// Reads a program file for the tools that check it. A module, not a command.

import { readFileSync } from 'node:fs';

/**
 * A program file's text, or the one issue that stops it from being checked: it cannot be read, or it is
 * not UTF-8 text.
 * @param {string} file
 * @returns {{ source: string } | { issue: import('../core/validate.mjs').Issue }}
 */
export function readProgram(file) {
  let bytes;
  try {
    bytes = readFileSync(file);
  } catch (error) {
    const message = `Cannot read the file: ${/** @type {Error} */ (error).message}.`;
    return { issue: { severity: 'error', path: '(top level)', message, hint: 'Check the file path.' } };
  }
  try {
    // fatal: rejects Windows-1251 and UTF-16 instead of passing them on as garbled text. UTF-16 without
    // a byte order mark can still decode cleanly, but it is full of NULs, which YAML does not allow.
    const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (source.includes('\0')) throw new Error('NUL in text');
    return { source };
  } catch {
    return {
      issue: {
        severity: 'error',
        path: '(top level)',
        message: 'The file is not UTF-8 text.',
        hint: 'Save the file as UTF-8.',
      },
    };
  }
}
