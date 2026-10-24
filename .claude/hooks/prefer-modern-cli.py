#!/usr/bin/env python3
"""PreToolUse(Bash) hook: reject classic Unix tools that have a modern replacement.

Exit 2 sends the message on stderr back to the agent.
"""
import json
import re
import sys

REPLACEMENTS = {
    "grep": "rg",
    "egrep": "rg",
    "fgrep": "rg -F",
    "find": "fd",
    "cat": "bat -p (writing a file with `cat > f` or a heredoc is fine)",
    "ls": "eza",
}

# A command word: at the start of the line or right after a separator.
COMMAND_WORD = re.compile(r"(?:^|[;&|(\n]|\$\()\s*(?:sudo\s+)?(\w+)\b(?!\s*(?:>|<<))")

HEREDOC = re.compile(r"<<-?\s*(['\"]?)(\w+)\1[^\n]*\n.*?\n\s*\2\b", re.S)
QUOTED = re.compile(r"'[^']*'|\"(?:\\.|[^\"\\])*\"")


def classic_tools(command: str) -> list[str]:
    command = HEREDOC.sub(" ", command)
    command = QUOTED.sub("''", command)
    return [w for w in COMMAND_WORD.findall(command) if w in REPLACEMENTS]


def main() -> int:
    command = json.load(sys.stdin).get("tool_input", {}).get("command", "")
    hits = list(dict.fromkeys(classic_tools(command)))
    if not hits:
        return 0
    print(
        "Use the modern replacement in Bash: "
        + "; ".join(f"{tool} -> {REPLACEMENTS[tool]}" for tool in hits)
        + ". Prefer the Read/Grep/Glob tools when one fits.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
