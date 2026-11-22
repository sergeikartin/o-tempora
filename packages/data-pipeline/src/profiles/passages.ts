interface ProfileText {
  overview: string;
  key_moments: readonly { date: string; title: string; text: string }[];
  deep_facts: readonly { text: string }[];
  connections: readonly { connection: string }[];
}

interface Passage {
  path: string;
  text: string;
}

// Saved verification and translation records use these paths. Copy each
// entry so callers can replace prose while preserving the English structure.
export function mapPassages<Profile extends ProfileText>(
  profile: Profile,
  map: (path: string, text: string) => string,
): Profile {
  return {
    ...profile,
    overview: map('overview', profile.overview),
    key_moments: profile.key_moments.map((moment, index) => ({
      ...moment,
      date: map(`key_moments.${index}.date`, moment.date),
      title: map(`key_moments.${index}.title`, moment.title),
      text: map(`key_moments.${index}.text`, moment.text),
    })),
    deep_facts: profile.deep_facts.map((fact, index) => ({
      ...fact,
      text: map(`deep_facts.${index}.text`, fact.text),
    })),
    connections: profile.connections.map((entry, index) => ({
      ...entry,
      connection: map(`connections.${index}.connection`, entry.connection),
    })),
  };
}

export function passages(profile: ProfileText): Passage[] {
  const result: Passage[] = [];
  mapPassages(profile, (path, text) => {
    result.push({ path, text });
    return text;
  });
  return result;
}
