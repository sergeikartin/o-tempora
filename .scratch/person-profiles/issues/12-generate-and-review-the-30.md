# Generate and review the 30

Type: task (human-in-the-loop)
Status: open
Blocked by: 11

## What to build

Produce the first batch: the 30 entities in `06-sample-selection.md` (20 People, 4 Conflicts, 6 Milestones in five Legendary clusters). English only.

- [ ] The `profiles` script's plan lists exactly the 30 entities.
- [ ] A `profile-writer` run per entity writes a draft Profile.
- [ ] A `profile-verifier` run per Profile writes its report beside it.
- [ ] The owner reads each report and the Profile, fixes or regenerates as needed, and promotes `draft` to `reviewed` (or `edited` after a manual change).
- [ ] Every Connection target the cluster relies on exists in the dataset, so hops can be judged.
