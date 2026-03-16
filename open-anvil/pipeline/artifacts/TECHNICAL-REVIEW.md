# Technical Review: OPEN ANVIL

## Executive Summary

The SPEC is well-structured and the refactor scope is realistic given that Floyd TTY Bridge v5.1.0 provides ~90% of the needed functionality. However, I've found **1 Category A blocker** that requires an architecture reversal, **4 Category B risks** that need resolution plans, and **3 Category C recommendations**. The blocker is fixable without scope change — it's a transport direction reversal, not a redesign.

## Blocker Report

### Category A: Blockers (1 found → 1 resolved)

**A-1: WebSocket Server Cannot Run in MV3 Service Worker**

The SPEC (Section 3.2, lines 121-123) states:
> "Extension's background.js runs a WebSocket server (port 7777 default)"

This is **technically impossible**. Manifest V3 service workers:
- Cannot bind to TCP ports
- Cannot run server sockets
- Get terminated after ~30s of inactivity
- Have no access to `net` module or server-side WebSocket APIs

**Resolution**: Reverse the WebSocket direction.

```
SPEC says:   MCP Server (WS client) → Extension background.js (WS server)
Corrected:   MCP Server (WS server on :7777) ← Extension background.js (WS client)
```

The **Node.js MCP server** runs the WebSocket server. The extension's background.js connects as a WebSocket client on startup. Service workers CAN initiate outbound WebSocket connections.

Flow becomes:
```
LLM ← stdio/MCP → open-anvil-mcp (Node, also WS server :7777) ← WS client → background.js
```

This is actually cleaner:
- Node process is long-lived (no service worker suspension)
- Extension reconnects on service worker wake-up
- Multiple extensions could connect to one MCP server
- No port-binding in restricted service worker context

**Impact on SPEC**: Section 3.1 diagram, Section 3.2 narrative, Section 4.2, Section 4.3, Phase 2 roadmap all need the direction flipped. Tool routing logic in background.js is unchanged — only the transport layer reverses.

---

### Category B: High Risk Items (4 found → 4 resolved)

**B-1: Service Worker Suspension Kills WebSocket Connections**

MV3 service workers suspend after ~30s of inactivity. When suspended, any open WebSocket connection drops.

**Resolution plan**:
- Floyd already uses `chrome.alarms.create('floyd-keep-alive', { periodInMinutes: 0.4 })` (24s interval) to prevent suspension. Copy this pattern.
- Add auto-reconnect on the extension side: when the service worker wakes, check if the WebSocket to the MCP server is alive. If not, reconnect.
- The MCP server should queue incoming tool calls during brief disconnects (< 5s) and retry delivery on reconnect.
- This is a **known pattern** — the Floyd code at background.js:68-76 already implements exponential backoff reconnection.

**B-2: `importScripts` vs ES Modules Conflict**

The existing Floyd `background.js` uses `importScripts('cdp.js')` etc. (line 3-7). The Open Anvil manifest in ARCHITECTURE.md specifies `"type": "module"` in the background config. These are **mutually exclusive**:
- `importScripts()` only works WITHOUT `"type": "module"`
- ES `import` only works WITH `"type": "module"`

**Resolution plan**: Keep `importScripts()` approach (no `"type": "module"`). This avoids rewriting all imported scripts to use ES module exports/imports. The Floyd code is proven with `importScripts` — don't change what works. Update the Open Anvil manifest to NOT include `"type": "module"`.

**B-3: GIF Recording Depends on Offscreen Document**

The SPEC (Section 2.3) says to delete `offscreen.js` and `offscreen.html`. But background.js:444-449 routes GIF tools through `chrome.runtime.sendMessage` to the offscreen document. The `gif-recorder.js` is listed as "copy verbatim" but will have no execution context if the offscreen doc is deleted.

**Resolution plan**: Keep offscreen.html and offscreen.js but strip out the Gemini audio portions. The offscreen document is needed for:
- GIF assembly (canvas operations not available in service workers)
- Potential future WASM execution

Rename them to clarify purpose: `offscreen-worker.html` / `offscreen-worker.js`. Update the `ensureOffscreen()` justification string.

**B-4: vision-tools.js Not in Content Scripts**

The SPEC lists `vision-tools.js` as "copy verbatim" but the Floyd manifest.json does NOT include it in `content_scripts`. It exists as a file but must be loaded differently (likely injected dynamically by background.js or imported by another content script).

**Resolution plan**: Inspect how vision-tools.js is actually loaded in Floyd. If it's injected dynamically, replicate that pattern. If it's imported by content-script.js, it's already covered. Need to verify before scaffolding.

---

### Category C: Recommendations

**C-1: Tool Schema Single Source of Truth**

Tool definitions exist in `mcp-server.js` (the Node file with full MCP schemas). The dispatch happens in background.js's `handleBrowserApiTool` switch statement and content-script.js message handler. Risk of schema drift between definition and implementation.

**Recommendation**: Generate a `tools.json` manifest that both the MCP server and extension read. The MCP server exposes it via `tools/list`. The extension uses it for input validation. One file, two consumers.

**C-2: `navigate_to` Missing from Background API**

The `handleBrowserApiTool` switch in background.js handles `open_tab`, `close_tab`, `switch_tab`, `list_tabs`, `take_screenshot`, etc. — but `navigate_to` falls through to the content script handler. For the most basic navigation tool, this means it requires a content script already running on the page.

**Recommendation**: Add `navigate_to` to `handleBrowserApiTool`:
```javascript
case 'navigate_to': {
  const tabId = args.tab_id || activeTab?.id;
  await chrome.tabs.update(tabId, { url: args.url });
  return { success: true, result: { navigated: args.url } };
}
```
This makes navigation work even on `chrome://` pages where content scripts can't inject.

**C-3: Shell Execution Scope**

The SPEC includes `execute_local_shell` in the tool set (background.js:347-371), which routes through native messaging to the Python PTY host. Since Open Anvil replaces the native host with a Node MCP server, shell execution should route through the MCP server's Node process (using `child_process.exec`). This keeps shell execution out of the extension entirely.

**Recommendation**: Shell tools live in the MCP server layer, not the extension. The extension handles browser-only operations. Clean separation of concerns.

---

## Second Pass Findings

1. **Content script injection fallback is solid**: background.js:283-298 re-injects content-script.js if the initial message fails. This handles fresh tabs and page reloads. Keep this pattern.

2. **Tab group management**: Floyd has `autoJoinTabGroup` and `create_tab_group`/`manage_tab_group` tools. These aren't in the SPEC's tool list but are useful for agent workspace organization. Consider including them.

3. **Test infrastructure**: Floyd has a `__FLOYD_TEST__` guard (background.js:489-506) that exposes internal functions for testing. Rename to `__OPEN_ANVIL_TEST__` during refactor.

4. **Sanitization**: The `sanitize()` function (background.js:512-519) limits strings to 500 chars and strips control characters. Good security practice — keep it.

5. **Dual native host sessions**: Floyd supports two simultaneous native host sessions (session 1 for LLM, session 2 for vision). Open Anvil's WebSocket approach makes this unnecessary since the MCP server can multiplex connections. Simplify to single connection.

## Confidence Score
8/10 — High confidence. The refactor is well-scoped, the source code is mature, and the blocker has a clean resolution. Main risk is service worker lifecycle management, but Floyd's existing keep-alive pattern mitigates this.

## Sign-off
- [x] Clear to proceed to scaffolding (after A-1 architecture reversal is applied to SPEC)
- [ ] Wait for clarification on: None — all issues have resolution plans
