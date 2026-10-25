# Connection history and Detail Level raise

Type: task
Status: open
Blocked by: 13, 14

## What to build

Make Connections navigable (`spec.md`, Behaviour; prototype in `01-profile-panel-prototype.md`).

- [ ] Opening a Connection adds a history entry (push); mark clicks and Search keep today's rule.
- [ ] A target below the current Detail Level is listed with the Detail Level pips and "Appears at <level>"; opening it raises the Detail Level and pans to it, as an Entity Link does.
- [ ] Filters never gate a Connection.
- [ ] A target not in the dataset is not listed.
- [ ] Back after a hop returns to the previous entity's panel.
- [ ] Tests cover push-per-hop, raise on below-level targets, and unfiltered listing; `web` typecheck, lint and tests pass.
