# Claude Code Documentation Index

Complete routing table for all official Claude Code documentation pages.
All URLs follow: `https://code.claude.com/docs/en/{filename}.md`

## Automation

| Keywords | Filename | Description |
| --- | --- | --- |
| hook, event, pre-tool, post-tool, automation | `hooks-guide.md` | Hook creation guide with examples |
| hook API, hook events, hook reference, lifecycle | `hooks.md` | Hook events reference (all events + input/output) |
| schedule, /loop, cron, recurring, reminder | `scheduled-tasks.md` | In-session scheduling with /loop and cron |
| web schedule, recurring web task | `web-scheduled-tasks.md` | Scheduled tasks on claude.ai/code |
| channel, webhook, push message, notification bridge | `channels.md` | Push message channels (Slack, webhooks) |
| channel reference, channel plugin, relay | `channels-reference.md` | Channel implementation reference |
| headless, non-interactive, pipe, batch, automation | `headless.md` | Non-interactive/scripted Claude Code usage |

## Extensibility

| Keywords | Filename | Description |
| --- | --- | --- |
| skill, SKILL.md, trigger, bundled resource | `skills.md` | Skill creation and configuration |
| subagent, agent tool, delegate, explore agent | `sub-agents.md` | Subagent types, config, and delegation |
| agent team, teammate, parallel agents, cowork | `agent-teams.md` | Multi-agent coordination and teams |
| plugin, create plugin, plugin structure | `plugins.md` | Plugin creation and development |
| marketplace, install plugin, discover plugin | `discover-plugins.md` | Plugin marketplace and installation |
| plugin reference, manifest, plugin components, LSP | `plugins-reference.md` | Plugin components and CLI reference |
| plugin marketplace, host marketplace, schema | `plugin-marketplaces.md` | Creating and hosting marketplaces |
| mcp, mcp server, tool integration, stdio, SSE | `mcp.md` | MCP server setup and configuration |

## Configuration

| Keywords | Filename | Description |
| --- | --- | --- |
| settings, settings.json, config scope, worktree settings | `settings.md` | Settings files, scopes, and precedence |
| permission, allow, deny, permission rule, specifier | `permissions.md` | Permission rules, syntax, and managed settings |
| permission mode, plan mode, auto mode, dontAsk, bypass | `permission-modes.md` | Permission modes (plan, auto, dontAsk, bypass) |
| CLAUDE.md, memory, auto memory, rules, AGENTS.md | `memory.md` | Memory system, CLAUDE.md, and .claude/rules/ |
| model, model config, model alias, effort level, extended context | `model-config.md` | Model selection, aliases, and configuration |
| fast mode, speed, fast toggle | `fast-mode.md` | Fast mode toggle and cost tradeoff |
| theme, terminal, vim mode, notification, appearance | `terminal-config.md` | Terminal themes, vim mode, notifications |
| keybinding, keyboard shortcut, rebind key, chord | `keybindings.md` | Custom keyboard shortcuts |
| statusline, status bar, status display | `statusline.md` | Custom status line configuration |
| output style, formatting, response style | `output-styles.md` | Built-in and custom output styles |
| voice, dictation, push-to-talk, speech | `voice-dictation.md` | Voice input configuration |
| env var, environment variable | `env-vars.md` | Environment variables reference |
| sandbox, isolation, filesystem restrict, network restrict | `sandboxing.md` | Filesystem and network sandboxing |

## Platforms and Integrations

| Keywords | Filename | Description |
| --- | --- | --- |
| platform, where to run, comparison | `platforms.md` | Platform comparison overview |
| vscode, vs code, extension, IDE | `vs-code.md` | VS Code extension features and config |
| jetbrains, intellij, pycharm, webstorm, goland | `jetbrains.md` | JetBrains IDE plugin |
| desktop, desktop app, diff view, app preview, computer use | `desktop.md` | Desktop app features and config |
| desktop install, desktop quickstart | `desktop-quickstart.md` | Desktop app installation |
| web, claude.ai/code, cloud environment, web session | `claude-code-on-the-web.md` | Web app features, cloud env, network access |
| slack, slack integration, slack bot | `slack.md` | Slack integration |
| chrome, browser automation, browser control | `chrome.md` | Chrome browser automation |
| remote control, remote session, remote device | `remote-control.md` | Remote Control from other devices |

## CI/CD and Code Review

| Keywords | Filename | Description |
| --- | --- | --- |
| github action, github CI, @claude PR, claude-code-action | `github-actions.md` | GitHub Actions integration |
| gitlab, merge request, gitlab CI, gitlab pipeline | `gitlab-ci-cd.md` | GitLab CI/CD integration |
| code review, review.md, severity, automated review | `code-review.md` | Automated code review setup |

## Deployment and Enterprise

| Keywords | Filename | Description |
| --- | --- | --- |
| third-party, proxy, gateway, cloud provider | `third-party-integrations.md` | Deployment options overview |
| bedrock, AWS, amazon | `amazon-bedrock.md` | AWS Bedrock setup |
| vertex, GCP, google cloud | `google-vertex-ai.md` | Google Vertex AI setup |
| foundry, azure, microsoft | `microsoft-foundry.md` | Microsoft Foundry setup |
| gateway, litellm, LLM proxy | `llm-gateway.md` | LLM gateway and LiteLLM config |
| network, proxy, CA cert, mTLS, SSL | `network-config.md` | Network and proxy configuration |
| devcontainer, container, dev environment | `devcontainer.md` | Dev container configuration |
| server-managed, enterprise settings, managed config | `server-managed-settings.md` | Enterprise server-managed settings |

## Administration

| Keywords | Filename | Description |
| --- | --- | --- |
| install, setup, system requirements, update | `setup.md` | Installation and updates |
| auth, login, credential, team auth, SSO | `authentication.md` | Authentication and credential management |
| security, prompt injection, MCP security, IDE security | `security.md` | Security practices and protections |
| OTEL, telemetry, metrics, monitoring, opentelemetry | `monitoring-usage.md` | Usage monitoring with OTEL metrics/events |
| cost, token usage, reduce tokens, /cost | `costs.md` | Cost tracking and reduction strategies |
| analytics, PR attribution, adoption, ROI | `analytics.md` | Teams/Enterprise analytics |
| data, retention, training policy, telemetry | `data-usage.md` | Data policies and retention |
| zero data retention, ZDR | `zero-data-retention.md` | ZDR scope and configuration |

## Reference

| Keywords | Filename | Description |
| --- | --- | --- |
| CLI, cli flag, command reference, cli command | `cli-reference.md` | All CLI commands and flags |
| slash command, /command, built-in command | `commands.md` | Slash commands reference |
| tool, tool reference, bash tool, tool behavior | `tools-reference.md` | Tool behavior details |
| interactive, keyboard shortcut, vim, command history, background bash | `interactive-mode.md` | Interactive mode features and shortcuts |
| checkpoint, undo, rewind, restore | `checkpointing.md` | Checkpoint and undo system |
| troubleshoot, install error, debug, fix | `troubleshooting.md` | Troubleshooting common issues |

## Core Concepts

| Keywords | Filename | Description |
| --- | --- | --- |
| how it works, agentic loop, context window, session | `how-claude-code-works.md` | Architecture, models, tools, sessions |
| feature overview, feature comparison, context cost | `features-overview.md` | Feature comparison and context costs |
| workflow, best practice, worktree, common task | `common-workflows.md` | Common workflows and patterns |
| best practice, tips, effective usage | `best-practices.md` | Comprehensive best practices |
| quickstart, getting started, first session | `quickstart.md` | Getting started guide |
| changelog, release notes, what's new | `changelog.md` | Release changelog |
