# Shipped Profile data shape

Type: grilling
Status: open
Blocked by: 01

## Question

What does `shared-types` ship and how does `web` load it? Cover: Profile fields in `shared-types` and what is dropped from the raw JSON (meta, categories, unmatched Connections); whether Profiles ride inside the `detail<N>` delta files or load lazily per entity or per level (payload size at about 513 entities versus 30); how a Connection is stored (target id/slug resolved at Output) so web needs no matching; locale files and Field Fallback; and how `**bold**` is rendered safely.
