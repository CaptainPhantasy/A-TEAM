// security.test.js — Security-sensitive surface tests (S1-S9)
// S1-S3: WebSocket token auth boundary (spawns standalone server.js with WS)
// S4:    rate limiter (stdio transport — the working response path)
// S5-S6: execute_shell default-absent / opt-in posture
// S7:    auto-generated token file mode 0o600
// S8-S9: native_host.py message-size enforcement + clean EOF
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, statSync, unlinkSync, readFileSync } from 'node:fs';
import WebSocket from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = join(__dirname, '..', 'server.js');
const OPENANVIL_ROOT = join(__dirname, '..', '..');
const NATIVE_HOST = join(OPENANVIL_ROOT, 'native_host.py');
const INSTALLER = join(OPENANVIL_ROOT, 'install.sh');
const PYTHON = process.env.PYTHON || 'python3';

const TEST_TOKEN = 'test-token-sec';
const TEST_PORT = 17890;

// ── stdio helper ──────────────────────────────────────────────────────────
function spawnStdio(envOverrides = {}) {
  const env = {
    ...process.env,
    MCP_TRANSPORT: 'stdio',
    ANVIL_WS_ENABLED: 'false',
    ...envOverrides,
  };
  const proc = spawn('node', [SERVER], { env, stdio: ['pipe', 'pipe', 'pipe'] });
  proc.stderr.on('data', () => {});
  return proc;
}

function collectStdout(proc) {
  const responses = new Map();
  let buf = '';
  proc.stdout.on('data', (chunk) => {
    buf += chunk.toString();
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      try { responses.set(JSON.parse(t).id, JSON.parse(t)); } catch {}
    }
  });
  return responses;
}

function send(proc, obj) {
  proc.stdin.write(JSON.stringify(obj) + '\n');
}

function waitFor(responses, id, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (responses.has(id)) return resolve(responses.get(id));
    const timer = setTimeout(() => reject(new Error(`timeout for ${id}`)), timeoutMs);
    const orig = responses.set.bind(responses);
    responses.set = (k, v) => {
      orig(k, v);
      if (k === id) { clearTimeout(timer); resolve(v); }
      return responses;
    };
  });
}

// ── S1, S2, S3: WebSocket token auth ──────────────────────────────────────

describe('Security — WebSocket auth (S1-S3)', () => {
  let proc;

  before(async () => {
    proc = spawn('node', [SERVER], {
      env: {
        ...process.env,
        ANVIL_PORT: String(TEST_PORT),
        ANVIL_HOST: '127.0.0.1',
        ANVIL_WS_TOKEN: TEST_TOKEN,
        ANVIL_WS_ENABLED: 'true',
        ANVIL_TIMEOUT: '1000',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    proc.stderr.on('data', () => {});
    // wait for WS server to accept connections
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('server did not start')), 8000);
      const url = `ws://127.0.0.1:${TEST_PORT}?token=${encodeURIComponent(TEST_TOKEN)}`;
      function attempt() {
        const ws = new WebSocket(url);
        ws.on('open', () => { clearTimeout(timer); ws.close(); resolve(); });
        ws.on('error', () => setTimeout(attempt, 200));
      }
      attempt();
    });
  });

  after((t, done) => {
    proc.on('exit', () => done());
    proc.kill('SIGTERM');
  });

  it('S1 — no token → close 4401', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    const code = await new Promise((resolve) => ws.on('close', resolve));
    assert.equal(code, 4401);
  });

  it('S2 — wrong token → close 4401', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}?token=wrong`);
    const code = await new Promise((resolve) => ws.on('close', resolve));
    assert.equal(code, 4401);
  });

  it('S3 — correct token → connection opens', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}?token=${encodeURIComponent(TEST_TOKEN)}`);
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('timeout')), 5000);
    });
    ws.close();
  });
});

// ── S4: rate limiter (over stdio — the working response transport) ───────

describe('Security — rate limit (S4)', () => {
  let proc;
  let responses;

  before(() => {
    proc = spawnStdio({ ANVIL_TIMEOUT: '500' });
    responses = collectStdout(proc);
  });

  after((t, done) => {
    proc.on('exit', () => done());
    proc.stdin.end();
  });

  it('S4 — 31st call within 1000ms window is rate-limited', async () => {
    // initialize first
    send(proc, { jsonrpc: '2.0', id: 's4-init', method: 'initialize', params: {} });
    await waitFor(responses, 's4-init');

    // Fire 31 get_perception_status calls rapidly. Each returns immediately
    // (no tab → {success:false}) so all 31 land within the 1000ms window.
    // The first 30 pass; the 31st must be rate-limited.
    for (let i = 1; i <= 31; i++) {
      send(proc, {
        jsonrpc: '2.0', id: `s4-${i}`, method: 'tools/call',
        params: { name: 'get_perception_status', arguments: {} }
      });
    }

    const resp31 = await waitFor(responses, 's4-31', 8000);
    assert.equal(resp31.result.isError, true);
    const text = resp31.result.content[0].text;
    assert.ok(text.includes('Rate limit exceeded'), `expected rate-limit msg, got: ${text}`);

    // Confirm the first call was NOT rate-limited
    const resp1 = responses.get('s4-1');
    assert.ok(resp1, 'first call must have a response');
    assert.notEqual(resp1.result.isError, true, 'first call must not be rate-limited');
  });
});

// ── S5, S6: execute_shell posture ─────────────────────────────────────────

describe('Security — shell posture (S5-S6)', () => {
  it('S5 — execute_shell absent from tools/list by default', async () => {
    const proc = spawnStdio({ ANVIL_SHELL: '' });
    const responses = collectStdout(proc);
    send(proc, { jsonrpc: '2.0', id: 's5', method: 'tools/list', params: {} });
    const resp = await waitFor(responses, 's5');
    const names = resp.result.tools.map((t) => t.name);
    assert.ok(!names.includes('execute_shell'));
    proc.stdin.end();
  });

  it('S6 — execute_shell present with ANVIL_SHELL=true', async () => {
    const proc = spawnStdio({ ANVIL_SHELL: 'true' });
    const responses = collectStdout(proc);
    send(proc, { jsonrpc: '2.0', id: 's6', method: 'tools/list', params: {} });
    const resp = await waitFor(responses, 's6');
    const names = resp.result.tools.map((t) => t.name);
    assert.ok(names.includes('execute_shell'));
    proc.stdin.end();
  });
});

// ── S7: auto-generated token file mode 0o600 ────────────────────────────

describe('Security — token file hygiene (S7)', () => {
  it('S7 — auto-generated token file has mode 0o600', async () => {
    const tmpConfig = join(process.env.TMPDIR || '/tmp', `anvil-test-cfg-${Date.now()}`);
    const proc = spawn('node', [SERVER], {
      env: {
        ...process.env,
        ANVIL_PORT: String(TEST_PORT + 1),
        ANVIL_WS_TOKEN: '',
        XDG_CONFIG_HOME: tmpConfig,
        ANVIL_WS_ENABLED: 'true',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    proc.stderr.on('data', () => {});

    const tokenFile = join(tmpConfig, 'open-anvil', 'token');
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('token file not created')), 5000);
      const check = setInterval(() => {
        if (existsSync(tokenFile)) { clearTimeout(timer); clearInterval(check); resolve(); }
      }, 100);
    });

    const mode = statSync(tokenFile).mode & 0o777;
    assert.equal(mode, 0o600, `token file mode should be 0o600, got 0o${mode.toString(8)}`);
    const token = readFileSync(tokenFile, 'utf-8').trim();
    assert.ok(token.length > 0, 'token must be non-empty');

    proc.kill('SIGTERM');
    try { unlinkSync(tokenFile); } catch {}
  });
});

// ── S8, S9: native_host.py ───────────────────────────────────────────────

describe('Security — native_host.py (S8-S9)', () => {
  it('S8 — rejects message > 1MB (MAX_MESSAGE_SIZE)', async () => {
    const oversizedLen = 2 * 1024 * 1024; // 2MB > 1MB limit
    const header = Buffer.alloc(4);
    header.writeUInt32LE(oversizedLen, 0);

    const proc = spawn(PYTHON, [
      '-c',
      `import sys; sys.path.insert(0, ${JSON.stringify(OPENANVIL_ROOT)});
import native_host;
try:
    native_host.read_native_message();
    sys.exit(0);
except ValueError:
    sys.exit(42);
except Exception:
    sys.exit(1);`,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    proc.stdin.write(header);
    proc.stdin.end();

    const code = await new Promise((resolve) => proc.on('exit', resolve));
    assert.equal(code, 42, 'read_native_message must raise ValueError on oversized input');
  });

  it('S9 — clean EOF shutdown (stdin close → exit 0)', async () => {
    const proc = spawn(PYTHON, [NATIVE_HOST], {
      env: { ...process.env, ANVIL_NODE_BIN: process.execPath },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.stdin.end(); // EOF → read_native_message returns None → shutdown

    const code = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('native_host did not exit')), 10000);
      proc.on('exit', (c) => { clearTimeout(timer); resolve(c); });
    });

    assert.equal(code, 0, `native_host should exit 0 on EOF (got ${code}, stderr: ${stderr})`);
  });
});

describe('Security — installer and native-host logging (S10-S11)', () => {
  it('S10 — installer never prints the generated WebSocket token', () => {
    const installer = readFileSync(INSTALLER, 'utf-8');
    assert.ok(!installer.includes('Generated WS token: $token'));
    assert.ok(installer.includes('Token saved to $token_file'));
  });

  it('S11 — native host does not dump launch environment or argv', () => {
    const host = readFileSync(NATIVE_HOST, 'utf-8');
    assert.ok(!host.includes('anvil_native_host_launch.log'));
    assert.ok(!host.includes("os.environ.get('HOME'"));
    assert.ok(!host.includes('sys.argv'));
  });
});
