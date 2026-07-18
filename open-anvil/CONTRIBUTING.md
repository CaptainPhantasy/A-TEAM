# Contributing to Open Anvil

Thanks for your interest in contributing! This project is built for the AI agent community — every contribution helps.

## Getting Started

1. Fork the repo
2. Clone: `git clone https://github.com/<you>/open-anvil.git`
3. Install deps: `cd open-anvil && npm install`
4. Run tests: `cd mcp-server && node --test test/*.test.js`
5. Lint: `npx eslint mcp-server/server.js extension/background.js`

## Development Setup

### MCP Server
```bash
cd mcp-server
npm install
node server.js                    # Start in standalone mode
ANVIL_DEBUG=true node server.js   # Verbose logging
ANVIL_SHELL=true node server.js  # Enable shell access
```

### Chrome Extension
1. Go to `chrome://extensions`
2. Enable Developer Mode
3. Load Unpacked → select `extension/` directory
4. Badge should show ● (purple) if native host is running

### Native Messaging Host
Requires Python 3.8+ and the Floyd TTY Bridge installed. See `install.sh` for setup.

## Code Standards

- **ESLint**: Run `npx eslint` before committing. Zero errors required.
- **No secrets**: API keys, tokens, passwords in code will be rejected.
- **No hardcoded paths**: Use env vars or config files for all paths.
- **Error handling**: All async operations must have try/catch or .catch().
- **Logging**: Use the `log()` function. Never use `console.log` in production code.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system design. Key points:
- `mcp-server/server.js` — MCP JSON-RPC server, speaks to extension via WS or native pipe
- `extension/background.js` — Chrome service worker, routes tool calls to content scripts
- `extension/native_host.py` — Python native messaging host (in Floyd TTY repo)

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Run tests: `node --test test/*.test.js` — all must pass
4. Run lint: `npx eslint mcp-server/ extension/background.js` — zero errors
5. Update docs if you changed behavior
6. Submit PR with clear description

## Reporting Issues

Use GitHub Issues. Include:
- OS and Chrome version
- Node.js version
- Steps to reproduce
- Expected vs actual behavior
- Server logs with `ANVIL_DEBUG=true`

## License

MIT — see [LICENSE](LICENSE). All contributions are under the same license.
