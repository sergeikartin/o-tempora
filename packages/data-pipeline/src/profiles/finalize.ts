import { readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { slugify } from '../output/slugs.js';
import {
  extractAssessedProfile,
  finalizedAssessment,
} from './assessed-profile.js';
import { PROFILE_SCHEMA_VERSION } from './model-profile.js';
import { readStoredProfiles, writeJson } from './store.js';
import { type ProfileSubject, SUBJECT_TYPE } from './subjects.js';
import { parseTokenUsage, type TokenUsage } from './usage.js';
import { asRecord, asString } from './values.js';
import { profileHash } from './verification/policy.js';
import type { ResolveArticleQids } from './wikipedia-qids.js';

interface WriterRun {
  model: string;
  reasoningEffort: string | null;
  tokens: TokenUsage | null;
}

function parseWriterRun(root: unknown): WriterRun | undefined {
  const writer = asRecord(root, 'staged file').writer;
  if (writer === undefined) return undefined;
  const run = asRecord(writer, 'writer');
  return {
    model: asString(run.model, 'writer.model'),
    reasoningEffort:
      run.reasoning_effort == null
        ? null
        : asString(run.reasoning_effort, 'writer.reasoning_effort'),
    tokens: parseTokenUsage(run.tokens),
  };
}

export interface FinalizeOptions {
  incomingDir: string;
  profilesDir: string;
  // Every entity in the dataset: the subject a file is checked against, and
  // the set a Connection has to land in.
  subjects: readonly ProfileSubject[];
  model: string;
  runId: string;
  qids?: ReadonlySet<string>;
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
  const staged = asRecord(
    JSON.parse(await readFile(stagingPath, 'utf8')),
    fileName,
  );
  const { profile, assessment } = extractAssessedProfile(staged);
  const writer = parseWriterRun(staged);
  const generation = asRecord(staged, fileName).generation;
  let provenance:
    | { prompt_version: string; prompt_hash: string; generated_at: string }
    | undefined;
  if (generation !== undefined) {
    const fields = asRecord(generation, 'generation');
    provenance = {
      prompt_version: asString(
        fields.prompt_version,
        'generation.prompt_version',
      ),
      prompt_hash: asString(fields.prompt_hash, 'generation.prompt_hash'),
      generated_at: asString(fields.generated_at, 'generation.generated_at'),
    };
    if (
      !/^[a-f0-9]{12}$/.test(provenance.prompt_hash) ||
      !Number.isFinite(Date.parse(provenance.generated_at))
    ) {
      throw new Error('generation: invalid prompt hash or timestamp');
    }
  }
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
  const seen = new Set([qid]);
  const keptIndices: number[] = [];
  const connections = profile.connections.flatMap((connection, index) => {
    const target = resolved.get(connection.wikipedia_url);
    const lane = target && laneOfQid.get(target);
    if (!target || !lane || seen.has(target)) return [];
    seen.add(target);
    keptIndices.push(index);
    return [{ ...connection, qid: target, lane }];
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
      generated_at: provenance?.generated_at ?? null,
      prompt_version: provenance?.prompt_version ?? null,
      prompt_hash: provenance?.prompt_hash ?? null,
      schema_version: PROFILE_SCHEMA_VERSION,
      model: writer?.model ?? options.model,
      reasoning_effort: writer?.reasoningEffort ?? null,
      temperature: null,
      run_id: options.runId,
      locale: 'en',
      source: { wikidata_qid: subjectQid },
      tokens: writer?.tokens ?? null,
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
  const pending = {
    profile_hash: profileHash(record),
    assessment: finalizedAssessment(assessment, record, undefined, keptIndices),
    model: record.meta.model,
  };
  await writeJson(recordPath, {
    ...record,
    meta: { ...record.meta, pending_assessment: pending },
  });
  await rm(stagingPath);
  return { outcome: 'written', recordPath };
}

// Finalize staged Profiles as drafts. Keep staged files for protected edits
// and validation failures so the coordinator can inspect them.
export async function finalizeProfiles(
  options: FinalizeOptions,
): Promise<FinalizeResult> {
  let fileNames: string[];
  try {
    fileNames = (await readdir(options.incomingDir))
      .filter((name) =>
        options.qids
          ? options.qids.has(INCOMING_FILE.exec(name)?.[1] ?? '')
          : name.endsWith('.json'),
      )
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
