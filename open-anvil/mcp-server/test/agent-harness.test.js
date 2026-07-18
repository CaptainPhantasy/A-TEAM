// agent-harness.test.js — Agent-harness recovery + backstop tests (A1-A3)
// A1: failed extension tool call does not corrupt subsequent calls
// A2: MAX_PENDING_REQUESTS (1000) backstop rejects the 1001st
// A3: version alignment — no WARNING on startup stderr
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = join(__dirname, '..', 'server.js');

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

// ── A1: recovery after failed (timed-out) tool call ─────────────────────

describe('Agent harness — recovery (A1)', () => {
  let proc;
  let responses;

  before(() => {
    proc = spawnStdio({ ANVIL_TIMEOUT: '600' });
    responses = collectStdout(proc);
  });

  after((t, done) => {
    proc.on('exit', () => done());
    proc.stdin.end();
  });

  it('A1 — timed-out extension call does not corrupt the next call', async () => {
    send(proc, { jsonrpc: '2.0', id: 'a1-init', method: 'initialize', params: {} });
    await waitFor(responses, 'a1-init');

    // First call: extension tool with no extension connected → times out
    send(proc, {
      jsonrpc: '2.0', id: 'a1-fail', method: 'tools/call',
      params: { name: 'navigate_to', arguments: { url: 'about:blank' } }
    });
    const failResp = await waitFor(responses, 'a1-fail', 5000);
    const failParsed = JSON.parse(failResp.result.content[0].text);
    assert.equal(failParsed.success, false);
    assert.ok(failResp.result.content[0].text.toLowerCase().includes('timed out'));

    // Second call: a perception tool that returns immediately (no extension needed).
    // If the failed call corrupted pendingRequests, this would hang or error.
    send(proc, {
      jsonrpc: '2.0', id: 'a1-ok', method: 'tools/call',
      params: { name: 'get_perception_status', arguments: {} }
    });
    const okResp = await waitFor(responses, 'a1-ok', 5000);
    // get_perception_status with no tab returns {success:false, error:'No tab_id...'}
    // but it resolves immediately — proving the pending-request map is clean.
    // It may be success or a controlled error, but it must NOT be a timeout.
    assert.ok(
      !okResp.result.content[0].text.toLowerCase().includes('timed out'),
      'second call must not time out — pendingRequests must be clean'
    );
  });
});

// ── A2: MAX_PENDING_REQUESTS backstop ────────────────────────────────────

describe('Agent harness — pending-request backstop (A2)', () => {
  let proc;
  let responses;

  before(() => {
    // Long timeout so pending requests accumulate rather than resolving.
    proc = spawnStdio({ ANVIL_TIMEOUT: '120000' });
    responses = collectStdout(proc);
  });

  after((t, done) => {
    proc.on('exit', () => done());
    proc.stdin.end();
  });

  it('A2 — MAX_PENDING_REQUESTS backstop rejects beyond-cap calls', async () => {
    send(proc, { jsonrpc: '2.0', id: 'a2-init', method: 'initialize', params: {} });
    await waitFor(responses, 'a2-init');

    // The rate limiter allows 30 calls per 1000ms per source. To reach the
    // MAX_PENDING_REQUESTS (1000) backstop we must accumulate pending requests
    // across multiple rate-limit windows. Each batch of 30 passes the limiter;
    // because no extension is connected and ANVIL_TIMEOUT=30000, none resolve
    // within the accumulation window. After ~34 batches the 1000-cap fires.
    let batch;
    let backstopHit = null;
    const checkBackstop = () => {
      for (const [id, resp] of responses) {
        if (typeof id !== 'string' || !id.startsWith('a2-')) continue;
        const text = resp.result?.content?.[0]?.text || '';
        if (text.includes('Too many pending requests')) {
          backstopHit = { id, text };
          return;
        }
      }
    };

    // Send 35 batches of 30 calls (1050 total), waiting 1050ms between batches
    // so each batch lands in a fresh rate-limit window.
    for (batch = 0; batch < 35; batch++) {
      for (let i = 1; i <= 30; i++) {
        const id = batch * 30 + i;
        send(proc, {
          jsonrpc: '2.0', id: `a2-${id}`, method: 'tools/call',
          params: { name: 'navigate_to', arguments: { url: 'about:blank' } }
        });
      }
      // Wait for the rate-limit window to reset (1000ms + margin)
      await new Promise((r) => setTimeout(r, 1010));
      // Check if the backstop has fired yet
      checkBackstop();
      if (backstopHit) break;
    }

    assert.ok(backstopHit, 'MAX_PENDING_REQUESTS backstop must fire before 1050 pending calls');
    const parsed = JSON.parse(backstopHit.text);
    assert.equal(parsed.success, false);
    assert.ok(
      backstopHit.text.includes('Too many pending requests'),
      `expected backstop message, got: ${backstopHit.text}`
    );
  });

});

// ── A3: version alignment ────────────────────────────────────────────────

describe('Agent harness — version alignment (A3)', () => {
  it('A3 — no "Version mismatch" WARNING on startup stderr', async () => {
    const proc = spawn('node', [SERVER], {
      env: {
        ...process.env,
        MCP_TRANSPORT: 'stdio',
        ANVIL_WS_ENABLED: 'false',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    // Send initialize and wait for the response, then close.
    const resp = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 5000);
      let buf = '';
      proc.stdout.on('data', (chunk) => {
        buf += chunk.toString();
        for (const line of buf.split('\n')) {
          const t = line.trim();
          if (!t) continue;
          try {
            const msg = JSON.parse(t);
            if (msg.id === 'a3') { clearTimeout(timer); resolve(msg); }
          } catch {}
        }
      });
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 'a3', method: 'initialize', params: {} }) + '\n');
    });

    assert.equal(resp.result.serverInfo.version, '1.2.0');

    // Give stderr a moment to flush, then close stdin.
    await new Promise((resolve) => setTimeout(resolve, 200));
    proc.stdin.end();

    assert.ok(
      !stderr.includes('Version mismatch'),
      `stderr must not contain "Version mismatch", got: ${stderr}`
    );
  });
});
