# Scaffolding Complete: OPEN ANVIL

## Project Structure

```
open-anvil/
├── extension/                    # Chrome Extension (MV3)
│   ├── manifest.json            # Stripped: no sidePanel, nativeMessaging, offscreen audio
│   ├── background.js            # TO BUILD: WS client + tool router
│   ├── cdp.js                   # Verbatim from Floyd
│   ├── accessibility-tree.js    # Verbatim from Floyd
│   ├── content-script.js        # Verbatim from Floyd
│   ├── distill-dom.js           # Verbatim from Floyd
│   ├── dom-observer.js          # Verbatim from Floyd
│   ├── set-of-marks.js          # Verbatim from Floyd
│   ├── ref-tools.js             # Verbatim from Floyd
│   ├── vision-tools.js          # Verbatim from Floyd
│   ├── network-monitor.js       # Verbatim from Floyd
│   ├── gif-recorder.js          # Verbatim from Floyd
│   ├── quick-mode.js            # Verbatim from Floyd
│   ├── net-rules.js             # Verbatim from Floyd
│   ├── ui-gate.js               # Verbatim from Floyd
│   ├── agent-indicator.js       # Verbatim from Floyd
│   ├── checkpoint.js            # Verbatim (heartbeat extension in Phase 3)
│   ├── workflow-recorder.js     # Verbatim from Floyd
│   ├── offscreen-worker.html    # Stripped of Gemini audio
│   ├── offscreen-worker.js      # Stripped of Gemini audio
│   └── icons/                   # Extension icons
├── mcp-server/                  # Node.js MCP Server
│   ├── server.js                # TO BUILD: MCP stdio + WS server
│   ├── tool-definitions.js      # Extracted from Floyd mcp-server.js
│   ├── package.json             # Exact: ws@8.19.0
│   └── package-lock.json        # Generated, locked
├── sdk/                         # Client libraries (Phase 5)
│   ├── node/                    # Node.js SDK
│   └── cli/                     # CLI wrapper
├── debug/                       # Trace output directory
├── state/                       # Checkpoint/heartbeat state
├── test/                        # Tests
├── pipeline/                    # A-Team pipeline artifacts
│   ├── artifacts/
│   │   ├── SPEC.md
│   │   └── TECHNICAL-REVIEW.md
│   ├── receipts/
│   └── state/
├── .env.example                 # Environment config template
├── .gitignore                   # Excludes node_modules, state, debug, .env
└── package.json                 # Root workspace manifest
```

## Dependencies Installed

### Production Dependencies
| Package | Version | Rationale |
|---------|---------|-----------|
| ws | 8.19.0 | WebSocket server for MCP ↔ extension bridge. Pure JS, zero sub-deps, 0 vulnerabilities. Only external dep needed. |

### Development Dependencies
None — keeping it minimal for v1. Tests use Node's built-in test runner.

## Lock Verification
- [x] Lock file generated (package-lock.json)
- [x] Install successful (0 vulnerabilities)
- [x] Build: N/A (no build step — vanilla JS)
- [x] Dev server: pending (server.js not yet written)

## Files Carried from Floyd TTY Bridge v5.1.0
- 14 files copied verbatim (content scripts, CDP, utilities)
- 2 files renamed (offscreen → offscreen-worker)
- 1 file extracted for reference (mcp-server.js → tool-definitions.js)
- 1 file kept as reference (background-floyd-original.js)

## Files Removed (Floyd-Specific)
- sidepanel.js / sidepanel.html (terminal UI)
- live-service.js (Gemini Live)
- interceptors-main.js (Gemini interceptor)
- lab_bridge.js (Floyd Lab bridge)
- floyd_explorer.py (file explorer)
- native_host.py (PTY bridge — replaced by Node MCP server)
- floyd-tools.sh (Bash SDK with OSC protocol)
- lib/genai.mjs, lib/xterm.js, lib/xterm.css (Gemini + terminal)
- audio/ directory (Gemini audio assets)

## Manifest Changes (Floyd → Open Anvil)
| Permission | Floyd | Open Anvil | Reason |
|-----------|-------|------------|--------|
| nativeMessaging | Yes | **No** | Replaced by WebSocket to MCP server |
| sidePanel | Yes | **No** | No terminal UI needed |
| offscreen | Yes | **Yes** | Kept for GIF recording canvas ops |
| unlimitedStorage | Yes | **No** | Not needed without knowledge base |

## Scripts Available
- `npm start` — Run MCP server (root)
- `npm test` — Run tests via Node test runner

## Confidence Score
9/10 — Clean scaffold with exact versions, proven verbatim files, and clear build targets.
