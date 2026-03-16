// perception-tools.js — MCP tool definitions and handlers for the Perception Engine
'use strict';

export const PERCEPTION_TOOLS_VERSION = '1.1.0';

function objectSchema(properties, required = []) {
  return { type: 'object', properties, required, additionalProperties: true };
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

export const PERCEPTION_TOOL_DEFINITIONS = [
  {
    name: 'perceive',
    description: 'Get page awareness — returns a snapshot on first call or after navigation, a delta of changes since last call, or a no_change status. Replaces the need for read_page + get_page_state + get_dom_changes with a single token-efficient call.',
    inputSchema: objectSchema({
      tab_id: { type: 'number', description: 'Tab ID to perceive. Defaults to active tab.' },
      agent_id: { type: 'string', description: 'Agent identifier for cursor tracking. Defaults to "default".' },
      intent: {
        type: 'string',
        enum: ['full', 'interactive', 'forms', 'navigation', 'changes_only'],
        description: 'What to include. "full" = everything, "interactive" = only clickable/typeable elements, "forms" = only form elements, "navigation" = just URL/title/scroll, "changes_only" = deltas without scroll events.'
      },
      max_chars: { type: 'number', description: 'Maximum output characters (default 4000). Lower = fewer tokens.' },
      force_snapshot: { type: 'boolean', description: 'Force a full snapshot even if only deltas exist.' }
    })
  },
  {
    name: 'subscribe',
    description: 'Configure which event types this agent tracks. Controls what appears in perceive() deltas.',
    inputSchema: objectSchema({
      agent_id: { type: 'string', description: 'Agent identifier.' },
      event_types: {
        type: 'array',
        items: { type: 'string', enum: ['dom', 'navigation', 'scroll', 'network', 'console'] },
        description: 'Event types to subscribe to.'
      }
    }, ['event_types'])
  },
  {
    name: 'get_perception_status',
    description: 'Diagnostic tool — shows current page model state, cursor positions, and engine stats.',
    inputSchema: objectSchema({
      agent_id: { type: 'string', description: 'Agent identifier.' },
      tab_id: { type: 'number', description: 'Specific tab to inspect.' }
    })
  }
];

export const PERCEPTION_TOOL_NAMES = new Set(PERCEPTION_TOOL_DEFINITIONS.map(t => t.name));

// ─── Tool Handlers ───────────────────────────────────────────────────────────

export function handlePerceptionTool(engine, toolName, args, activeTabId) {
  const agentId = args.agent_id || 'default';
  const tabId = args.tab_id || activeTabId;

  switch (toolName) {
    case 'perceive': {
      if (!tabId) {
        return {
          success: false,
          error: 'No tab_id provided and no active tab known. Specify a tab_id or navigate first.'
        };
      }
      const result = engine.perceive(agentId, tabId, {
        intent: args.intent,
        max_chars: args.max_chars,
        force_snapshot: args.force_snapshot
      });
      return { success: true, result };
    }

    case 'subscribe': {
      const result = engine.setSubscriptions(agentId, args.event_types);
      return { success: true, result };
    }

    case 'get_perception_status': {
      const result = engine.getStatus(agentId, tabId);
      return { success: true, result };
    }

    default:
      return { success: false, error: `Unknown perception tool: ${toolName}` };
  }
}
