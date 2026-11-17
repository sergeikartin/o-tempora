# Cleopatra — manual source audit

Date: 2026-11-15. Outcome: **held for corrections and remaining evidence checks**.

Reviewed: `packages/data-pipeline/data/raw/profiles/people/Q635-cleopatra.en.json`.
SHA-256: `705bd041882f72cec635ec3d1848912b49eb753f89604c01c92877c571d04c67`.

This is a manual research note, not a verifier report or publication approval. The raw Profile remains unchanged. All visible passages were inspected; partial support below does not certify every detail. Live URL-to-QID resolution, source snapshots/hashes and a second independent coverage audit remain outstanding.

## Corrections to make

1. `deep_facts.0.text`, “was not ethnically Egyptian”: **disputed / overcertain**. Macedonian dynastic descent is established, but the maternal ancestry is uncertain. Classicist Duane Roller explicitly discusses possible Egyptian ancestry. Replace the opening with: “Cleopatra belonged to the Macedonian Greek dynasty founded by Ptolemy I, one of Alexander the Great’s generals.” Retain the language anecdote as Plutarch’s account, without “bothered,” which adds an unnecessary judgment. [Roller, Oxford University Press](https://blog.oup.com/2010/12/cleopatra-2/), [Metropolitan Museum, Ptolemaic Egypt](https://www.metmuseum.org/essays/egypt-in-the-ptolemaic-period).

2. `key_moments.3.text`, “personal possession of Rome’s emperor”: **disputed / misleading as settled fact**. The readable Cambridge chapter identifies this as a traditional interpretation and explains Egypt’s distinct administration. Prefer: “Egypt became a Roman province governed by a prefect answerable directly to Octavian.” A Cambridge sourcebook excerpt explicitly rejecting the personal-property interpretation was discoverable, but its PDF failed twice; that failure is not itself evidence. The readable chapter supports the proposed administrative wording. [Cambridge History of Egypt, chapter 1](https://www.cambridge.org/core/books/abs/cambridge-history-of-egypt/egypt-under-roman-rule-the-legacy-of-ancient-egypt/29EF41B413D84B440F204EB45E3542B2).

3. `overview`, “since the death of Alexander the Great”: **imprecise chronology**. Ptolemy took control after Alexander’s death, but became king in 305 BC. Prefer “a Greek-speaking dynasty founded by one of Alexander the Great’s generals.” This preserves the history without conflating satrapal government and dynastic kingship. [Metropolitan Museum](https://www.metmuseum.org/essays/egypt-in-the-ptolemaic-period).

4. `key_moments.0.text`, “By about 49 BC”: **unverified precision in this audit**. Plutarch establishes expulsion before Caesar’s arrival in 48 BC without dating it to 49. Change to “Before Caesar arrived in 48 BC” unless a scholarly chronology supporting 49 is attached. The approximate wording is not proved false. [Plutarch, Caesar 48–49](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Plutarch/Lives/Caesar%2A.html).

5. `deep_facts.1.source`: **missing public passage citation** (`not_on_wikipedia`). The story is directly documented by Pliny and appropriately flagged as legend. Use the readable primary source below. Change “has been doubted ever since” to “has been debated by modern scholars”; the original implies an unverified continuous history of doubt. Ullman reviews changing scholarly views and experimental considerations. [Pliny, Natural History 9.119–121](https://www.attalus.org/pliny/hn9b.html), [B. L. Ullman, Classical Journal 52 (1957)](https://penelope.uchicago.edu/Thayer/E/Journals/CJ/52/5/Cleopatras_Pearls%2A.html).

6. `deep_facts.2.text`, “hollow hairpin”: **translation discrepancy**. The inspected Perrin translation says hollow comb. Prefer “poison concealed in a hollow comb,” explicitly within Plutarch’s account, or document the translation supporting hairpin. Preserve the existing uncertainty about the snake and punctures. [Plutarch, Antony 85–86](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Plutarch/Lives/Antony%2A.html).

## Passage coverage

Indices are zero-based. Each Key Moment row covers its date, title and text; Deep Fact rows cover the visible text and legend framing. Writer-supplied claim lists were treated as hints.

| Passage | Assessment | Evidence / unresolved details |
|---|---|---|
| `subject`, `type`, `wikipedia_url` | Identity consistent with Cleopatra VII; live URL/QID check pending | The museum identifies the Ptolemaic queen and her 51–30 BC reign. [Saint Louis Art Museum](https://www.slam.org/collection/constituents/33528/) |
| `overview` | Partially supported | Reign, Roman pressure and alliances fit the scholarly teaching guide; dynasty wording needs correction above. [Warwick/OCR](https://warwick.ac.uk/fac/arts/classics/warwickclassicsnetwork/stoa/anchist/gcse/cleopatra/teachersguide/) |
| `key_moments.0` | Partially supported | Father’s death in 51 BC and displacement supported by the [Oslo Historical Museum](https://www.historiskmuseum.no/english/exhibitions/good-as-gold/cleopatra/). [Caesar, Civil Wars 3.107–108](https://classics.mit.edu/Caesar/civil.mb.txt) confirms heirs, request to Rome to enforce the will and eunuch regent. Exact age and 49 BC army chronology still need specific evidence. |
| `key_moments.1` | Substantially supported; corroboration incomplete | [Plutarch, Caesar 48–49](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Plutarch/Lives/Caesar%2A.html) supports Pompey’s head, palace entry, conflict and restoration; [Dio 42.43–44](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Cassius_Dio/42%2A.html) supports the king perishing in the river. Retain attributed bedding account; its independent corroboration is not established here. |
| `key_moments.2` | Partially supported | Barge and language accounts are explicitly attributed in [Plutarch, Antony 25–27](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Plutarch/Lives/Antony%2A.html). [Folger](https://www.folger.edu/explore/shakespeares-works/antony-and-cleopatra/further-reading/) confirms Shakespeare used North’s translation, including the barge description. A continuous affair from 41 BC is too compressed: Plutarch 36 describes its renewal after interruption. Exact date and all three children need additional specific corroboration. |
| `key_moments.3` | Partially supported; framing correction needed | [Dio 51](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Cassius_Dio/51%2A.html) supports 30 BC conquest/deaths and distinguishes subsequent campaigning from Actium. Province’s supposed private ownership needs correction above. Formal declaration wording and exact August dating need separate primary passages before approval. |
| `deep_facts.0` | Disputed opening; attributed language tradition supported | See correction 1. Plutarch’s account verifies the tradition, not a modern genealogical conclusion. Dynasty/sibling-marriage context: [Roller](https://blog.oup.com/2010/12/cleopatra-2/). |
| `deep_facts.1` | Supported as an attributed legend, citation repair needed | [Pliny 9.119–121](https://www.attalus.org/pliny/hn9b.html) contains banquet, sum and pearl. [Ullman](https://penelope.uchicago.edu/Thayer/E/Journals/CJ/52/5/Cleopatras_Pearls%2A.html) supplies independent analysis, not an independent ancient witness. No factual endorsement of the banquet is implied. |
| `deep_facts.2` | Supported as a report of variant ancient accounts, translation correction advised | [Plutarch, Antony 86](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Plutarch/Lives/Antony%2A.html). Two independent original accounts on distinct hosts have not been established for the obscure factual details. |

## Connections

Names and explanatory text were inspected. All eight stored targets exist in the published dataset according to the batch’s offline preflight; that is separate from historical relationship verification and live URL/QID identity resolution.

| Path / target | Verdict on explanation | Evidence / gap |
|---|---|---|
| `connections.0` Mark Antony | Partially supported | Shared partnership and deaths supported by [Dio 51](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Cassius_Dio/51%2A.html); avoid implying uninterrupted partnership after 41. |
| `connections.1` Julius Caesar | Supported in substance | Restoration and reported paternity: [Plutarch, Caesar 49](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Plutarch/Lives/Caesar%2A.html). Keep attribution for paternity. |
| `connections.2` Augustus | Supported in substance | Actium followed by conquest, not annexation in 31: [Dio 51](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Cassius_Dio/51%2A.html). |
| `connections.3` Battle of Actium | Supported in substance | Defeat/demise narrative: [Metropolitan Museum, Augustan rule](https://www.metmuseum.org/essays/augustan-rule-27-b-c-14-a-d). “Doomed” is interpretive shorthand. |
| `connections.4` Caesarion | Partially supported | Reported son and killing: [Plutarch, Antony 81–82](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Plutarch/Lives/Antony%2A.html). Co-rule still needs a specific citation. |
| `connections.5` Ptolemy XIII | Supported in substance | Brother/rival and death in river: [Dio 42](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Cassius_Dio/42%2A.html). |
| `connections.6` Ptolemy XII | Supported in substance | Paternity/death year: [Oslo Historical Museum](https://www.historiskmuseum.no/english/exhibitions/good-as-gold/cleopatra/). Will provision: [Caesar, Civil Wars 3.108](https://classics.mit.edu/Caesar/civil.mb.txt). |
| `connections.7` Cleopatra Selene II | Supported in substance | Daughter and Mauretanian queenship: [Brandeis thesis abstract](https://scholarworks.brandeis.edu/esploro/outputs/graduate/Cleopatra-Selene-The-Iconography-and-Cultural/9924354987201921). |

## Remaining gate work

Replace disputed wording, close the named factual gaps, validate passage source URLs/anchors, and run the normal independent evidence/coverage verification. Sources inspected here include ancient accounts written long after events; attribution matters, and two retellings of one account do not supply independent corroboration. No approval receipt was created.
