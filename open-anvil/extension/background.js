// background.js — Open Anvil Agent Pilot v1.0.0 Service Worker
// WebSocket client connecting to MCP server. Routes tool calls to content scripts.
'use strict';
importScripts('cdp.js');
importScripts('net-rules.js');
importScripts('network-monitor.js');
importScripts('checkpoint.js');
importScripts('workflow-recorder.js');

// ─── Configuration ──────────────────────────────────────────────────────────
const WS_BASE_URL = 'ws://127.0.0.1:7777';
const RECONNECT_DELAY_BASE = 1000;
const RECONNECT_MAX_ATTEMPTS = 20;
const KEEP_ALIVE_INTERVAL_MIN = 0.4; // ~24 seconds

// ─── State ──────────────────────────────────────────────────────────────────
let ws = null;
let reconnectAttempts = 0;
let reconnectTimer = null;

// ─── Keep-Alive Alarm ───────────────────────────────────────────────────────
chrome.alarms.create('anvil-keep-alive', { periodInMinutes: KEEP_ALIVE_INTERVAL_MIN });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'anvil-keep-alive') {
    // Ping to keep service worker alive and check WS health
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectWebSocket();
    } else {
      ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    }
  }
});

// ─── WebSocket Connection ───────────────────────────────────────────────────
async function getWsUrl() {
  try {
    const data = await chrome.storage.local.get('anvilWsToken');
    if (data.anvilWsToken) {
      return `${WS_BASE_URL}?token=${encodeURIComponent(data.anvilWsToken)}`;
    }
  } catch (_) {}
  return WS_BASE_URL;
}

function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  getWsUrl().then(wsUrl => _doConnect(wsUrl)).catch(() => _doConnect(WS_BASE_URL));
}

function _doConnect(wsUrl) {
  try {
    ws = new WebSocket(wsUrl);
  } catch (e) {
    console.error('[Anvil] WebSocket creation failed:', e.message);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log('[Anvil] Connected to MCP server');
    reconnectAttempts = 0;
    // Announce ourselves
    ws.send(JSON.stringify({
      type: 'status',
      event: 'connected',
      data: { version: '1.0.0', agent: 'open-anvil-extension' }
    }));
  };

  ws.onmessage = async (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      console.error('[Anvil] Bad JSON from MCP server');
      return;
    }

    if (msg.type === 'tool_call') {
      const result = await routeToolCall(msg);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          id: msg.id,
          type: 'tool_response',
          success: result.success !== false,
          result: result.result,
          error: result.error,
          duration: result.duration
        }));
      }
    }

    // Server requests fresh snapshots from all tabs (reconnect/init)
    if (msg.type === 'perception_init') {
      requestPerceptionSnapshots();
    }
  };

  ws.onclose = () => {
    console.log('[Anvil] WebSocket closed');
    ws = null;
    scheduleReconnect();
  };

  ws.onerror = (err) => {
    console.error('[Anvil] WebSocket error');
    // onclose will fire after this
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  if (reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
    console.error('[Anvil] Max reconnect attempts reached. Will retry on next alarm.');
    reconnectAttempts = 0;
    return;
  }
  const delay = Math.min(RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttempts), 30000);
  reconnectAttempts++;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWebSocket();
  }, delay);
}

// Connect on startup
connectWebSocket();

// ─── Desktop Notifications ──────────────────────────────────────────────────
function notifyUser(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
    priority: 2
  });
}

// ─── Offscreen Document ─────────────────────────────────────────────────────
let offscreenReady = false;
async function ensureOffscreen() {
  if (offscreenReady) return;
  const existing = await chrome.offscreen.hasDocument();
  if (!existing) {
    await chrome.offscreen.createDocument({
      url: 'offscreen-worker.html',
      reasons: ['WORKERS', 'BLOBS'],
      justification: 'GIF recording and canvas operations for agent automation'
    });
  }
  offscreenReady = true;
}

// ─── Route Tool Calls ───────────────────────────────────────────────────────
async function routeToolCall(msg) {
  const start = Date.now();
  try {
    let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab) {
      const tabs = await chrome.tabs.query({ active: true });
      if (tabs.length > 0) tab = tabs[0];
    }

    // Try background API tools first
    const browserApiResult = await handleBrowserApiTool(msg.tool, msg.args || {}, tab);
    if (browserApiResult !== null) {
      browserApiResult.duration = Date.now() - start;
      return browserApiResult;
    }

    // Forward to content script
    if (!tab?.id) {
      return { success: false, error: 'No active tab found', duration: Date.now() - start };
    }

    chrome.tabs.sendMessage(tab.id, { type: 'AGENT_WORKING' }).catch(() => {});

    return new Promise((resolve) => {
      const done = (result) => {
        chrome.tabs.sendMessage(tab.id, { type: 'AGENT_DONE' }).catch(() => {});
        result.duration = Date.now() - start;
        resolve(result);
      };

      chrome.tabs.sendMessage(tab.id, {
        type: 'tool_call',
        requestId: msg.id,
        tool: msg.tool,
        args: msg.args || {}
      }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script not loaded — inject and retry
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content-script.js']
          }).then(() => {
            chrome.tabs.sendMessage(tab.id, {
              type: 'tool_call',
              requestId: msg.id,
              tool: msg.tool,
              args: msg.args || {}
            }, (retryResponse) => {
              if (chrome.runtime.lastError) {
                done({ success: false, error: 'Content script failed: ' + chrome.runtime.lastError.message });
              } else {
                done(retryResponse || { success: false, error: 'No response from content script' });
              }
            });
          }).catch(err => {
            done({ success: false, error: 'Cannot inject into this page: ' + err.message });
          });
        } else {
          done(response || { success: false, error: 'No response from content script' });
        }
      });
    });
  } catch (e) {
    return { success: false, error: e.message, duration: Date.now() - start };
  }
}

// ─── Browser API Tools (handled in background, not content script) ──────────
async function handleBrowserApiTool(tool, args, activeTab) {
  switch (tool) {
    case 'navigate_to': {
      const tabId = args.tab_id || activeTab?.id;
      if (!tabId) return { success: false, error: 'No tab available' };
      await chrome.tabs.update(tabId, { url: args.url });
      // Wait for page to start loading
      return { success: true, result: { navigated: args.url, tabId } };
    }
    case 'open_tab': {
      const newTab = await chrome.tabs.create({ url: args.url });
      await autoJoinTabGroup(newTab.id);
      return { success: true, result: { tabId: newTab.id, url: args.url } };
    }
    case 'close_tab': {
      await chrome.tabs.remove(args.tab_id);
      return { success: true, result: { closed: args.tab_id } };
    }
    case 'switch_tab': {
      await chrome.tabs.update(args.tab_id, { active: true });
      return { success: true, result: { switched: args.tab_id } };
    }
    case 'list_tabs': {
      const tabs = await chrome.tabs.query({});
      return { success: true, result: tabs.map(t => ({
        tabId: t.id, url: t.url, title: t.title, active: t.active, status: t.status
      })) };
    }
    case 'take_screenshot': {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      return { success: true, result: { screenshot: dataUrl, format: 'png' } };
    }
    case 'get_tab_state': {
      const tabId = args.tab_id || activeTab?.id;
      if (!tabId) return { success: false, error: 'No tab ID' };
      const tab = await chrome.tabs.get(tabId);
      return { success: true, result: {
        tabId: tab.id, url: tab.url, title: tab.title,
        status: tab.status, active: tab.active
      } };
    }
    case 'download': {
      const opts = { url: args.url };
      if (args.filename) opts.filename = args.filename;
      if (args.saveAs) opts.saveAs = true;
      const downloadId = await chrome.downloads.download(opts);
      return { success: true, result: { downloadId } };
    }
    case 'download_status': {
      const items = await chrome.downloads.search({ id: args.downloadId });
      if (!items || items.length === 0) return { success: false, error: 'Download not found' };
      const d = items[0];
      return { success: true, result: {
        id: d.id, state: d.state, filename: d.filename,
        bytesReceived: d.bytesReceived, totalBytes: d.totalBytes, error: d.error
      } };
    }
    case 'create_tab_group': {
      const groupId = await chrome.tabs.group({ tabIds: args.tabIds });
      const updateOpts = {};
      if (args.title) updateOpts.title = args.title;
      if (args.color) updateOpts.color = args.color;
      if (args.collapsed !== undefined) updateOpts.collapsed = args.collapsed;
      if (Object.keys(updateOpts).length > 0) {
        await chrome.tabGroups.update(groupId, updateOpts);
      }
      await chrome.storage.session.set({ anvilActiveGroupId: groupId });
      return { success: true, result: { groupId } };
    }
    case 'manage_tab_group': {
      const gid = args.groupId;
      if (!gid) return { success: false, error: 'groupId required' };
      if (args.action === 'collapse') {
        await chrome.tabGroups.update(gid, { collapsed: true });
      } else if (args.action === 'expand') {
        await chrome.tabGroups.update(gid, { collapsed: false });
      } else if (args.action === 'ungroup') {
        const tabs = await chrome.tabs.query({ groupId: gid });
        if (tabs.length > 0) await chrome.tabs.ungroup(tabs.map(t => t.id));
      } else if (args.title || args.color) {
        const updateOpts = {};
        if (args.title) updateOpts.title = args.title;
        if (args.color) updateOpts.color = args.color;
        await chrome.tabGroups.update(gid, updateOpts);
      }
      return { success: true, result: { groupId: gid, action: args.action || 'update' } };
    }
    case 'add_net_rule':
      return addNetRule(args);
    case 'remove_net_rule':
      return removeNetRule(args);
    case 'read_network':
      return readNetwork(args);
    case 'start_network_monitor':
      return startNetworkMonitor(activeTab?.id);
    case 'stop_network_monitor':
      return stopNetworkMonitor();
    case 'checkpoint_save':
      return checkpointSave(args);
    case 'checkpoint_restore':
      return checkpointRestore(args);
    case 'record_start':
      return recordStart({ ...args, tabId: activeTab?.id });
    case 'record_stop':
      return recordStop(args);
    case 'record_export':
      return recordExport(args);
    case 'gif_start':
    case 'gif_add_frame':
    case 'gif_stop': {
      await ensureOffscreen();
      const resp = await chrome.runtime.sendMessage({ type: 'GENERATE_GIF', data: { ...args, command: tool } });
      return resp || { success: false, error: 'No response from offscreen worker' };
    }
    default:
      return null; // Not a background API tool — forward to content script
  }
}

// ─── Tab Group Auto-Join ────────────────────────────────────────────────────
async function autoJoinTabGroup(tabId) {
  try {
    const data = await chrome.storage.session.get('anvilActiveGroupId');
    if (data.anvilActiveGroupId) {
      await chrome.tabs.group({ tabIds: [tabId], groupId: data.anvilActiveGroupId });
    }
  } catch (_) {}
}

// ─── Messages from Content Scripts ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;

  const sanitize = (s) => {
    if (typeof s !== 'string') return '';
    let out = '';
    for (let i = 0; i < s.length && out.length < 500; i++) {
      const c = s.charCodeAt(i);
      if (c >= 0x20 || c === 0x09) out += s[i];
    }
    return out;
  };

  try {
    if (message.type === 'debug_command') {
      const tabId = message.tabId || sender.tab?.id;
      const method = message.method;
      const params = message.params || {};
      if (!tabId || typeof method !== 'string' || !method) {
        sendResponse({ success: false, error: 'debug_command requires tabId and method' });
        return false;
      }
      globalThis.__anvilCDP.execute(tabId, method, params)
        .then(result => sendResponse({ success: true, result }))
        .catch(err => sendResponse({ success: false, error: err.message || 'CDP command failed' }));
      return true;
    }

    if (message.action) {
      handleBrowserApiTool(message.action, message, { id: sender.tab?.id })
        .then(result => {
          sendResponse(result || { success: false, error: 'Unknown action' });
        })
        .catch(err => {
          sendResponse({ success: false, error: err.message || 'Internal error' });
        });
      return true;
    }

    // Forward perception messages from content scripts to server
    if (message.type === 'perception_events' || message.type === 'perception_snapshot' ||
        message.type === 'perception_scroll') {
      forwardPerceptionMessage(message, sender);
      return false;
    }

    if (message.type === 'interceptor_event' && message.payload) {
      const { payload } = message;
      const safeEvent = { tool: 'browser_event' };
      if (payload.type === 'console_error') {
        safeEvent.event = 'console_error';
        safeEvent.message = sanitize(payload.message);
      } else if (payload.type === 'network_error') {
        safeEvent.event = 'network_error';
        safeEvent.method = sanitize(payload.method);
        safeEvent.url = sanitize(payload.url);
        safeEvent.status = typeof payload.status === 'number' ? payload.status : 0;
      } else if (payload.type === 'unhandled_exception') {
        safeEvent.event = 'exception';
        safeEvent.message = sanitize(payload.message);
        safeEvent.source = sanitize(payload.filename) + ':' + (payload.lineno || 0);
      } else if (payload.type === 'unhandled_rejection') {
        safeEvent.event = 'promise_rejection';
        safeEvent.reason = sanitize(payload.reason);
      } else {
        return false;
      }

      // Forward browser events to MCP server
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'browser_event',
          event: safeEvent,
          timestamp: Date.now()
        }));
      }
      return false;
    }
  } catch (e) {
    console.error('[Anvil] Message handler error:', e);
  }
  return false;
});

// ─── Perception: Event Forwarding ────────────────────────────────────────

// Forward perception events from content scripts to server (fire-and-forget)
function forwardPerceptionMessage(message, sender) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const tabId = sender.tab?.id;
  if (!tabId) return;

  ws.send(JSON.stringify({
    type: message.type,
    tabId,
    ...message
  }));
}

// Request fresh snapshots from all tabs
async function requestPerceptionSnapshots() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.id || !tab.url || tab.url.startsWith('chrome://')) continue;
      chrome.tabs.sendMessage(tab.id, { type: 'perception_request_snapshot' }).catch(() => {});
    }
  } catch (e) {
    console.error('[Anvil] Failed to request perception snapshots:', e.message);
  }
}

// Tab closed → notify server
chrome.tabs.onRemoved.addListener((tabId) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'perception_tab_closed',
      tabId,
      timestamp: Date.now()
    }));
  }
});

// Navigation completed → notify server
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return; // main frame only
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'perception_navigation',
      tabId: details.tabId,
      url: details.url,
      timestamp: Date.now()
    }));
  }
});

// ─── Extension Install/Update ───────────────────────────────────────────────
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    notifyUser('Open Anvil', 'Agent Pilot installed. Start the MCP server to begin.');
  }
});

// ─── Test Hook ──────────────────────────────────────────────────────────────
if (globalThis.__OPEN_ANVIL_TEST__) {
  globalThis.__anvilBackgroundTest = {
    routeToolCall,
    handleBrowserApiTool,
    getWs: () => ws,
    setWs: (w) => { ws = w; }
  };
}
