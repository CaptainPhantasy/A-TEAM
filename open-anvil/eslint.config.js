import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-const-assign': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'warn',
      'eqeqeq': ['warn', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'warn',
      'no-throw-literal': 'warn',
      'no-empty': 'off',
      'semi': ['warn', 'always'],
      'no-extra-semi': 'warn',
    },
  },
  {
    files: ['extension/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        chrome: 'readonly',
        importScripts: 'readonly',
        globalThis: 'readonly',
        // Functions imported via importScripts in service worker context
        // cdp.js
        attach: 'readonly', execute: 'readonly', send: 'readonly', initAnvilCDP: 'readonly',
        // net-rules.js
        addNetRule: 'readonly', removeNetRule: 'readonly', initNetRules: 'readonly',
        // network-monitor.js
        readNetwork: 'readonly', startNetworkMonitor: 'readonly', stopNetworkMonitor: 'readonly', initNetworkMonitor: 'readonly',
        // checkpoint.js
        checkpointSave: 'readonly', checkpointRestore: 'readonly',
        // workflow-recorder.js
        recordStart: 'readonly', recordStop: 'readonly', recordExport: 'readonly',
      },
    },
  },
  {
    files: ['mcp-server/test/**/*.js', 'mcp-server/test-server.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.min.js',
      'extension/background-floyd-original.js',
      'extension/content-script.js',  // Classic script, uses ESM import syntax
      'extension/dom-observer.js',     // Loaded by content-script
      'extension/vision-tools.js',     // Loaded by content-script
      'extension/accessibility-tree.js',
      'extension/gif-recorder.js',
      'extension/event-streamer.js',
      'extension/ui-gate.js',
      'pipeline/**',
    ],
  },
];
