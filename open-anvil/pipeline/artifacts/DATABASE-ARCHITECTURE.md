# Database Architecture: OPEN ANVIL

## Overview
Open Anvil has no traditional database. State is managed through:
1. **WebSocket Message Protocol** — JSON schemas for MCP ↔ extension communication
2. **Checkpoint State** — JSON files persisted to disk for crash recovery
3. **Heartbeat State** — In-memory + file-backed health monitoring
4. **Tool Call Correlation** — Request/response ID mapping across async boundaries

## 1. WebSocket Message Protocol

### MCP Server → Extension (Tool Request)
```json
{
  "id": "string (UUID)",
  "type": "tool_call",
  "tool": "string (tool name)",
  "args": { "...tool-specific arguments" },
  "timestamp": "number (Date.now())"
}
```

### Extension → MCP Server (Tool Response)
```json
{
  "id": "string (matches request ID)",
  "type": "tool_response",
  "success": "boolean",
  "result": { "...tool-specific result" },
  "error": "string | undefined",
  "duration": "number (ms)"
}
```

### Extension → MCP Server (Status Events)
```json
{
  "type": "status",
  "event": "connected | disconnected | tab_changed | error",
  "data": { "...event-specific data" },
  "timestamp": "number"
}
```

## 2. Checkpoint State Schema

Stored in `state/checkpoint-{name}.json`:
```json
{
  "version": 1,
  "name": "string",
  "createdAt": "ISO 8601",
  "browser": {
    "tabId": "number",
    "url": "string",
    "title": "string",
    "scroll": { "x": "number", "y": "number" },
    "viewport": { "width": "number", "height": "number" }
  },
  "refs": {
    "refId": { "selector": "string", "tagName": "string", "text": "string" }
  },
  "tabGroup": {
    "groupId": "number | null",
    "title": "string",
    "color": "string"
  },
  "note": "string (user annotation)"
}
```

## 3. Heartbeat State Schema

Stored in `state/heartbeat.json` (overwritten each tick):
```json
{
  "tick": "number (monotonic counter)",
  "timestamp": "ISO 8601",
  "lastAction": "string (tool name)",
  "lastArgs": { "...summary" },
  "extensionConnected": "boolean",
  "activeTabId": "number",
  "activeTabUrl": "string",
  "stuckDetection": {
    "sameActionCount": "number",
    "threshold": 3,
    "isStuck": "boolean"
  }
}
```

## 4. Debug Trace Schema

Stored in `debug/trace-{session}.jsonl` (append-only):
```jsonl
{"ts":"ISO","type":"tool_call","tool":"navigate_to","args":{"url":"..."},"id":"..."}
{"ts":"ISO","type":"tool_response","id":"...","success":true,"duration":142}
{"ts":"ISO","type":"event","event":"tab_changed","tabId":123}
```

## 5. MCP Protocol Messages (stdio)

### Client → Server: Initialize
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": { "name": "claude-code", "version": "1.0" }
  }
}
```

### Client → Server: List Tools
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

### Client → Server: Call Tool
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "navigate_to",
    "arguments": { "url": "https://example.com" }
  }
}
```

### Server → Client: Tool Result
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      { "type": "text", "text": "{\"success\":true,\"result\":{\"navigated\":\"https://example.com\"}}" }
    ]
  }
}
```

## 6. Validation Rules

| Rule | Schema | Enforcement |
|------|--------|-------------|
| V-1 | Tool call must have `id` and `tool` | MCP server validates before forwarding |
| V-2 | Tool args must match `inputSchema` | MCP server validates against tool-definitions.js |
| V-3 | Response must reference valid request `id` | Correlation map in MCP server with 30s TTL |
| V-4 | Checkpoint name must be alphanumeric + dashes | Regex validation in checkpoint.js |
| V-5 | Heartbeat tick must be monotonically increasing | State engine rejects stale ticks |
| V-6 | WebSocket messages must be valid JSON | Parse + catch at transport layer |
| V-7 | Screenshot data must be base64-encoded PNG | Validated at capture layer |
| V-8 | Tab IDs must be positive integers | Chrome API enforces |
| V-9 | Selector strings sanitized (no script injection) | content-script.js sanitize() |
| V-10 | WebSocket binds to 127.0.0.1 only | Hardcoded in server.js, not configurable to non-localhost |

## Confidence Score
9/10 — Clean state schemas with clear boundaries between transient (WebSocket), persistent (checkpoint), and diagnostic (trace) data.
