# Landing Page Curiosities & Profiles Rollout Plan

## Goal

Replace the Landing Page’s date-overlap Curiosities with **7 unexpected, documented historical connections** (spanning People, Conflicts, and Milestones, including Deep Cuts) where every mark has a shipped bilingual Profile and every Curiosity links directly to a **Profile Anchor** (`#moment-<n>` or `#fact-<n>`) with a **Connection** to the paired entity.

---

## The 7 Curiosities

| # | Curiosity | Marks (`slug` / `QID` / Level) | Lead & Anchor Target | Shipped? |
|---|---|---|---|---|
| 1 | **Mary Shelley & Year Without a Summer** | `mary-shelley` (`Q47152`, L4) · `year-without-a-summer` (`Q209625`, L4, 1816) | `mary-shelley` → Villa Diodati / *Frankenstein* moment | Need both |
| 2 | **Vermeer & Leeuwenhoek** | `johannes-vermeer` (`Q41264`, L3) · `antonie-van-leeuwenhoek` (`Q43522`, L4) | `johannes-vermeer` → Delft / estate executor Deep Fact | Need both |
| 3 | **Einstein, Szilárd & the Refrigerator** | `albert-einstein` (L1, shipped) · `leo-szilard` (`Q153238`, L4) · `first-household-refrigerator` (`Q11692568`, L2, 1913) | `albert-einstein` → `#fact-1` (already shipped) | Need 2 (`leo-szilard`, `first-household-refrigerator`) |
| 4 | **Gregorian Calendar & October Revolution** | `gregorian-calendar` (L1, 1582, shipped) · `october-revolution` (`Q42976`, L2, Nov 1917) | `gregorian-calendar` → `#moment-4` (already shipped) | Need 1 (`october-revolution`) |
| 5 | **Gandhi & Tolstoy** | `mahatma-gandhi` (L1, shipped) · `leo-tolstoy` (`Q7243`, L2) | `leo-tolstoy` → Gandhi correspondence / Tolstoy Farm passage | Need 1 (`leo-tolstoy`) |
| 6 | **Charlemagne & Harun al-Rashid** | `charlemagne` (`Q3044`, L2) · `harun-al-rashid` (`Q131002`, L4) | `charlemagne` → Abul-Abbas white elephant Deep Fact | Need both |
| 7 | **Marie Curie, X-rays & World War I** | `marie-curie` (L1, shipped) · `discovery-of-x-rays` (`Q34777`, L2, Nov 1895) · `world-war-i` (`Q361`, L1) | `marie-curie` → `#fact-1` (already shipped) | Need 2 (`world-war-i`, `discovery-of-x-rays`) |

---

## Profile Production Batches (12 Missing Bilingual Profiles)

Workflow per batch (per `packages/data-pipeline/docs/profiles.md`):
1. `prepare --locale=en --qids=...` (sequential Wikipedia fetch)
2. Parallel `profile-writer` (`inherit`) → `validate` → parallel `profile-checker` (`inherit`) → max 1 `revise` + `recheck` → `promote --locale=en --harness=agy`
3. `prepare --locale=ru --qids=...`
4. Parallel `profile-translator` (`flash`) → `validate` → parallel `profile-translation-checker` (`flash`, using `--polish` for pure Russian phrasing fixes) → `promote --locale=ru --harness=agy`

### Batch 1 *(In progress — stopping after this batch for review)*
- `Q47152` — **Mary Shelley** (`mary-shelley`, L4): include 1816 Lake Geneva / Year Without a Summer moment + Connection to `Q209625`.
- `Q209625` — **Year Without a Summer** (`year-without-a-summer`, L4): include Tambora eruption, 1816 crisis, Villa Diodati / *Frankenstein* + Connection to `Q47152`.
- `Q41264` — **Johannes Vermeer** (`johannes-vermeer`, L3): include documented Delft / Leeuwenhoek estate-executor Deep Fact + Connection to `Q43522`.

### Batch 2 *(Next)*
- `Q43522` — **Antonie van Leeuwenhoek** (`antonie-van-leeuwenhoek`, L4): include Vermeer estate-executor link + Connection to `Q41264`.
- `Q153238` — **Leó Szilárd** (`leo-szilard`, L4): include Einstein–Szilárd refrigerator patent & 1939 letter + Connections to `Q937` (Einstein) & `Q11692568`.
- `Q11692568` — **First household refrigerator** (`first-household-refrigerator`, L2): include early domestic refrigeration / toxic refrigerants & Einstein–Szilárd safety design if well sourced + Connections to `Q937` / `Q153238`.

### Batch 3
- `Q42976` — **October Revolution** (`october-revolution`, L2): include Old Style / New Style calendar shift (25 Oct / 7 Nov) + Connection to `Q12138` (Gregorian calendar).
- `Q7243` — **Leo Tolstoy** (`leo-tolstoy`, L2): include 1909–1910 correspondence with Gandhi & Tolstoy Farm (anchor target!) + Connection to `Q1001` (Mahatma Gandhi).
- `Q3044` — **Charlemagne** (`charlemagne`, L2): include Harun al-Rashid’s 802 diplomatic gift of the elephant Abul-Abbas (anchor target!) + Connection to `Q131002`.

### Batch 4
- `Q131002` — **Harun al-Rashid** (`harun-al-rashid`, L4): include diplomatic exchange with Charlemagne / Abul-Abbas + Connection to `Q3044`.
- `Q361` — **World War I** (`world-war-i`, L1): include Connection to `Q7186` (Marie Curie) alongside core WWI connections.
- `Q34777` — **Discovery of X-rays** (`discovery-of-x-rays`, L2): include Röntgen’s 1895 discovery & wartime medical use + Connection to `Q7186` (Marie Curie) / `Q361`.

---

## Final Integration & Deploy Prep (After Batch 4)

1. **Build & publish dataset:**
   ```bash
   npm run build-data --workspace packages/data-pipeline
   npm run publish-data --workspace packages/data-pipeline
   ```
2. **Support Milestone point marks on the Landing Page:**
   - Extend `MarkKind` in [curiosities.ts](file:///home/sergei/projects/o-tempora/packages/web/src/app/landing/curiosities.ts) to include `'milestone'` (using `MILESTONE_GROUP_COLORS` and optional `end` for point-in-time marks).
   - Render point marks as dots below the axis in [CuriosityFigure.tsx](file:///home/sergei/projects/o-tempora/packages/web/src/app/landing/CuriosityFigure.tsx) and [LandingPage.module.css](file:///home/sergei/projects/o-tempora/packages/web/src/app/landing/LandingPage.module.css), matching the timeline’s line-vs-dot visual grammar.
3. **Update Curiosities, anchors & i18n copy:**
   - Replace the old `CURIOSITIES` list in [curiosities.ts](file:///home/sergei/projects/o-tempora/packages/web/src/app/landing/curiosities.ts) with the 7 new Curiosities, each pinned with `lead` + `anchor`.
   - Update `EXPECTED_ANCHOR_TARGETS` in [curiosities.test.ts](file:///home/sergei/projects/o-tempora/packages/web/src/app/landing/curiosities.test.ts).
   - Update English & Russian landing copy in [en.json](file:///home/sergei/projects/o-tempora/packages/web/messages/en.json) and [ru.json](file:///home/sergei/projects/o-tempora/packages/web/messages/ru.json) and verify Russian string fit on mobile/desktop.
4. **Verify:**
   - Run `npm run test`, `npm run typecheck`, `npm run lint` across workspaces.
   - Visually verify the updated Landing Page in both locales via `npm run shot --workspace packages/web`.
