# Security Policy

## Supported Versions

| Version | Status |
|---------|--------|
| 1.2.x   | ✅ Active development |

## Reporting a Vulnerability

**Do NOT open a public issue for security vulnerabilities.**

Instead, email: `security@floydslabs.dev` with:
- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact

We will acknowledge within 24 hours and provide a fix timeline within 72 hours.

## Security Architecture

### Authentication
- **WebSocket**: Token-based auth, auto-generated on first run (24-byte hex)
- **Native Messaging**: OS-level permission (Chrome manages lifecycle)
- **MCP Protocol**: Designed for localhost use — no remote access by default

### Shell Access
- `execute_shell` is **disabled by default**
- Enable with `ANVIL_SHELL=true` environment variable
- Commands are rate-limited (30/second)
- Output is capped at 256KB
- Command length capped at 10KB

### Message Size Limits
- Native messaging: 1MB (Chrome hard limit)
- MCP protocol: 4MB
- Large payloads (screenshots) spill to temp files

### Permissions Model
The Chrome extension requires:
- `<all_urls>` host permission — needed for browser automation on any page
- `debugger` — needed for Chrome DevTools Protocol
- `nativeMessaging` — needed for persistent pipe to native host
- `tabs`, `scripting`, `downloads`, `webNavigation` — core browser APIs

These permissions are necessary for full browser control. The extension injects content scripts on all URLs for DOM access.

## Dependency Security

- Single runtime dependency: `ws` (MIT licensed, 0 known vulnerabilities)
- Python dependency: `orjson` (for native host performance)
- All dependencies audited on every `npm install` / `pip install`

## Known Limitations

- WebSocket server binds to `127.0.0.1` only — not exposed to the network
- No encryption on WebSocket (localhost-only, token auth provides access control)
- No user authentication — any local process with the token can connect
- Native messaging host has full shell access via PTY bridge (separate from MCP shell)
