#!/usr/bin/env node
// Writes catalog/index.yaml from the entries in catalog/exercises/: node scripts/build-catalog-index.mjs
// Run it after changing an entry. Needs no npm ci: it uses only tools/catalog.mjs and core/.

import { writeFileSync } from 'node:fs';
import { buildIndex } from '../core/catalog.mjs';
import { loadCatalog } from '../tools/catalog.mjs';

const catalog = new URL('../catalog/', import.meta.url);
const loaded = loadCatalog(catalog);
if ('error' in loaded) {
  console.error(loaded.error);
  process.exitCode = 1;
} else {
  writeFileSync(new URL('index.yaml', catalog), buildIndex(loaded.catalog));
}
