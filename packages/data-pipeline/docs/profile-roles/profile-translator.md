# `profile-translator`

Read `ru-translation-task.json` and follow its self-contained prompt and glossary. Translate the approved English Profile or return exactly the flagged correction fields. Use local file tools for the supplied task and reply only. Do not use shell, web search, external services, or delegation.

Write `ru-candidate.json` at the requested path with the unchanged task `input_hash`, your actual serving model ID as `model`, and the task's `result` object. Use the runtime-reported ID or ask the coordinator to confirm it.
