#!/usr/bin/env node
// Checks Repscript program files: node tools/validate.mjs <file>...
// Prints a report per file and exits with 1 if any file has an error. Never modifies files.

import { readFileSync } from 'node:fs';
import { formatIssues, validate } from '../core/validate.mjs';

const schema = JSON.parse(readFileSync(new URL('../schema/repscript.schema.json', import.meta.url), 'utf8'));

/**
 * @param {string} file
 * @returns {import('../core/validate.mjs').Issue[]}
 */
function checkFile(file) {
  let bytes;
  try {
    bytes = readFileSync(file);
  } catch (error) {
    const message = `Cannot read the file: ${/** @type {Error} */ (error).message}.`;
    return [{ severity: 'error', path: '(top level)', message, hint: 'Check the file path.' }];
  }
  let source;
  try {
    // fatal: rejects Windows-1251 and UTF-16 instead of passing them on as garbled text. UTF-16 without
    // a byte order mark can still decode cleanly, but it is full of NULs, which YAML does not allow.
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (source.includes('\0')) throw new Error('NUL in text');
  } catch {
    return [{ severity: 'error', path: '(top level)', message: 'The file is not UTF-8 text.', hint: 'Save the file as UTF-8.' }];
  }
  return validate(source, schema);
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node tools/validate.mjs <file>...');
  process.exitCode = 1;
}
for (const file of files) {
  const issues = checkFile(file);
  if (issues.some(issue => issue.severity === 'error')) process.exitCode = 1;
  process.stdout.write(`${file}\n${formatIssues(issues)}`);
}
