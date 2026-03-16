// server-dispatch.test.js — Integration tests for MCP server tool dispatch routing
// Tests that tools/call routes correctly to local, perception, and extension paths.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PerceptionEngine } from '../perception-engine.js';
import { PERCEPTION_TOOL_NAMES, handlePerceptionTool } from '../perception-tools.js';

// We test the dispatch logic by simulating what server.js does:
// 1. Check LOCAL_TOOLS → handleLocalTool
// 2. Check PERCEPTION_TOOL_NAMES → handlePerceptionTool
// 3. Else → sendToExtension (we verify it's NOT handled by the above)

const LOCAL_TOOLS = new Set(['execute_shell']);

function classifyTool(toolName) {
  if (LOCAL_TOOLS.has(toolName)) return 'local';
  if (PERCEPTION_TOOL_NAMES.has(toolName)) return 'perception';
  return 'extension';
}

describe('Server Tool Dispatch Routing', () => {

  // ── 1. Local tools route correctly ───────────────────────────────────────

  it('routes execute_shell to local handler', () => {
    assert.equal(classifyTool('execute_shell'), 'local');
  });

  // ── 2. Perception tools route correctly ──────────────────────────────────

  it('routes perceive to perception handler', () => {
    assert.equal(classifyTool('perceive'), 'perception');
  });

  it('routes subscribe to perception handler', () => {
    assert.equal(classifyTool('subscribe'), 'perception');
  });

  it('routes get_perception_status to perception handler', () => {
    assert.equal(classifyTool('get_perception_status'), 'perception');
  });

  // ── 3. Extension tools route correctly ───────────────────────────────────

  it('routes navigate_to to extension', () => {
    assert.equal(classifyTool('navigate_to'), 'extension');
  });

  it('routes read_page to extension', () => {
    assert.equal(classifyTool('read_page'), 'extension');
  });

  it('routes click_element to extension', () => {
    assert.equal(classifyTool('click_element'), 'extension');
  });

  it('routes take_screenshot to extension', () => {
    assert.equal(classifyTool('take_screenshot'), 'extension');
  });

  it('routes list_tabs to extension', () => {
    assert.equal(classifyTool('list_tabs'), 'extension');
  });

  it('routes get_dom_changes to extension', () => {
    assert.equal(classifyTool('get_dom_changes'), 'extension');
  });

  // ── 4. All 42 original tools route to extension (not perception) ────────

  it('does not intercept any of the 42 original tools', () => {
    const originalTools = [
      'navigate_to', 'open_tab', 'close_tab', 'switch_tab', 'list_tabs',
      'get_tab_state', 'get_page_state', 'click_element', 'type_text',
      'fill_form', 'select_option', 'scroll_to', 'wait_for_element',
      'click_ref', 'type_ref', 'scroll_to_ref', 'click_mark',
      'analyze_page', 'analyze_element', 'find_elements', 'extract_text',
      'extract_css', 'check_accessibility', 'check_contrast',
      'take_screenshot', 'read_page', 'read_console', 'distill_dom',
      'get_dom_changes', 'read_network', 'set_of_marks', 'quick',
      'download', 'download_status', 'add_net_rule', 'remove_net_rule',
      'checkpoint_save', 'checkpoint_restore',
      'gif_start', 'gif_add_frame', 'gif_stop'
    ];

    for (const tool of originalTools) {
      const route = classifyTool(tool);
      assert.equal(route, 'extension', `${tool} should route to extension, got ${route}`);
    }
  });

  // ── 5. Perception tool handler returns correct structure ─────────────────

  describe('handlePerceptionTool', () => {
    let engine;

    beforeEach(() => {
      engine = new PerceptionEngine();
    });

    it('perceive returns no_model when tab has no data', () => {
      const result = handlePerceptionTool(engine, 'perceive', { tab_id: 999 }, 999);
      assert.equal(result.success, true);
      assert.equal(result.result.status, 'no_model');
    });

    it('perceive returns snapshot on first call with data', () => {
      engine.ingestSnapshot(1, {
        url: 'https://example.com',
        title: 'Test',
        viewport: { width: 1440, height: 900 },
        nodes: [{ ref: 'ref_1', tagName: 'div', textContent: 'Hello' }]
      });

      const result = handlePerceptionTool(engine, 'perceive', { tab_id: 1 }, 1);
      assert.equal(result.success, true);
      assert.equal(result.result.status, 'snapshot');
      assert.ok(result.result.text.includes('Test'));
    });

    it('perceive returns no_change on second call without changes', () => {
      engine.ingestSnapshot(1, {
        url: 'https://example.com', title: 'Test',
        nodes: [{ ref: 'ref_1', tagName: 'div' }]
      });

      handlePerceptionTool(engine, 'perceive', { tab_id: 1, agent_id: 'a1' }, 1);
      const result = handlePerceptionTool(engine, 'perceive', { tab_id: 1, agent_id: 'a1' }, 1);
      assert.equal(result.success, true);
      assert.equal(result.result.status, 'no_change');
    });

    it('perceive returns delta after events', () => {
      engine.ingestSnapshot(1, {
        url: 'https://example.com', title: 'Test',
        nodes: [{ ref: 'ref_1', tagName: 'div' }]
      });

      handlePerceptionTool(engine, 'perceive', { tab_id: 1, agent_id: 'a1' }, 1);

      engine.ingestEvents(1, [
        { type: 'text_changed', ref: 'ref_1', tagName: 'div', oldValue: '', newValue: 'Updated' }
      ]);

      const result = handlePerceptionTool(engine, 'perceive', { tab_id: 1, agent_id: 'a1' }, 1);
      assert.equal(result.success, true);
      assert.equal(result.result.status, 'delta');
    });

    it('perceive defaults agent_id to "default"', () => {
      engine.ingestSnapshot(1, {
        url: 'https://example.com', title: 'Test', nodes: []
      });

      const result = handlePerceptionTool(engine, 'perceive', { tab_id: 1 }, 1);
      assert.equal(result.success, true);
      assert.ok(engine.cursors.has('default'));
    });

    it('perceive uses activeTabId when tab_id not provided', () => {
      engine.ingestSnapshot(42, {
        url: 'https://example.com', title: 'Test', nodes: []
      });

      const result = handlePerceptionTool(engine, 'perceive', {}, 42);
      assert.equal(result.success, true);
      assert.equal(result.result.tab_id, 42);
    });

    it('perceive returns error when no tab_id and no activeTabId', () => {
      const result = handlePerceptionTool(engine, 'perceive', {}, null);
      assert.equal(result.success, false);
      assert.ok(result.error.includes('No tab_id'));
    });

    it('subscribe updates agent subscriptions', () => {
      const result = handlePerceptionTool(engine, 'subscribe', {
        agent_id: 'a1',
        event_types: ['dom', 'navigation']
      }, null);
      assert.equal(result.success, true);
      assert.deepEqual(result.result.subscriptions, ['dom', 'navigation']);
    });

    it('get_perception_status returns engine state', () => {
      engine.ingestSnapshot(1, {
        url: 'https://example.com', title: 'Test', nodes: []
      });

      const result = handlePerceptionTool(engine, 'get_perception_status', {
        agent_id: 'a1', tab_id: 1
      }, 1);
      assert.equal(result.success, true);
      assert.equal(result.result.models.length, 1);
      assert.equal(result.result.models[0].tabId, 1);
      assert.equal(result.result.totals.modelCount, 1);
    });

    it('returns error for unknown perception tool', () => {
      const result = handlePerceptionTool(engine, 'nonexistent', {}, null);
      assert.equal(result.success, false);
      assert.ok(result.error.includes('Unknown'));
    });
  });
});
