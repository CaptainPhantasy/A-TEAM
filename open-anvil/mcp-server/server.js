#!/usr/bin/env node
// open-anvil-mcp — MCP Server for Open Anvil
// Speaks MCP JSON-RPC 2.0 on stdio, runs WebSocket server for Chrome extension
'use strict';

import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { createInterface } from 'node:readline';
import { execSync } from 'node:child_process';

// ─── Configuration ──────────────────────────────────────────────────────────
const PORT = parseInt(process.env.ANVIL_PORT || '7777', 10);
const HOST = process.env.ANVIL_HOST || '127.0.0.1';
const TIMEOUT = parseInt(process.env.ANVIL_TIMEOUT || '30000', 10);
const DEBUG = process.env.ANVIL_DEBUG === 'true' || process.argv.includes('--debug');

const SERVER_INFO = { name: 'open-anvil', version: '1.0.0' };
const PROTOCOL_VERSION = '2024-11-05';

// ─── Tool Definitions ───────────────────────────────────────────────────────
function objectSchema(properties, required = []) {
  return { type: 'object', properties, required, additionalProperties: true };
}

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

  // Shell (handled locally by MCP server, not forwarded to extension)
  { name: 'execute_shell', description: 'Execute a shell command on the host machine.', inputSchema: objectSchema({ command: { type: 'string', description: 'Shell command to execute.' }, timeout: { type: 'number', description: 'Timeout in ms (default 30000).' } }, ['command']) },
];

const TOOL_NAMES = new Set(TOOL_DEFINITIONS.map(t => t.name));
const LOCAL_TOOLS = new Set(['execute_shell']);

// ─── State ──────────────────────────────────────────────────────────────────
let extensionWs = null;
const pendingRequests = new Map(); // id → { resolve, timer }
let requestCounter = 0;
let initialized = false;

// ─── Logging ────────────────────────────────────────────────────────────────
function log(...args) {
  if (DEBUG) process.stderr.write(`[anvil] ${args.join(' ')}\n`);
}

// ─── MCP stdio Transport ────────────────────────────────────────────────────
const rl = createInterface({ input: process.stdin, terminal: false });

function sendMcpResponse(obj) {
  const json = JSON.stringify(obj);
  process.stdout.write(json + '\n');
  log('→ MCP:', json.slice(0, 200));
}

function mcpResult(id, result) {
  sendMcpResponse({ jsonrpc: '2.0', id, result });
}

function mcpError(id, code, message, data) {
  const err = { code, message };
  if (data !== undefined) err.data = data;
  sendMcpResponse({ jsonrpc: '2.0', id, error: err });
}

// ─── Local Tool Handlers ────────────────────────────────────────────────────
function handleLocalTool(name, args) {
  if (name === 'execute_shell') {
    try {
      const timeout = args.timeout || 30000;
      const result = execSync(args.command, {
        timeout,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        shell: true
      });
      return { success: true, result: { output: result, exitCode: 0 } };
    } catch (err) {
      return {
        success: false,
        error: err.message,
        result: { output: err.stdout || '', stderr: err.stderr || '', exitCode: err.status || 1 }
      };
    }
  }
  return { success: false, error: `Unknown local tool: ${name}` };
}

// ─── Extension Communication ────────────────────────────────────────────────
function sendToExtension(toolName, args) {
  return new Promise((resolve, reject) => {
    if (!extensionWs || extensionWs.readyState !== WebSocket.OPEN) {
      resolve({
        success: false,
        error: 'Extension not connected. Open Chrome with Open Anvil extension loaded, then reload this server.'
      });
      return;
    }

    const id = `req_${++requestCounter}_${Date.now()}`;
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

    log('→ EXT:', msg.slice(0, 200));
    extensionWs.send(msg);
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
}

// ─── MCP Protocol Handler ───────────────────────────────────────────────────
async function handleMcpMessage(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }

  log('← MCP:', line.slice(0, 200));

  if (msg.jsonrpc !== '2.0') return;

  // Notifications (no id) — just acknowledge
  if (msg.id === undefined) {
    if (msg.method === 'notifications/initialized') {
      log('Client confirmed initialization');
    }
    return;
  }

  const { id, method, params } = msg;

  switch (method) {
    case 'initialize': {
      initialized = true;
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
        tools: TOOL_DEFINITIONS.map(t => ({
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

      let result;
      if (LOCAL_TOOLS.has(toolName)) {
        result = handleLocalTool(toolName, toolArgs);
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
const httpServer = createServer();
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  log(`Extension connected from ${req.socket.remoteAddress}`);

  if (extensionWs && extensionWs.readyState === WebSocket.OPEN) {
    log('Replacing existing extension connection');
    extensionWs.close();
  }

  extensionWs = ws;

  ws.on('message', handleExtensionMessage);

  ws.on('close', () => {
    log('Extension disconnected');
    if (extensionWs === ws) extensionWs = null;
  });

  ws.on('error', (err) => {
    log('Extension WebSocket error:', err.message);
  });
});

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    log(`Port ${PORT} in use, retrying in 1s...`);
    setTimeout(() => {
      httpServer.close();
      httpServer.listen(PORT, HOST);
    }, 1000);
  } else {
    log('HTTP server error:', err.message);
    process.exit(1);
  }
});

httpServer.listen(PORT, HOST, () => {
  log(`WebSocket server listening on ws://${HOST}:${PORT}`);
});

// ─── stdio MCP Input ────────────────────────────────────────────────────────
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (trimmed) handleMcpMessage(trimmed);
});

rl.on('close', () => {
  log('stdin closed, shutting down');
  wss.close();
  httpServer.close();
  process.exit(0);
});

// ─── Graceful Shutdown ──────────────────────────────────────────────────────
process.on('SIGINT', () => {
  log('SIGINT received, shutting down');
  wss.close();
  httpServer.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down');
  wss.close();
  httpServer.close();
  process.exit(0);
});

log('Open Anvil MCP server started');
log(`Waiting for extension on ws://${HOST}:${PORT}`);
log('Waiting for MCP client on stdin');
