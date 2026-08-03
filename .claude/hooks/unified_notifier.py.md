# Unified Notifier for Claude Code Hooks

## Overview

The `unified_notifier.py` script provides a centralized notification system for Claude Code hooks. It bridges Claude Code events with your desktop notification system and text-to-speech (TTS) engine, keeping you informed about what Claude is doing even when you're not actively watching the terminal.

### Key Features

- **Dual Notification System**: Sends both desktop notifications (via `terminal-notifier`) and spoken announcements (via custom TTS script)
- **Path Simplification**: Automatically converts absolute file paths to relative paths for cleaner, more readable notifications
- **Smart Message Adaptation**: Uses different messages for visual notifications vs. spoken audio (e.g., shows full command text but speaks a concise summary)
- **Comprehensive Event Coverage**: Handles 7 different Claude Code hook events with tailored messages for each
- **Silent Failure**: Gracefully handles errors without interrupting Claude's workflow
- **Centralized Configuration**: Single script managing all notification logic across multiple hook events

### Benefits

- **Stay Informed**: Know when Claude needs your attention without constantly checking the terminal
- **Accessibility**: Audio announcements help visually impaired users or when working away from screen
- **Context Awareness**: Notifications include relevant details (commands, file paths, prompts)
- **Reduced Cognitive Load**: Let the notification system track Claude's state while you focus on other work
- **Customizable**: Easy to modify messages or add new event types

## Prerequisites

### Required Tools

1. **terminal-notifier** (macOS)
   ```bash
   brew install terminal-notifier
   ```

2. **Python 3** with standard library modules:
   - `json`, `sys`, `subprocess`, `argparse`, `os`, `re`, `typing`
   - All included in Python 3 standard library (3.5+)

3. **Custom TTS Script**
   - You need a text-to-speech script (referenced in configuration)
   - Example path: `/Users/george/D7378/PC/gitrepos/www_git/tts-projects/claude_tts.py`
   - Should accept `--voice` and `--quiet` flags, plus text as argument

### Platform Requirements

- **macOS**: Required for `terminal-notifier`
- **Linux/Windows**: Would need alternative notification commands (e.g., `notify-send` on Linux)

## Configuration

### Script Configuration Variables

Edit these constants at the top of `unified_notifier.py`:

```python
# --- CONFIGURATION ---
# The absolute path to your text-to-speech script.
TTS_SCRIPT_PATH: str = "/path/to/your/tts/script.py"

# The voice to be used for the TTS announcement.
TTS_VOICE: str = "af_bella"  # Change to your preferred voice
# ---------------------
```

**Configuration Notes:**
- `TTS_SCRIPT_PATH`: Must be absolute path to your TTS script
- `TTS_VOICE`: Voice identifier supported by your TTS engine
- The script uses `uv run` to execute the TTS script - ensure `uv` is installed or modify the command

### Environment Requirements

- The script expects to be called from Claude Code hooks with JSON data via stdin
- Uses the `cwd` field from hook input for path relativization
- No additional environment variables required

### Constants and Defaults

The script uses these fixed values:
- **Title**: Always `"Claude Code"` for all notifications
- **Sound**: Uses macOS `"default"` notification sound
- **Subprocess behavior**: Uses `check=True` which raises exceptions on non-zero exit codes (caught by error handler)

**Default values when JSON fields are missing:**

| Field | Default Value | Used In |
|-------|---------------|---------|
| `source` | `"session"` | SessionStart |
| `message` | `"Claude needs permission or input."` | Notification |
| `command` | `"a command"` | PreToolUse_Bash |
| `file_path` | `""` (empty string) | PreToolUse_FileOp |
| `prompt` | `""` (empty string) | UserPromptSubmit |
| `cwd` | `""` (empty string) | All events |

## Supported Hook Events

| Hook Event | Trigger | Visual Notification | Audio Notification | Path Simplification |
|------------|---------|---------------------|-------------------|---------------------|
| **SessionStart** | New session starts | "New session started from {source}" | Same | No |
| **UserPromptSubmit** | User submits prompt | "Processing: {first 70 chars}..." | Same | Yes (in prompt) |
| **Notification** | Claude needs input | "{message}" | Same | No |
| **PreToolUse (Bash)** | Before bash command | "Wants to run: {command}" | "Wants to run a {program} command" | Yes |
| **PreToolUse (FileOp)** | Before file edit/write | "Wants to modify: {filepath}" | Same | Yes |
| **SubagentStop** | Subagent completes | "A subagent task has finished" | Same | No |
| **Stop** | Session completes | "Finished working in {directory}" | Same | No |

### Event Details

#### SessionStart
```json
{
  "hook_event_name": "SessionStart",
  "source": "startup"  // or "resume", "clear", "compact"
}
```
**Notification**: "Session Started: New session started from startup."

#### UserPromptSubmit
```json
{
  "hook_event_name": "UserPromptSubmit",
  "prompt": "Please fix the bug in authentication.py"
}
```
**Notification**: "Prompt Submitted: Processing: Please fix the bug in authentication.py..."
- Truncates to 70 characters
- Simplifies file paths if found in prompt

#### Notification
```json
{
  "hook_event_name": "Notification",
  "message": "Claude needs your permission to use Bash"
}
```
**Notification**: "Input Required: Claude needs your permission to use Bash"

#### PreToolUse (Bash Variant)
```json
{
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "git commit -m 'Fix bug'"
  }
}
```
**Visual**: "Command Execution: Wants to run: git commit -m 'Fix bug'"
**Audio**: "Command Execution: Wants to run a git command."

#### PreToolUse (FileOp Variant)
```json
{
  "hook_event_name": "PreToolUse",
  "tool_name": "Edit",  // or "Write"
  "tool_input": {
    "file_path": "/absolute/path/to/file.py"
  }
}
```
**Notification**: "File Operation: Wants to modify: relative/path/to/file.py"

#### SubagentStop
```json
{
  "hook_event_name": "SubagentStop"
}
```
**Notification**: "Subagent Complete: A subagent task has finished."

#### Stop
```json
{
  "hook_event_name": "Stop",
  "cwd": "/Users/you/project"
}
```
**Notification**: "Session Complete: Finished working in project."

## How It Works

### Data Flow

```
┌─────────────┐
│ Claude Code │
│   Runtime   │
└──────┬──────┘
       │ Hook Event Triggered
       ▼
┌─────────────────────────────┐
│  settings.json Hook Config  │
│  Calls unified_notifier.py  │
└──────────┬──────────────────┘
           │ Sends JSON via stdin
           ▼
┌──────────────────────────────────┐
│   unified_notifier.py            │
│  ┌────────────────────────────┐  │
│  │ 1. Parse JSON from stdin   │  │
│  │ 2. Identify hook event     │  │
│  │ 3. Extract relevant data   │  │
│  │ 4. Simplify paths (if any) │  │
│  │ 5. Generate messages       │  │
│  └────────────┬───────────────┘  │
└───────────────┼──────────────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
┌──────────────┐  ┌─────────────┐
│ terminal-    │  │ TTS Script  │
│ notifier     │  │ (claude_    │
│              │  │  tts.py)    │
└──────┬───────┘  └──────┬──────┘
       │                 │
       ▼                 ▼
┌─────────────┐   ┌─────────────┐
│  Desktop    │   │   Audio     │
│ Notification│   │  Speaker    │
└─────────────┘   └─────────────┘
```

### Processing Steps

1. **Input Parsing**: Reads JSON data from stdin containing hook event details
2. **Event Detection**: Uses `argparse` to get the event name from command-line argument
3. **Data Extraction**: Pulls relevant fields from JSON (command, filepath, prompt, etc.)
4. **Path Simplification**: Converts absolute paths to relative paths when `cwd` is available
   - Uses regex pattern: `r"([\"']?(/|~/)[^\s\"']+[\"']?)"`
   - Converts `/Users/you/project/src/file.py` → `src/file.py`
5. **Message Generation**: Creates appropriate title, subtitle, and message based on event type
6. **Dual Notification**: Sends both desktop and TTS notifications with appropriate messages
7. **Error Handling**: Silently catches and ignores notification failures to avoid disrupting Claude

### Path Transformation Logic

The script uses `os.path.relpath()` to convert absolute paths to relative paths:

```python
# Example transformation
abs_path = "/Users/george/project/src/auth.py"
cwd = "/Users/george/project"
relative_path = os.path.relpath(abs_path, cwd)  # → "src/auth.py"
```

This applies to:
- File paths in `PreToolUse` events for Edit/Write tools
- File paths mentioned in user prompts
- Command arguments in Bash tool calls

### Error Handling

The script uses silent failure for robustness:

```python
except (subprocess.TimeoutExpired, subprocess.SubprocessError, FileNotFoundError):
    # Fail silently if a notification command fails
    pass
except Exception:
    # Catch any other unexpected errors and fail silently
    pass
```

**Why silent failure?**
- Notification failures shouldn't interrupt Claude's workflow
- Missing dependencies (TTS script, terminal-notifier) won't cause crashes
- Hooks run automatically - user may not be able to intervene immediately

## Architecture & Data Flow

### Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Claude Code                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐ │
│  │ SessionStart│  │ UserPrompt │  │ PreToolUse │  │   Stop    │ │
│  │   Event    │  │   Submit   │  │   Event    │  │   Event   │ │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬─────┘ │
└────────┼───────────────┼───────────────┼───────────────┼────────┘
         │               │               │               │
         └───────────────┴───────────────┴───────────────┘
                                │
                    ┌───────────▼────────────┐
                    │   .claude/settings.json│
                    │   Hook Configuration   │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │  Python subprocess:    │
                    │  unified_notifier.py   │
                    │  <event_name>          │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │  JSON Data (stdin)     │
                    │  {                     │
                    │    "hook_event_name",  │
                    │    "tool_name",        │
                    │    "tool_input",       │
                    │    "cwd",              │
                    │    ...                 │
                    │  }                     │
                    └───────────┬────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
    ┌────▼─────┐         ┌──────▼──────┐      ┌───────▼───────┐
    │  Parse   │         │  Identify   │      │  Extract      │
    │  JSON    │────────▶│  Event Type │─────▶│  Event Data   │
    └──────────┘         └─────────────┘      └───────┬───────┘
                                                       │
                                          ┌────────────▼────────────┐
                                          │  Path Simplification     │
                                          │  (if paths present)      │
                                          │  /abs/path → rel/path    │
                                          └────────────┬────────────┘
                                                       │
                                          ┌────────────▼────────────┐
                                          │  Message Generation      │
                                          │  • title                 │
                                          │  • subtitle              │
                                          │  • message (visual)      │
                                          │  • tts_message (audio)   │
                                          └────────────┬────────────┘
                                                       │
                         ┌─────────────────────────────┼─────────────────────────────┐
                         │                             │                             │
                    ┌────▼──────┐                ┌─────▼─────┐                ┌──────▼──────┐
                    │ Subprocess│                │Subprocess │                │   Silent    │
                    │ terminal- │                │ uv run    │                │   Error     │
                    │ notifier  │                │ tts.py    │                │  Handling   │
                    └────┬──────┘                └─────┬─────┘                └─────────────┘
                         │                            │
                    ┌────▼──────┐              ┌──────▼──────┐
                    │  Desktop  │              │    Audio    │
                    │   Alert   │              │   Speech    │
                    │  (5 sec)  │              │  (10 sec)   │
                    └───────────┘              └─────────────┘
```

### Message Flow Detail

```
Event: PreToolUse (Bash)
Input JSON:
{
  "tool_name": "Bash",
  "tool_input": {"command": "/usr/local/bin/npm test"},
  "cwd": "/Users/you/project"
}

    │
    ├─▶ Extract command: "/usr/local/bin/npm test"
    │
    ├─▶ Simplify paths: (no change, not a file path)
    │
    ├─▶ Generate visual message: "Wants to run: /usr/local/bin/npm test"
    │
    ├─▶ Generate audio message: "Wants to run a npm command"
    │
    ├─▶ Desktop: title="Claude Code"
    │            subtitle="Command Execution"
    │            message="Wants to run: /usr/local/bin/npm test"
    │
    └─▶ TTS: "Command Execution: Wants to run a npm command"
```

## Integration with Claude Code Settings

### Minimal Configuration (Single Event)

Example: Only notify for bash commands

**.claude/settings.json** or **~/.claude/settings.json**:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/unified_notifier.py PreToolUse_Bash"
          }
        ]
      }
    ]
  }
}
```

### Full Configuration (All 7 Events)

Complete setup with all supported hook events:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/unified_notifier.py SessionStart"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/unified_notifier.py UserPromptSubmit"
          }
        ]
      }
    ],
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/unified_notifier.py Notification"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/unified_notifier.py PreToolUse_Bash"
          }
        ]
      },
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/unified_notifier.py PreToolUse_FileOp"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/unified_notifier.py SubagentStop"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/unified_notifier.py Stop"
          }
        ]
      }
    ]
  }
}
```

### Advanced Configuration (With Custom Matchers)

Example: Different notifications for different file types

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/unified_notifier.py PreToolUse_Bash"
          }
        ]
      },
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/unified_notifier.py PreToolUse_FileOp"
          }
        ]
      },
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/unified_notifier.py PreToolUse_Read"
          }
        ]
      }
    ]
  }
}
```

Then add to `unified_notifier.py`:
```python
elif event == "PreToolUse_Read":
    subtitle = "Reading File"
    abs_file_path = hook_data.get("tool_input", {}).get("file_path", "")
    # ... similar logic
```

### Project-Specific vs User-Wide Settings

**Project-Specific** (`.claude/settings.json`):
- Only applies to current project
- Good for project-specific notification preferences
- Committed to version control (optional)

**User-Wide** (`~/.claude/settings.json`):
- Applies to all projects
- Good for consistent notification preferences across projects
- Not committed to version control

**Local Override** (`.claude/settings.local.json`):
- Project-specific but not committed
- Overrides both project and user settings
- Good for personal preferences in shared projects

### Using $CLAUDE_PROJECT_DIR

Always use `$CLAUDE_PROJECT_DIR` for portability:

```json
"command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/unified_notifier.py SessionStart"
```

**Why?**
- Works regardless of where Claude Code is running from
- Allows project-relative hook scripts
- Required when hooks are stored in project directory

## Message Customization

### Dual-Message System

The script supports different messages for visual and audio notifications:

```python
# Visual notification (detailed)
message = "Wants to run: git commit -m 'Add feature' && git push origin main"

# Audio notification (concise)
tts_message = "Wants to run a git command."
```

**When to use different messages:**
- **Long commands**: Show full command visually, speak summary
- **File paths**: Show relative path visually, speak just "file operation"
- **Complex prompts**: Show truncated text visually, speak generic "processing prompt"

### Modifying Messages for Events

To customize messages, edit the event handling in `main()`:

```python
elif event == "PreToolUse_Bash":
    command = hook_data.get("tool_input", {}).get("command", "a command")
    subtitle = "Command Execution"

    # Customize these messages:
    message = f"About to execute: {clean_command}"  # Visual
    tts_message = f"Running {program_name}."        # Audio
```

### Example Customizations

**Add emoji to desktop notifications:**
```python
subtitle = "🔔 Command Execution"
message = f"⚡ Wants to run: {clean_command}"
```

**Change notification sound:**
```python
notifier_cmd = [
    "terminal-notifier",
    "-title", title,
    "-subtitle", subtitle,
    "-message", message,
    "-sound", "Glass",  # Changed from "default"
]
```

**Add notification urgency levels:**
```python
# For Bash commands involving git push
if "git push" in command:
    subprocess.run([
        "terminal-notifier",
        "-title", title,
        "-subtitle", "⚠️ IMPORTANT",
        "-message", message,
        "-sound", "Basso",
    ])
```

## Extending the Script

### Adding Unused Hook Events

The script currently doesn't handle these 4 Claude Code hook events:
- PostToolUse
- PermissionRequest
- PreCompact
- SessionEnd

### Example: Adding PostToolUse

**1. Add to settings.json:**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/unified_notifier.py PostToolUse_Bash"
          }
        ]
      }
    ]
  }
}
```

**2. Add to unified_notifier.py main() function:**
```python
elif event == "PostToolUse_Bash":
    subtitle = "Command Completed"
    tool_response = hook_data.get("tool_response", {})
    command = hook_data.get("tool_input", {}).get("command", "")

    # Extract first word as program name
    program_name = command.split()[0] if command else "command"

    # Check if successful
    success = tool_response.get("success", True)
    if success:
        message = f"Successfully ran: {command[:50]}..."
        tts_message = f"{program_name} completed successfully."
    else:
        message = f"Failed to run: {command[:50]}..."
        tts_message = f"{program_name} failed."
```

### Example: Adding PermissionRequest

**1. Add to settings.json:**
```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/unified_notifier.py PermissionRequest"
          }
        ]
      }
    ]
  }
}
```

**2. Add to unified_notifier.py:**
```python
elif event == "PermissionRequest":
    tool_name = hook_data.get("tool_name", "unknown tool")
    subtitle = "Permission Requested"
    message = f"Claude wants permission to use {tool_name}"
    tts_message = f"Permission requested for {tool_name}."
```

### Example: Adding PreCompact

**1. Add to settings.json:**
```json
{
  "hooks": {
    "PreCompact": [
      {
        "matcher": "auto",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/unified_notifier.py PreCompact"
          }
        ]
      }
    ]
  }
}
```

**2. Add to unified_notifier.py:**
```python
elif event == "PreCompact":
    trigger = hook_data.get("trigger", "manual")
    subtitle = "Compacting Conversation"
    if trigger == "auto":
        message = "Context window full - auto-compacting conversation history"
        tts_message = "Auto-compacting conversation."
    else:
        message = "Manually compacting conversation history"
        tts_message = "Compacting conversation."
```

### Example: Adding SessionEnd

**1. Add to settings.json:**
```json
{
  "hooks": {
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/unified_notifier.py SessionEnd"
          }
        ]
      }
    ]
  }
}
```

**2. Add to unified_notifier.py:**
```python
elif event == "SessionEnd":
    reason = hook_data.get("reason", "exit")
    dir_name = os.path.basename(cwd) if cwd else "current directory"
    subtitle = "Session Ended"

    reason_messages = {
        "clear": "Session cleared",
        "logout": "User logged out",
        "prompt_input_exit": "Exited during prompt input",
        "other": "Session ended"
    }

    message = f"{reason_messages.get(reason, 'Session ended')} in {dir_name}"
    tts_message = f"Session ended in {dir_name}."
```

### Code Pattern to Follow

When adding new events, follow this pattern:

```python
elif event == "YourEventName":
    # 1. Extract relevant data from hook_data
    field1 = hook_data.get("field1", "default")
    field2 = hook_data.get("field2", {}).get("nested", "")

    # 2. Set subtitle
    subtitle = "Event Description"

    # 3. Process/simplify paths if needed
    if cwd and "/path/pattern" in field1:
        # Apply path simplification logic
        pass

    # 4. Generate visual message
    message = f"Your message: {field1}"

    # 5. (Optional) Generate different audio message
    tts_message = f"Concise version: {field2}"
```

## Testing Instructions

### Manual Testing for Each Hook Event

#### Testing SessionStart

**Trigger the event:**
```bash
# Start a new Claude Code session
claude

# Or resume a session
claude --resume
```

**Verify:**
- Desktop notification appears with "Session Started"
- Audio announces "Session started from startup" (or "resume")

#### Testing UserPromptSubmit

**Trigger the event:**
```bash
# In Claude Code, type any prompt and press Enter
# Example: "List all Python files"
```

**Verify:**
- Desktop notification shows "Processing: List all Python files..."
- Audio announces the prompt text
- If prompt contains file paths, they should be relativized

#### Testing Notification

**Trigger the event:**
```bash
# In Claude Code, wait for a permission prompt
# Or trigger idle notification by waiting 60+ seconds
```

**Verify:**
- Desktop notification shows "Input Required"
- Audio announces the notification message

#### Testing PreToolUse_Bash

**Trigger the event:**
```bash
# Ask Claude to run a command
# Example: "Run git status"
```

**Verify:**
- Desktop notification shows "Wants to run: git status"
- Audio announces "Wants to run a git command"
- Path simplification works if command contains file paths

#### Testing PreToolUse_FileOp

**Trigger the event:**
```bash
# Ask Claude to edit or create a file
# Example: "Create a new file test.py"
```

**Verify:**
- Desktop notification shows "Wants to modify: test.py" (relative path)
- Audio announces the same
- Absolute path converted to relative path

#### Testing SubagentStop

**Trigger the event:**
```bash
# Ask Claude to use a subagent (Task tool)
# Example: "Use the Explore agent to find all configuration files"
```

**Verify:**
- Desktop notification shows "Subagent Complete" when done
- Audio announces "A subagent task has finished"

#### Testing Stop

**Trigger the event:**
```bash
# Wait for Claude to finish responding to your request
# The hook triggers when Claude completes
```

**Verify:**
- Desktop notification shows "Finished working in {directory}"
- Audio announces the same with directory name

### Testing with Mock JSON Input

You can test the script directly without Claude Code:

**1. Create a test JSON file** (`test_input.json`):
```json
{
  "session_id": "test123",
  "transcript_path": "/tmp/test.jsonl",
  "cwd": "/Users/you/project",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "git status"
  }
}
```

**2. Run the script manually:**
```bash
cat test_input.json | .claude/hooks/unified_notifier.py PreToolUse_Bash
```

**3. Verify both notifications appear**

### Verifying Notifications Appear

**Desktop notification check:**
- Should appear in top-right corner (macOS)
- Should have title "Claude Code"
- Should have appropriate subtitle
- Should play sound

**TTS check:**
- Should hear spoken announcement
- Should match expected audio message
- Should complete without errors

### Verifying TTS Works Correctly

**Test TTS script directly:**
```bash
uv run /path/to/your/tts/script.py --voice af_bella --quiet "Test message"
```

**Verify:**
- Voice speaks "Test message"
- No errors printed
- Script completes successfully

### Testing Path Transformation Logic

**Create test input with absolute path:**
```json
{
  "cwd": "/Users/you/project",
  "hook_event_name": "PreToolUse",
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "/Users/you/project/src/auth.py"
  }
}
```

**Expected transformation:**
- Input: `/Users/you/project/src/auth.py`
- Output: `src/auth.py`

### Using claude --debug to See Hook Execution

**Run Claude Code in debug mode:**
```bash
claude --debug
```

**Look for hook execution logs:**
```
[DEBUG] Executing hooks for PreToolUse:Bash
[DEBUG] Hook command: ".claude/hooks/unified_notifier.py PreToolUse_Bash"
[DEBUG] Hook completed with status 0
```

**Common debug output:**
- Hook command being executed
- Exit code (0 = success)
- Any stderr output (errors)
- Timing information

## Troubleshooting

### Common Issues

#### TTS Script Not Found

**Symptom:** No audio notifications, silent failure

**Solution:**
1. Verify TTS_SCRIPT_PATH is correct:
   ```python
   TTS_SCRIPT_PATH: str = "/correct/path/to/claude_tts.py"
   ```
2. Check file exists:
   ```bash
   ls -la /correct/path/to/claude_tts.py
   ```
3. Test TTS script directly:
   ```bash
   uv run /correct/path/to/claude_tts.py --voice af_bella --quiet "Test"
   ```

#### terminal-notifier Not Installed

**Symptom:** No desktop notifications

**Solution:**
```bash
# Check if installed
which terminal-notifier

# Install if missing
brew install terminal-notifier

# Test directly
terminal-notifier -title "Test" -message "Hello"
```

#### Silent Failure Behavior

**Symptom:** Hooks run but no notifications appear

**Debugging:**
1. Check if hook is registered:
   ```bash
   # In Claude Code
   /hooks
   ```
2. Run script manually to see errors:
   ```bash
   echo '{"hook_event_name":"SessionStart","source":"startup"}' | \
     .claude/hooks/unified_notifier.py SessionStart
   ```
3. Check for error output (stderr)

#### Path Not Simplifying Correctly

**Symptom:** Seeing absolute paths instead of relative

**Debugging:**
1. Check `cwd` field in hook input
2. Verify path is actually inside `cwd`
3. Check for path matching regex:
   ```python
   path_pattern = r"([\"']?(/|~/)[^\s\"']+[\"']?)"
   ```

### Debug Mode Tips

**Enable Python debugging:**
```python
# Add at top of unified_notifier.py
import sys
sys.stderr.write(f"DEBUG: Event={event}, CWD={cwd}\n")
```

**Check hook registration:**
```bash
# In Claude Code
/hooks

# Look for your unified_notifier.py entries
```

**View hook execution in real-time:**
```bash
# Run Claude Code in debug mode
claude --debug 2>&1 | grep "unified_notifier"
```

### Checking Hook Registration with /hooks

**In Claude Code:**
```
/hooks
```

**Look for:**
- Your hook events (SessionStart, PreToolUse, etc.)
- Correct command paths
- Correct matchers (for PreToolUse)

**Example expected output:**
```
PreToolUse:
  Matcher: Bash
  Command: "$CLAUDE_PROJECT_DIR/.claude/hooks/unified_notifier.py PreToolUse_Bash"
```

### Verifying Python Dependencies

**Check Python version:**
```bash
python3 --version
# Should be 3.7 or higher
```

**Test required modules:**
```bash
python3 -c "import json, sys, subprocess, argparse, os, re; print('All modules OK')"
```

**Check uv installation (for TTS):**
```bash
which uv
uv --version
```

### Testing Outside of Claude Code

**Create standalone test:**
```bash
#!/bin/bash
# test_notifier.sh

echo '{
  "session_id": "test",
  "transcript_path": "/tmp/test.jsonl",
  "cwd": "'$(pwd)'",
  "permission_mode": "default",
  "hook_event_name": "SessionStart",
  "source": "startup"
}' | .claude/hooks/unified_notifier.py SessionStart

echo "Test complete. Did you see/hear the notification?"
```

**Run test:**
```bash
chmod +x test_notifier.sh
./test_notifier.sh
```

## Security Considerations

### Hook Execution Security

**Risk:** Hooks execute automatically with your user permissions

**Mitigation:**
- Review hook scripts before adding to settings
- Use version control for hook files
- Avoid hooks that execute arbitrary code from hook input
- Never execute untrusted code in hooks

### Path Handling Security

**Risk:** Path traversal attacks via malicious file paths

**Current protection:**
```python
# Script uses os.path.relpath which handles ".." safely
relative_path = os.path.relpath(abs_path, cwd)
```

**Best practices:**
- Don't execute commands based on paths from hook input
- Validate paths before use if extending script
- Be cautious with paths containing special characters

### Input Validation and Sanitization

**Current approach:**
- Script uses `json.load()` which safely parses JSON
- Regex for path detection is read-only (no execution)
- All external calls use subprocess with explicit arguments (not shell=True)

**Best practices for extending:**
```python
# Good: Explicit argument list
subprocess.run(["command", arg1, arg2], check=True)

# Bad: Shell injection risk
subprocess.run(f"command {arg1}", shell=True)  # DON'T DO THIS
```

### Reference to Claude Code Hooks Security Best Practices

See official Claude Code documentation:
- [Hooks Security Considerations](https://code.claude.com/docs/en/hooks#security-considerations)

**Key points:**
- Hooks run automatically in the agent loop
- Have access to your environment's credentials
- Can modify, delete, or access any files your user can
- Should never execute untrusted input
- Always quote shell variables
- Use absolute paths for scripts

**Example secure pattern:**
```python
# Always validate input before use
file_path = hook_data.get("tool_input", {}).get("file_path", "")
if file_path and not ".." in file_path:  # Basic path traversal check
    # Safe to proceed
    pass
```

---

## Quick Reference

### File Locations

- **Script**: `.claude/hooks/unified_notifier.py`
- **Project settings**: `.claude/settings.json`
- **User settings**: `~/.claude/settings.json`
- **Local settings**: `.claude/settings.local.json`

### Configuration Quick Edit

```python
# Edit these in unified_notifier.py
TTS_SCRIPT_PATH = "/path/to/your/tts/script.py"
TTS_VOICE = "af_bella"
```

### Quick Test

```bash
# Test desktop notifications
terminal-notifier -title "Test" -message "Hello"

# Test TTS
uv run /path/to/tts/script.py --voice af_bella --quiet "Test"

# Test hook script
echo '{"hook_event_name":"SessionStart","source":"startup"}' | \
  .claude/hooks/unified_notifier.py SessionStart
```

### Supported Events Checklist

- ✅ SessionStart
- ✅ UserPromptSubmit
- ✅ Notification
- ✅ PreToolUse (Bash)
- ✅ PreToolUse (Edit/Write)
- ✅ SubagentStop
- ✅ Stop
- ⬜ PostToolUse (not implemented)
- ⬜ PermissionRequest (not implemented)
- ⬜ PreCompact (not implemented)
- ⬜ SessionEnd (not implemented)

---

**Last Updated:** 2025-12-15
**Script Version:** 1.0
**Compatible with:** Claude Code (all versions with hooks support)
