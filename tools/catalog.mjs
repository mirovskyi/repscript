// Reads a catalog directory for the tools, the tests and the scripts. A module, not a command.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from '../core/catalog.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const RESTORE =
  'The catalog comes with the project: restore catalog/ with git checkout -- catalog, or download the project again.';

/**
 * The texts of a catalog directory's files, each with its path from the project root written with /, so
 * reports read the same on Windows. Throws an Error naming the file when one is not UTF-8 text, or when
 * exercises/ holds a file that is not a .yaml entry, which the checks would otherwise skip.
 * @param {URL} dir the directory, with a trailing slash
 * @returns {import('../core/catalog.mjs').CatalogFiles}
 */
export function readCatalogFiles(dir) {
  const path = fileURLToPath(dir);
  /** @param {string} name */
  const pathOf = name => relative(ROOT, join(path, name)).replaceAll('\\', '/');
  /** @param {string} name */
  const read = name => {
    const file = pathOf(name);
    const bytes = readFileSync(join(path, name));
    /** @type {string | undefined} */
    let source;
    try {
      // fatal: a file saved as Windows-1251 fails here instead of reaching the index garbled.
      source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      source = undefined;
    }
    // UTF-16 without a byte order mark decodes, but is full of NULs.
    if (source === undefined || source.includes('\0')) throw new Error(`${file}: the file is not UTF-8 text.`);
    return { file, source };
  };
  const names = readdirSync(join(path, 'exercises')).sort();
  const other = names.find(name => !name.endsWith('.yaml'));
  if (other !== undefined) throw new Error(`${pathOf(`exercises/${other}`)}: entry files are named <id>.yaml.`);
  return {
    exercises: names.map(name => read(`exercises/${name}`)),
    muscles: read('muscles.yaml'),
    equipment: read('equipment.yaml'),
  };
}

/**
 * @param {URL} dir the directory, with a trailing slash
 * @returns {{ catalog: import('../core/catalog.mjs').Catalog } | { error: string }} error: the two lines
 *   tools/validate.mjs prints
 */
export function loadCatalog(dir) {
  try {
    return { catalog: buildCatalog(readCatalogFiles(dir)) };
  } catch (error) {
    return { error: `Cannot read the catalog: ${/** @type {Error} */ (error).message}\n${RESTORE}` };
  }
}
