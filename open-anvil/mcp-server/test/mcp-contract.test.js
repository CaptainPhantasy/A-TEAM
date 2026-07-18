// mcp-contract.test.js — MCP protocol contract tests (M1-M6)
// Spawns the real server.js over stdio and asserts the JSON-RPC contract.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = join(__dirname, '..', 'server.js');

const BASE_ENV = {
  ...process.env,
  MCP_TRANSPORT: 'stdio',
  ANVIL_WS_ENABLED: 'false',
  ANVIL_SHELL: '',            // default: shell tool absent
  ANVIL_TIMEOUT: '1500',      // short timeout for M5
};

function spawnServer(envOverrides = {}) {
  const env = { ...BASE_ENV, ...envOverrides };
  const proc = spawn('node', [SERVER], { env, stdio: ['pipe', 'pipe', 'pipe'] });
  proc.stderr.on('data', () => {}); // drain
  return proc;
}

function send(proc, obj) {
  proc.stdin.write(JSON.stringify(obj) + '\n');
}

// Collect stdout lines until a response matching pred arrives (or timeout).
function nextResponse(proc, pred, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`timeout waiting for response matching ${pred}`));
    }, timeoutMs);
    let buf = '';
    const onData = (chunk) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop(); // keep partial
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let msg;
        try { msg = JSON.parse(trimmed); } catch { continue; }
        if (pred(msg)) {
          clearTimeout(timer);
          proc.stdout.off('data', onData);
          resolve(msg);
          return;
        }
      }
    };
    proc.stdout.on('data', onData);
  });
}

describe('MCP Contract (M1-M6)', () => {
  let proc;

  before(() => {
    proc = spawnServer();
  });

  after((t, done) => {
    proc.on('exit', () => done());
    proc.stdin.end();
  });

  // M1: initialize returns correct protocolVersion and serverInfo
  it('M1 — initialize returns protocolVersion 2024-11-05 and serverInfo open-anvil/1.2.0', async () => {
    const req = { jsonrpc: '2.0', id: 'm1', method: 'initialize', params: {} };
    const p = nextResponse(proc, (m) => m.id === 'm1');
    send(proc, req);
    const resp = await p;
    assert.equal(resp.jsonrpc, '2.0');
    assert.equal(resp.result.protocolVersion, '2024-11-05');
    assert.equal(resp.result.serverInfo.name, 'open-anvil');
    assert.equal(resp.result.serverInfo.version, '1.2.0');
    assert.ok(resp.result.capabilities?.tools, 'capabilities.tools must exist');
  });

  // M2: tools/list default — 44 tools, execute_shell absent
  it('M2 — tools/list default has 44 tools and execute_shell is absent', async () => {
    const req = { jsonrpc: '2.0', id: 'm2', method: 'tools/list', params: {} };
    const p = nextResponse(proc, (m) => m.id === 'm2');
    send(proc, req);
    const resp = await p;
    const names = resp.result.tools.map((t) => t.name);
    assert.equal(names.length, 44);
    assert.ok(!names.includes('execute_shell'), 'execute_shell must be absent by default');
    // Each tool must have name, description, inputSchema
    for (const t of resp.result.tools) {
      assert.equal(typeof t.name, 'string');
      assert.equal(typeof t.description, 'string');
      assert.equal(typeof t.inputSchema, 'object');
    }
  });

  // M4: tools/call for unknown tool → isError true, text contains "Unknown tool"
  it('M4 — unknown tool call returns isError with Unknown tool', async () => {
    const req = {
      jsonrpc: '2.0', id: 'm4', method: 'tools/call',
      params: { name: 'nonexistent_tool_xyz', arguments: {} }
    };
    const p = nextResponse(proc, (m) => m.id === 'm4');
    send(proc, req);
    const resp = await p;
    assert.equal(resp.result.isError, true);
    const text = resp.result.content[0].text;
    assert.ok(text.includes('Unknown tool'), `expected "Unknown tool" in: ${text}`);
  });

  // M6: malformed JSON-RPC — non-2.0 jsonrpc is silently dropped (no crash, no response)
  it('M6a — non-2.0 jsonrpc message is dropped without crash', async () => {
    // Send a bad message, then a good one. The good one must still get a response.
    send(proc, { jsonrpc: '1.0', id: 'bad', method: 'initialize', params: {} });
    const req = { jsonrpc: '2.0', id: 'm6a', method: 'initialize', params: {} };
    const p = nextResponse(proc, (m) => m.id === 'm6a');
    send(proc, req);
    const resp = await p;
    assert.equal(resp.result.serverInfo.name, 'open-anvil');
  });

  it('M6b — non-object JSON line is dropped without crash', async () => {
    proc.stdin.write('"just a string"\n'); // valid JSON, not an object
    const req = { jsonrpc: '2.0', id: 'm6b', method: 'tools/list', params: {} };
    const p = nextResponse(proc, (m) => m.id === 'm6b');
    send(proc, req);
    const resp = await p;
    assert.equal(resp.result.tools.length, 44);
  });
});

// M3: tools/list with ANVIL_SHELL=true exposes execute_shell (separate process)
describe('MCP Contract — shell opt-in (M3)', () => {
  let proc;

  before(() => {
    proc = spawnServer({ ANVIL_SHELL: 'true' });
  });

  after((t, done) => {
    proc.on('exit', () => done());
    proc.stdin.end();
  });

  it('M3 — ANVIL_SHELL=true exposes execute_shell (45 tools)', async () => {
    const p = nextResponse(proc, (m) => m.id === 'm3');
    send(proc, { jsonrpc: '2.0', id: 'm3', method: 'tools/list', params: {} });
    const resp = await p;
    const names = resp.result.tools.map((t) => t.name);
    assert.equal(names.length, 45);
    assert.ok(names.includes('execute_shell'), 'execute_shell must be present when ANVIL_SHELL=true');
  });
});

// M5: extension tool call with no extension connected → timeout error
describe('MCP Contract — timeout (M5)', () => {
  let proc;

  before(() => {
    proc = spawnServer({ ANVIL_TIMEOUT: '800' });
  });

  after((t, done) => {
    proc.on('exit', () => done());
    proc.stdin.end();
  });

  it('M5 — extension tool call with no extension times out', async () => {
    // initialize first (server requires nothing, but be safe)
    const pInit = nextResponse(proc, (m) => m.id === 'm5-init');
    send(proc, { jsonrpc: '2.0', id: 'm5-init', method: 'initialize', params: {} });
    await pInit;

    // Call an extension tool (navigate_to). No extension is connected in stdio
    // mode with WS disabled, so it must time out.
    const p = nextResponse(proc, (m) => m.id === 'm5', 6000);
    send(proc, {
      jsonrpc: '2.0', id: 'm5', method: 'tools/call',
      params: { name: 'navigate_to', arguments: { url: 'about:blank' } }
    });
    const resp = await p;
    const text = resp.result.content[0].text;
    const parsed = JSON.parse(text);
    assert.equal(parsed.success, false);
    assert.ok(text.toLowerCase().includes('timed out'), `expected "timed out" in: ${text}`);
  });
});
