// Pantheon has no Tagline and supplies only an English article slug. Fetch these
// fields and the localized labels together for each candidate QID.
export function buildTaglinesQuery(personIds: string[]): string {
  const values = personIds.map((id) => `wd:${id}`).join(' ');
  return `
SELECT ?person ?nameEn ?nameRu ?tagline ?taglineRu ?image ?articleRu WHERE {
  VALUES ?person { ${values} }
  OPTIONAL { ?person rdfs:label ?nameEn . FILTER(LANG(?nameEn) = "en") }
  OPTIONAL { ?person rdfs:label ?nameRu . FILTER(LANG(?nameRu) = "ru") }
  OPTIONAL { ?person schema:description ?tagline . FILTER(LANG(?tagline) = "en") }
  OPTIONAL { ?person schema:description ?taglineRu . FILTER(LANG(?taglineRu) = "ru") }
  OPTIONAL { ?person wdt:P18 ?image . }
  OPTIONAL { ?articleRu schema:about ?person; schema:isPartOf <https://ru.wikipedia.org/>. }
}
`.trim();
}
