#!/usr/bin/env node
// ws-bridge — Thin stdio-to-WebSocket bridge for MCP clients
//
// Allows MCP clients (like pi) that speak stdio to connect to a
// server.js instance running behind a native host on port 7778.
//
// Usage: node ws-bridge.js [port] [token]
//   port  — WebSocket port (default: 7778)
//   token — Optional WS auth token

'use strict';

import WebSocket from 'ws';
import { createInterface } from 'node:readline';

const PORT = parseInt(process.argv[2] || '7778', 10);
const TOKEN = process.argv[3] || process.env.ANVIL_WS_TOKEN || '';
const HOST = process.env.ANVIL_HOST || '127.0.0.1';
const RECONNECT_DELAY = 2000;
const MAX_RECONNECT = 20;

let ws = null;
let reconnectCount = 0;
let reconnectTimer = null;
let initialized = false;

// ─── stdio → WS (MCP client to server) ──────────────────────────────────────
const rl = createInterface({ input: process.stdin, terminal: false });

function sendToServer(line) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(line);
  }
  // else: buffer dropped — server not connected yet
}

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  sendToServer(trimmed);
});

rl.on('close', () => {
  if (ws) ws.close();
  process.exit(0);
});

// ─── WS → stdio (server to MCP client) ──────────────────────────────────────
function connect() {
  let url = `ws://${HOST}:${PORT}`;
  if (TOKEN) url += `?token=${encodeURIComponent(TOKEN)}`;

  try {
    ws = new WebSocket(url);
  } catch (e) {
    process.stderr.write(`[ws-bridge] WebSocket error: ${e.message}\n`);
    scheduleReconnect();
    return;
  }

  ws.on('open', () => {
    reconnectCount = 0;
    process.stderr.write(`[ws-bridge] Connected to ws://${HOST}:${PORT}\n`);
  });

  ws.on('message', (data) => {
    // Forward server output to stdout for the MCP client
    process.stdout.write(data.toString() + '\n');
  });

  ws.on('close', (code) => {
    process.stderr.write(`[ws-bridge] Disconnected (code: ${code})\n`);
    ws = null;
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    process.stderr.write(`[ws-bridge] Error: ${err.message}\n`);
    ws = null;
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (reconnectCount >= MAX_RECONNECT) {
    process.stderr.write(`[ws-bridge] Max reconnects (${MAX_RECONNECT}) exceeded\n`);
    process.exit(1);
    return;
  }
  if (reconnectTimer) return;
  const delay = Math.min(RECONNECT_DELAY * Math.pow(1.5, reconnectCount), 30000);
  reconnectCount++;
  process.stderr.write(`[ws-bridge] Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${reconnectCount}/${MAX_RECONNECT})\n`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

// ─── Graceful shutdown ──────────────────────────────────────────────────────
process.on('SIGINT', () => { if (ws) ws.close(); process.exit(0); });
process.on('SIGTERM', () => { if (ws) ws.close(); process.exit(0); });

// ─── Start ──────────────────────────────────────────────────────────────────
process.stderr.write(`[ws-bridge] Connecting to ws://${HOST}:${PORT}...\n`);
connect();
