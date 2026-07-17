#!/usr/bin/env node
// Test harness for Open Anvil MCP server
// Spawns server, sends MCP commands, reads responses

const { spawn } = require('node:child_process');
const ANVIL_PORT = process.env.ANVIL_PORT || '7779';
const SERVER_PATH = process.env.ANVIL_SERVER_PATH || '/Volumes/Storage/A-TEAM/open-anvil/mcp-server/server.js';
const TIMEOUT_MS = parseInt(process.env.ANVIL_TIMEOUT || '10000');

const commands = {
  initialize: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test-harness', version: '1.0.0' } } },
  list_tabs: { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_tabs', arguments: {} } },
  get_page_state: { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_page_state', arguments: {} } },
  perceive: { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'perceive', arguments: {} } }
};

async function runTest() {
  return new Promise((resolve, reject) => {
    const server = spawn('node', [SERVER_PATH], {
      env: { ...process.env, ANVIL_PORT: String(ANVIL_PORT) },
      stdio: ['pipe', 'pipe']
    });

    let output = '';
    let errors = '';
    let timeout;
    let done = false;

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        server.kill();
        reject(new Error('Test timeout'));
      }
    }, TIMEOUT_MS);

    server.stdout.on('data', (data) => {
      output += data.toString();
      tryProcessResponse(output);
    });

    server.stderr.on('data', (data) => {
      errors += data.toString();
    });

    server.on('close', () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        console.log('\n=== SERVER CLOSED ===');
        console.log('Output received:', output.length, 'bytes');
        if (output) {
          console.log('\n=== MCP RESPONSES ===');
          output.split('\n').filter(l => l.trim()).forEach(line => {
            if (line) console.log(line);
          });
        }
        if (errors) {
          console.log('\n=== DEBUG LOG ===');
          console.log(errors);
        }
        resolve({ output, errors, closed: true });
      }
    });

    function tryProcessResponse(allOutput) {
    const lines = allOutput.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const resp = JSON.parse(line);
        if (resp.result) {
          if (resp.result.tools) {
            console.log('\n✅ TOOLS/LIST: Received', resp.result.tools.length, 'tools');
          } else if (resp.result.content) {
            const content = resp.result.content[0];
            if (content.text) {
              const data = JSON.parse(content.text);
              if (data.success) {
                console.log('\n✅ SUCCESS:', JSON.stringify(data.result || data, null, 2));
              } else {
                console.log('\n❌ FAILURE:', data.error);
              }
            }
          }
        }
      } catch (e) {}
    }
  }

    // Send commands with delays
    console.log('Spawning server on port', ANVIL_PORT);
    console.log('Sending initialize...');
    server.stdin.write(JSON.stringify(commands.initialize) + '\n');

    setTimeout(() => {
      console.log('Sending list_tabs...');
      server.stdin.write(JSON.stringify(commands.list_tabs) + '\n');
    }, 200);

    setTimeout(() => {
      console.log('Sending get_page_state...');
      server.stdin.write(JSON.stringify(commands.get_page_state) + '\n');
    }, 400);

    setTimeout(() => {
      console.log('Sending perceive...');
      server.stdin.write(JSON.stringify(commands.perceive) + '\n');
    }, 600);

    setTimeout(() => {
      console.log('Closing server...');
      server.stdin.end();
    }, 1000);
  });
}

runTest().then(result => {
  console.log('\n=== TEST COMPLETE ===');
  process.exit(result.output ? 0 : 1);
}).catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
