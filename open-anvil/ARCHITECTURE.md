# Open Anvil — Architecture

## Communication Flow

```
┌─────────────┐     MCP/stdio      ┌─────────────────┐    WebSocket     ┌──────────────────┐
│  ANY LLM    │◄──────────────────►│  MCP SERVER      │◄───────────────►│  CHROME EXTENSION │
│  (Claude,   │  JSON-RPC 2.0      │  (Python)        │  localhost:7777  │  (Manifest V3)    │
│   GPT,      │                    │                  │                 │                    │
│   Gemini,   │                    │  ┌────────────┐  │                 │  ┌──────────────┐  │
│   Llama)    │                    │  │ TOOLS:     │  │                 │  │ background.js│  │
│             │                    │  │ • browser  │  │                 │  │ (service wkr)│  │
│             │                    │  │ • shell    │  │                 │  │              │  │
│             │                    │  │ • vision   │  │                 │  │ content.js   │  │
│             │                    │  │ • state    │  │                 │  │ (DOM/A11y)   │  │
│             │                    │  │ • debug    │  │                 │  │              │  │
│             │                    │  └────────────┘  │                 │  │ devtools.js  │  │
└─────────────┘                    └─────────────────┘                 │  │ (debug panel)│  │
                                          │                            │  └──────────────┘  │
                                          │ subprocess                 └──────────────────┘
                                          ▼                                     │
                                   ┌─────────────┐                              │ CDP
                                   │  OS SHELL   │                              ▼
                                   │  (managed   │                     ┌──────────────────┐
                                   │   processes)│                     │  CHROME DEVTOOLS  │
                                   └─────────────┘                     │  PROTOCOL         │
                                                                       │  (debugger,       │
                                          ▲                            │   network,        │
                                          │ file I/O                   │   performance)    │
                                          ▼                            └──────────────────┘
                                   ┌─────────────┐
                                   │ STATE STORE │
                                   │ (JSON +     │
                                   │  heartbeat) │
                                   └─────────────┘
```

## Why This Architecture

1. **Chrome Extension** — Not Playwright. Full page context access, no CORS, no proxy,
   reads the real accessibility tree, executes JS in page scope, intercepts network,
   captures screenshots via CDP. Works on ANY page including auth-walled ones.

2. **MCP Server** — Standard Model Context Protocol. Any LLM that speaks MCP can use
   these tools. Claude, GPT (via bridge), Gemini, local Llama — doesn't matter.

3. **WebSocket Bridge** — Extension and MCP server communicate over localhost WebSocket.
   Low latency, bidirectional, supports streaming screenshots and live DOM updates.

4. **CDP (Chrome DevTools Protocol)** — The extension uses CDP for debug-grade access:
   network interception, performance profiling, JS coverage, DOM snapshots. This is
   what makes it "not 1985 Playwright."

5. **State Engine** — JSON-based persistent state with heartbeat ticks, checkpoint/restore,
   and crash recovery. The agent can die and resume where it left off.

## Tool Manifest

| Tool | Capability | Protocol |
|------|-----------|----------|
| pilot-browser | Navigate, click, type, read A11y tree, screenshot, find elements | Extension → CDP |
| pilot-shell | Execute commands, manage background processes, stream output | subprocess |
| pilot-vision | Screenshot capture, element coordinate mapping, visual diff | Extension → CDP |
| pilot-state | Checkpoint, restore, heartbeat, crash recovery | File I/O |
| pilot-debug | Execution trace, network log, performance profile, action replay | All channels |
