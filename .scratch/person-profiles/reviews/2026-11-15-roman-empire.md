# Founding of the Roman Empire — manual source audit

Date: 2026-11-15. Outcome: **held for chronology, framing and corroboration**.

Reviewed: `packages/data-pipeline/data/raw/profiles/milestones/Q2277-founding-of-the-roman-empire.en.json`.
SHA-256: `f0fc109a7bc5a86a665ca64f2e4d702491884d565a8cc98aef61568b7e688307`.

This is a manual research note, not a verifier report or publication approval. No raw prose or review metadata was changed. Every visible passage was inspected; support below is limited to the specified claims. Live URL/QID resolution, evidence snapshots/hashes and a separate coverage audit remain pending.

## Corrections to make

1. `key_moments.0.text`, “civil war ended at sea”; `connections.1.connection`, “left Octavian without a serious rival”: **contradicted chronology / premature conclusion**. Actium was in 31 BC; Antony remained alive and campaigning continued until Egypt’s conquest in 30. Prefer: “Octavian won a decisive naval victory at Actium in 31 BC. The war ended the following year after his invasion of Egypt and the deaths of Antony and Cleopatra.” For the Connection: “The decisive 31 BC naval victory over Antony and Cleopatra, followed by their final defeat in Egypt in 30 BC.” [Dio 51.1–4](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Cassius_Dio/51%2A.html).

2. `overview`, “the richest provinces”: **unsupported superlative / misleading selection criterion**. The division principally retained military provinces, while rich peaceful provinces also went to the Senate. Prefer “provinces containing most of the army.” `key_moments.2.text`, “more power than any Roman before him”: **unsupported superlative**, especially given Caesar’s dictatorship. Prefer “kept decisive control of the army while presenting his rule in republican terms.” [Dio 53.12–13](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Cassius_Dio/53%2A.html), [Princeton museum, More Context](https://artmuseum.princeton.edu/art/collections/objects/38856).

3. `key_moments.3.text`: the 23 BC resignation and tribunician power are well supported, but dating the precise scope of **imperium maius** to this year without qualification conceals a genuine scholarly debate. Use “According to Cassius Dio, he also received authority superior to provincial governors.” The historical reconstruction should remain attributed rather than mechanically labelled false. [Dio 53.32](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Cassius_Dio/53%2A.html); [Clemens Koehn, Chiron 40 (2010), abstract](https://publications.dainst.org/journals/chiron/article/view/421) explicitly discusses modern objections to the 23 BC reconstruction.

4. `deep_facts.0.text`: Suetonius reports a Romulus proposal, whereas Dio says Octavian himself wanted it and withdrew because it suggested kingship. Keep the two attributions separate. The alleged murder of Romulus is not shown by these passages to be a reason for rejecting the title. Delete that causal implication unless separately sourced. Replace “a word ... that had never belonged to anyone before” with “a new honorific with religious associations.” [Suetonius, Augustus 7](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Suetonius/12Caesars/Augustus%2A.html), [Dio 53.16](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Cassius_Dio/53%2A.html). The two ancient works are distinct accounts but were consulted on the same host, so the policy’s distinct-host corroboration requirement is still unmet.

5. Dataset date: offline preflight reports `loadSubjects()` labels this Milestone **28 BC**. The conventional beginning associated with Augustus’ title/settlement is **27 BC**, while the census and preliminary restoration really belong to 28 BC. Resolve whether this point-shaped Milestone denotes the constitutional settlement or the longer transition, then reconcile the dataset’s historical/astronomical conversion accordingly. Do not change genuine 28 BC events in the Profile merely to fit the milestone. [Metropolitan Museum](https://www.metmuseum.org/essays/augustan-rule-27-b-c-14-a-d), [Augustus, Res Gestae 34](https://www.livius.org/sources/content/augustus-res-gestae/).

## Passage coverage

Indices are zero-based; Key Moment rows include date, title and text. The “supported in substance” assessments do not certify absent citations or uncovered details.

| Passage | Assessment | Evidence / unresolved details |
|---|---|---|
| `subject`, `type`, `wikipedia_url` | Event identity broadly consistent; boundary requires decision | Roman Empire is broader than its founding; current point date needs reconciliation above. Live URL/QID comparison remains pending. |
| `overview` | Partially supported | Adoptive heir, victory and republican presentation: [Princeton, More Context](https://artmuseum.princeton.edu/art/collections/objects/38856). Restoration in sixth/seventh consulships: [Res Gestae 34](https://www.livius.org/sources/content/augustus-res-gestae/). “Richest” needs correction; “nobody” is unnecessarily universal—say he avoided the title king. |
| `key_moments.0` | Chronology correction required | [Dio 51](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Cassius_Dio/51%2A.html) separates Actium and later Egypt conquest. Agrippa’s naval role supported; exact “last great Hellenistic kingdom” superlative still needs independent scholarly support. |
| `key_moments.1` | Substantially supported | [Res Gestae 8](https://www.livius.org/sources/content/augustus-res-gestae/) records census with Agrippa and the forty-one-year interval; §7 records leadership of Senate. [Dio 53.2.5](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Cassius_Dio/53%2A.html) records ending illegal regulations. “Closest ally” is interpretive superlative; prefer “ally.” |
| `key_moments.2` | Partially supported; superlative blocks | [Dio 53.12–16](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Cassius_Dio/53%2A.html) supports provinces, ten-year grant and title. [Res Gestae 34](https://www.livius.org/sources/content/augustus-res-gestae/) is the ruler’s own restoration claim, not independent endorsement. Exact January day sequence needs a further source; omit “as expected” mind-reading and power superlative. |
| `key_moments.3` | Supported traditional reconstruction, disputed detail | [Dio 53.30–32](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Cassius_Dio/53%2A.html) describes illness, resignation and grants; scholarly debate about legal scope: [Koehn](https://publications.dainst.org/journals/chiron/article/view/421). Date/title can stand with qualified text. |
| `deep_facts.0` | Partially supported / attribution repair needed | See correction 4; murder motivation and absolute novelty have not been demonstrated. |
| `deep_facts.1` | Substantially supported; corroboration incomplete | [Dio 55.6](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Cassius_Dio/55%2A.html) and [Suetonius 31](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Suetonius/12Caesars/Augustus%2A.html) describe the renaming and victories. [Lewis and Short, Tufts](https://atlas.perseus.tufts.edu/dictionaries/entry/urn:cite2:scaife-viewer:dictionary-entries.atlas_v1:lat.ls.perseus-eng2-n44084/) confirms sixth/month-from-March etymology. Exact Senate action in 8 BC and Alexandria rationale need a directly inspected corroborating source on a distinct host. |
| `deep_facts.2` | Supported in substance; quotation corroboration incomplete | [Suetonius 28–29](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Suetonius/12Caesars/Augustus%2A.html) contains the brick/marble boast; [Diana Kleiner, Yale lecture](https://oyc.yale.edu/history-art/hsar-252/lecture-9) independently discusses Forum and Altar of Augustan Peace. Architecture and political message supported, but the exact attributed boast still needs a second independent account on a distinct host under the stricter policy. |

## Connections

All nine stored QIDs exist in the published dataset according to the batch’s offline preflight. That does not certify current URLs resolve to those QIDs.

| Path / target | Assessment of explanation | Evidence / gap |
|---|---|---|
| `connections.0` Augustus | Supported in substance | Title/founding: [Metropolitan Museum](https://www.metmuseum.org/essays/augustan-rule-27-b-c-14-a-d); exact January date remains to document. |
| `connections.1` Battle of Actium | Chronology correction needed | See correction 1. |
| `connections.2` Mark Antony | Supported in substance | Final contest/death: [Dio 51](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Cassius_Dio/51%2A.html). |
| `connections.3` Marcus Vipsanius Agrippa | Supported in substance | Naval role: [Dio 51.21](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Cassius_Dio/51%2A.html); census: [Res Gestae 8](https://www.livius.org/sources/content/augustus-res-gestae/). |
| `connections.4` Cleopatra | Supported in substance | Conquest and ruler’s death in 30 BC: [Cambridge History of Egypt](https://www.cambridge.org/core/books/abs/cambridge-history-of-egypt/egypt-under-roman-rule-the-legacy-of-ancient-egypt/29EF41B413D84B440F204EB45E3542B2). |
| `connections.5` Julius Caesar | Partially supported | Adoption/civil-war context: [Princeton, More Context](https://artmuseum.princeton.edu/art/collections/objects/38856). Specific transfer of loyal soldiers needs a direct source. |
| `connections.6` Roman Republic | Supported in substance, oversimplified wording | [Princeton, More Context](https://artmuseum.princeton.edu/art/collections/objects/38856) supports maintained forms/control. “In name” can imply offices ceased functioning; prefer “while preserving republican offices and the Senate.” |
| `connections.7` Assassination of Julius Caesar | Supported in substance | 44 BC and ensuing conflict: [Princeton, More Context](https://artmuseum.princeton.edu/art/collections/objects/38856). Avoid implying all preceding civil wars began with assassination. |
| `connections.8` Tiberius | Supported in substance | Stepson and succession: [Suetonius, Tiberius 4, 21–24](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Suetonius/12Caesars/Tiberius%2A.html). AD 14 transition agrees with [Metropolitan Museum, Augustan rule](https://www.metmuseum.org/essays/augustan-rule-27-b-c-14-a-d). Institutional survival is reasonable interpretation, not proof of a settled hereditary rule. |

## Source quality and remaining work

The Princeton page has an internal date error: its current opening paragraph says Augustus in 29 BCE, while its older “More Context” section correctly says 27 BC. It was used only for the specified contextual claims; the date relies on the Met and the primary chronological record. Ancient texts are retrospective and Augustus’ account is self-presentation. Obtain missing independent corroboration, settle the milestone boundary, replace overstatements, validate passage citations and complete the normal verification workflow. No approval receipt was created.
