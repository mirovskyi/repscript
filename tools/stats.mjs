#!/usr/bin/env node
// Reports the numbers of Repscript program files and their findings: node tools/stats.mjs <file>...
// Prints a report per file and exits with 1 if any file has a validator error; a finding never changes
// the exit code. Never modifies files.

import { readFileSync } from 'node:fs';
import { formatStats, programStats } from '../core/stats.mjs';
import { checkProgram, formatIssues } from '../core/validate.mjs';
import { loadCatalog, loadGuidelines } from './catalog.mjs';
import { readProgram } from './program.mjs';

/** @typedef {import('../core/catalog.mjs').Catalog} Catalog */
/** @typedef {import('../core/guidelines.mjs').Guidelines} Guidelines */

const schema = JSON.parse(readFileSync(new URL('../schema/repscript.schema.json', import.meta.url), 'utf8'));
const NO_NUMBERS = 'No numbers: fix the errors above first.\n';

/**
 * The catalog and the guidelines, or the two error lines of the first that cannot be read.
 * @returns {{ catalog: Catalog, guidelines: Guidelines } | { error: string }}
 */
function load() {
  const dir = new URL('../catalog/', import.meta.url);
  const loaded = loadCatalog(dir);
  // As with the branch that prints the error below, an error here occurs only in the tests' copies.
  /* node:coverage ignore next */
  if ('error' in loaded) return loaded;
  const read = loadGuidelines(dir, loaded.catalog);
  /* node:coverage ignore next */
  if ('error' in read) return read;
  return { catalog: loaded.catalog, guidelines: read.guidelines };
}

/**
 * A file's report body: the stats of a valid program, or the validator's report and why there are no
 * numbers.
 * @param {string} file
 * @param {Catalog} catalog
 * @param {Guidelines} guidelines
 * @returns {{ text: string, failed: boolean }}
 */
function report(file, catalog, guidelines) {
  const read = readProgram(file);
  if ('issue' in read) return { text: formatIssues([read.issue]) + NO_NUMBERS, failed: true };
  const { issues, data, lineOf } = checkProgram(read.source, schema, catalog);
  // Warnings do not stop the count and are not printed: tools/validate.mjs shows them.
  if (issues.some(issue => issue.severity === 'error'))
    return { text: formatIssues(issues) + NO_NUMBERS, failed: true };
  return { text: formatStats(programStats(data, lineOf, catalog, guidelines)), failed: false };
}

const files = process.argv.slice(2);
const loaded = load();
if (!files.length) {
  console.error('Usage: node tools/stats.mjs <file>...');
  process.exitCode = 1;
}
// The broken-catalog and broken-guidelines tests in tools/stats.test.mjs run a copy of this tool.
// Coverage drops the copy's file once the test deletes it, so these lines never show as run here.
/* node:coverage ignore next 4 */
else if ('error' in loaded) {
  console.error(loaded.error);
  process.exitCode = 1;
} else {
  for (const file of files) {
    const { text, failed } = report(file, loaded.catalog, loaded.guidelines);
    if (failed) process.exitCode = 1;
    process.stdout.write(`${file}\n${text}`);
  }
}
