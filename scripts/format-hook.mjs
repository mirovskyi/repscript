#!/usr/bin/env node
// Claude Code PostToolUse hook (.claude/settings.json): formats a file Claude just edited with Biome.
// Does nothing without npm ci or for files biome.json does not cover, and never fails the edit: CI checks the rest.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BIOME = fileURLToPath(new URL('../node_modules/@biomejs/biome/bin/biome', import.meta.url));

/** @type {unknown} */
let file;
try {
  file = JSON.parse(readFileSync(0, 'utf8')).tool_input?.file_path;
} catch {
  // Not the hook payload: nothing to format.
}
if (typeof file === 'string' && /\.m?js$/.test(file) && existsSync(BIOME)) {
  spawnSync(process.execPath, [BIOME, 'check', '--write', '--no-errors-on-unmatched', file], {
    cwd: ROOT,
    stdio: 'ignore',
  });
}
