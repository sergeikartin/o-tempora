interface Sluggable {
  id: string;
  name: string;
  fameScore: number;
}

// Lowercase ASCII words joined by hyphens: diacritics folded away ("Brontë"
// → "bronte"), everything else that isn't a letter or digit treated as a
// separator.
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// One slug per entity across every lane (an Entity Link carries the slug
// alone, so it must be unique globally), derived from the English name so it
// is identical in both locales. Of the entities sharing a name, the most
// famous keeps the plain slug (ties broken by id); the rest get their id
// appended, which stays stable as unrelated entities come and go. A name
// with no ASCII letters or digits falls back to the id.
export function assignSlugs(
  entities: readonly Sluggable[],
): Map<string, string> {
  const byBaseSlug = new Map<string, Sluggable[]>();
  for (const entity of entities) {
    const base = slugify(entity.name) || slugify(entity.id);
    const group = byBaseSlug.get(base);
    if (group) group.push(entity);
    else byBaseSlug.set(base, [entity]);
  }

  const slugOf = new Map<string, string>();
  const taken = new Set<string>();
  for (const [base, group] of byBaseSlug) {
    group.sort((a, b) => b.fameScore - a.fameScore || a.id.localeCompare(b.id));
    group.forEach((entity, index) => {
      let slug = index === 0 ? base : `${base}-${slugify(entity.id)}`;
      // A suffixed slug can still collide with another entity's own base
      // slug; keep extending with the id until it is free.
      while (taken.has(slug)) slug = `${slug}-${slugify(entity.id)}`;
      taken.add(slug);
      slugOf.set(entity.id, slug);
    });
  }
  return slugOf;
}
