# Open Anvil — Architecture

## Dual-Channel Communication

Open Anvil supports two communication paths between the MCP server and the Chrome extension. Both can run simultaneously (badge shows purple ●).

### Channel 1: WebSocket (default)

```
┌─────────────┐     MCP/stdio      ┌─────────────────┐    WebSocket     ┌──────────────────┐
│  ANY LLM    │◄──────────────────►│  MCP SERVER      │◄───────────────►│  CHROME EXTENSION │
│  (Claude,   │  JSON-RPC 2.0      │  (Node.js)       │  localhost:7777  │  (Manifest V3)    │
│   GPT,      │                    │                  │                 │                    │
│   Gemini,   │                    │  ┌────────────┐  │  tool_call      │  ┌──────────────┐  │
│   Llama)    │                    │  │ TOOLS:     │  │◄────────────────│  │ background.js│  │
│             │                    │  │ • browser  │  │  tool_response  │  │ (service wkr)│  │
│             │                    │  │ • vision   │  │  perception_*   │  │              │  │
│             │                    │  │ • state    │  │                 │  │ content.js   │  │
│             │                    │  │ • perceive │  │                 │  │ (DOM/A11y)   │  │
│             │                    │  └────────────┘  │                 │  │              │  │
│             │                    │                  │                 │  │ event-stream │  │
│             │                    │  ┌────────────┐  │                 │  │ (DOM sensor) │  │
│             │                    │  │ PERCEPTION │  │                 │  └──────────────┘  │
│             │                    │  │ ENGINE     │  │                 │                    │
│             │                    │  │ • models   │  │                 │                    │
│             │                    │  │ • cursors  │  │                 │                    │
│             │                    │  │ • deltas   │  │                 │                    │
│             │                    │  └────────────┘  │                 │                    │
└─────────────┘                    └─────────────────┘                 └──────────────────┘
                                          │                                     │
                                          │ subprocess                          │ CDP
                                          ▼                                     ▼
                                   ┌─────────────┐                     ┌──────────────────┐
                                   │  OS SHELL   │                     │  CHROME DEVTOOLS  │
                                   │  (opt-in,   │                     │  PROTOCOL         │
                                   │   rate-ltd) │                     │  (debugger, etc)  │
                                   └─────────────┘                     └──────────────────┘
```

### Channel 2: Native Messaging (persistent pipe)

```
┌─────────────┐     MCP/stdio      ┌─────────────────┐  anvil/tool_call  ┌──────────────────┐
│  NATIVE     │◄──────────────────►│  MCP SERVER      │◄────────────────►│  NATIVE HOST     │
│  HOST       │  JSON-RPC 2.0      │  (Node.js)       │  JSON-RPC notif   │  (Python)         │
│  (Chrome)   │                    │  MCP_TRANSPORT   │                  │                  │
│             │                    │  =stdio mode     │                  │  ┌────────────┐  │
│             │                    │                  │                  │  │ 4-byte LE  │  │
│             │                    │  WS on :7778     │                  │  │ wire fmt   │  │
│             │                    │  (for pi/other   │                  │  │ + JSON     │  │
│             │                    │   MCP clients)   │                  │  └─────┬──────┘  │
└─────────────┘                    └─────────────────┘                        │
                                                                          │ native msg
                                                                          ▼
                                                                   ┌──────────────────┐
                                                                   │  CHROME EXTENSION │
                                                                   │  background.js    │
                                                                   │  (persistent)     │
                                                                   └──────────────────┘
```

The native messaging channel is managed by Chrome — it never goes stale because Chrome
controls the native host lifecycle. When Chrome closes, the host exits. When Chrome opens,
the host restarts.

### Protocol Translation (Native Host)

The native host translates between two wire formats:

| Direction | From | To |
|-----------|------|----|
| Server → Extension | `{"jsonrpc":"2.0","method":"anvil/tool_call","params":{...}}` | `{"type":"mcp_tool_call","requestId":"...","tool":"...","args":{...}}` |
| Extension → Server | `{"type":"tool_response","requestId":"...","success":true,"result":{...}}` | `{"jsonrpc":"2.0","method":"anvil/tool_response","params":{...}}` |
| Extension → Server | `{"type":"mcp_perception_events","tabId":1,...}` | `{"jsonrpc":"2.0","method":"anvil/perception","params":{"type":"perception_events",...}}` |
| Extension → Server | `{"type":"mcp_perception_snapshot",...}` | `{"jsonrpc":"2.0","method":"anvil/perception","params":{"type":"perception_snapshot",...}}` |

### Badge States

| Badge | Color | Meaning |
|-------|-------|---------|
| ● | Purple | Both channels active (WS + native) |
| WS | Green | WebSocket only |
| NM | Blue | Native messaging only |
| (empty) | — | Disconnected |

## Why This Architecture

1. **Chrome Extension** — Not Playwright. Full page context access, no CORS, no proxy,
   reads the real accessibility tree, executes JS in page scope, intercepts network,
   captures screenshots via CDP. Works on ANY page including auth-walled ones.

2. **MCP Protocol** — Vendor-agnostic. Any LLM that speaks MCP JSON-RPC 2.0 can use
   the tools. Claude, GPT, Gemini, Llama, GLM — doesn't matter.

3. **Dual Channel** — WebSocket for low-latency direct connections. Native messaging
   for persistent, Chrome-managed pipes that never go stale. Both work simultaneously.

4. **Perception Engine** — Token-efficient page awareness. Instead of dumping the entire
   DOM, it tracks deltas. First call gets a full snapshot, subsequent calls get only
   what changed. Agents save 80-90% on context tokens.

5. **Security** — WS token auth (auto-generated), execute_shell opt-in, rate limiting,
   message size limits. Nothing open by default.

## Transport Modes

### Standalone (default)
- Server spawned by MCP client (pi, Claude Desktop, etc.)
- stdin/stdout = MCP JSON-RPC
- WS on port 7777 for extension
- Token auto-generated on first run

### Native Host (stdio)
- Server spawned by native_host.py
- stdin/stdout = MCP JSON-RPC (to native host)
- WS on port 7778 for secondary MCP clients (pi via ws-bridge)
- Extension communicates via native pipe (translated by native host)
- No WS token needed (local pipe only)

## Components

### MCP Server (`mcp-server/server.js`)
- Speaks MCP JSON-RPC 2.0 on stdin
- WebSocket server for extension + MCP client connections
- Perception engine for token-efficient page awareness
- Rate limiting and security controls

### Chrome Extension (`extension/`)
- `background.js` — Service worker, dual-channel connection, tool routing
- `content-script.js` — DOM interaction, accessibility tree, event monitoring
- `event-streamer.js` — Streams DOM changes to server
- `dom-observer.js` — MutationObserver for perception engine
- `cdp.js` — Chrome DevTools Protocol bridge
- `perception-tools.js` — Perception engine (content script side)

### Native Host (`native_host.py`)
- Chrome native messaging host (4-byte LE + JSON wire format)
- PTY bridge for terminal-in-browser
- MCP subprocess bridge with protocol translation
- Process supervisor for child process management
- File watcher for live reload

### WS Bridge (`mcp-server/ws-bridge.js`)
- Thin stdio→WebSocket proxy
- Allows MCP clients that speak stdio to connect to a WS-based server
- Used when pi needs to reach the native host's server instance

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `ANVIL_PORT` | 7777 | WebSocket port (standalone mode) |
| `ANVIL_WS_PORT` | 7778 | WebSocket port (stdio mode) |
| `ANVIL_HOST` | 127.0.0.1 | WebSocket bind address |
| `ANVIL_WS_TOKEN` | (auto) | WebSocket auth token |
| `ANVIL_SHELL` | false | Enable execute_shell tool |
| `ANVIL_DEBUG` | false | Verbose logging |
| `ANVIL_TIMEOUT` | 30000 | Tool call timeout (ms) |
| `MCP_TRANSPORT` | — | Set to "stdio" for native host mode |
| `MCP_SERVER_PATH` | — | Path to server.js (native host uses this) |
