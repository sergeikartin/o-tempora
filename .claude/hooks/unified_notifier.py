#!/usr/bin/env python3
"""
A unified notification script for Claude Code hooks.

This script is designed to be called from the `settings.json` file.
It reads hook data from stdin, determines the appropriate notification
message based on the hook event, and then triggers both a desktop
notification (using terminal-notifier) and a text-to-speech (TTS)
announcement.
"""

import sys
import json
import subprocess
import argparse
import os
import re
from typing import List, Optional

# --- CONFIGURATION ---
# The absolute path to your text-to-speech script.
TTS_SCRIPT_PATH: str = "/Users/george/D7378/PC/gitrepos/www_git/tts-projects/claude_tts.py"
# The voice to be used for the TTS announcement.
TTS_VOICE: str = "af_bella"
# ---------------------


def send_notification(title: str, subtitle: str, message: str, tts_message: Optional[str] = None) -> None:
    """
    Sends a desktop notification and a TTS announcement.

    Args:
        title (str): The main title for the notification.
        subtitle (str): The subtitle, used for context.
        message (str): The core message content for the desktop notification.
        tts_message (Optional[str]): A separate, concise message for TTS.
                                     If None, `message` is used for both.
    """
    try:
        # 1. Trigger the desktop notification using the detailed message.
        notifier_cmd: List[str] = [
            "terminal-notifier",
            "-title", title,
            "-subtitle", subtitle,
            "-message", message,
            "-sound", "default",
        ]
        subprocess.run(notifier_cmd, check=True, timeout=5)

        # 2. Determine the message for TTS. Use the specific tts_message if provided.
        final_tts_message = tts_message if tts_message is not None else message
        
        # Prepend the subtitle for clearer audio context.
        spoken_message = f"{subtitle}: {final_tts_message}"
        
        tts_cmd: List[str] = [
            "uv", "run", TTS_SCRIPT_PATH,
            "--voice", TTS_VOICE,
            "--notification",
            "--no-preload",
            "--skip-voice-check",
            "--quiet",
            spoken_message,
        ]
        subprocess.run(tts_cmd, check=True, timeout=5)

    except (subprocess.TimeoutExpired, subprocess.SubprocessError, FileNotFoundError):
        # Fail silently if a notification command fails.
        pass
    except Exception:
        # Catch any other unexpected errors and fail silently.
        pass


def main() -> None:
    """
    The main entry point for the script.
    """
    parser = argparse.ArgumentParser(description="Claude Code Unified Notifier")
    parser.add_argument("hook_event", help="The name of the hook event being triggered.")
    args = parser.parse_args()

    try:
        hook_data: dict = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    title: str = "Claude Code"
    subtitle: str = "Alert"
    message: str = "An event occurred."
    tts_message: Optional[str] = None # Initialize tts_message
    event: str = args.hook_event
    cwd: str = hook_data.get("cwd", "")
    path_pattern = r"([\"']?(/|~/)[^\s\"']+[\"']?)"

    # --- Message Generation Logic ---
    if event == "SessionStart":
        source = hook_data.get("source", "session")
        subtitle = "Session Started"
        message = f"New session started from {source}."

    elif event == "UserPromptSubmit":
        prompt = hook_data.get("prompt", "")
        subtitle = "Prompt Submitted"
        clean_prompt = prompt
        match = re.search(path_pattern, prompt)
        if match and cwd:
            abs_path = match.group(1).strip("'\"")
            expanded_path = os.path.expanduser(abs_path)
            try:
                relative_path = os.path.relpath(expanded_path, cwd)
                clean_prompt = prompt.replace(abs_path, relative_path)
            except ValueError:
                pass
        message = f"Processing: {clean_prompt[:70]}..."

    elif event == "Notification":
        subtitle = "Input Required"
        message = hook_data.get("message", "Claude needs permission or input.")

    elif event == "PreToolUse_Bash":
        command = hook_data.get("tool_input", {}).get("command", "a command")
        subtitle = "Command Execution"
        
        # --- Create two different messages ---
        # 1. A clean command for the visual notification.
        clean_command = command
        matches = re.finditer(path_pattern, command)
        for match in matches:
            if cwd:
                abs_path = match.group(1).strip("'\"")
                expanded_path = os.path.expanduser(abs_path)
                try:
                    relative_path = os.path.relpath(expanded_path, cwd)
                    clean_command = clean_command.replace(abs_path, relative_path)
                except ValueError:
                    continue
        message = f"Wants to run: {clean_command}"
        
        # 2. A concise summary for the TTS audio.
        program_name = clean_command.split()[0]
        tts_message = f"Wants to run a {program_name} command."

    elif event == "PreToolUse_FileOp":
        subtitle = "File Operation"
        abs_file_path = hook_data.get("tool_input", {}).get("file_path", "")
        message = "Wants to modify a file"
        if abs_file_path and cwd:
            try:
                relative_path = os.path.relpath(abs_file_path, cwd)
                message = f"Wants to modify: {relative_path}"
            except ValueError:
                message = f"Wants to modify: {abs_file_path}"
        elif abs_file_path:
            message = f"Wants to modify: {abs_file_path}"

    elif event == "SubagentStop":
        subtitle = "Subagent Complete"
        message = "A subagent task has finished."

    elif event == "Stop":
        dir_name = os.path.basename(cwd) if cwd else "current directory"
        subtitle = "Session Complete"
        message = f"Finished working in {dir_name}."

    elif event == "SessionEnd":
        num_turns = hook_data.get("num_turns", 0)
        duration_ms = hook_data.get("duration_ms", 0)
        duration_min = round(duration_ms / 60000, 1) if duration_ms else 0
        subtitle = "Session Ended"
        message = f"Session complete: {num_turns} turns in {duration_min} minutes."
        tts_message = f"Session ended after {num_turns} turns."

    elif event == "PostToolUse_Bash":
        tool_result = hook_data.get("tool_result", {})
        exit_code = tool_result.get("exit_code", 0)
        subtitle = "Command Complete"
        if exit_code == 0:
            message = "Command completed successfully."
            tts_message = "Command succeeded."
        else:
            message = f"Command failed with exit code {exit_code}."
            tts_message = f"Command failed, exit code {exit_code}."

    elif event == "PostToolUse_FileOp":
        tool_name = hook_data.get("tool_name", "file operation")
        file_path = hook_data.get("tool_input", {}).get("file_path", "")
        subtitle = "File Saved"
        if file_path and cwd:
            try:
                relative_path = os.path.relpath(file_path, cwd)
                message = f"Saved: {relative_path}"
            except ValueError:
                message = f"Saved: {file_path}"
        else:
            message = f"{tool_name} completed."
        tts_message = "File saved."

    elif event == "PreCompact":
        trigger = hook_data.get("trigger", "auto")
        subtitle = "Memory Compaction"
        message = f"Compacting memory ({trigger} trigger)."
        tts_message = "Compacting memory."

    elif event == "PermissionRequest":
        tool_name = hook_data.get("tool_name", "unknown tool")
        subtitle = "Permission Request"
        message = f"Permission requested for: {tool_name}"
        tts_message = f"Permission needed for {tool_name}."

    # Send the notification, providing the specific tts_message if available.
    send_notification(title, subtitle, message, tts_message)


if __name__ == "__main__":
    main()