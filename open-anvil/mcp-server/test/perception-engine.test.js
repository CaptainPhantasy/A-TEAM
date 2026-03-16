// perception-engine.test.js — Unit tests for PerceptionEngine
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PerceptionEngine } from '../perception-engine.js';

describe('PerceptionEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new PerceptionEngine();
  });

  // ── 1. Model Lifecycle ───────────────────────────────────────────────────

  it('creates a model on first access', () => {
    const model = engine.getOrCreateModel(1);
    assert.equal(model.tabId, 1);
    assert.equal(model.nodes.size, 0);
    assert.equal(model.status, 'active');
  });

  it('removes model and cleans up cursors', () => {
    engine.ingestSnapshot(1, { url: 'https://example.com', title: 'Test', nodes: [] });
    engine.perceive('agent1', 1);
    assert.ok(engine.models.has(1));

    engine.removeModel(1);
    assert.ok(!engine.models.has(1));

    const cursor = engine.cursors.get('agent1');
    assert.ok(!cursor.tabSeqs.has(1));
  });

  // ── 2. Snapshot Ingestion ────────────────────────────────────────────────

  it('ingests a snapshot and populates node map', () => {
    engine.ingestSnapshot(1, {
      url: 'https://example.com',
      title: 'Test Page',
      viewport: { width: 1440, height: 900 },
      scroll: { x: 0, y: 0 },
      readyState: 'complete',
      nodes: [
        { ref: 'ref_1', tagName: 'button', role: 'button', textContent: 'Click me' },
        { ref: 'ref_2', tagName: 'input', role: 'textbox', textContent: '' },
        { ref: 'ref_3', tagName: 'h1', role: 'heading', textContent: 'Title' }
      ]
    });

    const model = engine.models.get(1);
    assert.equal(model.url, 'https://example.com');
    assert.equal(model.nodes.size, 3);
    assert.equal(model.nodes.get('ref_1').tagName, 'button');
    assert.ok(model.seq > 0);
  });

  // ── 3. Perceive: First Call → Snapshot ───────────────────────────────────

  it('returns snapshot on first perceive call', () => {
    engine.ingestSnapshot(1, {
      url: 'https://example.com',
      title: 'Dashboard',
      viewport: { width: 1440, height: 900 },
      scroll: { x: 0, y: 350 },
      nodes: [
        { ref: 'ref_1', tagName: 'h1', textContent: 'Dashboard' }
      ]
    });

    const result = engine.perceive('agent1', 1);
    assert.equal(result.status, 'snapshot');
    assert.ok(result.text.includes('Dashboard'));
    assert.ok(result.text.includes('1440x900'));
    assert.equal(result.node_count, 1);
  });

  // ── 4. Perceive: No Changes → no_change ─────────────────────────────────

  it('returns no_change when nothing changed since last perceive', () => {
    engine.ingestSnapshot(1, {
      url: 'https://example.com',
      title: 'Test',
      nodes: [{ ref: 'ref_1', tagName: 'div', textContent: 'Hello' }]
    });

    engine.perceive('agent1', 1); // first call → snapshot
    const result = engine.perceive('agent1', 1); // second call → no_change

    assert.equal(result.status, 'no_change');
    assert.ok(result.text.includes('No changes'));
    assert.ok(result.token_estimate < 100);
  });

  // ── 5. Perceive: Delta After Events ──────────────────────────────────────

  it('returns delta when DOM events occurred since last perceive', () => {
    engine.ingestSnapshot(1, {
      url: 'https://example.com',
      title: 'Test',
      nodes: [
        { ref: 'ref_1', tagName: 'button', textContent: 'Submit' },
        { ref: 'ref_2', tagName: 'h1', textContent: 'Loading...' }
      ]
    });

    engine.perceive('agent1', 1); // consume snapshot

    // Simulate DOM changes
    engine.ingestEvents(1, [
      { type: 'attribute_changed', ref: 'ref_1', tagName: 'button', attribute: 'disabled', oldValue: 'true', newValue: null },
      { type: 'text_changed', ref: 'ref_2', tagName: 'h1', oldValue: 'Loading...', newValue: 'Ready' },
      { type: 'added', ref: 'ref_3', tagName: 'dialog', role: 'dialog', textContent: 'Login Modal' }
    ]);

    const result = engine.perceive('agent1', 1);
    assert.equal(result.status, 'delta');
    assert.equal(result.event_count, 3);
    assert.ok(result.text.includes('Ready'));
    assert.ok(result.text.includes('dialog'));
  });

  // ── 6. Delta Compaction: Add+Remove Cancel ───────────────────────────────

  it('cancels add+remove pairs during compaction', () => {
    engine.ingestSnapshot(1, { url: 'https://x.com', title: 'T', nodes: [] });
    engine.perceive('agent1', 1);

    engine.ingestEvents(1, [
      { type: 'added', ref: 'ref_10', tagName: 'div', textContent: 'temp' },
      { type: 'removed', ref: 'ref_10', tagName: 'div', textContent: 'temp' }
    ]);

    const result = engine.perceive('agent1', 1);
    assert.equal(result.status, 'delta');
    assert.equal(result.compacted_count, 0);
  });

  // ── 7. Delta Compaction: Attribute Collapse ──────────────────────────────

  it('collapses multiple attribute changes to latest value', () => {
    engine.ingestSnapshot(1, { url: 'https://x.com', title: 'T', nodes: [
      { ref: 'ref_1', tagName: 'div' }
    ] });
    engine.perceive('agent1', 1);

    engine.ingestEvents(1, [
      { type: 'attribute_changed', ref: 'ref_1', tagName: 'div', attribute: 'class', oldValue: 'a', newValue: 'b' },
      { type: 'attribute_changed', ref: 'ref_1', tagName: 'div', attribute: 'class', oldValue: 'b', newValue: 'c' },
      { type: 'attribute_changed', ref: 'ref_1', tagName: 'div', attribute: 'class', oldValue: 'c', newValue: 'd' }
    ]);

    const result = engine.perceive('agent1', 1);
    assert.equal(result.compacted_count, 1);
    assert.ok(result.text.includes('a'));  // original oldValue
    assert.ok(result.text.includes('d'));  // final newValue
  });

  // ── 8. Delta Compaction: Text Change Collapse ────────────────────────────

  it('collapses multiple text changes to first old → last new', () => {
    engine.ingestSnapshot(1, { url: 'https://x.com', title: 'T', nodes: [
      { ref: 'ref_5', tagName: 'span', textContent: 'A' }
    ] });
    engine.perceive('agent1', 1);

    engine.ingestEvents(1, [
      { type: 'text_changed', ref: 'ref_5', tagName: 'span', oldValue: 'A', newValue: 'B' },
      { type: 'text_changed', ref: 'ref_5', tagName: 'span', oldValue: 'B', newValue: 'C' },
      { type: 'text_changed', ref: 'ref_5', tagName: 'span', oldValue: 'C', newValue: 'D' }
    ]);

    const result = engine.perceive('agent1', 1);
    assert.equal(result.compacted_count, 1);
    assert.ok(result.text.includes('"A"'));
    assert.ok(result.text.includes('"D"'));
  });

  // ── 9. Intent Filtering ──────────────────────────────────────────────────

  it('filters by intent=navigation to return minimal output', () => {
    engine.ingestSnapshot(1, {
      url: 'https://example.com/page',
      title: 'My Page',
      viewport: { width: 1440, height: 900 },
      scroll: { x: 0, y: 100 },
      nodes: [
        { ref: 'ref_1', tagName: 'button', textContent: 'Click' },
        { ref: 'ref_2', tagName: 'div', textContent: 'Content' }
      ]
    });

    const result = engine.perceive('agent1', 1, { intent: 'navigation' });
    assert.equal(result.status, 'snapshot');
    assert.ok(result.text.includes('My Page'));
    assert.ok(result.text.includes('1440x900'));
    // Should NOT include individual nodes
    assert.ok(!result.text.includes('Click'));
  });

  // ── 10. Navigation Triggers New Snapshot ─────────────────────────────────

  it('returns snapshot after navigation even if cursor had seen previous page', () => {
    engine.ingestSnapshot(1, { url: 'https://page1.com', title: 'P1', nodes: [] });
    engine.perceive('agent1', 1); // see page 1

    engine.ingestNavigation(1, { url: 'https://page2.com', title: 'P2' });
    engine.ingestSnapshot(1, { url: 'https://page2.com', title: 'P2', nodes: [
      { ref: 'ref_1', tagName: 'h1', textContent: 'Page 2' }
    ] });

    const result = engine.perceive('agent1', 1);
    assert.equal(result.status, 'snapshot');
    assert.ok(result.text.includes('Page 2'));
  });

  // ── 11. Max Chars Budget ─────────────────────────────────────────────────

  it('respects max_chars budget and truncates output', () => {
    const nodes = [];
    for (let i = 0; i < 200; i++) {
      nodes.push({ ref: `ref_${i}`, tagName: 'div', textContent: `Node content number ${i} with some extra text` });
    }
    engine.ingestSnapshot(1, { url: 'https://big.com', title: 'Big', viewport: { width: 1440, height: 900 }, nodes });

    const result = engine.perceive('agent1', 1, { max_chars: 500 });
    assert.equal(result.status, 'snapshot');
    assert.ok(result.text.length <= 500);
  });

  // ── 12. Cursor Expiry ────────────────────────────────────────────────────

  it('expires idle cursors and marks stale models', () => {
    engine.ingestSnapshot(1, { url: 'https://x.com', title: 'T', nodes: [] });
    engine.perceive('agent1', 1);

    // Manually age the cursor and model
    const cursor = engine.cursors.get('agent1');
    cursor.lastAccessAt = Date.now() - 11 * 60 * 1000; // 11 minutes ago

    const model = engine.models.get(1);
    model.lastEventAt = Date.now() - 6 * 60 * 1000; // 6 minutes ago

    const stats = engine.expireStale();
    assert.equal(stats.expiredCursors, 1);
    assert.ok(!engine.cursors.has('agent1'));
    assert.equal(model.status, 'stale');
  });

  // ── 13. No Model Returns Helpful Message ─────────────────────────────────

  it('returns no_model when tab has no model', () => {
    const result = engine.perceive('agent1', 999);
    assert.equal(result.status, 'no_model');
    assert.ok(result.message.includes('No page model'));
  });

  // ── 14. Node Map Updates From Events ─────────────────────────────────────

  it('updates node map correctly from ingested events', () => {
    engine.ingestSnapshot(1, {
      url: 'https://x.com', title: 'T',
      nodes: [{ ref: 'ref_1', tagName: 'button', textContent: 'Old Text', attributes: { disabled: 'true' } }]
    });

    engine.ingestEvents(1, [
      { type: 'text_changed', ref: 'ref_1', tagName: 'button', oldValue: 'Old Text', newValue: 'New Text' },
      { type: 'attribute_changed', ref: 'ref_1', tagName: 'button', attribute: 'disabled', oldValue: 'true', newValue: null },
      { type: 'added', ref: 'ref_2', tagName: 'span', textContent: 'Added' }
    ]);

    const model = engine.models.get(1);
    assert.equal(model.nodes.get('ref_1').textContent, 'New Text');
    assert.equal(model.nodes.get('ref_1').attributes.disabled, null);
    assert.equal(model.nodes.size, 2);
    assert.equal(model.nodes.get('ref_2').tagName, 'span');
  });

  // ── 15. Multi-Agent Cursors ──────────────────────────────────────────────

  it('maintains independent cursors for different agents', () => {
    engine.ingestSnapshot(1, { url: 'https://x.com', title: 'T', nodes: [
      { ref: 'ref_1', tagName: 'div', textContent: 'Hello' }
    ] });

    const r1 = engine.perceive('agent1', 1);
    assert.equal(r1.status, 'snapshot');

    // Agent 2 hasn't seen anything yet
    const r2 = engine.perceive('agent2', 1);
    assert.equal(r2.status, 'snapshot');

    // Now both have seen it
    const r1b = engine.perceive('agent1', 1);
    assert.equal(r1b.status, 'no_change');

    const r2b = engine.perceive('agent2', 1);
    assert.equal(r2b.status, 'no_change');

    // Add events — both should see delta
    engine.ingestEvents(1, [
      { type: 'text_changed', ref: 'ref_1', tagName: 'div', oldValue: 'Hello', newValue: 'World' }
    ]);

    const r1c = engine.perceive('agent1', 1);
    assert.equal(r1c.status, 'delta');

    const r2c = engine.perceive('agent2', 1);
    assert.equal(r2c.status, 'delta');
  });

  // ── 16. Reset All Cursors ────────────────────────────────────────────────

  it('resets all cursors (reconnect scenario)', () => {
    engine.ingestSnapshot(1, { url: 'https://x.com', title: 'T', nodes: [] });
    engine.perceive('agent1', 1);
    engine.perceive('agent2', 1);

    engine.resetAllCursors();

    // Both should get snapshot again
    const r1 = engine.perceive('agent1', 1);
    assert.equal(r1.status, 'snapshot');

    const r2 = engine.perceive('agent2', 1);
    assert.equal(r2.status, 'snapshot');
  });
});
