# Open Anvil v1.1.0 — Complete Deployment & Operations Guide

> Vendor-agnostic browser automation via MCP. 45 tools. Vision + text-only + perception paths.
> This document enables any LLM (no sub-agent capability required) or human operator to deploy and use Open Anvil from scratch.

---

## TABLE OF CONTENTS

1. [What Open Anvil Is](#1-what-open-anvil-is)
2. [Architecture](#2-architecture)
3. [Prerequisites](#3-prerequisites)
4. [Installation — Step by Step](#4-installation--step-by-step)
5. [Configuration Reference](#5-configuration-reference)
6. [Verification Checklist](#6-verification-checklist)
7. [Tool Reference (All 45 Tools)](#7-tool-reference-all-45-tools)
8. [Perception Engine](#8-perception-engine)
9. [Operational Workflows (Recipes)](#9-operational-workflows-recipes)
10. [Quick Mode Command Language](#10-quick-mode-command-language)
11. [Error Reference](#11-error-reference)
12. [Token Budget Guidelines](#12-token-budget-guidelines)
13. [Troubleshooting](#13-troubleshooting)
14. [LLM System Prompt Integration](#14-llm-system-prompt-integration)
15. [Human Headless Deployment Guide](#15-human-headless-deployment-guide)

---

## 1. WHAT OPEN ANVIL IS

Open Anvil is a browser automation system with two components:

- **Chrome Extension** (Manifest V3) — Installed in Chrome. Provides deep page access via content scripts, Chrome DevTools Protocol (CDP), accessibility tree generation, DOM observation, GIF recording, network monitoring, and checkpoint/restore.
- **MCP Server** (Node.js) — Speaks Model Context Protocol (MCP) JSON-RPC 2.0 over stdio. Bridges any LLM to the Chrome extension over a localhost WebSocket on port 7777.

Any LLM that speaks MCP can use Open Anvil: Claude, GPT, Gemini, Llama, or any custom client.

**Key differentiator over Playwright/Puppeteer:** Open Anvil runs inside a real Chrome instance with full extension permissions. It reads the real accessibility tree, works on auth-walled pages, intercepts network traffic, and captures screenshots via CDP. No proxy, no CORS issues, no synthetic browser.

---

## 2. ARCHITECTURE

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
                                                                       └──────────────────┘
```

### Data Flow

1. LLM sends JSON-RPC `tools/call` on stdin to the MCP server.
2. MCP server routes:
   - `execute_shell` → handled locally via `child_process.execSync`.
   - `perceive`, `subscribe`, `get_perception_status` → handled by the server-side Perception Engine.
   - All other tools → forwarded over WebSocket to the Chrome extension.
3. Chrome extension routes to background API or content scripts.
4. Response flows back: extension → WebSocket → MCP server → stdout → LLM.

### Extension Content Scripts (loaded on every page)

| Script | Purpose | Runs In |
|--------|---------|---------|
| `accessibility-tree.js` | Generates the accessibility tree for `read_page` | All frames |
| `ui-gate.js` | UI interaction gating | Main frame |
| `ref-tools.js` | Ref ID generation and lookup for `click_ref`/`type_ref` | All frames |
| `distill-dom.js` | DOM distillation for `distill_dom` | All frames |
| `dom-observer.js` | MutationObserver for DOM changes | All frames |
| `event-streamer.js` | Batches DOM events → background for Perception Engine | Main frame |
| `set-of-marks.js` | Visual numbered markers for `set_of_marks` | All frames |
| `quick-mode.js` | Quick mode command parser for `quick` | All frames |
| `content-script.js` | Core interaction handler (click, type, fill, scroll) | Main frame |
| `agent-indicator.js` | Visual indicator when agent is active | Main frame |

### Extension Background Scripts (service worker)

| Script | Purpose |
|--------|---------|
| `background.js` | WebSocket client, tool router, perception event forwarding |
| `cdp.js` | Chrome DevTools Protocol management |
| `net-rules.js` | Declarative network rules (`add_net_rule`/`remove_net_rule`) |
| `network-monitor.js` | Network request capture for `read_network` |
| `checkpoint.js` | Checkpoint save/restore state management |
| `workflow-recorder.js` | Workflow recording support |

### Offscreen Worker

| File | Purpose |
|------|---------|
| `offscreen-worker.html` + `offscreen-worker.js` | GIF recording via canvas (no DOM needed) |

---

## 3. PREREQUISITES

| Requirement | Minimum Version | Check Command |
|-------------|----------------|---------------|
| Chrome | 116+ | `chrome://version` |
| Node.js | 20.0.0+ | `node --version` |
| npm | (bundled with Node) | `npm --version` |

No other system dependencies. The only npm dependency is `ws` (WebSocket library, version 8.19.0).

---

## 4. INSTALLATION — STEP BY STEP

### Step 4.1: Install the MCP Server

```bash
cd /path/to/open-anvil/mcp-server
npm install
```

**Expected output:** A `node_modules/` directory containing the `ws` package. No errors.

**Verification:**
```bash
ls node_modules/ws/package.json
# Should exist and show version 8.19.0
```

### Step 4.2: Load the Chrome Extension

1. Open Chrome.
2. Navigate to `chrome://extensions` in the address bar.
3. Enable **"Developer mode"** — toggle in the top-right corner.
4. Click **"Load unpacked"**.
5. Select the `open-anvil/extension/` directory (the folder containing `manifest.json`).
6. Verify: **"Open Anvil — Agent Pilot"** appears in the extensions list with no errors.
7. Verify: The extension icon appears in the Chrome toolbar.

**If errors appear on load:** Check that no files reference `sidepanel`, `nativeMessaging`, or `offscreen.js` (the correct file is `offscreen-worker.js`).

### Step 4.3: Configure Your LLM Client

#### Option A: Claude Code CLI

```bash
claude mcp add open-anvil --transport stdio --scope user -- \
  node /absolute/path/to/open-anvil/mcp-server/server.js
```

#### Option B: MCP config file (Claude Desktop, or any MCP client)

Add to your MCP servers configuration (e.g., `~/.claude/mcp_servers.json` or Claude Desktop settings):

```json
{
  "open-anvil": {
    "command": "node",
    "args": ["/absolute/path/to/open-anvil/mcp-server/server.js"],
    "env": {
      "ANVIL_PORT": "7777",
      "ANVIL_DEBUG": "false"
    }
  }
}
```

**CRITICAL:** Use absolute paths. Relative paths will fail if the working directory differs.

#### Option C: Manual stdio (any MCP-compatible client)

```bash
node /absolute/path/to/open-anvil/mcp-server/server.js
```

Send JSON-RPC 2.0 on stdin, receive responses on stdout. Debug logs go to stderr.

### Step 4.4: Verify the Connection

1. The LLM client launches the MCP server process (or you launch it manually).
2. The MCP server starts a WebSocket server on `ws://127.0.0.1:7777`.
3. The Chrome extension's service worker auto-connects to this WebSocket.
4. The extension icon should show a silver badge when connected.

**Test the connection:**

Send this MCP call (your LLM does this automatically when you call `list_tabs`):
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_tabs","arguments":{}}}
```

**Expected:** A JSON response listing your open Chrome tabs.

---

## 5. CONFIGURATION REFERENCE

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANVIL_PORT` | `7777` | WebSocket server port. Extension connects here. |
| `ANVIL_HOST` | `127.0.0.1` | Bind address. `127.0.0.1` = localhost only (secure default). `0.0.0.0` = all interfaces (not recommended). |
| `ANVIL_TIMEOUT` | `30000` | Tool call timeout in milliseconds. If a tool call takes longer, it returns a timeout error. |
| `ANVIL_DEBUG` | `false` | When `true`, writes detailed execution traces to stderr. Also enabled with `--debug` CLI flag. |
| `ANVIL_STATE_DIR` | `./state` | Directory for checkpoint and heartbeat data. |
| `ANVIL_WS_TOKEN` | (empty) | Shared secret for WebSocket authentication. If set, the extension must send a matching token. Set in extension via: `chrome.storage.local.set({ anvilWsToken: 'your-token' })` |

### Extension Constants (in background.js)

| Constant | Value | Description |
|----------|-------|-------------|
| `WS_BASE_URL` | `ws://127.0.0.1:7777` | WebSocket server URL. |
| `RECONNECT_DELAY_BASE` | `1000` | Base reconnect delay in ms. |
| `RECONNECT_MAX_ATTEMPTS` | `20` | Maximum reconnection attempts before giving up. |
| `KEEP_ALIVE_INTERVAL_MIN` | `0.4` | Chrome alarm interval (~24 seconds) to keep service worker alive. |

### Perception Engine Constants (in perception-engine.js)

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_NODES_PER_TAB` | `5000` | Maximum DOM nodes tracked per tab. |
| `MAX_EVENTS_PER_TAB` | `2000` | Maximum events in the event log per tab. Oldest 25% dropped when full. |
| `CURSOR_EXPIRY_MS` | `600000` (10 min) | Idle cursor expiration time. |
| `STALE_MODEL_MS` | `300000` (5 min) | Time after which a page model is marked stale. |

---

## 6. VERIFICATION CHECKLIST

After installation, verify each component:

| # | Check | Command/Action | Expected Result |
|---|-------|---------------|-----------------|
| 1 | Node.js version | `node --version` | `v20.x.x` or higher |
| 2 | npm dependencies installed | `ls open-anvil/mcp-server/node_modules/ws` | Directory exists |
| 3 | Extension loaded | Chrome → `chrome://extensions` | "Open Anvil — Agent Pilot" listed, no errors |
| 4 | Extension service worker active | Click "service worker" link on extension card | DevTools opens without errors |
| 5 | MCP server starts | `node open-anvil/mcp-server/server.js` | Stderr shows: `[anvil] Open Anvil MCP server started` |
| 6 | WebSocket connects | Check extension icon after server starts | Silver badge appears |
| 7 | Tool call works | Call `list_tabs` via your LLM client | Returns array of open tabs |
| 8 | Page reading works | Navigate to a page, call `read_page` | Returns accessibility tree text |

---

## 7. TOOL REFERENCE (ALL 45 TOOLS)

### 7.1 Navigation (7 tools)

| Tool | Required Params | Optional Params | Returns | Protocol |
|------|----------------|-----------------|---------|----------|
| `navigate_to` | `url: string` | — | `{navigated, tabId}` | Extension → Chrome API |
| `open_tab` | `url: string` | — | `{tabId, url}` | Extension → Chrome API |
| `close_tab` | `tab_id: number` | — | `{closed}` | Extension → Chrome API |
| `switch_tab` | `tab_id: number` | — | `{switched}` | Extension → Chrome API |
| `list_tabs` | — | — | `[{tabId, url, title, active, status}]` | Extension → Chrome API |
| `get_tab_state` | — | `tab_id: number` | `{tabId, url, title, status, active}` | Extension → Chrome API |
| `get_page_state` | — | — | `{url, title, viewport, scroll, document_size, ready_state}` | Extension → Chrome API |

### 7.2 Interaction (10 tools)

| Tool | Required Params | Optional Params | Returns |
|------|----------------|-----------------|---------|
| `click_element` | `selector: string` | — | `{clicked}` or `{error}` |
| `click_ref` | `ref: string` | — | `{ref}` |
| `click_mark` | `mark: integer` | — | `{mark, ref, tagName}` |
| `type_text` | `selector: string`, `text: string` | `clear_first: boolean` | `{typed_into, value}` |
| `type_ref` | `ref: string`, `text: string` | — | `{ref, value}` |
| `fill_form` | `fields: [{selector, value}]` | — | `{filled, results[]}` |
| `select_option` | `selector: string`, `value: string` | — | `{selected}` or `{error}` |
| `scroll_to` | `target: string` | — | `{scrolled_to, position}` |
| `scroll_to_ref` | `ref: string` | — | `{ref}` |
| `wait_for_element` | `selector: string` | `timeout: number` (default 5000) | `{selector, wait_time}` |

**`target` for `scroll_to`:** `"top"`, `"bottom"`, `"up"`, `"down"`, or a CSS selector.

**`ref` values** come from `read_page` or `distill_dom` output (e.g., `"ref_15"`). They are stable accessibility-tree references. **Always prefer `click_ref`/`type_ref` over `click_element`/`type_text`** — ref IDs are more stable than CSS selectors.

### 7.3 Analysis (7 tools)

| Tool | Required Params | Optional Params | Returns |
|------|----------------|-----------------|---------|
| `read_page` | — | `depth: number`, `max_chars: number`, `filter: string`, `ref_id: string` | Accessibility tree text |
| `distill_dom` | — | `mode: string`, `depth: number`, `max_chars: number`, `filter: string`, `ref_id: string` | Distilled DOM content |
| `find_elements` | `query: string` | `search_by: string`, `limit: number` | `{results_count, results[]}` |
| `extract_text` | `selector: string` | `limit: number` | `{count, results[]}` |
| `extract_css` | `selector: string` | `properties: string[]` | `{selector, styles}` |
| `analyze_page` | — | `include_accessibility: boolean`, `include_css: boolean`, `viewport_scroll: boolean` | Full page analysis |
| `analyze_element` | `selector: string` | — | Deep element inspection |

**`distill_dom` modes:** `"text_only"`, `"input_fields"`, `"all_content"`.
**`find_elements` search_by:** `"any"`, `"text"`, `"aria"`, `"placeholder"`, `"alt"`, `"role"`.

**CRITICAL: Always pass `max_chars` and `depth` to `read_page`.** Default recommendation: `max_chars: 4000, depth: 6`. Never request unbounded trees — they can exhaust an agent's context window.

### 7.4 Quality (2 tools)

| Tool | Required Params | Optional Params | Returns |
|------|----------------|-----------------|---------|
| `check_accessibility` | — | `level: string` (A/AA/AAA), `scope: string` | `{violations_count, violations[]}` |
| `check_contrast` | — | `selector: string` | `{issues_count, issues[]}` |

### 7.5 Observation (4 tools)

| Tool | Required Params | Optional Params | Returns |
|------|----------------|-----------------|---------|
| `read_console` | — | `limit: number`, `onlyErrors: boolean`, `pattern: string`, `clear: boolean` | `{messages[], total}` |
| `read_network` | — | `limit: number`, `urlPattern: string`, `clear: boolean` | Network events |
| `get_dom_changes` | — | — | `{changes[], count}` |
| `set_of_marks` | — | `show: boolean`, `filter: string` | `{marks}` |

**`set_of_marks` filter:** `"interactive"`, `"forms"`, `"all"`.

### 7.6 Capture (2 tools)

| Tool | Required Params | Optional Params | Returns |
|------|----------------|-----------------|---------|
| `take_screenshot` | — | `full_page: boolean` | Base64 PNG (also sent as MCP image content) |
| `quick` | `commands: string` | — | `{results[], commandCount}` |

### 7.7 Downloads (2 tools)

| Tool | Required Params | Optional Params | Returns |
|------|----------------|-----------------|---------|
| `download` | `url: string` | `filename: string`, `saveAs: boolean` | `{downloadId}` |
| `download_status` | `downloadId: number` | — | `{id, state, filename, bytesReceived, totalBytes}` |

### 7.8 Network Rules (2 tools)

| Tool | Required Params | Optional Params | Returns |
|------|----------------|-----------------|---------|
| `add_net_rule` | `id: integer`, `action: string`, `condition: object` | — | `{success}` |
| `remove_net_rule` | `id: integer` | — | `{success}` |

**`action`:** `"block"`, `"redirect"`, `"modifyHeaders"`.
**`condition`:** Must include `urlFilter: string`. May include `resourceTypes: string[]`.

### 7.9 State (2 tools)

| Tool | Required Params | Optional Params | Returns |
|------|----------------|-----------------|---------|
| `checkpoint_save` | — | `name: string`, `note: string` | `{success}` |
| `checkpoint_restore` | — | `name: string`, `checkpoint_id: string` | `{success}` |

### 7.10 GIF Recording (3 tools)

| Tool | Required Params | Optional Params | Returns |
|------|----------------|-----------------|---------|
| `gif_start` | — | — | Session started |
| `gif_add_frame` | `imageData: string` (base64) | — | Frame added |
| `gif_stop` | — | `filename: string` | GIF data |

### 7.11 Shell (1 tool)

| Tool | Required Params | Optional Params | Returns |
|------|----------------|-----------------|---------|
| `execute_shell` | `command: string` | `timeout: number` (default 30000) | `{output, exitCode}` |

**NOTE:** `execute_shell` runs on the host machine, NOT in the browser. It uses `child_process.execSync` with a 10MB buffer limit. Use for file operations, process management, and system commands.

### 7.12 Perception (3 tools)

| Tool | Required Params | Optional Params | Returns |
|------|----------------|-----------------|---------|
| `perceive` | — | `tab_id: number`, `agent_id: string`, `intent: string`, `max_chars: number` (default 4000), `force_snapshot: boolean` | See Section 8 |
| `subscribe` | `event_types: string[]` | `agent_id: string` | `{subscriptions[]}` |
| `get_perception_status` | — | `agent_id: string`, `tab_id: number` | `{models[], cursor, totals}` |

**`perceive` intent:** `"full"`, `"interactive"`, `"forms"`, `"navigation"`, `"changes_only"`.
**`subscribe` event_types:** `"dom"`, `"navigation"`, `"scroll"`, `"network"`, `"console"`.

---

## 8. PERCEPTION ENGINE

The Perception Engine is the key innovation of Open Anvil v1.1.0. It maintains a server-side living model of every open tab and provides per-agent cursors so multiple agents can perceive the same page independently.

### How It Works

1. **Extension streams events:** `event-streamer.js` hooks into `dom-observer.js` and batches DOM mutations every 100ms (max 50 events/batch). It sends these to `background.js`, which forwards them to the MCP server over WebSocket.

2. **Server maintains models:** The `PerceptionEngine` maintains a `PageModel` per tab. Each model tracks:
   - URL, title, viewport, scroll position, ready state
   - A node map (ref → PageNode, up to 5000 nodes/tab)
   - An event log (up to 2000 events/tab)
   - A sequence number that increments on every event

3. **Per-agent cursors:** Each agent gets an `AgentCursor` tracking the last sequence number seen per tab. When Agent A calls `perceive`, it only advances Agent A's cursor — Agent B's view is independent.

4. **Delta computation:** When `perceive` is called, the engine compares the agent's last-seen sequence to the current sequence and returns only what changed.

### Response Types

| `status` | When | Typical Token Cost | Content |
|----------|------|-------------------|---------|
| `snapshot` | First call, after navigation, or `force_snapshot: true` | ~800 tokens | Full page tree |
| `no_change` | Nothing happened since last call | ~80 tokens | Just URL/title confirmation |
| `delta` | DOM mutations occurred | ~200 tokens | Only the changed elements |
| `no_model` | No page model exists for this tab | ~50 tokens | Error message |

### Delta Compaction Rules

The engine compacts events before returning them:

- **Add + Remove of same ref** → cancel out (element flicker eliminated)
- **Multiple attribute changes to same attribute** → collapse to first oldValue → last newValue
- **Multiple text changes to same element** → collapse to first oldValue → last newValue

### Token Savings

For a typical 10-step workflow:
- `read_page` approach: ~10,000 tokens (full tree every call)
- `perceive` approach: ~2,500 tokens (1 snapshot + 9 deltas/no_changes)

### Multi-Agent Usage

```
Agent A: perceive(agent_id: 'agent_a')  → snapshot (first call)
Agent B: perceive(agent_id: 'agent_b')  → snapshot (independent first call)
[DOM changes happen]
Agent A: perceive(agent_id: 'agent_a')  → delta (only A's cursor advances)
Agent B: perceive(agent_id: 'agent_b')  → delta (B sees same changes independently)
```

---

## 9. OPERATIONAL WORKFLOWS (RECIPES)

### Recipe 1: Read a Page (Text Mode)

```
Step 1: navigate_to(url: 'https://example.com')
Step 2: wait_for_element(selector: 'body', timeout: 10000)
Step 3: get_page_state
        → Verify URL and ready_state are correct
Step 4: read_page(depth: 6, max_chars: 4000)
        → Get page structure via accessibility tree
Step 5: extract_text(selector: 'main h1, main h2', limit: 10)
        → Get specific content
```

### Recipe 2: Read a Page (Vision Mode)

```
Step 1: navigate_to(url: 'https://example.com')
Step 2: wait_for_element(selector: 'body', timeout: 10000)
Step 3: take_screenshot
        → Visual overview
Step 4: set_of_marks(show: true, filter: 'interactive')
        → Render numbered markers
Step 5: take_screenshot
        → Capture with marks visible
Step 6: set_of_marks(show: false)
        → Clean up markers
```

### Recipe 3: Read a Page (Perception Mode — Recommended for Text Agents)

```
Step 1: navigate_to(url: 'https://example.com')
Step 2: perceive()
        → status='snapshot', full page tree (~800 tokens)
Step 3: perceive()
        → status='no_change' if nothing happened (~80 tokens)
Step 4: [perform an action, e.g. click_ref]
Step 5: perceive()
        → status='delta', only changed elements (~200 tokens)
Step 6: perceive(intent: 'navigation')
        → Just URL/title/scroll (~80 tokens)
Step 7: perceive(intent: 'interactive')
        → Only buttons/inputs/links
Step 8: perceive(intent: 'forms')
        → Only form elements
Step 9: perceive(force_snapshot: true)
        → Force full re-read regardless of cursor position
```

### Recipe 4: Fill and Submit a Form

```
Step 1: read_page(depth: 6, max_chars: 4000)
        → Find form refs and input selectors
Step 2: fill_form(fields: [
          {selector: '#name', value: 'Test User'},
          {selector: '#email', value: 'test@example.com'},
          {selector: 'textarea', value: 'Message body'}
        ])
Step 3: extract_text(selector: '#name', limit: 1)
        → Verify name field was filled correctly
Step 4: checkpoint_save(name: 'form-filled')
        → Save state before destructive submit
Step 5: click_element(selector: 'button[type=submit]')
Step 6: wait_for_element(selector: '.success-message', timeout: 10000)
Step 7: extract_text(selector: '.success-message', limit: 1)
        → Verify success
```

### Recipe 5: Multi-Page Navigation

```
Step 1: navigate_to(url: 'https://site.com')
Step 2: read_page(depth: 6, max_chars: 4000)
        → Find navigation links
Step 3: click_ref(ref: 'ref_4')
        → Click target link
Step 4: wait_for_element(selector: 'main', timeout: 5000)
Step 5: get_page_state
        → Confirm new URL
Step 6: read_page(depth: 6, max_chars: 4000)
        → Read new page content
```

### Recipe 6: Test a Web Application

```
Step 1:  navigate_to(url: 'http://localhost:3000')
Step 2:  wait_for_element(selector: 'body', timeout: 10000)
Step 3:  read_console(onlyErrors: true, limit: 20)
         → Check for boot errors
Step 4:  read_page(depth: 6, max_chars: 4000)
         → Verify UI rendered
Step 5:  check_accessibility(level: 'AA')
         → WCAG audit
Step 6:  check_contrast
         → Color contrast audit
Step 7:  find_elements(query: 'Login', search_by: 'text')
         → Find login button
Step 8:  click_ref(ref: 'ref_N')
         → Click login
Step 9:  wait_for_element(selector: 'input[type=email]', timeout: 5000)
Step 10: fill_form(fields: [
           {selector: 'input[type=email]', value: 'user@test.com'},
           {selector: 'input[type=password]', value: 'testpass'}
         ])
Step 11: click_element(selector: 'button[type=submit]')
Step 12: wait_for_element(selector: '.dashboard', timeout: 10000)
Step 13: read_page(depth: 6, max_chars: 4000)
         → Verify dashboard loaded
Step 14: read_console(onlyErrors: true, limit: 10)
         → Check for post-login errors
```

### Recipe 7: Multi-Tab Workflow

```
Step 1: list_tabs
        → Get current tabs, save original tabId
Step 2: open_tab(url: 'https://other-site.com')
        → Returns new tabId
Step 3: [do work in new tab]
Step 4: switch_tab(tab_id: originalTabId)
        → Return to original tab
Step 5: close_tab(tab_id: newTabId)
        → Cleanup
```

### Recipe 8: Record a GIF

```
Step 1: gif_start
Step 2: take_screenshot → gif_add_frame(imageData: <base64>)
Step 3: [perform actions]
Step 4: take_screenshot → gif_add_frame(imageData: <base64>)
Step 5: [more actions]
Step 6: take_screenshot → gif_add_frame(imageData: <base64>)
Step 7: gif_stop(filename: 'workflow.gif')
```

---

## 10. QUICK MODE COMMAND LANGUAGE

The `quick` tool accepts newline-separated single-letter commands for rapid compound actions.

| Cmd | Syntax | Action |
|-----|--------|--------|
| `C` | `C x y` | Click at coordinates (x, y) |
| `RC` | `RC x y` | Right-click at coordinates |
| `DC` | `DC x y` | Double-click at coordinates |
| `H` | `H x y` | Hover at coordinates |
| `T` | `T text` | Type text into active element |
| `K` | `K keyname` | Press key (enter, tab, escape, backspace, etc.) |
| `S` | `S direction amount` | Scroll (up/down/left/right, pixels) |
| `N` | `N url` | Navigate to URL |
| `W` | `W ms` | Wait (milliseconds, max 10000) |
| `R` | `R selector` | Read element text |
| `D` | `D selector` | Read element dimensions |
| `M` | `M selector text` | Match element text (assertion) |
| `X` | `X selector` | Check element exists (assertion) |
| `P` | `P key value` | Set persistent variable |
| `Q` | `Q query` | Query knowledge base |

**Example:**
```
S down 500
W 1000
T Hello World
K enter
```

---

## 11. ERROR REFERENCE

| Error Message | Cause | Resolution |
|--------------|-------|------------|
| `"Extension not connected"` | Chrome extension not loaded or WebSocket disconnected | Open Chrome, verify extension is loaded and enabled at `chrome://extensions`. Check that no other process is using port 7777. Click "service worker" link to verify it's active. |
| `"Element not found: <selector>"` | CSS selector matched no elements | Re-read the page, find the correct selector. Use `find_elements` to search for the element. |
| `"Accessibility tree exceeds max_chars"` | Output too large for the specified limit | Add `depth` param to limit tree depth, or use `ref_id` to scope to a specific subtree. |
| `"Timeout waiting for <selector>"` | Element did not appear within timeout period | Page may not have loaded. Check URL with `get_page_state`. Increase timeout. Retry once. |
| `"Unknown quick command"` | Invalid syntax in quick mode commands | Use single-letter commands only (C, T, K, S, etc.). Check Quick Mode reference. |
| `"Tool call timed out after Xms"` | Tool execution exceeded ANVIL_TIMEOUT | Increase `ANVIL_TIMEOUT` env var, or simplify the operation. |
| `"No tab_id provided and no active tab known"` | Perception tools called before any navigation | Navigate to a page first, or specify `tab_id` explicitly. |
| `{success: false, error: ...}` | Generic tool-level failure | Read the error message, adjust parameters, retry once. |

### Three-Strike Rule

If an action fails 3 times:
1. **Strike 1:** Retry the exact same action.
2. **Strike 2:** Re-read the page, find an alternative selector/ref, retry with corrected params.
3. **Strike 3:** STOP. Call `checkpoint_save`. Report the blocker with current page state.

---

## 12. TOKEN BUDGET GUIDELINES

| Tool Call | Typical Token Cost | When to Use |
|-----------|--------------------|-------------|
| `read_page(depth:6, max_chars:4000)` | ~800-1200 tokens | Primary page understanding |
| `read_page(depth:3, max_chars:2000)` | ~200-400 tokens | Quick structure check |
| `read_page(ref_id:'ref_N', max_chars:2000)` | ~300-600 tokens | Drill into a specific section |
| `get_page_state` | ~80 tokens | Lightweight state check (URL, title, scroll) |
| `find_elements(limit:5)` | ~200-500 tokens | Targeted element search |
| `extract_text(limit:5)` | ~100-300 tokens | Read specific content |
| `analyze_page` | ~2000-4000 tokens | Full audit (use sparingly) |
| `take_screenshot` | ~0 text tokens (image) | Vision mode only |
| `check_accessibility` | ~500-2000 tokens | Quality gate |
| `execute_shell` | varies | Host commands |
| `perceive()` (snapshot) | ~800 tokens | First call or after navigation |
| `perceive()` (delta) | ~200 tokens | Subsequent calls with DOM changes |
| `perceive()` (no_change) | ~80 tokens | Subsequent calls, nothing changed |
| `perceive(intent:'navigation')` | ~80 tokens | Just URL/title/scroll check |

**Strategy:** Prefer `perceive()` over `read_page`. Use `perceive(intent:'navigation')` for lightweight checks. Reserve `analyze_page` for quality audits only. Never call `analyze_page` in a loop.

---

## 13. TROUBLESHOOTING

### Extension shows errors on load
- Verify no references to `sidepanel`, `nativeMessaging`, or `offscreen.js`.
- The extension uses `offscreen-worker.js` — not `offscreen.js`.
- Ensure all files listed in `manifest.json` exist in the `extension/` directory.

### "Extension not connected" error
The MCP server is running but Chrome has not connected via WebSocket. Check:
1. Extension is loaded and enabled in `chrome://extensions`.
2. No other process is using port 7777 (`lsof -i :7777`).
3. Chrome's service worker is active — click "service worker" link in `chrome://extensions`.
4. Try reloading the extension (click the reload button on the extension card).

### Tools return "No active tab"
Click on a tab in Chrome to make it the active tab before calling page-level tools.

### WebSocket keeps disconnecting
The extension uses a keep-alive alarm that fires every ~24 seconds. If disconnections persist:
1. Check `ANVIL_PORT` matches between server and extension.
2. Check no firewall is blocking localhost connections.
3. If using `ANVIL_WS_TOKEN`, ensure the extension has the matching token set via `chrome.storage.local.set({ anvilWsToken: 'your-token' })`.

### MCP server won't start — port in use
```bash
lsof -i :7777
# Kill the process using the port, or change ANVIL_PORT
```

The server auto-retries once after 1 second if port is in use.

### Perception returns "no_model"
No page model exists for the specified tab. This means either:
- No page has been loaded in that tab yet.
- The tab was closed and the model was cleaned up.
Solution: Navigate to a page first with `navigate_to`, then call `perceive`.

---

## 14. LLM SYSTEM PROMPT INTEGRATION

To embed Open Anvil capabilities in any LLM's system prompt, include the contents of `open-anvil/SKILLS.md` in the system prompt. That file contains:

1. Identity and mode detection (vision vs. text vs. perception)
2. Core rules (read before act, verify after act, cap output, etc.)
3. Workflow methodology (SCOPE → BUILD → TEST → LOOP)
4. Complete tool reference with parameters
5. Recipes for common tasks
6. Error handling guide
7. Token budget guidelines
8. Installation instructions

**Minimal system prompt addition:**
```
You are a browser automation agent using Open Anvil. You control Chrome through 45 MCP tools.
Rules:
1. Always call perceive() or read_page(depth:6, max_chars:4000) before any interaction.
2. Verify after every action.
3. Prefer click_ref/type_ref over click_element/type_text.
4. If an action fails 3 times, stop and report.
5. Call checkpoint_save before destructive operations.
```

---

## 15. HUMAN HEADLESS DEPLOYMENT GUIDE

This section is for human operators deploying Open Anvil as a non-interactive automation system (e.g., a headless CI pipeline or a scheduled bot).

### 15.1 Requirements

- A machine with Chrome installed and a display (or virtual display like Xvfb on Linux).
- Node.js 20+ installed.
- The Open Anvil repository cloned.

**Note:** Chrome extensions require a Chrome window. True headless Chrome (`--headless`) does NOT support extensions. You need either:
- A real display (macOS/Windows desktop), or
- A virtual display on Linux: `Xvfb :99 -screen 0 1920x1080x24 & export DISPLAY=:99`

### 15.2 Setup Steps

```bash
# 1. Clone or copy the open-anvil directory
cd /path/to/open-anvil

# 2. Install MCP server dependencies
cd mcp-server && npm install && cd ..

# 3. Start Chrome with the extension loaded
# macOS:
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --load-extension=/absolute/path/to/open-anvil/extension \
  --no-first-run \
  --disable-default-apps \
  &

# Linux (with Xvfb):
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99
google-chrome \
  --load-extension=/absolute/path/to/open-anvil/extension \
  --no-first-run \
  --disable-default-apps \
  &

# 4. Start the MCP server
node /absolute/path/to/open-anvil/mcp-server/server.js &

# 5. Wait for connection (extension connects automatically)
sleep 3

# 6. Send tool calls via stdin
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test"}}}' | node /absolute/path/to/open-anvil/mcp-server/server.js
```

### 15.3 Programmatic MCP Client

For automated systems, write a simple stdio MCP client:

```javascript
import { spawn } from 'node:child_process';

const server = spawn('node', ['/path/to/open-anvil/mcp-server/server.js']);
let requestId = 0;

function callTool(name, args = {}) {
  return new Promise((resolve) => {
    const id = ++requestId;
    const handler = (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.id === id) {
            server.stdout.off('data', handler);
            resolve(msg.result);
          }
        } catch {}
      }
    };
    server.stdout.on('data', handler);
    server.stdin.write(JSON.stringify({
      jsonrpc: '2.0', id, method: 'tools/call',
      params: { name, arguments: args }
    }) + '\n');
  });
}

// Initialize
await callTool('initialize'); // not a real tool call, use method directly
// Then call tools:
const tabs = await callTool('list_tabs');
console.log(tabs);
```

### 15.4 Security Considerations for Headless Deployment

1. **Always use `ANVIL_HOST=127.0.0.1`** — never bind to `0.0.0.0` in production.
2. **Set `ANVIL_WS_TOKEN`** to a strong random value and configure the extension to match.
3. **Limit `execute_shell`** — this tool runs arbitrary commands on the host. In production, consider removing it from the tool list or wrapping it with restrictions.
4. **Monitor the process** — the MCP server has graceful shutdown on SIGINT/SIGTERM. Set up process monitoring (systemd, pm2, etc.).

---

## APPENDIX: FILE MANIFEST

```
open-anvil/
├── .env.example                    # Environment variable template
├── .eslintrc.json                  # Linting config
├── .gitignore                      # Git ignore rules
├── ARCHITECTURE.md                 # Architecture overview
├── SETUP.md                        # Quick setup guide
├── SKILLS.md                       # LLM system prompt skill document
├── package.json                    # Root package (workspaces)
├── extension/
│   ├── manifest.json               # Chrome MV3 manifest
│   ├── background.js               # Service worker (WS client, tool router)
│   ├── cdp.js                      # Chrome DevTools Protocol
│   ├── checkpoint.js               # Checkpoint save/restore
│   ├── content-script.js           # Core DOM interaction
│   ├── accessibility-tree.js       # A11y tree generator
│   ├── agent-indicator.js          # Visual agent activity indicator
│   ├── distill-dom.js              # DOM distillation
│   ├── dom-observer.js             # MutationObserver
│   ├── event-streamer.js           # Event batching → Perception Engine
│   ├── gif-recorder.js             # GIF recording support
│   ├── net-rules.js                # Declarative network rules
│   ├── network-monitor.js          # Network request capture
│   ├── offscreen-worker.html       # Offscreen canvas host
│   ├── offscreen-worker.js         # GIF encoding
│   ├── quick-mode.js               # Quick command parser
│   ├── ref-tools.js                # Ref ID system
│   ├── set-of-marks.js             # Visual mark overlays
│   ├── ui-gate.js                  # UI interaction gating
│   ├── vision-tools.js             # Vision-related helpers
│   ├── workflow-recorder.js        # Workflow recording
│   └── icons/                      # Extension icons (16/48/128 px)
├── mcp-server/
│   ├── package.json                # Server package (ws dependency)
│   ├── server.js                   # MCP server entry point
│   ├── perception-engine.js        # Living page model
│   ├── perception-tools.js         # Perception tool handlers
│   ├── tool-definitions.js         # Legacy tool definitions (bridge mode)
│   └── test/
│       ├── perception-engine.test.js
│       ├── perception-integration.test.js
│       └── server-dispatch.test.js
└── pipeline/                       # DASES pipeline artifacts (from build)
    ├── artifacts/
    └── receipts/
```
