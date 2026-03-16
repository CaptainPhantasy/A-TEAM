# Frontend Report: OPEN ANVIL v1.0.0

## Visual Components

### Agent Indicator (agent-indicator.js)
- Green border overlay when agent is actively controlling the page
- Triggered by `AGENT_WORKING` / `AGENT_DONE` messages from background.js
- Non-intrusive, disappears when agent finishes
- Copied verbatim from Floyd v5.1.0

### Set of Marks (set-of-marks.js)
- Numbered badges overlaid on interactive elements
- Filter modes: interactive, forms, all
- Referenced by `click_mark` tool for visual targeting
- Copied verbatim from Floyd v5.1.0

### No Custom UI Panels
Open Anvil is intentionally headless for v1.0:
- No side panel (removed Floyd's terminal UI)
- No popup (extension icon click does nothing special)
- No devtools panel
- All interaction happens through MCP tool calls

This is by design — the LLM IS the UI. The agent calls tools, the tools manipulate the page, the page provides visual feedback through the agent indicator and set-of-marks.

## Accessibility
- Content scripts preserve all page accessibility features
- Ref IDs map to ARIA roles via accessibility-tree.js
- Agent indicator uses high-contrast green border (visible on all backgrounds)
- Set-of-marks badges use numbered labels (not color-dependent)

## Responsive Design
N/A — no custom UI panels. Content scripts adapt to whatever page they're injected into.

## Confidence Score
9/10 — No custom frontend to break. Visual components are proven from Floyd v5.1.0.
