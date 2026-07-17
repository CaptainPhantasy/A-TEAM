# Open Anvil

**Vendor-agnostic browser automation for AI agents.** Open source, MIT licensed.

Connect any LLM to a real Chrome browser via the MCP protocol. Navigate pages, click elements, read the DOM, take screenshots, fill forms, and more — 44 tools for full browser control.

**Not Playwright. Not Selenium. A real Chrome extension** that uses the Chrome DevTools Protocol to interact with pages exactly like a human would. Works on auth-walled pages, SPAs, and any site that loads in Chrome.

## Why Open Anvil?

- **Works with any LLM** — Claude, GPT, Gemini, Llama, GLM, anything that speaks MCP
- **Real browser, not headless** — Full page context, no CORS issues, real rendering
- **Persistent connection** — Native messaging bridge never goes stale (Chrome manages lifecycle)
- **Token-efficient** — Perception engine sends deltas, not full page dumps. Save 80-90% on context.
- **Secure by default** — Shell access disabled, WS auth required, rate limited
- **Open source** — MIT license, no vendor lock-in

## Quick Start (5 minutes)

### 1. Install

```bash
git clone https://github.com/floyds-labs/open-anvil.git
cd open-anvil
./install.sh
```

### 2. Load Extension in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` directory
5. Extension badge should show **●** (purple) if the native host is running

### 3. Configure Your LLM

#### pi
Add to `~/.pi/agent/settings.json` under `mcpServers`:
```json
{
  "open-anvil": {
    "command": "node",
    "args": ["/path/to/open-anvil/mcp-server/server.js"]
  }
}
```

#### Claude Desktop
Add to `~/.claude/mcp_servers.json`:
```json
{
  "open-anvil": {
    "command": "node",
    "args": ["/path/to/open-anvil/mcp-server/server.js"]
  }
}
```

#### Any MCP Client
The server speaks MCP JSON-RPC 2.0 on stdin/stdout. Connect it like any other MCP tool server.

### 4. Use It

```
You: Navigate to https://example.com and tell me what's on the page
LLM: [calls navigate_to, read_page, returns page content]
```

## Tools (44)

| Category | Tools |
|----------|-------|
| **Navigation** | navigate_to, open_tab, close_tab, switch_tab, list_tabs, get_tab_state, get_page_state |
| **Interaction** | click_element, type_text, fill_form, select_option, scroll_to, wait_for_element, click_ref, type_ref, scroll_to_ref, click_mark |
| **Analysis** | analyze_page, analyze_element, find_elements, extract_text, extract_css, check_accessibility, check_contrast |
| **Capture** | take_screenshot, read_page, read_console, distill_dom, get_dom_changes, read_network |
| **Agent** | set_of_marks, quick |
| **Platform** | download, download_status, add_net_rule, remove_net_rule, checkpoint_save, checkpoint_restore |
| **Recording** | gif_start, gif_add_frame, gif_stop |
| **Perception** | perceive, subscribe, get_perception_status |
| **Shell** ⚠️ | execute_shell (disabled by default — enable with `ANVIL_SHELL=true`) |

## Architecture

```
┌──────────┐  MCP/stdio  ┌──────────┐  WebSocket  ┌──────────────┐
│  ANY LLM  │◄──────────►│  SERVER   │◄───────────►│  EXTENSION   │
│           │  JSON-RPC   │  (Node)  │  + Native   │  (Chrome MV3)│
└──────────┘             └──────────┘   Pipe      └──────┬───────┘
                                                       │ CDP
                                                       ▼
                                                ┌─────────────┐
                                                │  WEB PAGE   │
                                                └─────────────┘
```

Two channels connect the server to the extension:
- **WebSocket** (port 7777) — low latency, for direct MCP client connections
- **Native Messaging** (persistent pipe) — Chrome-managed, never goes stale

Both can run simultaneously. Extension badge shows connection state (● = dual, WS = green, NM = blue).

See [ARCHITECTURE.md](ARCHITECTURE.md) for full details.

## Security

- **WS Token Auth** — Auto-generated on first run, stored in `~/.config/open-anvil/token`
- **Shell Opt-In** — `execute_shell` disabled by default. Enable with `ANVIL_SHELL=true`
- **Rate Limiting** — 30 tool calls/second per client
- **Message Size Limits** — 1MB on native messaging, 4MB on MCP
- **No Secrets in Code** — All paths configurable via env vars

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `ANVIL_PORT` | 7777 | WebSocket port (standalone mode) |
| `ANVIL_HOST` | 127.0.0.1 | WebSocket bind address |
| `ANVIL_WS_TOKEN` | (auto) | WebSocket auth token |
| `ANVIL_SHELL` | false | Enable execute_shell |
| `ANVIL_DEBUG` | false | Verbose logging |
| `MCP_TRANSPORT` | — | Set `stdio` for native host mode |

## Requirements

- Chrome 116+ (Chromium-based browsers)
- Node.js 18+
- Python 3.8+ (for native messaging host)

## License

MIT — see [LICENSE](LICENSE)

## Credits

Built by [Floyd's Labs](https://github.com/floyds-labs). Built for everyone.
