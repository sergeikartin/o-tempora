export const LANES = ['people', 'conflicts', 'milestones'] as const;
export type Lane = (typeof LANES)[number];

const LANE_FLAG_PATTERN = /^--lane=(.+)$/;

function isLane(value: string): value is Lane {
  return (LANES as readonly string[]).includes(value);
}

export function parseLaneFlag(argv: readonly string[]): Lane | undefined {
  for (const arg of argv) {
    const match = LANE_FLAG_PATTERN.exec(arg);
    if (!match?.[1]) continue;
    const value = match[1];
    if (!isLane(value)) {
      throw new Error(
        `Invalid --lane value "${value}" — expected one of: ${LANES.join(', ')}`,
      );
    }
    return value;
  }
  return undefined;
}
