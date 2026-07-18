#!/usr/bin/env node
// open-anvil-mcp — MCP Server for Open Anvil
// Speaks MCP JSON-RPC 2.0 on stdio, runs WebSocket server for Chrome extension
'use strict';

import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { createInterface } from 'node:readline';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { PerceptionEngine, PERCEPTION_ENGINE_VERSION } from './perception-engine.js';
import { PERCEPTION_TOOL_DEFINITIONS, PERCEPTION_TOOL_NAMES, PERCEPTION_TOOLS_VERSION, handlePerceptionTool } from './perception-tools.js';

// ─── Configuration ──────────────────────────────────────────────────────────
const PORT = parseInt(process.env.ANVIL_PORT || '7777', 10);
const HOST = process.env.ANVIL_HOST || '127.0.0.1';
const TIMEOUT = parseInt(process.env.ANVIL_TIMEOUT || '30000', 10);
const DEBUG = process.env.ANVIL_DEBUG === 'true' || process.argv.includes('--debug');
const JSON_LOG = process.env.ANVIL_LOG_FORMAT === 'json';

// ─── Logging ────────────────────────────────────────────────────────────────
function log(...args) {
  if (!DEBUG) return;
  const msg = args.join(' ');
  if (JSON_LOG) {
    process.stderr.write(JSON.stringify({ ts: Date.now(), lvl: 'debug', msg }) + '\n');
  } else {
    process.stderr.write(`[anvil] ${msg}\n`);
  }
}

function logPerception(...args) {
  const msg = args.join(' ');
  if (JSON_LOG) {
    process.stderr.write(JSON.stringify({ ts: Date.now(), lvl: 'perception', msg }) + '\n');
  } else {
    process.stderr.write(`[anvil:perception] ${msg}\n`);
  }
}

function logError(...args) {
  const msg = args.join(' ');
  if (JSON_LOG) {
    process.stderr.write(JSON.stringify({ ts: Date.now(), lvl: 'error', msg }) + '\n');
  } else {
    process.stderr.write(`[anvil:ERROR] ${msg}\n`);
  }
}

const WS_TOKEN = process.env.ANVIL_WS_TOKEN || '';
const SERVER_INFO = { name: 'open-anvil', version: '1.2.0' };
const PROTOCOL_VERSION = '2024-11-05';
const STDIO_MODE = process.env.MCP_TRANSPORT === 'stdio';

// ─── Auto-generate WS token if not set (standalone mode only) ─────────────
const TOKEN_DIR = process.env.XDG_CONFIG_HOME
  ? join(process.env.XDG_CONFIG_HOME, 'open-anvil')
  : join(homedir(), '.config', 'open-anvil');
const TOKEN_FILE = join(TOKEN_DIR, 'token');

function ensureToken() {
  if (WS_TOKEN) return WS_TOKEN;
  if (STDIO_MODE) return ''; // No token needed in stdio mode — native host is the client
  if (existsSync(TOKEN_FILE)) return readFileSync(TOKEN_FILE, 'utf-8').trim();
  mkdirSync(TOKEN_DIR, { recursive: true });
  const token = randomBytes(24).toString('hex');
  writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
  log(`Auto-generated WS token: ${token}`);
  log(`Token saved to ${TOKEN_FILE}`);
  return token;
}

const EFFECTIVE_WS_TOKEN = ensureToken();

// ─── Rate Limiting ────────────────────────────────────────────────────────
const RATE_LIMIT_WINDOW = 1000; // ms
const RATE_LIMIT_MAX = 30; // max calls per window
const rateLimitCounts = new Map(); // source → { count, windowStart }

function checkRateLimit(source) {
  const now = Date.now();
  let entry = rateLimitCounts.get(source);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    entry = { count: 0, windowStart: now };
    rateLimitCounts.set(source, entry);
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    log(`Rate limit exceeded for ${source}: ${entry.count}/${RATE_LIMIT_MAX} per ${RATE_LIMIT_WINDOW}ms`);
    return false;
  }
  return true;
}

// Periodically clean stale rate limit entries and routing entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitCounts) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW * 2) {
      rateLimitCounts.delete(key);
    }
  }
  // Clean stale response routing entries (shouldn't accumulate but safety net)
  if (mcpResponseRouting.size > 100) {
    mcpResponseRouting.clear();
  }
}, 10000);

// ─── Tool Definitions ───────────────────────────────────────────────────────
function objectSchema(properties, required = []) {
  return { type: 'object', properties, required, additionalProperties: true };
}

const SHELL_ENABLED = process.env.ANVIL_SHELL === 'true';

const TOOL_DEFINITIONS = [
  // Navigation
  { name: 'navigate_to', description: 'Navigate the current tab to a URL.', inputSchema: objectSchema({ url: { type: 'string', description: 'Target URL.' } }, ['url']) },
  { name: 'open_tab', description: 'Open a new browser tab.', inputSchema: objectSchema({ url: { type: 'string', description: 'Target URL.' } }, ['url']) },
  { name: 'close_tab', description: 'Close a tab by tab ID.', inputSchema: objectSchema({ tab_id: { type: 'number', description: 'Tab ID to close.' } }, ['tab_id']) },
  { name: 'switch_tab', description: 'Switch focus to a tab by tab ID.', inputSchema: objectSchema({ tab_id: { type: 'number', description: 'Tab ID to activate.' } }, ['tab_id']) },
  { name: 'list_tabs', description: 'List currently open tabs.', inputSchema: objectSchema({}) },
  { name: 'get_tab_state', description: 'Get metadata for a tab.', inputSchema: objectSchema({ tab_id: { type: 'number', description: 'Optional tab ID. Defaults to active tab.' } }) },
  { name: 'get_page_state', description: 'Get page URL, title, viewport, and scroll state.', inputSchema: objectSchema({}) },

  // Interaction
  { name: 'click_element', description: 'Click a DOM element by CSS selector.', inputSchema: objectSchema({ selector: { type: 'string', description: 'CSS selector.' } }, ['selector']) },
  { name: 'type_text', description: 'Type text into an input-like element.', inputSchema: objectSchema({ selector: { type: 'string', description: 'CSS selector for input.' }, text: { type: 'string', description: 'Text to type.' }, clear_first: { type: 'boolean', description: 'Clear existing text first.' } }, ['selector', 'text']) },
  { name: 'fill_form', description: 'Fill multiple fields in one call.', inputSchema: objectSchema({ fields: { type: 'array', description: 'Array of {selector, value} pairs.', items: { type: 'object', properties: { selector: { type: 'string' }, value: { type: 'string' } }, required: ['selector', 'value'] } } }, ['fields']) },
  { name: 'select_option', description: 'Select an option in a <select> element.', inputSchema: objectSchema({ selector: { type: 'string' }, value: { type: 'string' } }, ['selector', 'value']) },
  { name: 'scroll_to', description: 'Scroll to top/bottom/direction or a CSS selector.', inputSchema: objectSchema({ target: { type: 'string', description: 'top, bottom, up, down, or a CSS selector.' } }, ['target']) },
  { name: 'wait_for_element', description: 'Wait for selector to appear.', inputSchema: objectSchema({ selector: { type: 'string' }, timeout: { type: 'number', description: 'Timeout in ms.' } }, ['selector']) },
  { name: 'click_ref', description: 'Click an element by ref ID.', inputSchema: objectSchema({ ref: { type: 'string', description: 'Reference ID from read_page/distill output.' } }, ['ref']) },
  { name: 'type_ref', description: 'Type text into an element by ref ID.', inputSchema: objectSchema({ ref: { type: 'string' }, text: { type: 'string' } }, ['ref', 'text']) },
  { name: 'scroll_to_ref', description: 'Scroll element with ref ID into view.', inputSchema: objectSchema({ ref: { type: 'string' } }, ['ref']) },
  { name: 'click_mark', description: 'Click a numbered Set-of-Marks marker.', inputSchema: objectSchema({ mark: { type: 'integer', description: 'Mark number.' } }, ['mark']) },

  // Analysis
  { name: 'analyze_page', description: 'Comprehensive page analysis including structure and quality signals.', inputSchema: objectSchema({ include_css: { type: 'boolean' }, include_accessibility: { type: 'boolean' }, viewport_scroll: { type: 'boolean' } }) },
  { name: 'analyze_element', description: 'Deep analysis of one element.', inputSchema: objectSchema({ selector: { type: 'string' } }, ['selector']) },
  { name: 'find_elements', description: 'Search visible elements by text/aria/placeholder/alt/role.', inputSchema: objectSchema({ query: { type: 'string' }, search_by: { type: 'string', enum: ['any', 'text', 'aria', 'placeholder', 'alt', 'role'] }, limit: { type: 'number' } }, ['query']) },
  { name: 'extract_text', description: 'Extract text from matched elements.', inputSchema: objectSchema({ selector: { type: 'string' }, limit: { type: 'number' } }, ['selector']) },
  { name: 'extract_css', description: 'Extract computed styles for an element.', inputSchema: objectSchema({ selector: { type: 'string' }, properties: { type: 'array', items: { type: 'string' } } }, ['selector']) },
  { name: 'check_accessibility', description: 'Run accessibility checks and report violations.', inputSchema: objectSchema({ scope: { type: 'string' }, level: { type: 'string', enum: ['A', 'AA', 'AAA'] } }) },
  { name: 'check_contrast', description: 'Compute text contrast issues for selector or whole page.', inputSchema: objectSchema({ selector: { type: 'string' } }) },

  // Capture
  { name: 'take_screenshot', description: 'Capture current tab screenshot as base64 PNG.', inputSchema: objectSchema({ full_page: { type: 'boolean' } }) },
  { name: 'read_page', description: 'Read page via accessibility tree generator.', inputSchema: objectSchema({ filter: { type: 'string' }, depth: { type: 'number' }, max_chars: { type: 'number' }, ref_id: { type: 'string' } }) },
  { name: 'read_console', description: 'Read captured page console logs.', inputSchema: objectSchema({ onlyErrors: { type: 'boolean' }, limit: { type: 'number' }, clear: { type: 'boolean' }, pattern: { type: 'string' } }) },
  { name: 'distill_dom', description: 'Return distilled DOM content.', inputSchema: objectSchema({ mode: { type: 'string', enum: ['text_only', 'input_fields', 'all_content'] }, filter: { type: 'string' }, depth: { type: 'number' }, max_chars: { type: 'number' }, ref_id: { type: 'string' } }) },
  { name: 'get_dom_changes', description: 'Read and clear buffered DOM mutations.', inputSchema: objectSchema({}) },
  { name: 'read_network', description: 'Read captured network events.', inputSchema: objectSchema({ urlPattern: { type: 'string' }, limit: { type: 'number' }, clear: { type: 'boolean' } }) },

  // Agent
  { name: 'set_of_marks', description: 'Render numbered marks on interactive elements.', inputSchema: objectSchema({ show: { type: 'boolean' }, filter: { type: 'string', enum: ['interactive', 'forms', 'all'] } }) },
  { name: 'quick', description: 'Execute Quick Mode command script.', inputSchema: objectSchema({ commands: { type: 'string', description: 'Newline-separated quick mode commands.' } }, ['commands']) },

  // Platform
  { name: 'download', description: 'Start browser download.', inputSchema: objectSchema({ url: { type: 'string' }, filename: { type: 'string' }, saveAs: { type: 'boolean' } }, ['url']) },
  { name: 'download_status', description: 'Get status for a download ID.', inputSchema: objectSchema({ downloadId: { type: 'number' } }, ['downloadId']) },
  { name: 'add_net_rule', description: 'Add a declarative network rule.', inputSchema: objectSchema({ id: { type: 'integer' }, action: { type: 'string', enum: ['block', 'redirect', 'modifyHeaders'] }, condition: { type: 'object' } }, ['id', 'action', 'condition']) },
  { name: 'remove_net_rule', description: 'Remove declarative network rule by ID.', inputSchema: objectSchema({ id: { type: 'integer' } }, ['id']) },
  { name: 'checkpoint_save', description: 'Save current automation checkpoint.', inputSchema: objectSchema({ name: { type: 'string' }, note: { type: 'string' } }) },
  { name: 'checkpoint_restore', description: 'Restore a saved automation checkpoint.', inputSchema: objectSchema({ checkpoint_id: { type: 'string' }, name: { type: 'string' } }) },

  // GIF
  { name: 'gif_start', description: 'Start a GIF recording session.', inputSchema: objectSchema({}) },
  { name: 'gif_add_frame', description: 'Add a frame to active GIF session.', inputSchema: objectSchema({ imageData: { type: 'string' } }, ['imageData']) },
  { name: 'gif_stop', description: 'Stop GIF recording and return result.', inputSchema: objectSchema({ filename: { type: 'string' } }) },
];

// Shell tool only available when ANVIL_SHELL=true (security opt-in)
if (SHELL_ENABLED) {
  TOOL_DEFINITIONS.push({
    name: 'execute_shell',
    description: 'Execute a shell command on the host machine. SECURITY: This tool is enabled via ANVIL_SHELL=true.',
    inputSchema: objectSchema({ command: { type: 'string', description: 'Shell command to execute.' }, timeout: { type: 'number', description: 'Timeout in ms (default 30000).' } }, ['command'])
  });
}

const ALL_TOOL_DEFINITIONS = [...TOOL_DEFINITIONS, ...PERCEPTION_TOOL_DEFINITIONS];
const TOOL_NAMES = new Set(ALL_TOOL_DEFINITIONS.map(t => t.name));
const LOCAL_TOOLS = new Set(SHELL_ENABLED ? ['execute_shell'] : []);

// ─── State ──────────────────────────────────────────────────────────────────
let extensionWs = null;
let mcpClientWs = null; // MCP client connected via WS (e.g., pi via ws-bridge)
const pendingRequests = new Map(); // id → { resolve, timer }
const mcpResponseRouting = new Map(); // MCP request id → 'ws' | 'stdio'
const MAX_PENDING_REQUESTS = 1000; // Prevent memory leak from abandoned requests
let mcpIdCounter = 0;
let initialized = false;
const perception = new PerceptionEngine();
let activeTabId = null; // Tracked from extension messages

// ─── Extension Communication// ─── Extension Communication ────────────────────────────────────────────────

function sendToExtensionViaStdio(toolName, args) {
  return new Promise((resolve) => {
    if (pendingRequests.size >= MAX_PENDING_REQUESTS) {
      resolve({ success: false, error: `Too many pending requests (${pendingRequests.size}/${MAX_PENDING_REQUESTS}). Wait for pending tool calls to complete.` });
      return;
    }

    const id = `req_${++mcpIdCounter}_${Date.now()}`;
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      resolve({ success: false, error: `Tool call timed out after ${TIMEOUT}ms (stdio)` });
    }, TIMEOUT);

    pendingRequests.set(id, { resolve, timer });

    // Write as JSON-RPC notification — native host will translate to mcp_tool_call
    const msg = JSON.stringify({
      jsonrpc: '2.0',
      method: 'anvil/tool_call',
      params: { id, tool: toolName, args: args || {} }
    });

    log('→ EXT (stdio):', msg.slice(0, 200));
    process.stdout.write(msg + '\n');
  });
}

function sendToExtension(toolName, args) {
  return new Promise((resolve) => {
    // Try WS first
    if (extensionWs && extensionWs.readyState === WebSocket.OPEN) {
      if (pendingRequests.size >= MAX_PENDING_REQUESTS) {
        resolve({ success: false, error: `Too many pending requests (${pendingRequests.size}/${MAX_PENDING_REQUESTS}). Wait for pending tool calls to complete.` });
        return;
      }

      const id = `req_${++mcpIdCounter}_${Date.now()}`;
      const timer = setTimeout(() => {
        pendingRequests.delete(id);
        resolve({ success: false, error: `Tool call timed out after ${TIMEOUT}ms` });
      }, TIMEOUT);

      pendingRequests.set(id, { resolve, timer });

      const msg = JSON.stringify({
        id,
        type: 'tool_call',
        tool: toolName,
        args: args || {},
        timestamp: Date.now()
      });

      log('→ EXT (ws):', msg.slice(0, 200));
      extensionWs.send(msg);
      return;
    }

    // Fall back to stdio (native host pipe)
    if (STDIO_MODE) {
      sendToExtensionViaStdio(toolName, args).then(resolve);
      return;
    }

    resolve({
      success: false,
      error: 'Extension not connected. Open Chrome with Open Anvil extension loaded, then reload this server.'
    });
  });
}

function handleExtensionMessage(data) {
  let msg;
  try {
    msg = JSON.parse(data.toString());
  } catch {
    log('Bad JSON from extension:', data.toString().slice(0, 100));
    return;
  }

  log('← EXT:', JSON.stringify(msg).slice(0, 200));

  if (msg.type === 'tool_response' && msg.id) {
    const pending = pendingRequests.get(msg.id);
    if (pending) {
      clearTimeout(pending.timer);
      pendingRequests.delete(msg.id);
      pending.resolve({
        success: msg.success !== false,
        result: msg.result,
        error: msg.error
      });
    }
    return;
  }

  if (msg.type === 'status') {
    log('Extension status:', msg.event, JSON.stringify(msg.data || {}));
    return;
  }

  // ── Perception Events (with schema validation) ─────────────────────────
  if (msg.type === 'perception_events') {
    if (typeof msg.tabId !== 'number' || !Array.isArray(msg.events)) {
      log('Dropping malformed perception_events: tabId must be number, events must be array');
      return;
    }
    perception.ingestEvents(msg.tabId, msg.events);
    logPerception(`events tab=${msg.tabId} count=${msg.events.length}`);
    return;
  }

  if (msg.type === 'perception_snapshot') {
    if (typeof msg.tabId !== 'number') {
      log('Dropping malformed perception_snapshot: tabId must be number');
      return;
    }
    if (msg.nodes !== undefined && !Array.isArray(msg.nodes)) {
      log('Dropping malformed perception_snapshot: nodes must be array');
      return;
    }
    perception.ingestSnapshot(msg.tabId, msg);
    activeTabId = msg.tabId;
    logPerception(`snapshot tab=${msg.tabId} nodes=${(msg.nodes || []).length} url=${msg.url || '?'}`);
    return;
  }

  if (msg.type === 'perception_navigation') {
    if (typeof msg.tabId !== 'number') {
      log('Dropping malformed perception_navigation: tabId must be number');
      return;
    }
    perception.ingestNavigation(msg.tabId, msg);
    logPerception(`navigation tab=${msg.tabId} url=${msg.url || '?'}`);
    return;
  }

  if (msg.type === 'perception_scroll') {
    if (typeof msg.tabId !== 'number') {
      log('Dropping malformed perception_scroll: tabId must be number');
      return;
    }
    perception.ingestScroll(msg.tabId, { x: msg.x || 0, y: msg.y || 0 });
    return;
  }

  if (msg.type === 'perception_tab_closed') {
    if (typeof msg.tabId !== 'number') {
      log('Dropping malformed perception_tab_closed: tabId must be number');
      return;
    }
    perception.removeModel(msg.tabId);
    logPerception(`tab_closed tab=${msg.tabId}`);
    return;
  }
}

// ─── MCP Protocol Handler ───────────────────────────────────────────────────
async function handleMcpMessage(line, source = 'stdio') {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }

  log(`← MCP (${source}):`, line.slice(0, 200));

  if (msg.jsonrpc !== '2.0') return;

  // ── Extension responses via native host (stdio mode) ───────────────────
  // These are forwarded by the native host from the extension's tool_response
  if (msg.method === 'anvil/tool_response') {
    const resp = msg.params || {};
    const pending = pendingRequests.get(resp.id);
    if (pending) {
      clearTimeout(pending.timer);
      pendingRequests.delete(resp.id);
      pending.resolve({
        success: resp.success !== false,
        result: resp.result,
        error: resp.error
      });
    } else {
      log('Dropped tool_response for unknown request:', resp.id);
    }
    return;
  }

  // ── Extension perception events via native host (stdio mode) ───────────
  if (msg.method === 'anvil/perception') {
    const evt = msg.params || {};
    handleExtensionMessage(JSON.stringify(evt));
    return;
  }

  // Notifications (no id) — just acknowledge
  if (msg.id === undefined) {
    if (msg.method === 'notifications/initialized') {
      log('Client confirmed initialization');
    }
    return;
  }

  const { id, method, params } = msg;

  // Tag this request's response routing
  if (id !== undefined) {
    mcpResponseRouting.set(String(id), source);
  }

  switch (method) {
    case 'initialize': {
      if (!initialized) {
        initialized = true;
        log('MCP client initialized');
      }
      mcpResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: { listChanged: false }
        },
        serverInfo: SERVER_INFO
      });
      break;
    }

    case 'tools/list': {
      mcpResult(id, {
        tools: ALL_TOOL_DEFINITIONS.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema
        }))
      });
      break;
    }

    case 'tools/call': {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      if (!toolName || !TOOL_NAMES.has(toolName)) {
        mcpResult(id, {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` }) }],
          isError: true
        });
        break;
      }

      // Rate limit check
      if (!checkRateLimit(source)) {
        mcpResult(id, {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Rate limit exceeded. Too many tool calls.' }) }],
          isError: true
        });
        break;
      }

      let result;
      if (LOCAL_TOOLS.has(toolName)) {
        result = handleLocalTool(toolName, toolArgs);
      } else if (PERCEPTION_TOOL_NAMES.has(toolName)) {
        result = handlePerceptionTool(perception, toolName, toolArgs, activeTabId);
      } else {
        result = await sendToExtension(toolName, toolArgs);
      }

      const isError = result.success === false;
      const content = [{ type: 'text', text: JSON.stringify(result) }];

      // If result contains a screenshot (base64 image), also send as image content
      if (result.result?.screenshot && typeof result.result.screenshot === 'string') {
        const dataUrl = result.result.screenshot;
        const base64Match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
        if (base64Match) {
          content.push({
            type: 'image',
            data: base64Match[2],
            mimeType: `image/${base64Match[1]}`
          });
        }
      }

      mcpResult(id, { content, isError });
      break;
    }

    default: {
      mcpError(id, -32601, `Method not found: ${method}`);
    }
  }
}

// ─── WebSocket Server ───────────────────────────────────────────────────────
// Always start WS server. In stdio mode (native host), use a secondary port
// (default 7778) so pi can connect directly while the native host uses stdin.
// In standalone mode, use the primary port (default 7777).
const WS_PORT = STDIO_MODE
  ? parseInt(process.env.ANVIL_WS_PORT || '7778', 10)
  : PORT;

const WS_ENABLED = process.env.ANVIL_WS_ENABLED !== 'false';

let httpServer = null;
let wss = null;

if (WS_ENABLED) {
  httpServer = createServer();
  wss = new WebSocketServer({ server: httpServer });
}

if (wss) {
wss.on('connection', (ws, req) => {
  log(`Extension connected from ${req.socket.remoteAddress}`);

  // ── WebSocket Token Authentication ──────────────────────────────────────
  if (EFFECTIVE_WS_TOKEN) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const clientToken = url.searchParams.get('token');
    if (clientToken !== EFFECTIVE_WS_TOKEN) {
      log('Rejecting WebSocket connection: invalid or missing token');
      ws.close(4401, 'Unauthorized');
      return;
    }
    log('WebSocket token verified');
  }

  // Distinguish MCP client (JSON-RPC) from extension (typed messages)
  // by peeking at the first message.
  let clientType = null; // 'extension' | 'mcp_client'

  ws.on('message', (data) => {
    if (!clientType) {
      try {
        const first = JSON.parse(data.toString());
        clientType = first.jsonrpc === '2.0' ? 'mcp_client' : 'extension';
      } catch {
        clientType = 'extension'; // default
      }
      log(`WS client identified as: ${clientType}`);

      if (clientType === 'extension') {
        if (extensionWs && extensionWs.readyState === WebSocket.OPEN) {
          log('Replacing existing extension connection');
          extensionWs.close();
        }
        extensionWs = ws;
        // Request fresh snapshots from all tabs
        ws.send(JSON.stringify({ type: 'perception_init', version: EXPECTED_VERSION, timestamp: Date.now() }));
        perception.resetAllCursors();
      }
    }

    if (clientType === 'mcp_client') {
      // Process as MCP JSON-RPC
      handleMcpMessage(data.toString().trim(), 'ws');
    } else {
      handleExtensionMessage(data);
    }
  });

  ws.on('close', () => {
    log(`${clientType || 'unknown'} WS disconnected`);
    if (extensionWs === ws) {
      extensionWs = null;
      // Don't clear pending extension requests — they'll timeout naturally
      // and the error message tells the MCP client to retry
      log('Extension WS disconnected; tool calls will fail until extension reconnects');
    }
    if (mcpClientWs === ws) {
      mcpClientWs = null;
      // Clean up response routing for this client
      for (const [key, val] of mcpResponseRouting) {
        if (val === 'ws') mcpResponseRouting.delete(key);
      }
    }
  });

  ws.on('error', (err) => {
    log(`WS error (${clientType || 'unknown'}):`, err.message);
  });
});

} // end if (wss)

// ─── HTTP Server Start (WS mode only) ──────────────────────────────────────
if (httpServer) {
httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    log(`Port ${WS_PORT} in use, retrying in 1s...`);
    setTimeout(() => {
      httpServer.close();
      httpServer.listen(WS_PORT, HOST);
    }, 1000);
  } else {
    log('HTTP server error:', err.message);
    process.exit(1);
  }
});

httpServer.listen(WS_PORT, HOST, () => {
  log(`WebSocket server listening on ws://${HOST}:${WS_PORT}`);
});
} // end if (httpServer)

// ─── Perception Housekeeping ─────────────────────────────────────────────
setInterval(() => {
  const stats = perception.expireStale();
  if (stats.expiredCursors > 0) {
    log(`Perception: expired ${stats.expiredCursors} cursors, ${stats.totalModels} models, ${stats.totalCursors} cursors`);
  }
}, 60000);

// ─── JSON-RPC helpers ────────────────────────────────────────────────────────
function mcpResult(id, result) {
  const msg = { jsonrpc: '2.0', id, result };
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function mcpError(id, code, message) {
  const msg = { jsonrpc: '2.0', id, error: { code, message } };
  process.stdout.write(JSON.stringify(msg) + '\n');
}

// ─── Local tool handlers (server-side tools that don't need the extension) ──
function handleLocalTool(toolName, toolArgs) {
  if (toolName === 'echo') {
    return { success: true, result: { text: toolArgs.text || '' } };
  }
  return { success: false, error: `Unknown local tool: ${toolName}` };
}

// ─── stdio MCP Input ────────────────────────────────────────────────────────
const rl = createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (trimmed) handleMcpMessage(trimmed);
});

rl.on('close', () => {
  log('stdin closed, shutting down');
  if (wss) wss.close();
  if (httpServer) httpServer.close();
  process.exit(0);
});

// ─── Graceful Shutdown ──────────────────────────────────────────────────────
process.on('SIGINT', () => {
  log('SIGINT received, shutting down');
  if (wss) wss.close();
  if (httpServer) httpServer.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down');
  if (wss) wss.close();
  if (httpServer) httpServer.close();
  process.exit(0);
});

// ─── Version Alignment Check ─────────────────────────────────────────────
const EXPECTED_VERSION = SERVER_INFO.version;
const versionMismatch = [];
if (PERCEPTION_ENGINE_VERSION !== EXPECTED_VERSION) versionMismatch.push(`perception-engine=${PERCEPTION_ENGINE_VERSION}`);
if (PERCEPTION_TOOLS_VERSION !== EXPECTED_VERSION) versionMismatch.push(`perception-tools=${PERCEPTION_TOOLS_VERSION}`);
if (versionMismatch.length > 0) {
  process.stderr.write(`[anvil] WARNING: Version mismatch — server=${EXPECTED_VERSION} but ${versionMismatch.join(', ')}\n`);
}

log('Open Anvil MCP server started');
log(`Version: server=${EXPECTED_VERSION} engine=${PERCEPTION_ENGINE_VERSION} tools=${PERCEPTION_TOOLS_VERSION}`);
log(`Mode: ${STDIO_MODE ? 'stdio (native host)' : 'standalone'}`);
log(`WebSocket: ws://${HOST}:${WS_PORT} (enabled=${WS_ENABLED}, token=${EFFECTIVE_WS_TOKEN ? 'yes' : 'no'})`);
log('Waiting for MCP client on stdin');
