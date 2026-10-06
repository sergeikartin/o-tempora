import fsPromises from "node:fs/promises";

// A set of Wikidata QIDs a run is scoped to; undefined means "every entity".
export type QidFilter = ReadonlySet<string> | undefined;

const QID_FLAG_PATTERN = /^--qids=(.*)$/;
const QID_PATTERN = /^Q\d+$/;

// Parses fetch/index.ts's `--qids=Q1,Q2,...` CLI flag. Throws on a malformed
// QID so a typo fails fast rather than silently matching nothing.
export function parseQidsFlag(argv: readonly string[]): QidFilter {
  for (const arg of argv) {
    const match = QID_FLAG_PATTERN.exec(arg);
    if (!match) continue;
    const qids = (match[1] ?? "").split(",").map((qid) => qid.trim()).filter(Boolean);
    const invalid = qids.find((qid) => !QID_PATTERN.test(qid));
    if (invalid) throw new Error(`Invalid --qids value "${invalid}" — expected comma-separated QIDs like Q42`);
    if (qids.length === 0) throw new Error("--qids needs at least one QID");
    return new Set(qids);
  }
  return undefined;
}

export function filterByQids<T extends { id: string }>(entries: readonly T[], qids: QidFilter): T[] {
  return qids ? entries.filter((entry) => qids.has(entry.id)) : [...entries];
}

async function readJsonIfExists(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await fsPromises.readFile(filePath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

// Writes a per-id record file. Under a QID filter, the existing file is kept
// and only the filtered ids are replaced (or removed, when the fresh pass
// resolved nothing for them); otherwise the file is overwritten wholesale.
export async function writeRecordFile<V>(filePath: string, fresh: ReadonlyMap<string, V>, qids: QidFilter): Promise<void> {
  const merged: Record<string, V> = {};
  if (qids) {
    const existing = (await readJsonIfExists(filePath)) as Record<string, V> | undefined;
    for (const [id, value] of Object.entries(existing ?? {})) {
      if (!qids.has(id)) merged[id] = value;
    }
  }
  for (const [id, value] of fresh) merged[id] = value;
  await fsPromises.writeFile(filePath, JSON.stringify(merged, null, 2));
}

// Merges freshly enriched entries into the existing enriched list, keeping the
// curated list's order. Without a filter, `fresh` is already the full list.
export async function mergeEnriched<T extends { id: string }>(
  filePath: string,
  key: string,
  curatedIds: readonly string[],
  fresh: readonly T[],
  qids: QidFilter,
): Promise<T[]> {
  if (!qids) return [...fresh];
  const existing = ((await readJsonIfExists(filePath)) as Record<string, T[]> | undefined)?.[key] ?? [];
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  for (const entry of fresh) byId.set(entry.id, entry);
  return curatedIds.flatMap((id) => byId.get(id) ?? []);
}
