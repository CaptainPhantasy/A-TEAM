# Implementation Report: OPEN ANVIL v1.0.0

## Features Implemented

### F1: MCP Server (server.js)
- **Status**: WORKING
- MCP JSON-RPC 2.0 over stdio (protocol version 2024-11-05)
- `initialize` returns server info and capabilities
- `tools/list` returns 42 tool definitions with complete inputSchema
- `tools/call` dispatches to extension (via WebSocket) or handles locally
- WebSocket server on ws://127.0.0.1:7777
- Request/response correlation with timeout (30s default)
- Graceful degradation when extension not connected
- Signal handling (SIGINT, SIGTERM)

### F2: Extension Background (background.js)
- **Status**: BUILT (needs Chrome load test)
- WebSocket CLIENT connecting to MCP server
- Auto-reconnect with exponential backoff (max 20 attempts)
- Keep-alive alarm every 24s to prevent service worker suspension
- Tool routing: background API tools handled locally, rest forwarded to content scripts
- Content script auto-injection on fresh tabs
- Browser event forwarding to MCP server
- GIF routing through offscreen worker document
- Tab group management (create, manage, auto-join)
- All Floyd-specific code removed (no nativeMessaging, no sidePanel, no PTY, no Gemini)

### F3: Content Scripts (14 files, verbatim from Floyd v5.1.0)
- **Status**: COPIED
- accessibility-tree.js — A11y tree with WeakRef tracking
- content-script.js — Click, type, fill, scroll, wait, extract
- distill-dom.js — DOM distillation (text_only, input_fields, all_content)
- dom-observer.js — MutationObserver buffering
- set-of-marks.js — Visual numbered markers
- ref-tools.js — Element ref ID system
- vision-tools.js — Screenshot coordinate mapping
- network-monitor.js — Request/response interception
- gif-recorder.js — GIF frame capture
- quick-mode.js — Batch command execution
- net-rules.js — Declarative network rules
- ui-gate.js — UI permission gating
- agent-indicator.js — Agent control indicator
- checkpoint.js — Session save/restore
- workflow-recorder.js — Action recording

### F4: Local Shell Execution
- **Status**: WORKING
- `execute_shell` tool handles commands via Node child_process
- Timeout support (default 30s)
- Returns stdout, stderr, and exit code
- Runs in MCP server process (not forwarded to extension)

### F5: Manifest (Clean MV3)
- **Status**: BUILT
- Stripped: nativeMessaging, sidePanel, unlimitedStorage, audio resources
- Kept: debugger, tabs, scripting, storage, tabGroups, downloads, alarms, notifications, offscreen, webNavigation, declarativeNetRequestWithHostAccess
- 9 content scripts properly ordered (document_start before document_idle)
- CSP allows wasm-unsafe-eval for future WASM support

### F6: Offscreen Worker
- **Status**: BUILT
- Stripped all Gemini audio (playPcmAudio, playAudioUrl, WASM hash)
- Kept GIF recording pipeline
- Clean message handler

## Test Results

| Test | Method | Result |
|------|--------|--------|
| MCP initialize | stdio pipe | PASS — correct protocol response |
| MCP tools/list | stdio pipe | PASS — 42 tools with schemas |
| MCP execute_shell | stdio pipe | PASS — "hello from open anvil" |
| MCP navigate_to (no ext) | stdio pipe | PASS — graceful error |
| npm install | CLI | PASS — 0 vulnerabilities |
| Package lock | CLI | PASS — locked at ws@8.19.0 |

## Tool Count

| Category | Count | Examples |
|----------|-------|---------|
| Navigation | 7 | navigate_to, list_tabs, open_tab |
| Interaction | 10 | click_element, type_text, fill_form |
| Analysis | 7 | analyze_page, find_elements, check_accessibility |
| Capture | 6 | take_screenshot, read_page, distill_dom |
| Agent | 2 | set_of_marks, quick |
| Platform | 6 | download, add_net_rule, checkpoint_save |
| GIF | 3 | gif_start, gif_add_frame, gif_stop |
| Shell | 1 | execute_shell |
| **Total** | **42** | |

## Architecture Verification
- [x] No Floyd-specific code in background.js
- [x] No nativeMessaging in manifest
- [x] No sidePanel in manifest or background
- [x] No Gemini/Tom references
- [x] No PTY/OSC protocol code
- [x] WebSocket direction: MCP server = server, extension = client
- [x] Keep-alive alarm prevents service worker suspension
- [x] Offscreen worker stripped to GIF-only

## Confidence Score
8/10 — MCP server fully tested via stdio. Extension needs Chrome load test to verify WebSocket connectivity and content script routing.
