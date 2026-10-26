// Reads a catalog directory for the tools, the tests and the scripts. A module, not a command.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from '../core/catalog.mjs';
import { buildGuidelines, musclesProblem } from '../core/guidelines.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const RESTORE =
  'The catalog comes with the project: restore catalog/ with git checkout -- catalog, or download the project again.';

/**
 * @typedef {object} GuidelineFiles
 * @property {import('../core/catalog.mjs').CatalogFile} references
 * @property {import('../core/catalog.mjs').CatalogFile} targets
 * @property {import('../core/catalog.mjs').CatalogFile} corridors
 */

/**
 * A file's path from the project root, written with / so reports read the same on Windows.
 * @param {string} dir the directory's path
 * @param {string} name the file's path in the directory
 */
function pathOf(dir, name) {
  return relative(ROOT, join(dir, name)).replaceAll('\\', '/');
}

/**
 * Runs a read of the file system. Throws an Error naming the file by its path from the project root, with
 * the error's code, when it fails: the operating system's path would differ between machines.
 * @template T
 * @param {string} file the path from the project root
 * @param {() => T} read
 * @returns {T}
 */
function readOrName(file, read) {
  try {
    return read();
  } catch (error) {
    throw new Error(`${file}: the file cannot be read (${/** @type {NodeJS.ErrnoException} */ (error).code}).`);
  }
}

/**
 * A file's text with its path from the project root. Throws an Error naming the file when it cannot be
 * read or is not UTF-8 text.
 * @param {string} dir the directory's path
 * @param {string} name the file's path in the directory
 * @returns {import('../core/catalog.mjs').CatalogFile}
 */
function readText(dir, name) {
  const file = pathOf(dir, name);
  const bytes = readOrName(file, () => readFileSync(join(dir, name)));
  /** @type {string | undefined} */
  let source;
  try {
    // fatal: a file saved as Windows-1251 fails here instead of reaching the checks or the index garbled.
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    source = undefined;
  }
  // UTF-16 without a byte order mark decodes, but is full of NULs.
  if (source === undefined || source.includes('\0')) throw new Error(`${file}: the file is not UTF-8 text.`);
  return { file, source };
}

/**
 * The texts of a catalog directory's files, each with its path from the project root. Throws an Error
 * naming the file when one cannot be read or is not UTF-8 text, or when exercises/ holds a file that is
 * not a .yaml entry, which the checks would otherwise skip.
 * @param {URL} dir the directory, with a trailing slash
 * @returns {import('../core/catalog.mjs').CatalogFiles}
 */
export function readCatalogFiles(dir) {
  const path = fileURLToPath(dir);
  const names = readOrName(`${pathOf(path, 'exercises')}/`, () => readdirSync(join(path, 'exercises'))).sort();
  const other = names.find(name => !name.endsWith('.yaml'));
  if (other !== undefined) throw new Error(`${pathOf(path, `exercises/${other}`)}: entry files are named <id>.yaml.`);
  return {
    exercises: names.map(name => readText(path, `exercises/${name}`)),
    muscles: readText(path, 'muscles.yaml'),
    equipment: readText(path, 'equipment.yaml'),
  };
}

/**
 * The texts of the guideline files in a catalog directory, each with its path from the project root.
 * Throws an Error naming the file when one cannot be read or is not UTF-8 text. loadCatalog does not read
 * them, so a broken guideline file never stops the validator.
 * @param {URL} dir the directory, with a trailing slash
 * @returns {GuidelineFiles}
 */
export function readGuidelineFiles(dir) {
  const path = fileURLToPath(dir);
  return {
    references: readText(path, 'references.yaml'),
    targets: readText(path, 'targets.yaml'),
    corridors: readText(path, 'corridors.yaml'),
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

/**
 * The guidelines that the program report counts with: only targets.yaml and corridors.yaml, so a broken
 * references.yaml never stops the report. The muscles of every catalog entry are checked too: the count
 * reads them, the validator does not, and an entry file names its id.
 * @param {URL} dir the directory, with a trailing slash
 * @param {import('../core/catalog.mjs').Catalog} catalog
 * @returns {{ guidelines: import('../core/guidelines.mjs').Guidelines } | { error: string }} error: the two
 *   lines tools/stats.mjs prints
 */
export function loadGuidelines(dir, catalog) {
  const path = fileURLToPath(dir);
  let guidelines;
  try {
    const files = { targets: readText(path, 'targets.yaml'), corridors: readText(path, 'corridors.yaml') };
    guidelines = buildGuidelines(files, catalog);
  } catch (error) {
    return { error: `Cannot read the guidelines: ${/** @type {Error} */ (error).message}\n${RESTORE}` };
  }
  for (const [id, entry] of catalog.exercises) {
    const problem = musclesProblem(entry, guidelines);
    if (problem)
      return { error: `Cannot read the catalog: ${pathOf(path, `exercises/${id}.yaml`)}: ${problem}\n${RESTORE}` };
  }
  return { guidelines };
}
