// perception-engine.js — Living page model with per-agent cursors
// Pure logic, no I/O. Server feeds events in, agents call perceive() out.
'use strict';

export const PERCEPTION_ENGINE_VERSION = '1.1.0';

// ─── Caps ────────────────────────────────────────────────────────────────────
const MAX_NODES_PER_TAB = 5000;
const MAX_EVENTS_PER_TAB = 2000;
const CURSOR_EXPIRY_MS = 10 * 60 * 1000;   // 10 minutes
const STALE_MODEL_MS = 5 * 60 * 1000;       // 5 minutes

// ─── Data Structures ─────────────────────────────────────────────────────────

function createPageModel(tabId, url = '', title = '') {
  return {
    tabId,
    url,
    title,
    viewport: { width: 0, height: 0 },
    scroll: { x: 0, y: 0 },
    readyState: 'loading',
    nodes: new Map(),       // ref → PageNode
    eventLog: [],           // DomEvent[]
    seq: 0,                 // increments on every event
    snapshotSeq: 0,         // seq at last snapshot ingestion
    lastEventAt: Date.now(),
    status: 'active'        // active | stale
  };
}

function createAgentCursor(agentId) {
  return {
    agentId,
    tabSeqs: new Map(),     // tabId → lastSeenSeq
    subscriptions: new Set(['dom', 'navigation', 'scroll']),
    lastAccessAt: Date.now()
  };
}

// ─── Perception Engine ───────────────────────────────────────────────────────

export class PerceptionEngine {
  constructor() {
    this.models = new Map();    // tabId → PageModel
    this.cursors = new Map();   // agentId → AgentCursor
  }

  // ── Model Lifecycle ──────────────────────────────────────────────────────

  getOrCreateModel(tabId) {
    let model = this.models.get(tabId);
    if (!model) {
      model = createPageModel(tabId);
      this.models.set(tabId, model);
    }
    return model;
  }

  removeModel(tabId) {
    this.models.delete(tabId);
    // Reset all cursor seqs for this tab
    for (const cursor of this.cursors.values()) {
      cursor.tabSeqs.delete(tabId);
    }
  }

  // ── Cursor Lifecycle ─────────────────────────────────────────────────────

  getOrCreateCursor(agentId) {
    let cursor = this.cursors.get(agentId);
    if (!cursor) {
      cursor = createAgentCursor(agentId);
      this.cursors.set(agentId, cursor);
    }
    cursor.lastAccessAt = Date.now();
    return cursor;
  }

  // ── Event Ingestion ──────────────────────────────────────────────────────

  ingestSnapshot(tabId, snapshot) {
    const model = this.getOrCreateModel(tabId);

    if (snapshot.url !== undefined) model.url = snapshot.url;
    if (snapshot.title !== undefined) model.title = snapshot.title;
    if (snapshot.viewport) model.viewport = snapshot.viewport;
    if (snapshot.scroll) model.scroll = snapshot.scroll;
    if (snapshot.readyState) model.readyState = snapshot.readyState;

    // Replace node map from snapshot nodes
    if (snapshot.nodes && Array.isArray(snapshot.nodes)) {
      model.nodes.clear();
      for (const node of snapshot.nodes) {
        if (node.ref && model.nodes.size < MAX_NODES_PER_TAB) {
          model.nodes.set(node.ref, node);
        }
      }
    }

    model.seq++;
    model.snapshotSeq = model.seq;
    model.lastEventAt = Date.now();
    model.status = 'active';

    // Push a snapshot event into the log
    this._pushEvent(model, {
      type: 'snapshot',
      seq: model.seq,
      timestamp: Date.now()
    });
  }

  ingestNavigation(tabId, data) {
    const model = this.getOrCreateModel(tabId);
    const oldUrl = model.url;

    model.url = data.url || model.url;
    model.title = data.title || model.title;
    model.readyState = data.readyState || 'loading';
    model.nodes.clear();
    model.eventLog = [];
    model.seq++;
    model.snapshotSeq = 0; // force full snapshot on next perceive
    model.lastEventAt = Date.now();
    model.status = 'active';

    this._pushEvent(model, {
      type: 'navigation',
      seq: model.seq,
      from: oldUrl,
      to: model.url,
      timestamp: Date.now()
    });
  }

  ingestScroll(tabId, scroll) {
    const model = this.getOrCreateModel(tabId);
    model.scroll = { x: scroll.x || 0, y: scroll.y || 0 };
    model.seq++;
    model.lastEventAt = Date.now();

    this._pushEvent(model, {
      type: 'scroll',
      seq: model.seq,
      x: model.scroll.x,
      y: model.scroll.y,
      timestamp: Date.now()
    });
  }

  ingestEvents(tabId, events) {
    const model = this.getOrCreateModel(tabId);

    for (const event of events) {
      model.seq++;
      model.lastEventAt = Date.now();
      model.status = 'active';

      const enriched = { ...event, seq: model.seq, timestamp: Date.now() };
      this._pushEvent(model, enriched);

      // Update node map
      if (event.type === 'added' && event.ref) {
        if (model.nodes.size < MAX_NODES_PER_TAB) {
          model.nodes.set(event.ref, {
            ref: event.ref,
            tagName: event.tagName,
            role: event.role,
            textContent: event.textContent,
            attributes: event.attributes || {}
          });
        }
      } else if (event.type === 'removed' && event.ref) {
        model.nodes.delete(event.ref);
      } else if (event.type === 'attribute_changed' && event.ref) {
        const node = model.nodes.get(event.ref);
        if (node) {
          if (!node.attributes) node.attributes = {};
          node.attributes[event.attribute] = event.newValue;
        }
      } else if (event.type === 'text_changed' && event.ref) {
        const node = model.nodes.get(event.ref);
        if (node) {
          node.textContent = event.newValue;
        }
      }
    }
  }

  _pushEvent(model, event) {
    if (model.eventLog.length >= MAX_EVENTS_PER_TAB) {
      // Drop oldest 25%
      model.eventLog = model.eventLog.slice(Math.floor(MAX_EVENTS_PER_TAB / 4));
    }
    model.eventLog.push(event);
  }

  // ── Core: perceive() ─────────────────────────────────────────────────────

  perceive(agentId, tabId, options = {}) {
    const cursor = this.getOrCreateCursor(agentId);
    const model = this.models.get(tabId);

    if (!model) {
      return {
        status: 'no_model',
        tab_id: tabId,
        message: 'No page model for this tab. Navigate first or wait for page load.',
        token_estimate: 50
      };
    }

    const lastSeen = cursor.tabSeqs.get(tabId) || 0;
    const intent = options.intent || 'full';
    const maxChars = options.max_chars || 4000;
    const forceSnapshot = options.force_snapshot || false;

    // Determine response type
    const needsSnapshot = forceSnapshot || lastSeen === 0 || model.snapshotSeq === 0;
    const hasNavigation = model.eventLog.some(e => e.type === 'navigation' && e.seq > lastSeen);
    const newEvents = model.eventLog.filter(e => e.seq > lastSeen);

    let result;

    if (needsSnapshot || hasNavigation) {
      result = this._buildSnapshot(model, intent, maxChars);
    } else if (newEvents.length === 0) {
      result = this._buildNoChange(model);
    } else {
      result = this._buildDelta(model, newEvents, intent, maxChars);
    }

    // Update cursor
    cursor.tabSeqs.set(tabId, model.seq);

    return result;
  }

  // ── Snapshot Builder ─────────────────────────────────────────────────────

  _buildSnapshot(model, intent, maxChars) {
    const lines = [];
    lines.push(`## Page: ${model.title || '(untitled)'} (${model.url})`);
    lines.push(`Viewport: ${model.viewport.width}x${model.viewport.height} | Scroll: ${model.scroll.x},${model.scroll.y} | State: ${model.readyState}`);
    lines.push('');

    if (intent === 'navigation') {
      // Minimal — just URL/title/scroll
      const text = lines.join('\n');
      return {
        status: 'snapshot',
        tab_id: model.tabId,
        text: text.slice(0, maxChars),
        node_count: model.nodes.size,
        seq: model.seq,
        token_estimate: Math.ceil(text.length / 4)
      };
    }

    lines.push(`### DOM Tree (${model.nodes.size} nodes):`);

    let charBudget = maxChars - lines.join('\n').length - 50;

    for (const [ref, node] of model.nodes) {
      if (intent === 'interactive' && !this._isInteractive(node)) continue;
      if (intent === 'forms' && !this._isFormElement(node)) continue;

      const line = this._formatNode(node);
      if (charBudget - line.length < 0) {
        lines.push(`... (${model.nodes.size} total nodes, truncated to fit ${maxChars} chars)`);
        break;
      }
      lines.push(line);
      charBudget -= line.length;
    }

    const text = lines.join('\n');
    return {
      status: 'snapshot',
      tab_id: model.tabId,
      text: text.slice(0, maxChars),
      node_count: model.nodes.size,
      seq: model.seq,
      token_estimate: Math.ceil(text.length / 4)
    };
  }

  // ── No-Change Builder ────────────────────────────────────────────────────

  _buildNoChange(model) {
    const text = `## Page: ${model.title || '(untitled)'} (${model.url})\nNo changes since last perception.`;
    return {
      status: 'no_change',
      tab_id: model.tabId,
      text,
      seq: model.seq,
      token_estimate: Math.ceil(text.length / 4)
    };
  }

  // ── Delta Builder ────────────────────────────────────────────────────────

  _buildDelta(model, events, intent, maxChars) {
    // Filter events by intent
    let filtered = events;
    if (intent === 'navigation') {
      filtered = events.filter(e => e.type === 'navigation' || e.type === 'scroll');
    } else if (intent === 'changes_only') {
      filtered = events.filter(e => e.type !== 'scroll');
    }

    // Compact events
    const compacted = this._compactEvents(filtered);

    const lines = [];
    lines.push(`## Page: ${model.title || '(untitled)'} (${model.url})`);
    lines.push(`Viewport: ${model.viewport.width}x${model.viewport.height} | Scroll: ${model.scroll.x},${model.scroll.y}`);
    lines.push('');
    lines.push(`### Changes (${filtered.length} events → ${compacted.length} compacted):`);

    let charBudget = maxChars - lines.join('\n').length - 50;

    for (const event of compacted) {
      const line = this._formatEvent(event);
      if (charBudget - line.length < 0) {
        lines.push(`... (truncated to fit ${maxChars} chars)`);
        break;
      }
      lines.push(line);
      charBudget -= line.length;
    }

    const text = lines.join('\n');
    return {
      status: 'delta',
      tab_id: model.tabId,
      text: text.slice(0, maxChars),
      event_count: filtered.length,
      compacted_count: compacted.length,
      seq: model.seq,
      token_estimate: Math.ceil(text.length / 4)
    };
  }

  // ── Event Compaction ─────────────────────────────────────────────────────

  _compactEvents(events) {
    const refState = new Map(); // ref → latest event or null (cancelled)
    const nonRefEvents = [];

    for (const event of events) {
      if (!event.ref) {
        // Events without refs can't be compacted by ref
        if (event.type !== 'snapshot') {
          nonRefEvents.push(event);
        }
        continue;
      }

      const ref = event.ref;
      const existing = refState.get(ref);

      if (event.type === 'added') {
        // If previously removed, they cancel. If previously added, latest wins.
        if (existing && existing.type === 'removed') {
          refState.delete(ref); // add + remove cancel
        } else {
          refState.set(ref, event);
        }
      } else if (event.type === 'removed') {
        if (existing && existing.type === 'added') {
          refState.delete(ref); // add + remove cancel
        } else {
          refState.set(ref, event);
        }
      } else if (event.type === 'attribute_changed') {
        if (existing && existing.type === 'attribute_changed' && existing.attribute === event.attribute) {
          // Collapse: keep oldValue from first, newValue from latest
          refState.set(ref, { ...event, oldValue: existing.oldValue });
        } else if (existing && existing.type === 'attribute_changed') {
          // Different attribute — store as compound
          nonRefEvents.push(existing);
          refState.set(ref, event);
        } else {
          refState.set(ref, event);
        }
      } else if (event.type === 'text_changed') {
        if (existing && existing.type === 'text_changed') {
          // Collapse: keep oldValue from first, newValue from latest
          refState.set(ref, { ...event, oldValue: existing.oldValue });
        } else {
          refState.set(ref, event);
        }
      } else {
        nonRefEvents.push(event);
      }
    }

    // Merge results: ref-compacted + non-ref, ordered by seq
    const result = [...refState.values(), ...nonRefEvents];
    result.sort((a, b) => (a.seq || 0) - (b.seq || 0));
    return result;
  }

  // ── Formatting ───────────────────────────────────────────────────────────

  _formatNode(node) {
    const parts = [node.tagName || 'unknown'];
    if (node.role) parts.push(`role="${node.role}"`);
    if (node.textContent) parts.push(`"${this._truncate(node.textContent, 60)}"`);
    parts.push(`[${node.ref}]`);
    if (node.attributes) {
      for (const [k, v] of Object.entries(node.attributes)) {
        if (k !== 'role' && v) parts.push(`${k}="${this._truncate(String(v), 30)}"`);
      }
    }
    return `  ${parts.join(' ')}`;
  }

  _formatEvent(event) {
    switch (event.type) {
      case 'added': {
        const desc = event.role ? `${event.tagName} "${event.textContent || ''}"` : event.tagName;
        return `+ ${desc} [${event.ref || '?'}]`;
      }
      case 'removed': {
        const desc = event.role ? `${event.tagName} "${event.textContent || ''}"` : event.tagName;
        return `- ${desc} [${event.ref || '?'}]`;
      }
      case 'attribute_changed':
        return `~ ${event.tagName || '?'} [${event.ref || '?'}] ${event.attribute}: ${this._truncate(String(event.oldValue || ''), 30)} → ${this._truncate(String(event.newValue || ''), 30)}`;
      case 'text_changed':
        return `~ ${event.tagName || '?'} [${event.ref || '?'}] text: "${this._truncate(event.oldValue || '', 40)}" → "${this._truncate(event.newValue || '', 40)}"`;
      case 'navigation':
        return `⟳ Navigated: ${event.from || '?'} → ${event.to || '?'}`;
      case 'scroll':
        return `↕ Scroll: ${event.x},${event.y}`;
      default:
        return `? ${event.type} [${event.ref || ''}]`;
    }
  }

  _truncate(str, max) {
    if (typeof str !== 'string') return '';
    return str.length > max ? str.substring(0, max) + '…' : str;
  }

  _isInteractive(node) {
    const interactive = ['button', 'a', 'input', 'select', 'textarea', 'details', 'summary'];
    if (interactive.includes(node.tagName)) return true;
    if (node.role && ['button', 'link', 'textbox', 'checkbox', 'radio', 'tab', 'menuitem', 'option', 'combobox', 'slider'].includes(node.role)) return true;
    if (node.attributes?.onclick || node.attributes?.tabindex) return true;
    return false;
  }

  _isFormElement(node) {
    const formTags = ['input', 'select', 'textarea', 'form', 'label', 'fieldset', 'legend', 'button'];
    if (formTags.includes(node.tagName)) return true;
    if (node.role && ['textbox', 'checkbox', 'radio', 'combobox', 'listbox', 'slider', 'spinbutton'].includes(node.role)) return true;
    return false;
  }

  // ── Subscription Management ──────────────────────────────────────────────

  setSubscriptions(agentId, eventTypes) {
    const cursor = this.getOrCreateCursor(agentId);
    cursor.subscriptions = new Set(eventTypes);
    return { success: true, subscriptions: [...cursor.subscriptions] };
  }

  // ── Diagnostics ──────────────────────────────────────────────────────────

  getStatus(agentId, tabId) {
    const cursor = this.cursors.get(agentId);
    const model = tabId ? this.models.get(tabId) : null;

    return {
      models: tabId
        ? (model ? [{
            tabId: model.tabId,
            url: model.url,
            title: model.title,
            nodeCount: model.nodes.size,
            eventCount: model.eventLog.length,
            seq: model.seq,
            status: model.status,
            lastEventAt: model.lastEventAt
          }] : [])
        : [...this.models.values()].map(m => ({
            tabId: m.tabId,
            url: m.url,
            title: m.title,
            nodeCount: m.nodes.size,
            eventCount: m.eventLog.length,
            seq: m.seq,
            status: m.status,
            lastEventAt: m.lastEventAt
          })),
      cursor: cursor ? {
        agentId: cursor.agentId,
        tabSeqs: Object.fromEntries(cursor.tabSeqs),
        subscriptions: [...cursor.subscriptions],
        lastAccessAt: cursor.lastAccessAt
      } : null,
      totals: {
        modelCount: this.models.size,
        cursorCount: this.cursors.size
      }
    };
  }

  // ── Housekeeping ─────────────────────────────────────────────────────────

  expireStale() {
    const now = Date.now();
    let expired = 0;

    // Expire idle cursors
    for (const [agentId, cursor] of this.cursors) {
      if (now - cursor.lastAccessAt > CURSOR_EXPIRY_MS) {
        this.cursors.delete(agentId);
        expired++;
      }
    }

    // Mark stale models
    for (const model of this.models.values()) {
      if (model.status === 'active' && now - model.lastEventAt > STALE_MODEL_MS) {
        model.status = 'stale';
      }
    }

    return { expiredCursors: expired, totalModels: this.models.size, totalCursors: this.cursors.size };
  }

  // Reset all cursors (used after reconnect)
  resetAllCursors() {
    for (const cursor of this.cursors.values()) {
      cursor.tabSeqs.clear();
    }
  }
}
