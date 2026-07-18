#!/bin/bash
cd /Volumes/Storage/A-TEAM/open-anvil/mcp-server

# Send initialize, wait for response, then send list_tabs
{
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}'
  sleep 0.1
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_tabs","arguments":{}}}'
} | node server.js 2>&1
