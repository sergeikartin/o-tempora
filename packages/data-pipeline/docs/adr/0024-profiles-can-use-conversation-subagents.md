---
status: accepted
supersedes: 0023-profiles-publish-after-evidence-backed-automatic-verification.md
---

# Profiles can use conversation subagents

The active conversation can already launch subagents, but the verification command in ADR 0023 always creates API clients. Add an explicit session execution mode for writing, research, audit and repair while retaining API execution as the default. The conversation dispatches agents through a local request/response directory; the CLI never launches a nested agent runtime or assumes access to the conversation's credentials.

Keep ADR 0023's evidence and publication policy. Research agents discover sources using their session tools and request article text from the running pipeline. The pipeline owns source fetching, excerpt checks, mechanical validation, repair limits, protected edits and approval receipts. Each audit is a separate subagent request. This preserves one verification implementation across execution modes instead of trusting an agent-authored approval report.

Requests have unique directories and hashes, a bounded wait, and explicit failure replies. Writer prompt provenance is captured by the pipeline; unreported session model identifiers and token usage stay unknown. The trade-off is an active conversation coordinator: a standalone CLI cannot autonomously dispatch work inside an existing conversation. Source/QID network access is still required even though session mode needs no provider API key.
