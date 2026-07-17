#!/usr/bin/env node
// test-server.js — Unit tests for Open Anvil MCP server
// Run: node --test mcp-server/test-server.js

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import { connect } from 'node:net';

const SERVER_PATH = new URL('./server.js', import.meta.url).pathname;
const PORT = 17777; // Use non-default port for testing
const TIMEOUT = 5000;

// ─── Helpers ──────────────────────────────────────────────────────────────

function spawnServer(env = {}) {
  return spawn('node', [SERVER_PATH], {
    env: {
      ...process.env,
      ANVIL_PORT: String(PORT),
      ANVIL_HOST: '127.0.0.1',
      ANVIL_WS_ENABLED: 'true',
      ANVIL_DEBUG: 'true',
      ...env,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function sendMcp(proc, msg) {
  const line = JSON.stringify(msg);
  proc.stdin.write(line + '\n');
  return line;
}

function readMcp(proc) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Read timeout')), TIMEOUT);
    let buffer = '';
    const onData = (chunk) => {
      buffer += chunk;
      const idx = buffer.indexOf('\n');
      if (idx !== -1) {
        clearTimeout(timer);
        proc.stdout.removeListener('data', onData);
        resolve(JSON.parse(buffer.slice(0, idx)));
      }
    };
    proc.stdout.on('data', onData);
  });
}

function wsConnect(port, token) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS connect timeout')), TIMEOUT);
    let url = `ws://127.0.0.1:${port}`;
    if (token) url += `?token=${token}`;
    const ws = new WebSocket(url);
    ws.on('open', () => { clearTimeout(timer); resolve(ws); });
    ws.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

function wsSend(ws, msg) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS send timeout')), TIMEOUT);
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
    ws.send(JSON.stringify(msg));
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('MCP Protocol', () => {
  let proc;

  before(async () => {
    proc = spawnServer();
    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  after(() => {
    proc.kill();
  });

  it('responds to initialize', async () => {
    sendMcp(proc, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    const resp = await readMcp(proc);
    assert.equal(resp.jsonrpc, '2.0');
    assert.equal(resp.id, 1);
    assert.ok(resp.result);
    assert.equal(resp.result.serverInfo.name, 'open-anvil');
  });

  it('responds to tools/list', async () => {
    sendMcp(proc, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const resp = await readMcp(proc);
    assert.ok(resp.result);
    assert.ok(Array.isArray(resp.result.tools));
    assert.ok(resp.result.tools.length > 40, 'Should have 40+ tools');
  });

  it('execute_shell is excluded by default', async () => {
    sendMcp(proc, { jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} });
    const resp = await readMcp(proc);
    const names = resp.result.tools.map((t) => t.name);
    assert.ok(!names.includes('execute_shell'), 'execute_shell should not be in tool list');
  });

  it('unknown tool returns error', async () => {
    sendMcp(proc, {
      jsonrpc: '2.0', id: 4,
      method: 'tools/call',
      params: { name: 'nonexistent_tool', arguments: {} },
    });
    const resp = await readMcp(proc);
    assert.ok(resp.result.isError);
  });

  it('unknown method returns error', async () => {
    sendMcp(proc, { jsonrpc: '2.0', id: 5, method: 'fake/method', params: {} });
    const resp = await readMcp(proc);
    assert.ok(resp.error);
    assert.equal(resp.error.code, -32601);
  });
});

describe('WebSocket Server', () => {
  let proc;

  before(async () => {
    proc = spawnServer({ ANVIL_WS_TOKEN: 'test-token-123' });
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  after(() => {
    proc.kill();
  });

  it('rejects connections without token', async () => {
    try {
      await wsConnect(PORT);
      assert.fail('Should have rejected connection');
    } catch (e) {
      assert.ok(e.message.includes('401') || e.message.includes('Unauthorized') || e.message.includes('ECONNRESET'));
    }
  });

  it('accepts connections with valid token', async () => {
    const ws = await wsConnect(PORT, 'test-token-123');
    assert.ok(ws.readyState === WebSocket.OPEN);
    ws.close();
  });
});

describe('Shell Security', () => {
  let proc;

  before(async () => {
    proc = spawnServer({ ANVIL_SHELL: 'true' });
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  after(() => {
    proc.kill();
  });

  it('execute_shell is included when ANVIL_SHELL=true', async () => {
    sendMcp(proc, { jsonrpc: '2.0', id: 10, method: 'tools/list', params: {} });
    const resp = await readMcp(proc);
    const names = resp.result.tools.map((t) => t.name);
    assert.ok(names.includes('execute_shell'), 'execute_shell should be in tool list');
  });

  it('execute_shell actually executes', async () => {
    sendMcp(proc, {
      jsonrpc: '2.0', id: 11,
      method: 'tools/call',
      params: { name: 'execute_shell', arguments: { command: 'echo hello', timeout: 5000 } },
    });
    const resp = await readMcp(proc);
    assert.ok(resp.result);
    const content = JSON.parse(resp.result.content[0].text);
    assert.equal(content.success, true);
    assert.ok(content.result.output.includes('hello'));
  });
});

describe('Perception Tools', () => {
  let proc;

  before(async () => {
    proc = spawnServer();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // Initialize first
    sendMcp(proc, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    await readMcp(proc);
  });

  after(() => {
    proc.kill();
  });

  it('perceive returns gracefully when no snapshot exists', async () => {
    sendMcp(proc, {
      jsonrpc: '2.0', id: 20,
      method: 'tools/call',
      params: { name: 'perceive', arguments: {} },
    });
    const resp = await readMcp(proc);
    assert.ok(resp.result);
    const content = JSON.parse(resp.result.content[0].text);
    // Should not crash, may return empty or "no model" state
    assert.ok(content.result !== undefined);
  });
});
