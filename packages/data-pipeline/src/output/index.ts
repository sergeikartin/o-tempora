import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DETAIL_LEVEL_FAME_SCORE_FLOORS } from "@o-tempora/shared-types";
import { transformPeople, transformConflicts, transformMilestones } from "../transform/index.js";
import { assignConflictsMilestonesRows, assignPersonRows } from "./row-assignment.js";
import { assignSlugs } from "./slugs.js";
import {
  buildPeople,
  buildConflicts,
  buildMilestones,
  splitByDetailLevel,
  type DropReport,
} from "./write-datasets.js";

// The pipeline owns its own output — generating a dataset is a separate,
// inspectable step from publishing it for consumers to read. `publish.ts`
// copies this directory's contents into packages/shared-types/src/data/.
const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "output");

function logReport(label: string, kept: number, report: DropReport): void {
  console.log(`${label}: kept ${kept}, dropped ${report.dropped}`);
  for (const [reason, count] of Object.entries(report.reasons)) {
    console.log(`    ${reason}: ${count}`);
  }
}

async function writeDataset(fileName: string, data: unknown): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path.join(DATA_DIR, fileName), JSON.stringify(data, null, 2));
}

// Attaches each entity's slug (slugs.ts) — computed once off the English
// build and applied to both language builds by id, since the slug is the same
// in both locales.
function withSlugs<T extends { id: string }>(entries: T[], slugOf: ReadonlyMap<string, string>): (T & { slug: string })[] {
  return entries.map((entry) => ({ ...entry, slug: slugOf.get(entry.id) ?? entry.id }));
}

// Attaches each entry's permanent Row Depth identity (TimelineEntry.row,
// docs/adr/0005-row-assignment-moves-to-the-pipeline.md) — row assignment is
// language-independent (same ids/dates/fame regardless of `lang`, per
// write-datasets.ts's Lang doc comment), so `rowOf` is computed once, off
// both builds' label widths, and applied to both language builds by id here.
function withRows<T extends { id: string }>(entries: T[], rowOf: ReadonlyMap<string, number>): (T & { row: number })[] {
  return entries.map((entry) => ({ ...entry, row: rowOf.get(entry.id) ?? 0 }));
}

// Writes a lane's 4 Detail Level delta files (`<lane>.detail1.json` ..
// `<lane>.detail4.json`, `.ru` variants included via `fileNameFor`) — see
// write-datasets.ts's splitByDetailLevel and docs/adr/0006-detail-level-
// merges-data-depth-and-payload-tier.md.
async function writeDetailLevelDataset<T extends { fameScore: number }>(
  fileNameFor: (level: 1 | 2 | 3 | 4) => string,
  entries: T[],
  levelFloors: readonly [number, number, number, number],
): Promise<void> {
  const { detail1, detail2, detail3, detail4 } = splitByDetailLevel(entries, levelFloors);
  await writeDataset(fileNameFor(1), detail1);
  await writeDataset(fileNameFor(2), detail2);
  await writeDataset(fileNameFor(3), detail3);
  await writeDataset(fileNameFor(4), detail4);
  console.log(
    `  -> ${fileNameFor(1)}: ${detail1.length}, ${fileNameFor(2)}: ${detail2.length}, ` +
      `${fileNameFor(3)}: ${detail3.length}, ${fileNameFor(4)}: ${detail4.length}`,
  );
}

async function main(): Promise<void> {
  // Every lane is built in both languages first: slugs are unique across
  // lanes, so they can only be assigned once all three are built. Both
  // language builds resolve from the same rows and decide inclusion off
  // English fields regardless of `lang` (write-datasets.ts's Lang doc
  // comment), which is what keeps the two files' entity sets identical.
  const peopleRows = transformPeople();
  const { people: peopleEn, report: peopleReport } = buildPeople(peopleRows, "en");
  logReport("people.json", peopleEn.length, peopleReport);
  const { people: peopleRuBuilt, report: peopleRuReport } = buildPeople(peopleRows, "ru");
  logReport("people.ru.json", peopleRuBuilt.length, peopleRuReport);

  const conflictRows = transformConflicts();
  const { entries: conflictsEn, report: conflictsReport } = buildConflicts(conflictRows, "en");
  logReport("conflicts.json", conflictsEn.length, conflictsReport);
  const { entries: conflictsRuBuilt, report: conflictsRuReport } = buildConflicts(conflictRows, "ru");
  logReport("conflicts.ru.json", conflictsRuBuilt.length, conflictsRuReport);

  const milestoneRows = transformMilestones();
  const { milestones: milestonesEn, report: milestonesReport } = buildMilestones(milestoneRows, "en");
  logReport("milestones.json", milestonesEn.length, milestonesReport);
  const { milestones: milestonesRuBuilt, report: milestonesRuReport } = buildMilestones(milestoneRows, "ru");
  logReport("milestones.ru.json", milestonesRuBuilt.length, milestonesRuReport);

  const slugOf = assignSlugs([...peopleEn, ...conflictsEn, ...milestonesEn]);
  const people = withSlugs(peopleEn, slugOf);
  const peopleRu = withSlugs(peopleRuBuilt, slugOf);
  const conflicts = withSlugs(conflictsEn, slugOf);
  const conflictsRu = withSlugs(conflictsRuBuilt, slugOf);
  const milestones = withSlugs(milestonesEn, slugOf);
  const milestonesRu = withSlugs(milestonesRuBuilt, slugOf);

  const personRowOf = assignPersonRows(people, peopleRu);
  const peopleWithRows = withRows(people, personRowOf);
  const peopleRuWithRows = withRows(peopleRu, personRowOf);
  await writeDetailLevelDataset(
    (level) => `people.detail${level}.json`,
    peopleWithRows,
    DETAIL_LEVEL_FAME_SCORE_FLOORS.people,
  );
  await writeDetailLevelDataset(
    (level) => `people.detail${level}.ru.json`,
    peopleRuWithRows,
    DETAIL_LEVEL_FAME_SCORE_FLOORS.people,
  );

  // Conflicts and Milestones share one row-packing pass (row-assignment.ts),
  // so their rows are computed together off both language builds (a label's
  // footprint is its widest rendering), then applied to both by id, same as
  // People above.
  const eventsRowOf = assignConflictsMilestonesRows(conflicts, milestones, conflictsRu, milestonesRu);
  const conflictsWithRows = withRows(conflicts, eventsRowOf);
  const conflictsRuWithRows = withRows(conflictsRu, eventsRowOf);
  const milestonesWithRows = withRows(milestones, eventsRowOf);
  const milestonesRuWithRows = withRows(milestonesRu, eventsRowOf);

  await writeDetailLevelDataset(
    (level) => `conflicts.detail${level}.json`,
    conflictsWithRows,
    DETAIL_LEVEL_FAME_SCORE_FLOORS.conflicts,
  );
  await writeDetailLevelDataset(
    (level) => `conflicts.detail${level}.ru.json`,
    conflictsRuWithRows,
    DETAIL_LEVEL_FAME_SCORE_FLOORS.conflicts,
  );
  await writeDetailLevelDataset(
    (level) => `milestones.detail${level}.json`,
    milestonesWithRows,
    DETAIL_LEVEL_FAME_SCORE_FLOORS.milestones,
  );
  await writeDetailLevelDataset(
    (level) => `milestones.detail${level}.ru.json`,
    milestonesRuWithRows,
    DETAIL_LEVEL_FAME_SCORE_FLOORS.milestones,
  );

  console.log(`Wrote Detail Level delta files for people, conflicts, and milestones (en + ru) to ${DATA_DIR}`);
  console.log("Run `npm run publish-data --workspace packages/data-pipeline` to publish to packages/shared-types.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
