// Battles, sieges and treaties can be nested Conflict entries without becoming Conflict Categories.
export const CONFLICT_CATEGORIES = [
  'war',
  'military-operation',
  'revolution',
  'rebellion',
  'coup-d-etat',
  'war-of-independence',
] as const;

export type ConflictCategory = (typeof CONFLICT_CATEGORIES)[number];

// Milestones lane's taxonomy, taken verbatim from the hand-curated source's
// `meta.categories` (data-pipeline/data/raw/milestones-curated.raw.json).
// Disjoint from ConflictCategory, even where names might coincide.
export const MILESTONE_CATEGORIES = [
  'science-theory',
  'medicine-health',
  'public-health',
  'communication',
  'media-culture',
  'transportation',
  'infrastructure',
  'landmarks',
  'everyday-technology',
  'food-agriculture',
  'expedition',
  'energy-industry',
  'society-administration',
  'culture-arts',
  'religion-mythology',
  'environment-geology',
  'commerce-finance',
  'social-movements',
  'sports-entertainment',
  'philosophy-education',
  'law-jurisprudence',
  'archaeology-anthropology',
] as const;

export type MilestoneCategory = (typeof MILESTONE_CATEGORIES)[number];

// These groups drive the Milestones palette and the Filters Panel. See docs/adr/0002-milestone-category-group-conflicts-blanket-toggle.md.
export const MILESTONE_CATEGORY_GROUPS = [
  'science-innovation',
  'social-culture',
] as const;

export type MilestoneCategoryGroup = (typeof MILESTONE_CATEGORY_GROUPS)[number];

export const MILESTONE_CATEGORY_TO_GROUP: Record<
  MilestoneCategory,
  MilestoneCategoryGroup
> = {
  'science-theory': 'science-innovation',
  'medicine-health': 'science-innovation',
  communication: 'science-innovation',
  transportation: 'science-innovation',
  'everyday-technology': 'science-innovation',
  'food-agriculture': 'science-innovation',
  'energy-industry': 'science-innovation',

  'public-health': 'social-culture',
  'media-culture': 'social-culture',
  landmarks: 'social-culture',
  infrastructure: 'social-culture',
  expedition: 'social-culture',
  'society-administration': 'social-culture',
  'culture-arts': 'social-culture',
  'religion-mythology': 'social-culture',
  'environment-geology': 'social-culture',
  'commerce-finance': 'social-culture',
  'social-movements': 'social-culture',
  'sports-entertainment': 'social-culture',
  'philosophy-education': 'social-culture',
  'law-jurisprudence': 'social-culture',
  'archaeology-anthropology': 'social-culture',
};

// UN M49 subregions. Map historical polities to present-day territory, and tag
// People by the present-day location of their birth and death.
export const REGIONS = [
  'northern-europe',
  'southern-europe',
  'eastern-europe',
  'western-europe',
  'eastern-asia',
  'south-eastern-asia',
  'southern-asia',
  'central-asia',
  'western-asia',
  'northern-africa',
  'western-africa',
  'middle-africa',
  'eastern-africa',
  'southern-africa',
  'northern-america',
  'central-america',
  'caribbean',
  'south-america',
  'australia-and-new-zealand',
  'melanesia',
  'micronesia',
  'polynesia',
] as const;

export type Region = (typeof REGIONS)[number];

// Matches Pantheon’s occupation groupings.
export const OCCUPATION_DOMAINS = [
  'sports',
  'institutions',
  'arts',
  'humanities',
  'science-technology',
  'business-law',
  'public-figure',
  'exploration',
] as const;

export type OccupationDomain = (typeof OCCUPATION_DOMAINS)[number];

// Years use astronomical numbering (year 0 is 1 BCE). Omit the month unless the
// source supports month-or-finer precision, since January would imply a date.
export interface YearMonth {
  approximate?: true;
  year: number;
  month?: number;
}

// An absent end means the Period is ongoing and renders through the present.
export interface Period {
  start: YearMonth;
  end?: YearMonth;
}

export interface PointInTime {
  at: YearMonth;
}

// Keep the pipeline’s delta boundaries and the web switch in sync. Indices run
// from Legendary to Deep Cut. The floors target ratios of entity counts.
export const DETAIL_LEVEL_FAME_SCORE_FLOORS = {
  people: [91, 88, 84, 80],
  conflicts: [86, 82, 78, 64],
  milestones: [87, 82, 76, 55],
} as const;

type SearchEntry = Pick<
  Person,
  'id' | 'slug' | 'name' | 'tagline' | 'fameScore' | 'regionTags'
>;

export interface SearchIndex {
  people: (SearchEntry & Pick<Person, 'occupationDomain'>)[];
  conflicts: SearchEntry[];
  milestones: (SearchEntry & Pick<Milestone, 'category'>)[];
}

export interface TimelineEntry {
  id: string;
  // Derived from the English name at build time. Entity Links need one globally
  // unique slug across all lanes and locales.
  slug: string;
  name: string;
  fameScore: number;
  tagline: string;
  // Wikipedia lead paragraph in the dataset’s language. A missing Description
  // does not prevent the entity from shipping.
  description?: string;
  wikipediaUrl: string;
  // Store the original Wikidata P18 Commons URI so the frontend can request a suitable width.
  image?: string;
  // Set only when the Commons license requires the image to be credited.
  imageAttribution?: string;
  // Rows come from the full dataset, so filters, zoom and Detail Level never
  // reassign them. Shipped entries must have a finite row. Tests may omit it.
  row?: number;
  // A Profile is fetched only when the pipeline marks it as shipped for this locale.
  hasProfile?: true;
}

// Allow only bold runs so the panel can render markup as elements without injecting HTML.
export interface ProfileKeyMoment {
  date: string;
  title: string;
  text: string;
  sourceUrl?: string;
}

export interface ProfileDeepFact {
  text: string;
  isLegend: boolean;
  sourceUrl?: string;
}

export const PROFILE_LANES = ['people', 'conflicts', 'milestones'] as const;

export type ProfileLane = (typeof PROFILE_LANES)[number];

// Output resolves Connection targets against the dataset. detailLevel is the
// first Detail Level that shows the target (1 = Legendary, 4 = Deep Cut).
export interface ProfileConnection {
  slug: string;
  reason: string;
  name: string;
  lane: ProfileLane;
  detailLevel: 1 | 2 | 3 | 4;
}

// Connections are ordered by importance.
export interface Profile {
  overview: string;
  keyMoments: readonly ProfileKeyMoment[];
  deepFacts: readonly ProfileDeepFact[];
  connections: readonly ProfileConnection[];
}

// People use Pantheon HPI as their Fame Score.
export interface Person extends TimelineEntry {
  // Pantheon supplies one occupation per person.
  occupationDomain: OccupationDomain;
  // Birth and death locations can yield different Region tags.
  regionTags: Region[];
  // The end may be absent for a living person.
  lifespan: Period;
}

// Any Conflict Category can produce a period or a point. The date claims determine the shape.
export interface Conflict extends TimelineEntry {
  category: ConflictCategory;
  regionTags: Region[];
  period: Period;
  // Parents must be Conflicts. Output checks that nesting stays within three levels.
  parentId?: string;
}

export interface ConflictEvent extends TimelineEntry, PointInTime {
  category: ConflictCategory;
  regionTags: Region[];
  // A ConflictEvent can never contain another entry.
  parentId?: string;
}

export type ConflictEntry = Conflict | ConflictEvent;

// A Milestone’s category is curator-assigned. Its date claims determine whether
// it occupies a period or a point.
interface MilestonePeriod extends TimelineEntry {
  category: MilestoneCategory;
  regionTags: Region[];
  approximateDate?: true;
  period: Period;
}

interface MilestonePoint extends TimelineEntry, PointInTime {
  category: MilestoneCategory;
  regionTags: Region[];
  // The date is a scholarly estimate rather than a recorded one; the UI
  // prefixes it with "ca.".
  approximateDate?: true;
}

export type Milestone = MilestonePeriod | MilestonePoint;

// Use the year’s start when the month is unknown. The pipeline and web share
// this projection so packed rows match the rendered marks.
export function yearMonthToFractionalYear(yearMonth: YearMonth): number {
  if (yearMonth.month === undefined) return yearMonth.year;
  return yearMonth.year + (yearMonth.month - 1) / 12;
}

// Use the same rough width estimate for offline row packing and live rendering.
export const AVG_CHAR_WIDTH_PX = 6;
export const POINT_RADIUS = 5;
// A point mark's label starts this far right of its dot's center — clear of
// the selection ring web draws around a selected dot.
export const POINT_LABEL_OFFSET_PX = 13;
export const MARK_LABEL_WRAP_WIDTH_PX = 140;
export const MARK_LABEL_MAX_LINES = 2;

// The pipeline’s row packing and the Minimap share this scale so the curve
// reflects the assigned rows. It matches the default view at the fallback width.
export const REFERENCE_SCALE_PIXELS_PER_YEAR = 1000 / 120;

export function estimateLabelWidthPx(name: string): number {
  return name.length * AVG_CHAR_WIDTH_PX;
}

export function wrapLabelLines(name: string, maxWidthPx: number): string[] {
  const words = name.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (currentLine !== '' && estimateLabelWidthPx(candidate) > maxWidthPx) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }
  if (currentLine !== '') lines.push(currentLine);
  return lines;
}

export function wrapMarkLabelLines(name: string): string[] {
  const lines = wrapLabelLines(name, MARK_LABEL_WRAP_WIDTH_PX);
  if (lines.length <= MARK_LABEL_MAX_LINES) return lines;
  return [
    ...lines.slice(0, MARK_LABEL_MAX_LINES - 1),
    lines.slice(MARK_LABEL_MAX_LINES - 1).join(' '),
  ];
}
