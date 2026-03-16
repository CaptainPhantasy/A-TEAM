# Open Anvil — Architecture

## Communication Flow

```
┌─────────────┐     MCP/stdio      ┌─────────────────┐    WebSocket     ┌──────────────────┐
│  ANY LLM    │◄──────────────────►│  MCP SERVER      │◄───────────────►│  CHROME EXTENSION │
│  (Claude,   │  JSON-RPC 2.0      │  (Node.js)       │  localhost:7777  │  (Manifest V3)    │
│   GPT,      │                    │                  │                 │                    │
│   Gemini,   │                    │  ┌────────────┐  │  event stream   │  ┌──────────────┐  │
│   Llama)    │                    │  │ TOOLS:     │  │◄────────────────│  │ background.js│  │
│             │                    │  │ • browser  │  │  (perception    │  │ (service wkr)│  │
│             │                    │  │ • shell    │  │   events, DOM   │  │              │  │
│             │                    │  │ • vision   │  │   snapshots,    │  │ content.js   │  │
│             │                    │  │ • state    │  │   scroll, nav)  │  │ (DOM/A11y)   │  │
│             │                    │  │ • perceive │  │                 │  │              │  │
│             │                    │  └────────────┘  │                 │  │ event-stream │  │
│             │                    │                  │                 │  │ (DOM sensor) │  │
│             │                    │  ┌────────────┐  │                 │  └──────────────┘  │
│             │                    │  │ PERCEPTION │  │                 │                    │
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
                                   │  (managed   │                     │  PROTOCOL         │
                                   │   processes)│                     │  (debugger,       │
                                   └─────────────┘                     │   network,        │
                                                                       │   performance)    │
                                          ▲                            └──────────────────┘
                                          │ file I/O
                                          ▼
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

6. **Perception Engine** — Server-side living page model. The extension streams DOM events
   to the server, which maintains per-tab page models with per-agent cursors. One call to
   `perceive` returns only what changed since the last call — snapshots on first call or
   navigation, deltas for DOM mutations, no_change when idle. Reduces text-mode agent
   token cost from ~2-3K (3-4 calls) to ~80-800 (1 call).

## Perception Data Flow

```
BEFORE (v1.0):  LLM → server (dumb relay) → extension (smart router) → content scripts
AFTER  (v1.1):  LLM → server (perception engine) ← extension (event streamer) ← content scripts
```

The extension's `event-streamer.js` hooks into `dom-observer.js` and streams batched DOM events
(100ms intervals, max 50/batch) to `background.js`, which forwards them to the server over WS.
The server's `PerceptionEngine` maintains a `PageModel` per tab and an `AgentCursor` per agent.
When an agent calls `perceive`, the engine computes only the delta since that agent's last call.

Delta compaction rules:
- Add + remove of the same ref cancel out (element flicker eliminated)
- Multiple attribute changes to the same attribute collapse to first old → last new
- Multiple text changes collapse to first old → last new

## Tool Manifest (45 Tools)

| Category | Tools | Count | Protocol |
|----------|-------|-------|----------|
| Navigation | navigate_to, open_tab, close_tab, switch_tab, list_tabs, get_tab_state, get_page_state | 7 | Extension → Chrome API |
| Interaction | click_element, type_text, fill_form, select_option, scroll_to, wait_for_element, click_ref, type_ref, scroll_to_ref, click_mark | 10 | Extension → Content Script |
| Analysis | analyze_page, analyze_element, find_elements, extract_text, extract_css, check_accessibility, check_contrast | 7 | Extension → Content Script |
| Capture | take_screenshot, read_page, read_console, distill_dom, get_dom_changes, read_network | 6 | Extension → CDP / Content Script |
| Agent | set_of_marks, quick | 2 | Extension → Content Script |
| Platform | download, download_status, add_net_rule, remove_net_rule, checkpoint_save, checkpoint_restore | 6 | Extension → Chrome API / File I/O |
| GIF | gif_start, gif_add_frame, gif_stop | 3 | Extension → Offscreen Worker |
| Shell | execute_shell | 1 | Server → subprocess |
| Perception | perceive, subscribe, get_perception_status | 3 | Server → Perception Engine |
