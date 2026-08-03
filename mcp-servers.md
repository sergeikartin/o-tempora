## Gemini CLI MCP Server

[Gemini CLI MCP](https://github.com/centminmod/gemini-cli-mcp-server)

```bash
claude mcp add gemini-cli /pato/to/.venv/bin/python /pato/to//mcp_server.py -s user -e GEMINI_API_KEY='GEMINI_API_KEY' -e OPENROUTER_API_KEY='OPENROUTER_API_KEY'
```

## Cloudflare MCP Documentation

[Cloudflare Documentation MCP](https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/docs-vectorize)

```bash
claude mcp add --transport sse cf-docs https://docs.mcp.cloudflare.com/sse -s user
```

## Context 7 MCP Server

[Context 7 MCP](https://github.com/upstash/context7)

```bash
claude mcp add --transport sse context7 https://mcp.context7.com/sse -s user
```

## Notion MCP Server

[Notion MCP](https://github.com/makenotion/notion-mcp-server)

```bash
claude mcp add-json notionApi '{"type":"stdio","command":"npx","args":["-y","@notionhq/notion-mcp-server"],"env":{"OPENAPI_MCP_HEADERS":"{\"Authorization\": \"Bearer ntn_API_KEY\", \"Notion-Version\": \"2022-06-28\"}"}}' -s user
```

## Chrome Devtools MCP sever

[Chrome Devtools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp)

```bash
claude --mcp-config .claude/mcp/chrome-devtools.json
```

Where `.claude/mcp/chrome-devtools.json`

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@latest"
      ]
    }
  }
}
```