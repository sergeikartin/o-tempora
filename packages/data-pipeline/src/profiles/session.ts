import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Complete, Completion } from './providers.js';
import { parseTokenUsage } from './usage.js';
import { asRecord, asString } from './values.js';
import { hash, parseAssessment, passages } from './verification/policy.js';
import {
  RESEARCH_INSTRUCTIONS,
  type Research,
} from './verification/researcher.js';
import type { SourceStore } from './verification/sources.js';

async function atomicJson(file: string, value: unknown): Promise<void> {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, file);
}

async function readJson(file: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

export interface SessionOptions {
  directory: string;
  log?: (message: string) => void;
  timeoutMs?: number;
  pollMs?: number;
}

// The conversation owns agent dispatch. This bridge only exchanges requests
// and validated replies; it never starts another agent runtime or API client.
export class SessionBridge {
  constructor(private readonly options: SessionOptions) {}

  readonly complete: Complete = async (prompt, role = 'write') =>
    this.request(role, { prompt });

  readonly research: Research = async (profile, subject, sources) => {
    const response = await this.request(
      'research',
      {
        instructions: RESEARCH_INSTRUCTIONS,
        profile,
        subject,
        passages: passages(profile),
      },
      sources,
    );
    return {
      assessment: parseAssessment(JSON.parse(response.text)),
      model: response.model,
    };
  };

  private async request(
    role: string,
    payload: unknown,
    sources?: SourceStore,
  ): Promise<Completion> {
    const directory = path.resolve(this.options.directory, randomUUID());
    const sourceDirectory = path.join(directory, 'sources');
    await mkdir(sourceDirectory, { recursive: true });
    const request = { id: path.basename(directory), role, payload };
    const requestHash = hash(request);
    await atomicJson(path.join(directory, 'request.json'), {
      ...request,
      request_hash: requestHash,
    });
    this.options.log?.(
      `session ${role}: ${path.join(directory, 'request.json')}`,
    );
    const deadline = Date.now() + (this.options.timeoutMs ?? 30 * 60_000);
    const handled = new Set<string>();
    let reads = 0;
    try {
      while (Date.now() < deadline) {
        if (sources) {
          for (const name of (await readdir(sourceDirectory)).sort()) {
            if (!name.endsWith('.request.json') || handled.has(name)) continue;
            handled.add(name);
            let response: unknown;
            try {
              if (++reads > 24) throw new Error('Source-read budget exhausted');
              const input = asRecord(
                await readJson(path.join(sourceDirectory, name)),
                'source request',
              );
              const source = await sources.readExcerpt(input);
              response = { source };
            } catch (error) {
              response = {
                error: error instanceof Error ? error.message : String(error),
              };
            }
            await atomicJson(
              path.join(
                sourceDirectory,
                name.replace(/\.request\.json$/, '.response.json'),
              ),
              response,
            );
          }
        }
        const reply = await readJson(path.join(directory, 'response.json'));
        if (reply !== undefined) {
          const value = asRecord(reply, 'session response');
          if (value.request_hash !== requestHash)
            throw new Error('Session response belongs to another request');
          if (value.error !== undefined)
            throw new Error(asString(value.error, 'session error'));
          const result = asRecord(value.result, 'session result');
          if (value.model === null)
            this.options.log?.(
              `session ${role}: model unreported; capture the agent's actual model identifier from runtime metadata (${path.join(directory, 'request.json')})`,
            );
          const completion = {
            text: JSON.stringify(result),
            model:
              value.model === null
                ? 'session-agent (model unreported)'
                : asString(value.model, 'session model'),
            reasoningEffort:
              value.reasoning_effort == null
                ? null
                : asString(value.reasoning_effort, 'session reasoning effort'),
            tokens: parseTokenUsage(value.tokens),
          };
          await atomicJson(path.join(directory, 'status.json'), {
            status: 'completed',
          });
          return completion;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, this.options.pollMs ?? 250),
        );
      }
      throw new Error(
        'Session request timed out; rerun the command with an active conversation',
      );
    } catch (error) {
      await atomicJson(path.join(directory, 'status.json'), {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
