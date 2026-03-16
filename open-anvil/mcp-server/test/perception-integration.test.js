// perception-integration.test.js — Integration tests for perception WS message flow
// Simulates the messages that background.js sends to server.js and verifies engine state.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PerceptionEngine } from '../perception-engine.js';

// Simulate what handleExtensionMessage does in server.js for perception messages.
// This validates the contract between extension and server.
function simulateHandleMessage(engine, msg, state) {
  // Schema validation (mirrors server.js logic)
  if (msg.type === 'perception_events') {
    if (typeof msg.tabId !== 'number' || !Array.isArray(msg.events)) {
      return { accepted: false, reason: 'invalid schema' };
    }
    engine.ingestEvents(msg.tabId, msg.events);
    return { accepted: true, type: 'events', count: msg.events.length };
  }

  if (msg.type === 'perception_snapshot') {
    if (typeof msg.tabId !== 'number') {
      return { accepted: false, reason: 'invalid tabId' };
    }
    if (msg.nodes !== undefined && !Array.isArray(msg.nodes)) {
      return { accepted: false, reason: 'invalid nodes' };
    }
    engine.ingestSnapshot(msg.tabId, msg);
    state.activeTabId = msg.tabId;
    return { accepted: true, type: 'snapshot' };
  }

  if (msg.type === 'perception_navigation') {
    if (typeof msg.tabId !== 'number') {
      return { accepted: false, reason: 'invalid tabId' };
    }
    engine.ingestNavigation(msg.tabId, msg);
    return { accepted: true, type: 'navigation' };
  }

  if (msg.type === 'perception_scroll') {
    if (typeof msg.tabId !== 'number') {
      return { accepted: false, reason: 'invalid tabId' };
    }
    engine.ingestScroll(msg.tabId, { x: msg.x || 0, y: msg.y || 0 });
    return { accepted: true, type: 'scroll' };
  }

  if (msg.type === 'perception_tab_closed') {
    if (typeof msg.tabId !== 'number') {
      return { accepted: false, reason: 'invalid tabId' };
    }
    engine.removeModel(msg.tabId);
    return { accepted: true, type: 'tab_closed' };
  }

  return { accepted: false, reason: 'unknown type' };
}

describe('Perception WS Message Contract', () => {
  let engine;
  let state;

  beforeEach(() => {
    engine = new PerceptionEngine();
    state = { activeTabId: null };
  });

  // ── 1. Snapshot Message ──────────────────────────────────────────────────

  describe('perception_snapshot', () => {
    it('creates a page model from a valid snapshot', () => {
      const result = simulateHandleMessage(engine, {
        type: 'perception_snapshot',
        tabId: 1,
        url: 'https://example.com',
        title: 'Test Page',
        viewport: { width: 1440, height: 900 },
        scroll: { x: 0, y: 0 },
        readyState: 'complete',
        nodes: [
          { ref: 'ref_1', tagName: 'button', role: 'button', textContent: 'Submit' },
          { ref: 'ref_2', tagName: 'input', role: 'textbox', textContent: '' }
        ],
        timestamp: Date.now()
      }, state);

      assert.equal(result.accepted, true);
      assert.equal(result.type, 'snapshot');
      assert.equal(state.activeTabId, 1);

      const model = engine.models.get(1);
      assert.ok(model);
      assert.equal(model.url, 'https://example.com');
      assert.equal(model.title, 'Test Page');
      assert.equal(model.nodes.size, 2);
      assert.equal(model.viewport.width, 1440);
    });

    it('rejects snapshot with non-numeric tabId', () => {
      const result = simulateHandleMessage(engine, {
        type: 'perception_snapshot',
        tabId: 'not-a-number',
        url: 'https://example.com',
        nodes: []
      }, state);
      assert.equal(result.accepted, false);
      assert.equal(result.reason, 'invalid tabId');
    });

    it('rejects snapshot with non-array nodes', () => {
      const result = simulateHandleMessage(engine, {
        type: 'perception_snapshot',
        tabId: 1,
        nodes: 'not-an-array'
      }, state);
      assert.equal(result.accepted, false);
      assert.equal(result.reason, 'invalid nodes');
    });

    it('accepts snapshot without nodes field (nodes are optional)', () => {
      const result = simulateHandleMessage(engine, {
        type: 'perception_snapshot',
        tabId: 1,
        url: 'https://example.com'
      }, state);
      assert.equal(result.accepted, true);
    });
  });

  // ── 2. Events Message ────────────────────────────────────────────────────

  describe('perception_events', () => {
    it('ingests valid DOM events', () => {
      // First create a model
      simulateHandleMessage(engine, {
        type: 'perception_snapshot',
        tabId: 1,
        url: 'https://example.com',
        nodes: [{ ref: 'ref_1', tagName: 'div', textContent: 'Hello' }]
      }, state);

      const result = simulateHandleMessage(engine, {
        type: 'perception_events',
        tabId: 1,
        events: [
          { type: 'text_changed', ref: 'ref_1', tagName: 'div', oldValue: 'Hello', newValue: 'World' },
          { type: 'added', ref: 'ref_2', tagName: 'span', textContent: 'New' }
        ],
        timestamp: Date.now()
      }, state);

      assert.equal(result.accepted, true);
      assert.equal(result.count, 2);

      const model = engine.models.get(1);
      assert.equal(model.nodes.get('ref_1').textContent, 'World');
      assert.equal(model.nodes.size, 2);
    });

    it('rejects events with non-numeric tabId', () => {
      const result = simulateHandleMessage(engine, {
        type: 'perception_events',
        tabId: null,
        events: []
      }, state);
      assert.equal(result.accepted, false);
    });

    it('rejects events with non-array events field', () => {
      const result = simulateHandleMessage(engine, {
        type: 'perception_events',
        tabId: 1,
        events: 'not-an-array'
      }, state);
      assert.equal(result.accepted, false);
    });

    it('rejects events with missing events field', () => {
      const result = simulateHandleMessage(engine, {
        type: 'perception_events',
        tabId: 1
      }, state);
      assert.equal(result.accepted, false);
    });
  });

  // ── 3. Navigation Message ────────────────────────────────────────────────

  describe('perception_navigation', () => {
    it('resets model and triggers snapshot on next perceive', () => {
      simulateHandleMessage(engine, {
        type: 'perception_snapshot',
        tabId: 1,
        url: 'https://page1.com',
        nodes: [{ ref: 'ref_1', tagName: 'div' }]
      }, state);

      // Agent sees current state
      engine.perceive('agent1', 1);

      // Navigation happens
      const result = simulateHandleMessage(engine, {
        type: 'perception_navigation',
        tabId: 1,
        url: 'https://page2.com',
        timestamp: Date.now()
      }, state);

      assert.equal(result.accepted, true);
      assert.equal(result.type, 'navigation');

      const model = engine.models.get(1);
      assert.equal(model.url, 'https://page2.com');
      assert.equal(model.nodes.size, 0); // cleared

      // Agent should get snapshot (not delta) on next perceive
      const perception = engine.perceive('agent1', 1);
      assert.equal(perception.status, 'snapshot');
    });

    it('rejects navigation with non-numeric tabId', () => {
      const result = simulateHandleMessage(engine, {
        type: 'perception_navigation',
        tabId: undefined,
        url: 'https://page2.com'
      }, state);
      assert.equal(result.accepted, false);
    });
  });

  // ── 4. Scroll Message ────────────────────────────────────────────────────

  describe('perception_scroll', () => {
    it('updates model scroll position', () => {
      simulateHandleMessage(engine, {
        type: 'perception_snapshot',
        tabId: 1,
        url: 'https://example.com',
        scroll: { x: 0, y: 0 },
        nodes: []
      }, state);

      const result = simulateHandleMessage(engine, {
        type: 'perception_scroll',
        tabId: 1,
        x: 0,
        y: 500,
        timestamp: Date.now()
      }, state);

      assert.equal(result.accepted, true);
      assert.equal(result.type, 'scroll');

      const model = engine.models.get(1);
      assert.equal(model.scroll.y, 500);
    });

    it('rejects scroll with non-numeric tabId', () => {
      const result = simulateHandleMessage(engine, {
        type: 'perception_scroll',
        tabId: 'bad',
        x: 0,
        y: 0
      }, state);
      assert.equal(result.accepted, false);
    });
  });

  // ── 5. Tab Closed Message ────────────────────────────────────────────────

  describe('perception_tab_closed', () => {
    it('removes the model for a closed tab', () => {
      simulateHandleMessage(engine, {
        type: 'perception_snapshot',
        tabId: 1,
        url: 'https://example.com',
        nodes: []
      }, state);

      assert.ok(engine.models.has(1));

      const result = simulateHandleMessage(engine, {
        type: 'perception_tab_closed',
        tabId: 1,
        timestamp: Date.now()
      }, state);

      assert.equal(result.accepted, true);
      assert.equal(result.type, 'tab_closed');
      assert.ok(!engine.models.has(1));
    });

    it('handles closing a tab that has no model', () => {
      const result = simulateHandleMessage(engine, {
        type: 'perception_tab_closed',
        tabId: 999,
        timestamp: Date.now()
      }, state);
      assert.equal(result.accepted, true); // no-op, no error
    });

    it('rejects tab_closed with non-numeric tabId', () => {
      const result = simulateHandleMessage(engine, {
        type: 'perception_tab_closed',
        tabId: false
      }, state);
      assert.equal(result.accepted, false);
    });
  });

  // ── 6. End-to-End Flow ───────────────────────────────────────────────────

  describe('end-to-end perception flow', () => {
    it('simulates full agent workflow: navigate → snapshot → interact → perceive deltas', () => {
      // 1. Page loads → extension sends snapshot
      simulateHandleMessage(engine, {
        type: 'perception_snapshot',
        tabId: 1,
        url: 'https://example.com',
        title: 'Home',
        viewport: { width: 1440, height: 900 },
        scroll: { x: 0, y: 0 },
        readyState: 'complete',
        nodes: [
          { ref: 'ref_1', tagName: 'h1', textContent: 'Welcome' },
          { ref: 'ref_2', tagName: 'button', role: 'button', textContent: 'Login' }
        ]
      }, state);

      // 2. Agent perceives → snapshot
      const p1 = engine.perceive('agent1', 1);
      assert.equal(p1.status, 'snapshot');
      assert.ok(p1.text.includes('Welcome'));

      // 3. Agent perceives again → no_change
      const p2 = engine.perceive('agent1', 1);
      assert.equal(p2.status, 'no_change');

      // 4. Agent clicks login → DOM changes happen
      simulateHandleMessage(engine, {
        type: 'perception_events',
        tabId: 1,
        events: [
          { type: 'added', ref: 'ref_3', tagName: 'dialog', role: 'dialog', textContent: 'Login Form' },
          { type: 'added', ref: 'ref_4', tagName: 'input', role: 'textbox', textContent: '' },
          { type: 'added', ref: 'ref_5', tagName: 'button', role: 'button', textContent: 'Submit' }
        ]
      }, state);

      // 5. Agent perceives → delta with only changes
      const p3 = engine.perceive('agent1', 1);
      assert.equal(p3.status, 'delta');
      assert.equal(p3.event_count, 3);
      assert.ok(p3.text.includes('dialog'));
      assert.ok(p3.text.includes('Login Form'));

      // 6. User scrolls
      simulateHandleMessage(engine, {
        type: 'perception_scroll',
        tabId: 1,
        x: 0,
        y: 300
      }, state);

      // 7. Navigation to new page
      simulateHandleMessage(engine, {
        type: 'perception_navigation',
        tabId: 1,
        url: 'https://example.com/dashboard'
      }, state);

      // 8. New page snapshot arrives
      simulateHandleMessage(engine, {
        type: 'perception_snapshot',
        tabId: 1,
        url: 'https://example.com/dashboard',
        title: 'Dashboard',
        viewport: { width: 1440, height: 900 },
        scroll: { x: 0, y: 0 },
        nodes: [
          { ref: 'ref_10', tagName: 'h1', textContent: 'Dashboard' }
        ]
      }, state);

      // 9. Agent perceives → snapshot (new page)
      const p4 = engine.perceive('agent1', 1);
      assert.equal(p4.status, 'snapshot');
      assert.ok(p4.text.includes('Dashboard'));
      assert.ok(!p4.text.includes('Welcome')); // old page content gone

      // 10. Tab closed
      simulateHandleMessage(engine, {
        type: 'perception_tab_closed',
        tabId: 1
      }, state);

      assert.ok(!engine.models.has(1));

      // 11. Agent perceives closed tab → no_model
      const p5 = engine.perceive('agent1', 1);
      assert.equal(p5.status, 'no_model');
    });
  });

  // ── 7. Unknown Message Types ─────────────────────────────────────────────

  it('rejects unknown message types', () => {
    const result = simulateHandleMessage(engine, {
      type: 'perception_unknown',
      tabId: 1
    }, state);
    assert.equal(result.accepted, false);
    assert.equal(result.reason, 'unknown type');
  });
});
