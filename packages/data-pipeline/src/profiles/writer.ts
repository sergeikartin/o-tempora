import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseModelProfile } from './model-profile.js';
import type { PlanEntry } from './plan.js';
import { renderPrompt } from './prompt.js';
import type { Complete, Provider } from './providers.js';
import { SUBJECT_TYPE } from './subjects.js';

export type WriteEntry = Extract<PlanEntry, { kind: 'write' }>;

export interface WriteOptions {
  entries: readonly WriteEntry[];
  promptMarkdown: string;
  complete: Complete;
  provider: Provider;
  concurrency: number;
}

export interface WriteResult {
  written: string[];
  failed: { qid: string; error: string }[];
}

// The JSON object in a model reply, tolerating a code fence or a line of
// preamble around it.
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end < start) throw new Error('reply has no JSON object');
  return JSON.parse(text.slice(start, end + 1));
}

async function writeEntry(
  entry: WriteEntry,
  options: WriteOptions,
): Promise<string> {
  const { subject } = entry;
  const prompt = renderPrompt(options.promptMarkdown, {
    type: SUBJECT_TYPE[subject.lane],
    name: subject.name,
    dates: subject.dates,
    wikipediaUrl: subject.wikipediaUrl,
  });
  const completion = await options.complete(prompt);
  const json = extractJson(completion.text);
  parseModelProfile(json, subject.qid);

  // `writer` rides along in the staged file so finalize can record the model
  // and token counts; the agents' files simply lack it.
  const staged = {
    ...(json as object),
    writer: {
      provider: options.provider,
      model: completion.model,
      tokens: completion.tokens,
    },
  };
  await mkdir(path.dirname(entry.outputPath), { recursive: true });
  await writeFile(entry.outputPath, `${JSON.stringify(staged, null, 2)}\n`);
  return entry.outputPath;
}

// Asks the model for each planned Profile and stages the validated reply at
// the entry's output path, the same place a profile-writer agent leaves its
// file. One failing entity is reported without stopping the others.
export async function writeProfiles(
  options: WriteOptions,
): Promise<WriteResult> {
  const result: WriteResult = { written: [], failed: [] };
  const queue = [...options.entries];

  async function worker(): Promise<void> {
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      try {
        result.written.push(await writeEntry(entry, options));
      } catch (error) {
        result.failed.push({
          qid: entry.subject.qid,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, options.concurrency) }, worker),
  );
  result.written.sort();
  result.failed.sort((a, b) => a.qid.localeCompare(b.qid));
  return result;
}
