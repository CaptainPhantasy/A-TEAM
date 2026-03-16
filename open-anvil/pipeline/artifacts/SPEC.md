# Project Specification: OPEN ANVIL
## Vendor-Agnostic Agent Pilot — Refactored from Floyd TTY Bridge v5.1.0

---

## 1. Executive Summary

Open Anvil is a **vendor-agnostic browser automation toolkit for AI agents**, refactored from the existing Floyd TTY Bridge Chrome extension (v5.1.0). The goal is to strip the PTY/side-panel coupling and produce a **standalone MCP server + Chrome extension** combo that any LLM (Claude, GPT, Gemini, Llama, etc.) can use via the standard Model Context Protocol over stdio.

The Floyd TTY Bridge already has ~90% of the functionality. This is a **surgical refactor**, not a rebuild.

---

## 2. Source of Truth: What Already Exists

### 2.1 Floyd TTY Bridge Inventory (Reusable As-Is)

| File | Lines | Function | Reuse Plan |
|------|-------|----------|------------|
| `cdp.js` | 165 | Chrome DevTools Protocol attach/detach/send with auto-detach timers | **Copy verbatim** |
| `accessibility-tree.js` | 250+ | A11y tree builder with WeakRef element tracking, role mapping, ref IDs | **Copy verbatim** |
| `content-script.js` | ~1000 | DOM interaction: click, type, fill forms, scroll, wait, extract text, CSS | **Copy verbatim** |
| `distill-dom.js` | 200+ | DOM distiller — text_only, input_fields, all_content modes | **Copy verbatim** |
| `dom-observer.js` | 200+ | MutationObserver wrapper — buffers DOM changes for agent consumption | **Copy verbatim** |
| `set-of-marks.js` | 200+ | Numbered visual markers on interactive elements | **Copy verbatim** |
| `ref-tools.js` | 100+ | Element reference ID assignment and lookup | **Copy verbatim** |
| `vision-tools.js` | 350+ | Screenshot capture, visual grounding, element coordinate mapping | **Copy verbatim** |
| `network-monitor.js` | 200+ | Network request/response interception and logging | **Copy verbatim** |
| `checkpoint.js` | 177 | Session checkpoint save/restore (URL, scroll, refs, tab group) | **Copy + extend with heartbeat** |
| `gif-recorder.js` | 300+ | GIF frame capture and assembly | **Copy verbatim** |
| `quick-mode.js` | 275+ | Multi-command batch execution | **Copy verbatim** |
| `net-rules.js` | 130+ | Declarative net request rule management | **Copy verbatim** |
| `ui-gate.js` | 85+ | UI permission gating | **Copy verbatim** |
| `agent-indicator.js` | 90+ | Visual indicator showing agent is controlling the page | **Copy verbatim** |

### 2.2 Files That Need Refactoring

| File | Lines | Current Role | Refactor Needed |
|------|-------|-------------|-----------------|
| `mcp-server.js` | 400+ | MCP JSON-RPC server embedded in Node CLI | **Extract tool definitions + dispatch table. Rewrite transport layer from readline/stdio to WebSocket client that talks to the extension's background.js** |
| `native_host.py` | 500+ | PTY manager + Chrome native messaging bridge (OSC 7701/7702) | **Strip PTY/OSC logic. Replace with a standalone MCP stdio server that relays to the extension via native messaging OR WebSocket** |
| `background.js` | 600+ | Service worker — native host connection, tool routing, tab management | **Refactor to accept connections from both native messaging AND a WebSocket server, so external MCP servers can talk to it** |
| `sidepanel.js` | 1000+ | Side panel UI + terminal emulator + proxy mode polling | **NOT NEEDED for Open Anvil. The side panel is a Floyd-specific UI. Strip entirely.** |
| `sidepanel.html` | 350+ | Side panel HTML | **NOT NEEDED** |
| `floyd-tools.sh` | 280+ | Bash SDK with OSC/proxy mode detection | **Rewrite as a thin MCP client wrapper OR provide equivalent Python/Node SDK** |
| `manifest.json` | 142 | Extension manifest with nativeMessaging, sidePanel, etc. | **Simplify: remove sidePanel, keep debugger, tabs, scripting, nativeMessaging. Add externally_connectable for WebSocket.** |

### 2.3 Files to Remove

| File | Reason |
|------|--------|
| `sidepanel.js` | Floyd-specific terminal UI |
| `sidepanel.html` | Floyd-specific terminal UI |
| `live-service.js` | Gemini Live integration (Floyd-specific) |
| `offscreen.js` / `offscreen.html` | Audio capture for Gemini (Floyd-specific) |
| `interceptors-main.js` | Gemini interceptor (Floyd-specific) |
| `lab_bridge.js` | Floyd Lab-specific bridge |
| `audio/` directory | Gemini audio assets |
| `floyd_explorer.py` | Floyd-specific file explorer |
| `workflow-recorder.js` | May keep later, but not MVP |

---

## 3. Target Architecture

### 3.1 Communication Flow

```
┌──────────────────┐     stdio (MCP)     ┌─────────────────────────────┐
│  ANY LLM         │◄──────────────────►│  open-anvil-mcp             │
│  (Claude Code,   │  JSON-RPC 2.0      │  (Node.js)                  │
│   GPT, Gemini,   │                    │                             │
│   Llama, etc.)   │                    │  Transports:                │
│                  │                    │  • stdin/stdout ←→ LLM      │
│                  │                    │  • WebSocket server :7777   │
└──────────────────┘                    │    ←→ Chrome extension      │
                                        └──────────────┬──────────────┘
                                                       │
                                            WebSocket (localhost:7777)
                                            Extension connects as CLIENT
                                                       │
                                        ┌──────────────▼──────────────┐
                                        │  CHROME EXTENSION            │
                                        │  (Manifest V3)               │
                                        │                              │
                                        │  background.js               │
                                        │  ├─ WS client → MCP server  │
                                        │  ├─ cdp.js                   │
                                        │  ├─ checkpoint.js            │
                                        │  ├─ tool router              │
                                        │  │                           │
                                        │  Content Scripts:             │
                                        │  ├─ accessibility-tree.js    │
                                        │  ├─ content-script.js        │
                                        │  ├─ distill-dom.js           │
                                        │  ├─ dom-observer.js          │
                                        │  ├─ ref-tools.js             │
                                        │  ├─ set-of-marks.js          │
                                        │  └─ vision-tools.js          │
                                        └──────────────────────────────┘
```

### 3.2 Key Design Decision: MCP Server as WebSocket Server (REVISED per Technical Review A-1)

**Problem**: MV3 service workers CANNOT run WebSocket servers (no TCP bind capability, suspended after ~30s of inactivity). The original plan to put the WS server in background.js is technically impossible.

**Solution**: The **Node.js MCP server** runs the WebSocket server on localhost:7777. The extension's background.js connects as a **WebSocket client** when the service worker starts.

```
LLM ←─ stdio/MCP ─→ open-anvil-mcp (Node, WS server :7777) ←─ WS client ─→ background.js
```

Why this is better:
- Node process is long-lived (no service worker suspension issues)
- Extension reconnects automatically on service worker wake-up
- Multiple extensions can connect to one MCP server
- No port-binding in restricted service worker context
- Keep-alive alarm (24s interval, from Floyd) prevents unnecessary suspension

This means:
1. `open-anvil-mcp` (Node) listens on `ws://127.0.0.1:7777` (configurable)
2. Extension's background.js connects as WS client on startup + alarm wake
3. MCP server speaks stdio/MCP to the LLM and WebSocket JSON to the extension
4. Multiple LLMs can share one MCP server instance

---

## 4. Functional Requirements

### 4.1 Tool Categories (from existing mcp-server.js — 40+ tools)

**Navigation (7 tools)**
- `navigate_to` — Navigate tab to URL
- `open_tab` — Open new tab
- `close_tab` — Close tab by ID
- `switch_tab` — Activate tab
- `list_tabs` — List all tabs
- `get_tab_state` — Tab metadata
- `get_page_state` — URL, title, viewport, scroll

**Interaction (12 tools)**
- `click_element` — Click by CSS selector
- `click_ref` — Click by ref ID
- `click_mark` — Click by Set-of-Marks number
- `type_text` — Type into input
- `type_ref` — Type by ref ID
- `fill_form` — Fill multiple fields
- `select_option` — Select dropdown option
- `scroll_to` — Scroll by direction/selector
- `scroll_to_ref` — Scroll ref into view
- `wait_for_element` — Wait for selector

**Analysis (7 tools)**
- `analyze_page` — Comprehensive page analysis
- `analyze_element` — Deep element analysis
- `find_elements` — Search by text/aria/role
- `extract_text` — Extract text from elements
- `extract_css` — Get computed styles
- `check_accessibility` — A11y audit
- `check_contrast` — Color contrast check

**Capture (6 tools)**
- `take_screenshot` — Tab screenshot (base64)
- `read_page` — Accessibility tree output
- `read_console` — Console log capture
- `distill_dom` — Distilled DOM content
- `get_dom_changes` — Buffered mutations
- `read_network` — Network event log

**Agent (5 tools)**
- `set_of_marks` — Render numbered markers
- `quick` — Batch command execution
- `write_observation` — Save observation to scratchpad
- `read_commands` — Read pending command queue
- `query_knowledge` — Knowledge base search

**Platform (5 tools)**
- `download` — Start browser download
- `download_status` — Check download progress
- `add_net_rule` — Declarative network rule
- `remove_net_rule` — Remove network rule
- `checkpoint_save` — Save session state

**State (NEW — 4 tools)**
- `checkpoint_save` — Save automation state (exists, keep)
- `checkpoint_restore` — Restore state (exists, keep)
- `heartbeat_tick` — **NEW**: Record heartbeat, check health, detect stuck loops
- `state_dump` — **NEW**: Dump full state for debug/recovery

**Debug (NEW — 3 tools)**
- `debug_trace` — **NEW**: Start/stop execution tracing
- `debug_network_log` — **NEW**: Structured network log with timing
- `debug_action_replay` — **NEW**: Replay recorded actions for regression testing

### 4.2 MCP Server Requirements

- Implements MCP protocol version `2024-11-05` (JSON-RPC 2.0 over stdio)
- Exposes all tools above via `tools/list` and `tools/call`
- **Runs WebSocket server** on `ws://127.0.0.1:7777` (configurable via `--port` flag)
- Accepts WebSocket connections from the Chrome extension
- Graceful degradation: if extension not connected, return clear error "Extension not connected. Open Chrome with Open Anvil extension loaded."
- Request timeout: 30s default per tool call
- Concurrent requests: queue and serialize (Chrome can only handle one debugger action at a time per tab)
- Queues incoming tool calls during brief extension disconnects (< 5s) for reconnect delivery
- Shell execution tools (`execute_shell`) run via Node `child_process`, NOT routed to extension

### 4.3 Extension Requirements

- Manifest V3 (NO `"type": "module"` — use `importScripts()` for background dependencies)
- WebSocket **client** in background.js connecting to `ws://127.0.0.1:7777`
- Auto-reconnect on service worker wake-up with exponential backoff
- Keep-alive alarm at 24s interval to prevent premature service worker suspension
- Accept tool call JSON from MCP server, route to appropriate handler, return result
- All existing content scripts loaded as-is
- CDP integration for debugger-level access
- Offscreen document retained (stripped of Gemini audio) for GIF recording + canvas ops
- No side panel, no terminal, no Gemini integration
- Clean install: `chrome://extensions` → Load unpacked → done

### 4.4 SDK / Client Libraries

**Node.js client** (for programmatic use):
```javascript
import { OpenAnvil } from 'open-anvil';
const anvil = new OpenAnvil({ port: 7777 });
await anvil.navigate('https://example.com');
const tree = await anvil.readPage({ filter: 'interactive' });
await anvil.click({ ref: tree.elements[0].ref });
```

**CLI wrapper** (for shell scripts):
```bash
anvil navigate "https://example.com"
anvil read-page --filter interactive
anvil click --ref ref_1
```

**skills.json** (universal tool schema):
A single JSON file that describes all tools in a format parseable by OpenAI function calling, Anthropic tool use, Google function declarations, and MCP tool schemas. One source of truth, four output formats.

---

## 5. Non-Functional Requirements

### 5.1 Performance
- Tool call round-trip: <200ms for DOM operations, <500ms for screenshots
- WebSocket latency: <5ms localhost
- MCP response streaming for large outputs (a11y trees, DOM distills)

### 5.2 Security
- WebSocket server binds to 127.0.0.1 ONLY (no external access)
- No credentials stored in extension storage
- Tool calls logged to debug trace (opt-in)
- Extension permissions minimized from Floyd's 15 to essential set

### 5.3 Reliability
- Extension reconnects WebSocket automatically on disconnect
- MCP server queues requests during brief disconnects
- Checkpoint/restore survives Chrome restarts
- Heartbeat detects stuck agents (no action for 60s → alert)

### 5.4 Compatibility
- Chrome 116+ (Manifest V3 requirement)
- macOS, Linux, Windows (native messaging paths differ)
- Node.js 20+ for MCP server
- Any MCP-compatible LLM client

---

## 6. Refactor Roadmap (Phased)

### Phase 1: Strip & Clean (Extension)
**Goal**: Remove all Floyd-specific code from the extension. End state: clean extension that accepts WebSocket connections and routes tool calls.

1. **Fork** the `extension/` directory into `open-anvil/extension/`
2. **Delete**: `sidepanel.js`, `sidepanel.html`, `live-service.js`, `offscreen.js`, `offscreen.html`, `interceptors-main.js`, `lab_bridge.js`, `audio/`, `floyd_explorer.py`
3. **Simplify** `manifest.json`: remove `sidePanel`, `offscreen` permissions, remove side panel content scripts, keep `debugger`, `tabs`, `scripting`, `storage`, `tabGroups`
4. **Refactor** `background.js`:
   - Remove all native host PTY management code
   - Remove all side panel communication code
   - Remove Gemini/Tom integration
   - Add WebSocket server (use `chrome.runtime` or a simple WS implementation)
   - Keep tool routing logic intact (the `handleBrowserApiTool` switch statement)
   - Keep native messaging as an alternative transport
5. **Verify**: Load extension in Chrome, confirm no errors, confirm WebSocket server starts

### Phase 2: MCP Server (Node.js)
**Goal**: Standalone Node.js process that speaks MCP stdio on one side and runs a WebSocket server that the extension connects to.

1. **Create** `open-anvil/mcp-server/server.js`:
   - Import tool definitions from `mcp-server.js` (the schema is already MCP-compatible)
   - Implement MCP protocol: `initialize`, `tools/list`, `tools/call`
   - **Run WebSocket server** on `ws://127.0.0.1:7777` (configurable `--port`)
   - Accept WebSocket connections from extension's background.js
   - Request/response correlation via message IDs
   - Timeout handling (30s default)
   - Queue serialization for concurrent requests
   - Queue tool calls during brief extension disconnects (< 5s)
   - Shell execution via Node `child_process.exec` (not routed to extension)
2. **Create** `open-anvil/mcp-server/package.json`: dependencies: `ws` only
3. **Create** install script that:
   - Installs Node dependencies
   - Generates MCP config snippet for Claude Code (`~/.claude/mcp_servers.json`)
4. **Verify**: Run server, start extension, confirm WS connection, execute `list_tabs`, get result

### Phase 3: State Engine
**Goal**: Add heartbeat, crash recovery, and state persistence for autonomous agents.

1. **Extend** `checkpoint.js` with:
   - `heartbeat_tick`: Records timestamp + current action + step count
   - Stuck detection: if same action repeated 3+ times, flag
   - State dump: serialize full agent state to JSON
2. **Add** `state-engine.js` to MCP server:
   - JSON file-based state store (configurable path)
   - Heartbeat monitoring: ping extension every 10s
   - Crash recovery: on MCP server restart, read last checkpoint, resume
3. **Verify**: Kill MCP server mid-operation, restart, confirm it resumes from checkpoint

### Phase 4: Debug System
**Goal**: Full execution tracing, action replay, and diagnostic tools.

1. **Add** debug trace logger to MCP server:
   - Every tool call logged with: timestamp, tool name, args, result summary, duration
   - Trace written to `open-anvil/debug/trace-{session}.jsonl`
2. **Add** network log aggregator:
   - Structured log from `network-monitor.js` output
   - Timing waterfall data
3. **Add** action replay:
   - Record all tool calls in a session
   - Replay them against the same page for regression testing
4. **Verify**: Run a build session, inspect trace, replay it

### Phase 5: SDK & Distribution
**Goal**: Client libraries, CLI, and universal tool schema.

1. **Create** `open-anvil/sdk/node/` — Node.js client library
2. **Create** `open-anvil/sdk/cli/` — Shell CLI (`anvil navigate`, `anvil click`, etc.)
3. **Generate** `skills.json` — Universal tool schema in 4 formats:
   - MCP (native)
   - OpenAI function calling
   - Anthropic tool use
   - Google function declarations
4. **Create** install/config guides for:
   - Claude Code (`~/.claude/mcp_servers.json`)
   - ChatGPT (via custom GPT function definitions)
   - Local Ollama/LM Studio (via MCP bridge)
5. **Verify**: Connect Claude Code to Open Anvil, run the Floyd Anvil HTML test from earlier

---

## 7. Success Criteria

- [ ] Extension loads in Chrome with zero errors
- [ ] MCP server starts and connects to extension
- [ ] `list_tabs` returns real tab data through MCP stdio
- [ ] `navigate_to` + `read_page` + `click_ref` flow works end-to-end
- [ ] `take_screenshot` returns base64 image through MCP
- [ ] Checkpoint save/restore survives server restart
- [ ] Heartbeat detects stuck agent within 60s
- [ ] Debug trace captures full session with timing
- [ ] Claude Code can use Open Anvil as an MCP server
- [ ] `skills.json` is parseable by OpenAI, Anthropic, and Google function calling formats
- [ ] Zero Floyd-specific code remains in the extension

---

## 8. Out of Scope (v1.0)

- Side panel terminal UI (that's Floyd's thing)
- Gemini Live / Tom the Peep integration
- Knowledge base / vector search (can be added as separate MCP server)
- Workflow recorder (Phase 2 feature)
- WASM execution sandbox (Phase 2 feature)
- Audio capture (Floyd-specific)
- Multi-browser support (Chrome only for v1)

---

## 9. Assumptions

- Chrome 116+ is available on the target machine
- Node.js 20+ is installed
- The user can load an unpacked extension in Chrome
- The user understands what MCP is and how to configure it in their LLM client
- The Floyd TTY Bridge v5.1.0 codebase is the source of truth at `/Volumes/Storage/Floyd TTY Bridge for Chrome/`
- All 108 existing tests pass (confirmed in TTY_TOOL_ISSUES.md)

---

## 10. File-by-File Refactor Checklist

```
COPY VERBATIM (no changes needed):
  □ cdp.js
  □ accessibility-tree.js
  □ content-script.js
  □ distill-dom.js
  □ dom-observer.js
  □ set-of-marks.js
  □ ref-tools.js
  □ vision-tools.js
  □ network-monitor.js
  □ gif-recorder.js
  □ quick-mode.js
  □ net-rules.js
  □ ui-gate.js
  □ agent-indicator.js

REFACTOR:
  □ background.js → strip PTY/sidepanel, add WebSocket server
  □ mcp-server.js → extract tool schemas, new transport layer
  □ checkpoint.js → add heartbeat_tick + state_dump
  □ manifest.json → simplify permissions, remove sidePanel
  □ native_host.py → REPLACE with Node MCP stdio server

DELETE:
  □ sidepanel.js
  □ sidepanel.html
  □ live-service.js
  □ offscreen.js / offscreen.html
  □ interceptors-main.js
  □ lab_bridge.js
  □ audio/
  □ floyd_explorer.py

CREATE NEW:
  □ mcp-server/server.js — MCP stdio ↔ WebSocket bridge
  □ mcp-server/package.json
  □ state-engine.js — heartbeat + crash recovery
  □ debug/tracer.js — execution trace logger
  □ sdk/node/index.js — Node client library
  □ sdk/cli/anvil.js — CLI wrapper
  □ skills.json — universal tool schema
  □ install.sh — cross-platform installer
  □ README.md
```
