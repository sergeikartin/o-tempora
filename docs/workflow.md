## Rules

- **Investigate first:** Never speculate about code you have not read. Read files and ripgrep for usages before making claims. If uncertain, say so and propose how to verify
- **Scope to the request:** Do what is asked; nothing more. When ambiguous, default to research and recommendations — only edit when explicitly asked. Do not refactor adjacent code or create abstractions for a single use
- **Verify before done:** Re-check each requirement. Run tests and lint. State what changed, what was verified, and what could not be
- **File discipline:** Edit existing files in place. Do not create new files unless required. Clean up scratch files
- **Safety:** Ask before destructive actions (deleting files/branches, force pushes, hard resets, --no-verify)
- **Efficiency:** Parallelize independent tool calls; serialize dependent ones
- **Tools:** Use `rg` not grep, `fd` not find. `tree` is not installed
