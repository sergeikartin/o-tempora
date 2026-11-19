import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { batchedCommonsImageAttributionFetch } from './batched-commons-image-attribution-fetch.js';
import { validateEnrichedConflictsFile } from './fetch-conflicts-enrichment.js';
import { validateEnrichedMilestonesFile } from './fetch-milestones-enrichment.js';
import { LANES, type Lane } from './lane.js';
import { filterByQids, type QidFilter, writeRecordFile } from './qid-filter.js';
import { validateSparqlResultShape } from './validate-sparql-result.js';

const RAW_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'data',
  'raw',
);

const ENTITY_URI_PATTERN = /\/entity\/(Q\d+)$/;

function extractQid(uri: string): string | undefined {
  return ENTITY_URI_PATTERN.exec(uri)?.[1];
}

interface ImageEntry {
  id: string;
  imageUri: string;
}

async function loadPeopleImageEntries(): Promise<ImageEntry[]> {
  const taglinesRaw = validateSparqlResultShape(
    JSON.parse(
      await fsPromises.readFile(
        path.join(RAW_DIR, 'people-taglines.raw.json'),
        'utf8',
      ),
    ),
  );
  return taglinesRaw.results.bindings
    .map((row) => {
      const personUri = row.person?.value;
      const imageUri = row.image?.value;
      const id = personUri ? extractQid(personUri) : undefined;
      return id && imageUri ? { id, imageUri } : undefined;
    })
    .filter((entry): entry is ImageEntry => entry !== undefined);
}

async function loadConflictsImageEntries(): Promise<ImageEntry[]> {
  const enrichedConflicts = validateEnrichedConflictsFile(
    JSON.parse(
      await fsPromises.readFile(
        path.join(RAW_DIR, 'conflicts-curated-enriched.raw.json'),
        'utf8',
      ),
    ),
  );
  return enrichedConflicts.conflicts
    .filter((conflict): conflict is typeof conflict & { image: string } =>
      Boolean(conflict.image),
    )
    .map((conflict) => ({ id: conflict.id, imageUri: conflict.image }));
}

async function loadMilestonesImageEntries(): Promise<ImageEntry[]> {
  const enrichedMilestones = validateEnrichedMilestonesFile(
    JSON.parse(
      await fsPromises.readFile(
        path.join(RAW_DIR, 'milestones-curated-enriched.raw.json'),
        'utf8',
      ),
    ),
  );
  return enrichedMilestones.milestones
    .filter((milestone): milestone is typeof milestone & { image: string } =>
      Boolean(milestone.image),
    )
    .map((milestone) => ({ id: milestone.id, imageUri: milestone.image }));
}

const LOAD_IMAGE_ENTRIES: Record<Lane, () => Promise<ImageEntry[]>> = {
  people: loadPeopleImageEntries,
  conflicts: loadConflictsImageEntries,
  milestones: loadMilestonesImageEntries,
};

export async function fetchImageAttribution(
  lane?: Lane,
  qids?: QidFilter,
): Promise<void> {
  const lanes = lane ? [lane] : LANES;
  await Promise.all(
    lanes.map(async (l) => {
      const entries = filterByQids(await LOAD_IMAGE_ENTRIES[l](), qids);
      if (qids && entries.length === 0) return;
      console.log(
        `Fetching Commons attribution for ${entries.length} ${l} images...`,
      );
      const attribution = await batchedCommonsImageAttributionFetch(entries);
      const outputPath = path.join(RAW_DIR, `${l}-image-attribution.raw.json`);
      await writeRecordFile(outputPath, attribution, qids);
      console.log(
        `Wrote ${attribution.size} ${l} attributions to ${outputPath}`,
      );
    }),
  );
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  fetchImageAttribution().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
