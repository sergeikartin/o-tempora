# Generate and review the 30

Type: task (human-in-the-loop)
Status: open
Blocked by: 11

## What to build

Produce the first batch: the 30 entities in `06-sample-selection.md` (20 People, 4 Conflicts, 6 Milestones in five Legendary clusters). English only.

- [ ] The `profiles` script's plan lists exactly the 30 entities.
- [x] A `profile-writer` run per entity writes a draft Profile.
- [ ] A `profile-verifier` run per Profile writes its report beside it.
- [ ] The owner reads each report and the Profile, fixes or regenerates as needed, and promotes `draft` to `reviewed` (or `edited` after a manual change).
- [ ] Every Connection target the cluster relies on exists in the dataset, so hops can be judged.

## Comments

Tracker reconciliation (2026-11-15): `6f9d9b9` committed the sample: 20 People, 4 Conflicts and 6 Milestones. All 30 files still have `meta.review.status: draft`; there are no `*.verification.json` reports and no shipped Profile JSON files. Generation is complete; verification and owner review/promotion are outstanding. The exact-sample plan and cluster Connection checks above still need their acceptance evidence. Do not rerun writing or promote drafts as part of tracker cleanup.
