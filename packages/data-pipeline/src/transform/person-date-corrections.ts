import type { PantheonPersonRow } from '../fetch/pantheon-row-shape.js';

// Evidence and calendar convention: docs/adr/0025-person-dates-can-have-evidenced-corrections.md.
export function correctPersonDates(row: PantheonPersonRow): PantheonPersonRow {
  if (row.wdId !== 'Q935') return row;

  // Newton's birth is Gregorian, but Pantheon's deathyear uses England's old
  // legal year. Check the source baseline so a new snapshot requires review.
  if (
    row.birthyear !== 1643 ||
    row.birthmonth !== 1 ||
    (row.deathyear !== 1726 && row.deathyear !== 1727) ||
    (row.deathmonth !== undefined && row.deathmonth !== 3)
  ) {
    throw new Error('Q935: Pantheon dates changed; review the date correction');
  }

  return { ...row, deathyear: 1727, deathmonth: 3 };
}
