# Locate the cost of an approved Profile

Type: task
Status: resolved
Blocked by:

## Question

What do saved drafts, receipts and session records tell us about reusable work, stage usage, repairs and completed bilingual Profiles per observed window? Separate measured results from missing data, and identify the smallest measurement needed if the records cannot distinguish the main costs.

## Answer

### Coverage at the published snapshot

| Subject | In scope | Published in both Locales | Unapproved English draft | No saved draft |
| --- | ---: | ---: | ---: | ---: |
| Legendary People | 76 | 2 | 18 | 56 |
| Mainstream People | 113 | 0 | 0 | 113 |
| Legendary Milestones | 38 | 2 | 4 | 32 |
| Mainstream Milestones | 70 | 0 | 0 | 70 |
| **Total** | **297** | **4** | **22** | **271** |

Counted the English Legendary and Mainstream dataset slices, matched Russian rows by slug, and checked both `hasProfile` flags and files. All 297 match subjects accepted by the writer. The current approval checks confirm both receipts for the same four subjects. There are no staged inputs or subjects published in only one Locale.

The 22 saved English drafts use prompt 2.1.0 and have no saved writer usage. Prompt 2.2.0 changes the Deep Fact selection criteria. The writer skips older drafts by default, and the verifier can use them as inputs independently of their writer prompt. Reuse therefore saves a writer pass when the draft also meets the current editorial bar. The existing receipts establish evidence and fidelity, while the Deep Fact selection criteria need an editorial comparison.

### Observed usage windows

| Five-hour reset (UTC, approximate) | Highest coordinator usage observed | In-scope bilingual approvals recorded |
| --- | ---: | ---: |
| Nov 16, 13:39 | 100% | 0 |
| Nov 16, 21:43 | 100% | 0 |
| Nov 17, 06:28 | 50% | 0 |
| Nov 17, 13:38 | 55% | 3 |
| Nov 19, 12:33 | 100% | 1 |

Matched 300-minute Codex coordinator snapshots by reset time, grouping a few seconds of timestamp drift. Assigned a completion to the window containing the saved approved Russian artifact timestamp after confirming current English approval. The Nov 17 window completed translations for Cleopatra, Gregorian calendar and Isaac Newton, with earlier English work carried in. The Nov 19 window completed Founding of the Roman Empire and also World War II, which falls outside this scope. Those two had manual review and edits before approval. Usage percentages cover all work charged to the window and reflect the coordinator's observed snapshots. These mixed windows leave end-to-end throughput for fresh Profiles unmeasured. [Prior manual reviews](../../person-profiles/reviews/README.md) · [Saved artifacts](../../../packages/data-pipeline/data/raw/profiles)

The final English reports record one automatic repair each for Cleopatra and Gregorian calendar and zero for the final Newton and Roman Empire runs. Newton's verification history shows an earlier repair round, and the final report came after manual edits. Three saved predecessor reports confirm repeat research and audit. The final Russian receipts record a correction and re-audit for Newton and Roman Empire, and a separate held Newton artifact survives. The Nov 17 completion-window coordinator logged one research request, one English audit, five translations and five translation audits. The Nov 19 coordinator logged nine research requests, seven English audits, eight translations and eight translation audits across its work. Request counts include attempts and cannot all be attributed to a finished Profile. English reports store models and repair counts, while translation receipts also store task token totals where recorded. None of these artifacts directly assigns charged quota to a role.

### Smallest next measurement

Run a serial pilot in a fresh window with one saved draft and one unwritten subject of similar size. Keep the current depth and both independent audits. Use comparable subjects and fixed model settings to get a first cost comparison, then repeat before making a schedule or changing the workflow. Review the saved draft's Deep Facts against the current prompt before counting it as a viable reuse case.

Record QID, stage, attempt, elapsed time, model/effort, outcomes, and both window reset times and used percentages at each stage boundary. Keep the coordinator separate from unrelated work during measurement. Retain per-agent input, cached input where available, and output counts as diagnostic measures. Count current English approvals and completed bilingual approvals, including subjects carried in from a prior window. Report quota change for the whole pilot and mark any stage with missing quota readings as unknown. A clean existing draft takes four model requests after finalization: research, English audit, translation, and Russian audit. A fresh Profile adds a writer request. Each changed English repair adds three requests, and a Russian correction adds two. Use the observed results to choose which repeat work merits a trial and how much to schedule per window. [Session workflow used in the pilot](../../../packages/data-pipeline/docs/adr/0024-profiles-can-use-conversation-subagents.md)

### Fresh Profile pilot, 2026-11-22

Ludwig van Beethoven (Q255) is a Legendary Person. The published rows had no Profile, the writer plan showed one to write, and the incoming directory was empty. The serial session pilot used `gpt-6.2-sol` at medium effort. It started at 16:25:47 UTC with the five-hour window already at 63% and a reset around 20:26 UTC. The weekly window was at 10%, with a reset on Nov 29 at 15:25:51 UTC. Each request ran in a fresh conversation.

| Stage | Request to response | Five-hour meter at response | Weekly meter at response | Input tokens | Cached input | Output tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Write | 1m 37s | 66% | 10% | 169,561 | 103,680 | 2,937 |
| First research | 5m 13s | 75% | 12% | 2,131,930 | 2,007,296 | 9,933 |
| First English audit | 2m 03s | 79% | 12% | 656,503 | 571,648 | 3,542 |
| Retry research | 4m 02s | 84% | 13% | 1,018,763 | 933,888 | 8,297 |
| Retry English audit | 1m 54s | 86% | 14% | 469,412 | 413,056 | 3,302 |
| First English repair | 2m 04s | 90% | 14% | 610,858 | 570,880 | 3,531 |
| Research after first repair | 3m 37s | 95% | 15% | 1,120,778 | 1,032,192 | 7,025 |
| Audit after first repair | 1m 38s | 97% | 15% | 469,704 | 418,048 | 2,639 |
| Second English repair | 1m 05s | 99% | 16% | 335,704 | 303,616 | 1,265 |

Finalization took roughly three seconds and resolved five in-dataset Connections from six candidates. The first verification returned `retry` at 16:35:15 UTC. The research covered 21 passages, but three source reads failed and the independent audit found claim, citation, and markup issues. With a fetch failure recorded, the pipeline withheld approval and suppressed automatic repair. A second verification used the known reachable URLs, repeated the research and English audit, and entered automatic repair. The elapsed request times include dispatch and handoff. The five-hour column uses the original stage readings. The weekly readings were recovered from the first coordinator snapshot and the final rate-limit snapshot for each agent. The retry audit’s final agent snapshot reads 87% on the five-hour meter, one point above the original stage reading. Both meters include coordination and any other usage charged to the window. Cached input is included in input tokens.

The first repair kept four Key Moments and five Connections and dropped one Deep Fact that lacked independent corroboration. The next research pass covered all 20 remaining passages. Its independent audit flagged two issues and triggered the second automatic repair. After that repair, the pilot had spent 24m 10s and the five-hour meter had increased by 36 percentage points. The weekly meter had increased by 6 percentage points. The normal verifier had requested a new research pass. Both Locale approvals were still pending.

### Pilot resumption, 2026-11-23

The first coordinator reading at 09:07 UTC was 2% on the five-hour meter and 16% on the weekly meter. The five-hour reset was around 13:08 UTC and the weekly reset was still Nov 29 at 15:25:51 UTC.

Two startup attempts failed during live Wikipedia QID resolution, before dispatching any model requests. Node's `--use-env-proxy --use-system-ca` flags let the verifier use the configured proxy and certificate trust store. The first research request was interrupted after a disk check showed the raw English file still held the original draft. The verifier had saved the first repaired draft in verification history and had kept the second repair in memory while waiting for its evidence pass. The coordinator replayed the second repair's two exact edits from its session log onto the first repaired draft, retained draft status, and restarted verification without another automatic repair allowance. The coordinator meter was 6% for five hours and 17% for the week immediately before the corrected pass. That startup interval includes the aborted research and coordinator work.

| Stage | Request to staged response | Five-hour meter | Weekly meter | Input tokens | Cached input | Output tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Research on recovered draft | 3m 58s | 10% | 17% | 966,680 | 888,832 | 9,128 |
| English audit on recovered draft | 1m 23s | 12% | 18% | 501,352 | 466,944 | 2,650 |
| Evidence-only retry | 2m 09s | 15% | 18% | 587,153 | 515,072 | 4,498 |
| English audit of evidence-only retry | 1m 36s | 17% | 18% | 527,913 | 488,448 | 2,761 |
| Research after editorial edits | 2m 45s | 20% | 19% | 720,481 | 678,400 | 5,967 |
| English audit after editorial edits | 1m 11s | 22% | 19% | 412,341 | 375,808 | 2,058 |
| Research after title and citation edits | 1m 39s | 25% | 20% | 430,159 | 393,728 | 3,286 |
| English audit after title and citation edits | 1m 09s | 27% | 20% | 501,212 | 451,840 | 1,702 |
| Russian translation | 1m 01s | 28% | 20% | 160,405 | 141,312 | 2,042 |
| Russian fidelity audit | 1m 18s | 29% | 20% | 204,473 | 190,848 | 2,696 |
| Russian correction | 59s | 30% | 20% | 167,593 | 155,648 | 1,838 |
| Russian fidelity re-audit | 1m 04s | 31% | 21% | 189,883 | 177,024 | 1,889 |

The resumed tasks used `gpt-6.2-sol` at medium effort. Meter values use the agents' final snapshots and reflect account-wide usage, including the coordinator. Elapsed time starts when the pipeline writes the request and ends when the agent stages its response. This includes dispatch but excludes coordinator handoff after staging.

The fresh evidence pass returned 40 supported findings across all 20 passages without source read failures. The independent audit held the draft on one finding about why Beethoven went to Vienna in 1792. The excerpt described the prior arrangements as likely. The auditor identified Waldstein's pre-departure letter as direct evidence of the plan. The evidence-only retry kept the draft and used an explicit Beethoven-Haus account of the study arrangements alongside Waldstein’s dated inscription. The other passages were checked against freshly fetched evidence.

The second audit held the same draft on four findings. It flagged the implication that Beethoven’s brothers received the Testament, the evidence for the Eroica’s first public performance, and the independence of evidence for the Haydn and Goethe findings. The coordinator made a separate editorial pass. It stated the move and subsequent study directly, identified the brothers as the intended recipients, and kept the Eroica performance date and venue while dropping the first-performance claim. It retained four Key Moments, two Deep Facts and five Connections, marked the draft as edited, and sent it through fresh research and the independent audit.

That pass held the draft on two remaining issues. The Eroica title still implied a debut, and the static Diabelli citation was not among the fetched URLs supporting its claims. The coordinator changed the title to name the venue and updated the citation to the fetched Beethoven-Haus work catalogue. Both changes went back through the full verification gate.

The independent English audit found no remaining issues or uncovered claims. The verifier issued the English approval, which also passed the current dataset-date check for 1770–1827.

The first Russian audit covered all 20 fields and requested changes to the overview’s time relationship, the private letter’s title, and the theatrical meaning of the music for Goethe’s play. The pipeline requested a correction and another full fidelity audit.

The second Russian audit covered all 20 fields with zero issues, and the verifier exited successfully with one approval. Both saved receipts passed the production approval checks. The two approvals are in raw data, awaiting a publication run.

The weekly meter rose from 10% to 21% across both parts of the pilot. The first run took it from 10% to 16% and the resumption from 16% to 21%. The five-hour readings rose from 63% to 99% in the first window and from 2% to 31% in the second. These are observed whole-percentage account readings that include the coordinator, startup failures and retries. The pilot produced one bilingual approval with editorial intervention. It does not establish routine throughput.

### Leonardo da Vinci trial, 2026-11-23

Leonardo da Vinci (Q762, 1452–1519) is a Legendary Person with no saved or staged draft and no published Profile in either Locale at preflight. The current one-shot workflow combines writing and evidence collection, then sends the finalized English draft to an independent auditor. The trial uses conversation agents on the current plan.

Preflight began at 10:44 UTC. The first account reading was 47% on the five-hour window and 23% on the weekly window, with resets on Nov 23 at 13:07:57 UTC and Nov 29 at 15:25:51 UTC. At dispatch of the writer the coordinator's reading was 48% and 23%. The meters include coordination and other account activity.

The preflight build shipped six existing Profiles per Locale, including Beethoven's separately approved Profile. The trial uses an isolated publication destination because the publisher copies the whole build and replaces the Profiles directory. The workspace sandbox blocked the `tsx` launcher's IPC socket, so the build uses the same entry point via `node --import tsx`.

| Stage | Dispatch to result | Five-hour meter | Weekly meter | Input tokens | Cached input | Output tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Research and writing | 6m 50s | 59% | 25% | 2,538,445 | 2,360,192 | 14,843 |
| First English audit | 2m 02s | 66% | 26% | 863,694 | 808,704 | 3,976 |
| First English repair | 2m 22s | 69% | 26% | 585,352 | 536,960 | 5,927 |
| Second English audit | 1m 23s | 72% | 27% | 565,877 | 498,816 | 3,235 |
| Second English repair | 1m 19s | 76% | 27% | 400,292 | 377,216 | 3,809 |
| Third English audit | 1m 44s | 79% | 28% | 610,243 | 559,872 | 4,131 |
| English audit after editorial edits | 40s | 84% | 29% | 586,662 | 556,416 | 1,636 |
| Russian translation | 1m 24s | 86% | 29% | 220,170 | 198,144 | 3,603 |
| First Russian fidelity audit | 56s | 88% | 29% | 196,305 | 184,448 | 2,691 |
| Russian correction | 47s | 89% | 30% | 164,254 | 143,104 | 2,068 |
| Second Russian fidelity audit | 1m 19s | 92% | 30% | 310,092 | 286,848 | 3,082 |

The table uses the latest available account reading for each response. Input totals include cached tokens. The first English repair and the final English audit used follow-up turns for their second appearances in the run, with incremental token counts for those follow-ups.

The writer tried 37 distinct URLs, fetched 27 and used 19 snapshots for 50 findings across 22 passages. Ten URLs returned HTTP errors. The writer continued with alternative sources. The 53 evidence CLI invocations include 16 retries after the default sandbox blocked the network. A narrow sandbox escalation let the public source and Wikipedia QID requests reach the configured proxy. Most drafting work went into finding excerpts that supported the precise wording and mapping them to each passage.

Finalization accepted four Key Moments and three Deep Facts and retained five of six proposed Connections. The first English check matched all 49 evidence quotes to cached text and held the draft on 16 blockers. Seven displayed citations pointed to Wikipedia while the supporting evidence came from different pages, one passage used unsupported italics, two details lacked coverage and six findings needed more precise wording or evidence. The factual issues included competing dates, a causal link inferred from a citation, and wording that made an older study sound current.

The first repair reused the saved snapshots, aligned the seven displayed citations and kept all four Key Moments, three Deep Facts and five Connections. The CLI saved the repaired draft and archived the first report before a new auditor received it.

The second audit found six remaining claims that needed more precise evidence or narrower phrasing. These included competing dates, the original location of an altarpiece and how confidently the source attributes the work on a figure. The concurrency limit prevented a fresh repair agent from starting, so the first repair agent took the second round as a follow-up. Its elapsed time starts with the resumed agent and its token counts are the increments for that round. It reused cached evidence, kept the Profile's depth, and saved a second checkpoint. A fresh agent took the third audit.

The third audit held on one uncovered clause and four evidence issues, including the date of the Mona Lisa, the description of a heart-valve study and Raphael's connection. With both automatic repairs used, the coordinator began an editorial pass before sending the Profile back to an independent auditor.

The editorial pass archived the third report, revised the flagged passages, marked the draft `edited` and checked 50 evidence excerpts against 20 saved sources. The conversation's agent slots temporarily stalled. Automatic review denied launching a separate Codex session that would have received the unpublished Profile and excerpts. No material was sent to that session.

The original independent auditor took the edited draft in a follow-up and used the new prepared task. The fourth audit found zero issues and zero uncovered claims. English approval was saved at 11:07:35 UTC with 50 findings across 21 passages. All four Key Moments, three Deep Facts and five Connections survived the English checks.

The first Russian fidelity audit covered all 21 fields and returned 14 issues, including naturalness and meaning. The correction needed to keep uncertainty tied to the 2002 study and preserve a service date without implying a recruitment date. After the allowed correction, the second Russian fidelity audit covered all 21 fields and held the Profile on three issues involving the declension of Sforza, the location of the planned town at Romorantin, and the phrasing of compass points. The CLI saved the hold at about 11:13:58 UTC.

The build and isolated publication confirmed the current English receipt. Against the preflight build, Output changed only Leonardo's English Legendary row and added his English Profile. The Russian row kept the Description fallback. The temporary publication used the production publisher's copy function and verified all 37 output files byte for byte.

English took **22m 31s of the 28m 54s** from writer dispatch to the final Russian gate. Research and writing took **6m 50s**. The remaining **15m 41s** before English approval went into audits, repairs, editorial edits and handoffs. Russian took **6m 23s** and ended held. The five-hour meter rose from 48% to 92% from coordinator startup to the final audit, and the weekly meter rose from 23% to 30%. The trial yielded one English approval and zero bilingual approvals.

The largest cost in both pilots came after the first draft. In this run the auditor repeatedly found claims that exceeded their excerpts even when the evidence text matched and the prior repair had cleared its own blockers. Citation alignment is a concrete avoidable cost. The writer prompt called for Wikipedia links while the publication check needed the same-passage links fetched for evidence. Fixing that handoff could clear the seven citation blockers before the first audit. The remaining factual wording and Russian fidelity issues still required separate review.

### Marie Curie citation trial, 2026-11-23

Marie Curie (Q7186, 1867–1934) appeared in Legendary with a Fame Score of 94.30 and no saved, staged or published Profile. The trial used prompt 2.4.0 after commit `fe59f61` retired the legacy writer and removed 25 unapproved English drafts. Writer dispatch was at 13:43:25 UTC.

| Stage | Dispatch to last usage reading | Five-hour meter | Weekly meter | Input tokens | Cached input | Output tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Research and writing | 7m 07s | 15% | 34% | 4,187,669 | 4,120,960 | 15,430 |
| First English audit | 1m 19s | 18% | 34% | 386,016 | 302,080 | 2,495 |
| English repair | 1m 18s | 20% | 34% | 343,781 | 271,744 | 2,846 |
| Second English audit | 1m 26s | 22% | 35% | 439,695 | 383,360 | 2,602 |
| Third English audit | 1m 28s | 25% | 35% | 446,976 | 413,952 | 2,721 |
| Russian translation | 1m 43s | 27% | 35% | 151,629 | 141,568 | 4,458 |
| First Russian fidelity audit | 1m 24s | 29% | 36% | 153,155 | 143,104 | 3,095 |
| Russian correction | 1m 08s | 31% | 36% | 175,494 | 158,592 | 2,641 |
| Second Russian fidelity audit | 1m 10s | 32% | 36% | 150,011 | 135,680 | 2,602 |
| **Agent total** | | | | **6,434,426** | **6,071,040** | **38,890** |

All stages used `gpt-6.2-sol` at medium effort. Agent token totals exclude coordination. The writer inherited the conversation and subsequent agents started in fresh contexts. Input totals include cached tokens. Account-wide readings went from 7% to 32% on the five-hour meter and 32% to 36% on the weekly meter. Those increases include coordination and any other account activity.

The writer tried 27 distinct URLs and fetched 22. Five returned HTTP errors, and an initial sandbox DNS failure cleared when the same URL was fetched with scoped network access. The assessment used 16 snapshots for 43 findings across 22 reader-visible fields. Finalization kept six of six Connections.

The first English audit cleared all seven displayed citations and found zero uncovered claims. It held three issues involving the description of the golden key, a source assigned to the wrong notebook finding and the wording of Harding’s ceremonial presentation. One repair addressed those issues. The second audit found a reference to a period photograph absent from the supplied excerpt. The coordinator corrected the assessment’s attribution to the museum account and surviving object. The third audit found no blockers. English was approved at 13:58:11 UTC, **14m 46s** after dispatch, with 44 findings and all four Key Moments, three Deep Facts, six Connections and seven original citations.

The first Russian audit flagged eight issues. Its JSON needed a format correction to serialize the findings as strings before the CLI accepted the verdict. After one translation correction, the second fidelity audit held on nine issues across seven fields, including terminology, agency and the scope of the ceremony wording. The Russian hold was saved at 14:05:04 UTC, **21m 40s** after dispatch. The trial yielded one English approval and zero bilingual approvals, so the weekly usage per bilingual approval remains unmeasured.

Build and isolated publication finished **21m 51s** after dispatch. The standard publisher copied 38 files byte for byte. Relative to the preflight build, only the English Legendary row gained `hasProfile` and the English Profile file was added. Russian retained the Description fallback.

### Marie Curie Russian retry

The retry reused the English approval and changed only the seven Russian fields flagged in the prior hold. The translator checked all 22 fields against English and reread the Russian for flow. A temporary merge restricted changes to the flagged fields. A fresh auditor reviewed all 22 fields and approved the candidate with zero blockers and zero further corrections. The retry took 3m 5s end to end, including 1m 31s for translation and 51s for the audit. Both English file hashes matched their pre-retry values. Commit `8998234` saved the Russian approval locally.
