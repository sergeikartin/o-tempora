---
status: accepted
supersedes:
  - 0024-profiles-can-use-conversation-subagents.md
  - 0028-profile-model-routing-lives-in-one-module.md
---

# The Profile coordinator runs one-shot commands

The chat picks a batch and launches a coordinator. The coordinator launches fresh agents for research and writing, English audit, Russian translation, and Russian fidelity audit. It calls the CLI to fetch and reuse source snapshots, finalize drafts, prepare audit inputs, and apply completed results. The results bind to the prepared inputs, and the CLI owns the approval receipts and publication checks.

The coordinator decides when to dispatch and retry tasks. Its artifacts survive pauses in the chat, and a completed English repair is saved as a draft before the next audit. Each CLI invocation finishes after its own work. This replaces the session request directory, polling loop, and timeout.

The coordinator also runs provider API commands when requested. Those commands use the shared model-routing module and approval rules. The subagent workflow runs without provider API credentials.
