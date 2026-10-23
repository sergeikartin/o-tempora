// The three top-level content tracks Fetch/Score/Tag/Output keep separate end to
// end (docs/adr/0001-wars-discoveries-people-separate-lanes.md): People,
// Conflicts, Milestones (docs/adr/0013-rename-lanes-to-conflicts-and-milestones.md).
// `--lane` selects one (docs/adr/0012-lane-scoped-fetch.md).
export const LANES = ["people", "conflicts", "milestones"] as const;
export type Lane = (typeof LANES)[number];

const LANE_FLAG_PATTERN = /^--lane=(.+)$/;

function isLane(value: string): value is Lane {
  return (LANES as readonly string[]).includes(value);
}

// Parses fetch/index.ts's `--lane=<value>` flag. Undefined means omitted: run
// all three lanes. Throws on an unrecognized value so a typo fails fast.
export function parseLaneFlag(argv: readonly string[]): Lane | undefined {
  for (const arg of argv) {
    const match = LANE_FLAG_PATTERN.exec(arg);
    if (!match?.[1]) continue;
    const value = match[1];
    if (!isLane(value)) {
      throw new Error(`Invalid --lane value "${value}" — expected one of: ${LANES.join(", ")}`);
    }
    return value;
  }
  return undefined;
}
