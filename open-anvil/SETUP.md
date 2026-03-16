# Open Anvil — Setup Guide

## Prerequisites
- Chrome 116+
- Node.js 20+

## Step 1: Install the MCP Server

```bash
cd open-anvil/mcp-server
npm install
```

## Step 2: Load the Chrome Extension

1. Open Chrome, navigate to `chrome://extensions`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `open-anvil/extension/` directory
5. Verify: "Open Anvil — Agent Pilot" appears with no errors

## Step 3: Configure Your LLM Client

### Claude Code
Add to `~/.claude/mcp_servers.json`:
```json
{
  "open-anvil": {
    "command": "node",
    "args": ["/path/to/open-anvil/mcp-server/server.js"],
    "env": {
      "ANVIL_PORT": "7777",
      "ANVIL_DEBUG": "false"
    }
  }
}
```

### Any MCP Client
The server speaks MCP JSON-RPC 2.0 over stdio. Launch it:
```bash
node /path/to/open-anvil/mcp-server/server.js
```

Send JSON-RPC on stdin, receive responses on stdout.

## Step 4: Verify Connection

1. Start the MCP server (your LLM client does this automatically)
2. The extension's service worker will auto-connect to `ws://127.0.0.1:7777`
3. Try: `list_tabs` — should return your open Chrome tabs
4. Try: `navigate_to` with a URL — should navigate the active tab

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| ANVIL_PORT | 7777 | WebSocket server port |
| ANVIL_HOST | 127.0.0.1 | Bind address (localhost only for security) |
| ANVIL_TIMEOUT | 30000 | Tool call timeout in ms |
| ANVIL_DEBUG | false | Debug logging to stderr |

## Troubleshooting

**Extension shows errors on load**: Check that no Floyd-specific files remain. The extension should have no references to `sidepanel`, `nativeMessaging`, or `offscreen.js` (it uses `offscreen-worker.js`).

**"Extension not connected" error**: The MCP server is running but Chrome hasn't connected. Check:
- Extension is loaded and enabled in `chrome://extensions`
- No other process is using port 7777
- Chrome's service worker is active (click "service worker" link in `chrome://extensions`)

**Tools return "No active tab"**: Click on a tab in Chrome to make it active before calling page-level tools.

## Available Tools (42)

### Navigation (7)
navigate_to, open_tab, close_tab, switch_tab, list_tabs, get_tab_state, get_page_state

### Interaction (10)
click_element, type_text, fill_form, select_option, scroll_to, wait_for_element, click_ref, type_ref, scroll_to_ref, click_mark

### Analysis (7)
analyze_page, analyze_element, find_elements, extract_text, extract_css, check_accessibility, check_contrast

### Capture (6)
take_screenshot, read_page, read_console, distill_dom, get_dom_changes, read_network

### Agent (2)
set_of_marks, quick

### Platform (6)
download, download_status, add_net_rule, remove_net_rule, checkpoint_save, checkpoint_restore

### GIF (3)
gif_start, gif_add_frame, gif_stop

### Shell (1)
execute_shell
