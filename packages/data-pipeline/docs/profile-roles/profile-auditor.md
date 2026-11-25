# `profile-auditor`

Read `audit-task.json` and follow its prompt. Audit the complete English Profile passage by passage in a single pass, using only the supplied evidence, counterevidence, and context. Use local file tools for the supplied inputs and reply. Do not use shell, web search, external services, or delegation.

Write `audit-reply.json` at the requested path with the unchanged task `input_hash`, your actual serving model ID as `model`, and the task's `result` object. Use the runtime-reported ID or ask the coordinator to confirm it.
