import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { slugify } from '../output/slugs.js';
import { parseModelProfile } from './model-profile.js';
import type { PromptInfo } from './prompt.js';
import { readStoredProfiles } from './store.js';
import { type ProfileSubject, SUBJECT_TYPE } from './subjects.js';
import type { ResolveArticleQids } from './wikipedia-qids.js';

// The JSON shape `meta` takes (prompts/profile.md, "Meta"). `temperature` and
// `tokens` stay null: a subagent does not expose them.
const SCHEMA_VERSION = 3;

export interface FinalizeOptions {
  incomingDir: string;
  profilesDir: string;
  // Every entity in the dataset: the subject a file is checked against, and
  // the set a Connection has to land in.
  subjects: readonly ProfileSubject[];
  prompt: PromptInfo;
  model: string;
  runId: string;
  now: Date;
  resolveArticleQids: ResolveArticleQids;
}

export interface FinalizeResult {
  written: string[];
  // Left in the staging folder: an `edited` record is never overwritten.
  skippedEdited: string[];
  // Left in the staging folder for the writer to redo.
  failed: { file: string; error: string }[];
}

const INCOMING_FILE = /^(Q\d+)\.json$/;

async function finalizeFile(
  fileName: string,
  options: FinalizeOptions,
  stored: Awaited<ReturnType<typeof readStoredProfiles>>,
): Promise<{ outcome: 'written' | 'edited'; recordPath: string }> {
  const qid = INCOMING_FILE.exec(fileName)?.[1];
  if (!qid) throw new Error('expected a file named <QID>.json');
  const subject = options.subjects.find((s) => s.qid === qid);
  if (!subject) throw new Error(`${qid} is not an entity in the dataset`);

  const existing = stored.get(qid);
  if (existing?.status === 'edited') {
    return { outcome: 'edited', recordPath: existing.filePath };
  }

  const stagingPath = path.join(options.incomingDir, fileName);
  const profile = parseModelProfile(
    JSON.parse(await readFile(stagingPath, 'utf8')),
    fileName,
  );
  if (profile.type !== SUBJECT_TYPE[subject.lane]) {
    throw new Error(
      `type is "${profile.type}", expected "${SUBJECT_TYPE[subject.lane]}"`,
    );
  }

  const resolved = await options.resolveArticleQids([
    profile.wikipedia_url,
    ...profile.connections.map((c) => c.wikipedia_url),
  ]);
  const subjectQid = resolved.get(profile.wikipedia_url);
  if (subjectQid !== qid) {
    throw new Error(
      `wikipedia_url resolves to ${subjectQid ?? 'no Wikidata item'}, expected ${qid}`,
    );
  }

  const laneOfQid = new Map(options.subjects.map((s) => [s.qid, s.lane]));
  const connections = profile.connections.flatMap((connection) => {
    const target = resolved.get(connection.wikipedia_url);
    const lane = target && laneOfQid.get(target);
    return target && lane ? [{ ...connection, qid: target, lane }] : [];
  });
  const unresolved = profile.connections.filter(
    (c) => !resolved.has(c.wikipedia_url),
  ).length;

  const record = {
    ...profile,
    connections: connections.map(
      ({ lane: _lane, ...connection }) => connection,
    ),
    meta: {
      generated_at: options.now.toISOString(),
      prompt_version: options.prompt.version,
      prompt_hash: options.prompt.hash,
      schema_version: SCHEMA_VERSION,
      model: options.model,
      temperature: null,
      run_id: options.runId,
      locale: 'en',
      source: { wikidata_qid: subjectQid },
      tokens: null,
      validation: {
        schema_valid: true,
        connections_returned: profile.connections.length,
        connections_matched_people: connections.filter(
          (c) => c.lane === 'people',
        ).length,
        connections_matched_events: connections.filter(
          (c) => c.lane !== 'people',
        ).length,
        connections_unresolved: unresolved,
      },
      review: { status: 'draft', reviewed_at: null },
    },
  };

  // The file name is frozen when the record is first created.
  const recordPath =
    existing?.filePath ??
    path.join(
      options.profilesDir,
      subject.lane,
      `${qid}-${slugify(subject.name)}.en.json`,
    );
  await mkdir(path.dirname(recordPath), { recursive: true });
  await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`);
  await rm(stagingPath);
  return { outcome: 'written', recordPath };
}

// Turns each `incoming/<QID>.json` the writer agents left into a committed
// record at `draft`. A regenerated record replaces its old file and so
// returns to `draft`; an `edited` one is never touched. A file that fails
// validation is reported and left in place without stopping the others.
export async function finalizeProfiles(
  options: FinalizeOptions,
): Promise<FinalizeResult> {
  let fileNames: string[];
  try {
    fileNames = (await readdir(options.incomingDir))
      .filter((name) => name.endsWith('.json'))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    fileNames = [];
  }
  const stored = await readStoredProfiles(options.profilesDir);

  const result: FinalizeResult = { written: [], skippedEdited: [], failed: [] };
  for (const fileName of fileNames) {
    try {
      const { outcome, recordPath } = await finalizeFile(
        fileName,
        options,
        stored,
      );
      if (outcome === 'written') result.written.push(recordPath);
      else result.skippedEdited.push(recordPath);
    } catch (error) {
      result.failed.push({ file: fileName, error: (error as Error).message });
    }
  }
  return result;
}
