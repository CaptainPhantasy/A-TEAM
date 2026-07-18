#!/usr/bin/env node
// generate-token.js — Generate or retrieve the WS auth token for Open Anvil
// Stores in ~/.config/open-anvil/token (or XDG_CONFIG_HOME equivalent)

'use strict';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { homedir } from 'node:os';

const configDir = process.env.XDG_CONFIG_HOME
  ? join(process.env.XDG_CONFIG_HOME, 'open-anvil')
  : join(homedir(), '.config', 'open-anvil');

const tokenFile = join(configDir, 'token');

// Read existing token or generate new one
if (existsSync(tokenFile)) {
  const existing = readFileSync(tokenFile, 'utf-8').trim();
  console.log(existing);
} else {
  mkdirSync(configDir, { recursive: true });
  const token = randomBytes(24).toString('hex');
  writeFileSync(tokenFile, token, { mode: 0o600 });
  console.error(`[generate-token] New token written to ${tokenFile}`);
  console.log(token);
}
