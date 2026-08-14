# 04 — Description: Russian Wikipedia extract, all three lanes

**What to build:** A parallel `ru.wikipedia.org` REST pass populates a Russian `description` across all three lanes' `.ru.json` files, alongside the existing English `en.wikipedia.org` pass, falling back to the English extract when no Russian article resolves.

**Blocked by:** 01

**Status:** done

**Status:** ready-for-agent

- [ ] The existing Wikipedia REST summary client (currently hardcoded to `en.wikipedia.org`) is made language-parametric and reused for a new `ru.wikipedia.org` pass, rather than duplicating the client.
- [ ] All three lanes' `.ru.json` files gain a Russian `description` value where a Russian Wikipedia article resolves, falling back to the already-fetched English `description` value otherwise (per-field fallback, same pattern as ticket 01).
- [ ] Pacing, retry, and best-effort skip-on-failure behavior for the new Russian pass follows the same conventions as the existing English pass (courtesy rate limit, no single failure aborting the run).
- [ ] Pipeline tests cover: Russian description present, Russian description missing (falls back to English extract), and the language-parametrized client's request shape.
