import type { OccupationDomain } from "@same-sky/shared-types";

// Pantheon `occupation` value (all-caps, as shipped in the CSV) -> app
// OccupationDomain. Mirrors Pantheon's own "Working in" filter grouping on
// pantheon.world/explore/rankings — verified to cover all 101 distinct
// non-empty occupation values in the 2025 Person Dataset with no gaps
// (.scratch/alt-data-sources/issues/12-occupation-taxonomy-mapping.md).
// Unlike the Wikidata-QID occupation table this replaces for People, this
// is a closed, fully-enumerated set (Pantheon has no long tail of
// unmapped values the way Wikidata occupation claims do) — no
// list-unmapped-* maintenance script needed.
export const OCCUPATION_DOMAIN_CATEGORIES: Record<string, OccupationDomain> = {
  // sports
  "SOCCER PLAYER": "sports",
  ATHLETE: "sports",
  "BASKETBALL PLAYER": "sports",
  CYCLIST: "sports",
  "TENNIS PLAYER": "sports",
  WRESTLER: "sports",
  SWIMMER: "sports",
  "RACING DRIVER": "sports",
  SKIER: "sports",
  "HOCKEY PLAYER": "sports",
  BOXER: "sports",
  "HANDBALL PLAYER": "sports",
  SKATER: "sports",
  GYMNAST: "sports",
  COACH: "sports",
  "CHESS PLAYER": "sports",
  FENCER: "sports",
  "VOLLEYBALL PLAYER": "sports",
  "MARTIAL ARTS": "sports",
  "BADMINTON PLAYER": "sports",
  CRICKETER: "sports",
  REFEREE: "sports",
  "RUGBY PLAYER": "sports",
  "BASEBALL PLAYER": "sports",
  "TABLE TENNIS PLAYER": "sports",
  GOLFER: "sports",
  "AMERICAN FOOTBALL PLAYER": "sports",
  SNOOKER: "sports",
  MOUNTAINEER: "sports",
  "POKER PLAYER": "sports",
  GAMER: "sports",
  "GO PLAYER": "sports",
  BULLFIGHTER: "sports",

  // institutions
  POLITICIAN: "institutions",
  "RELIGIOUS FIGURE": "institutions",
  "MILITARY PERSONNEL": "institutions",
  NOBLEMAN: "institutions",
  DIPLOMAT: "institutions",
  PILOT: "institutions",
  JUDGE: "institutions",
  "PUBLIC WORKER": "institutions",

  // arts
  ACTOR: "arts",
  SINGER: "arts",
  MUSICIAN: "arts",
  "FILM DIRECTOR": "arts",
  PAINTER: "arts",
  COMPOSER: "arts",
  ARCHITECT: "arts",
  SCULPTOR: "arts",
  "COMIC ARTIST": "arts",
  PHOTOGRAPHER: "arts",
  ARTIST: "arts",
  CONDUCTOR: "arts",
  DANCER: "arts",
  COMEDIAN: "arts",
  DESIGNER: "arts",
  "GAME DESIGNER": "arts",
  "FASHION DESIGNER": "arts",

  // humanities
  WRITER: "humanities",
  PHILOSOPHER: "humanities",
  HISTORIAN: "humanities",
  JOURNALIST: "humanities",
  LINGUIST: "humanities",
  CRITIC: "humanities",

  // science-technology
  BIOLOGIST: "science-technology",
  MATHEMATICIAN: "science-technology",
  PHYSICIST: "science-technology",
  PHYSICIAN: "science-technology",
  ASTRONOMER: "science-technology",
  CHEMIST: "science-technology",
  INVENTOR: "science-technology",
  ECONOMIST: "science-technology",
  ENGINEER: "science-technology",
  "COMPUTER SCIENTIST": "science-technology",
  PSYCHOLOGIST: "science-technology",
  ARCHAEOLOGIST: "science-technology",
  ANTHROPOLOGIST: "science-technology",
  GEOLOGIST: "science-technology",
  GEOGRAPHER: "science-technology",
  SOCIOLOGIST: "science-technology",
  "POLITICAL SCIENTIST": "science-technology",
  STATISTICIAN: "science-technology",

  // business-law
  BUSINESSPERSON: "business-law",
  LAWYER: "business-law",
  PRODUCER: "business-law",

  // public-figure
  "SOCIAL ACTIVIST": "public-figure",
  COMPANION: "public-figure",
  MODEL: "public-figure",
  CELEBRITY: "public-figure",
  EXTREMIST: "public-figure",
  "PORNOGRAPHIC ACTOR": "public-figure",
  PRESENTER: "public-figure",
  MAFIOSO: "public-figure",
  YOUTUBER: "public-figure",
  OCCULTIST: "public-figure",
  PIRATE: "public-figure",
  CHEF: "public-figure",
  MAGICIAN: "public-figure",
  INSPIRATION: "public-figure",

  // exploration
  ASTRONAUT: "exploration",
  EXPLORER: "exploration",
};
