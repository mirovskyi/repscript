#!/usr/bin/env node
// Checks that vendor/yaml.mjs is exactly the esbuild bundle of the yaml version in package.json, so the
// vendored code has no hand edits and a yaml update (Dependabot) fails CI until the bundle is rebuilt.
// Development only: needs npm ci.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

const ROOT = new URL('..', import.meta.url);
const VENDOR = 'vendor/yaml.mjs';
const ENTRY = 'node_modules/yaml/browser/dist/index.js';

/** @param {string} name */
const versionOf = name => JSON.parse(readFileSync(new URL(`node_modules/${name}/package.json`, ROOT), 'utf8')).version;
const yaml = versionOf('yaml');
const esbuild = versionOf('esbuild');

const vendored = readFileSync(new URL(VENDOR, ROOT), 'utf8');
// The header is the leading comment lines and one blank line after them.
const header = vendored.match(/^(?:\/\/.*\n)+\n/)?.[0] ?? '';
// absWorkingDir: the bundle's // path comments are relative to it.
const built = buildSync({ entryPoints: [ENTRY], absWorkingDir: fileURLToPath(ROOT), bundle: true, format: 'esm', write: false }).outputFiles[0].text;

const problems = [];
if (vendored.includes('\r')) problems.push('it has CRLF line endings');
else {
  if (!header.includes(`// yaml ${yaml} `)) problems.push(`the header does not name yaml ${yaml}`);
  if (!header.includes(`(esbuild ${esbuild})`)) problems.push(`the header does not name esbuild ${esbuild}`);
  if (vendored.slice(header.length) !== built) problems.push(`the code differs from the bundle of yaml ${yaml}`);
}

if (problems.length) {
  console.error(`${VENDOR}: ${problems.join('; ')}.`);
  console.error(`Rebuild it: npx esbuild ${ENTRY} --bundle --format=esm --outfile=${VENDOR}, then restore the header with the new versions.`);
  process.exitCode = 1;
} else {
  console.log(`${VENDOR} matches yaml ${yaml} built with esbuild ${esbuild}.`);
}
