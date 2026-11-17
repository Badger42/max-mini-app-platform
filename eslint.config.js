const sharedGlobals = {
  Array: 'readonly',
  BigInt: 'readonly',
  Boolean: 'readonly',
  Date: 'readonly',
  Error: 'readonly',
  Infinity: 'readonly',
  Intl: 'readonly',
  JSON: 'readonly',
  Map: 'readonly',
  Math: 'readonly',
  NaN: 'readonly',
  Number: 'readonly',
  Object: 'readonly',
  Promise: 'readonly',
  RangeError: 'readonly',
  ReferenceError: 'readonly',
  RegExp: 'readonly',
  Set: 'readonly',
  String: 'readonly',
  Symbol: 'readonly',
  SyntaxError: 'readonly',
  TypeError: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  WeakMap: 'readonly',
  WeakSet: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  globalThis: 'readonly',
  isFinite: 'readonly',
  parseFloat: 'readonly',
  parseInt: 'readonly',
  queueMicrotask: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly'
}

const browserGlobals = {
  ...sharedGlobals,
  Blob: 'readonly',
  File: 'readonly',
  FormData: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  history: 'readonly',
  location: 'readonly',
  navigator: 'readonly',
  window: 'readonly'
}

const nodeGlobals = {
  ...sharedGlobals,
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  exports: 'readonly',
  module: 'readonly',
  process: 'readonly',
  require: 'readonly'
}

const commonRules = {
  eqeqeq: ['error', 'always'],
  'no-constant-condition': 'error',
  'no-undef': 'error',
  'no-unreachable': 'error',
  'no-unused-vars': ['warn', {
    args: 'none',
    caughtErrors: 'none',
    varsIgnorePattern: '^_'
  }]
}

export default [
  {
    ignores: ['node_modules/**', 'coverage/**', 'dist/**']
  },
  {
    files: ['src/**/*.js', 'examples/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserGlobals
    },
    rules: commonRules
  },
  {
    files: ['tests/**/*.mjs', 'tests/**/*.js', 'type-tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      // Node test files install browser globals on globalThis in their fixtures.
      globals: { ...nodeGlobals, ...browserGlobals }
    },
    rules: commonRules
  }
]
