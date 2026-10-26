// The exercise catalog as data: built from the catalog files' texts, which the caller reads.
// No I/O, like the rest of core/: the tools read a directory, the player gets the texts from its server.

import { Document, isCollection, LineCounter, parseDocument } from '../vendor/yaml.mjs';

/**
 * @typedef {object} CatalogFile
 * @property {string} file the path from the project root, with /, such as catalog/exercises/pullup.wide.yaml
 * @property {string} source the file's text
 */

/**
 * @typedef {object} CatalogFiles
 * @property {CatalogFile[]} exercises
 * @property {CatalogFile} muscles
 * @property {CatalogFile} equipment
 */

/**
 * @typedef {object} Catalog
 * @property {Map<string, Record<string, unknown>>} exercises every entry by id, in id order, deprecated
 *   entries included
 * @property {Map<string, string>} names a normalized name or alias to the id of the first entry in id order
 *   that has it, deprecated entries left out
 * @property {Map<string, { group: boolean, children: string[] }>} muscles every key in dictionary order
 * @property {Set<string>} equipment every key in dictionary order
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isMapping(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Ids compared by code unit, so pullup comes before pullup.wide whatever the locale.
 * @param {string} a
 * @param {string} b
 */
export function compareIds(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The one throw for a catalog file the validator cannot use.
 * @param {string} where the file, with a line when known
 * @param {string} message
 * @returns {never}
 */
function fail(where, message) {
  throw new Error(`${where}: ${message}`);
}

/**
 * Parses a catalog or guideline file with the validator's YAML options. Throws an Error naming the file,
 * with the line of the first YAML error, when it is not valid YAML.
 * @param {CatalogFile} catalogFile
 * @returns {unknown}
 */
export function parseCatalogFile({ file, source }) {
  const lineCounter = new LineCounter();
  const doc = parseDocument(source, {
    lineCounter,
    schema: 'core',
    stringKeys: true,
    prettyErrors: false,
    resolveKnownTags: false,
  });
  if (!doc) throw new Error('yaml parseDocument returned no document');
  const [error] = doc.errors;
  if (error) fail(`${file} (line ${lineCounter.linePos(error.pos[0]).line})`, error.message);
  try {
    return doc.toJS();
  } catch (error) {
    return fail(file, /** @type {Error} */ (error).message);
  }
}

/**
 * Builds the catalog from the texts of its files. Throws an Error naming the file when one is not valid
 * YAML or lacks the shape the validator relies on; anything deeper is the catalog checks' job.
 * @param {CatalogFiles} files
 * @returns {Catalog}
 */
export function buildCatalog(files) {
  const entries = files.exercises.map(catalogFile => {
    const entry = parseCatalogFile(catalogFile);
    if (!isMapping(entry) || typeof entry.id !== 'string')
      fail(catalogFile.file, 'expected an exercise entry, a mapping with a string id.');
    return /** @type {Record<string, unknown> & { id: string }} */ (entry);
  });
  entries.sort((a, b) => compareIds(a.id, b.id));

  /** @type {Map<string, string>} */
  const names = new Map();
  for (const entry of entries) {
    if (entry.deprecated === true) continue;
    for (const { name } of entryNames(entry)) {
      const key = normalizeName(name);
      // A name of only punctuation normalizes to nothing and must not match every other such name.
      if (key && !names.has(key)) names.set(key, entry.id);
    }
  }

  /** @type {Catalog['muscles']} */
  const muscles = new Map();
  /**
   * @param {Record<string, unknown>[]} items
   * @param {string} where
   * @param {boolean} group
   */
  const addMuscles = (items, where, group) => {
    for (const [i, item] of items.entries()) {
      const children = item.children ?? [];
      if (!Array.isArray(children)) fail(files.muscles.file, `children of ${item.id} is not a list.`);
      const list = dictionary(children, files.muscles.file, `${where}[${i}].children`);
      muscles.set(/** @type {string} */ (item.id), { group, children: list.map(child => String(child.id)) });
      addMuscles(list, `${where}[${i}].children`, false);
    }
  };
  addMuscles(dictionary(parseCatalogFile(files.muscles), files.muscles.file, ''), '', true);

  const equipment = new Set(
    dictionary(parseCatalogFile(files.equipment), files.equipment.file, '').map(item => String(item.id)),
  );

  return { exercises: new Map(entries.map(entry => [entry.id, entry])), names, muscles, equipment };
}

/**
 * A dictionary's list of items, each checked to be a mapping with a string id.
 * @param {unknown} list
 * @param {string} file
 * @param {string} where the list's path in the file, empty for the top level
 * @returns {Record<string, unknown>[]}
 */
function dictionary(list, file, where) {
  if (!Array.isArray(list)) fail(file, 'expected a list of mappings, each with a string id.');
  for (const [i, item] of list.entries()) {
    if (!isMapping(item) || typeof item.id !== 'string')
      fail(file, `${where}[${i}] is not a mapping with a string id.`);
  }
  return list;
}

/** A key of names that holds a name: a two-letter language code, not an x- field or an unknown field. */
const LANGUAGE = /^[a-z]{2}$/;

/**
 * An entry's names under language codes in key order, then its aliases: the strings among them, each
 * with its path in the entry.
 * @param {Record<string, unknown>} entry
 * @returns {{ name: string, at: (string|number)[] }[]}
 */
export function entryNames(entry) {
  const names = isMapping(entry.names) ? Object.entries(entry.names).filter(([code]) => LANGUAGE.test(code)) : [];
  const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
  return [
    ...names.map(([code, name]) => ({ name, at: ['names', code] })),
    ...aliases.map((name, k) => ({ name, at: ['aliases', k] })),
  ].filter(({ name }) => typeof name === 'string');
}

/**
 * The form in which two exercise names match: NFKC, lowercase, ё as е, words split at every character
 * that is not a letter or a digit, the English plural folded in Latin words, joined with nothing between.
 * @param {string} text
 */
export function normalizeName(text) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replaceAll('ё', 'е')
    .split(/[^\p{L}\p{N}]+/u)
    .map(foldPlural)
    .join('');
}

/**
 * Words are split before folding, so pull-ups gives ups, which must lose its s: hence two letters, not three.
 * @param {string} word
 */
function foldPlural(word) {
  if (!/^[a-z]+$/.test(word)) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (/(?:ch|sh|ss|x)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 2 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/**
 * The text of catalog/index.yaml, which chats read to find ids: the id, the names under language codes,
 * the aliases when there are any, and the equipment of every entry that is not deprecated, in id order.
 * @param {Catalog} catalog
 * @returns {string}
 */
export function buildIndex(catalog) {
  const items = [];
  for (const { id, names, aliases, equipment, deprecated } of catalog.exercises.values()) {
    if (deprecated === true) continue;
    const named = isMapping(names)
      ? Object.fromEntries(Object.entries(names).filter(([code]) => LANGUAGE.test(code)))
      : names;
    items.push(
      Array.isArray(aliases) && aliases.length
        ? { id, names: named, aliases, equipment }
        : { id, names: named, equipment },
    );
  }
  const doc = new Document(items, { aliasDuplicateObjects: false });
  // names and the lists in flow style, one line each.
  for (const item of doc.contents.items)
    for (const pair of item.items) if (isCollection(pair.value)) pair.value.flow = true;
  // On the list rather than the document, which would add a blank line after the comment.
  doc.contents.commentBefore =
    ' Generated from catalog/exercises/ by node scripts/build-catalog-index.mjs.\n Do not edit: change the entries and rebuild.';
  // lineWidth 0: a long name stays on its line. No padding: {en: ...}, not { en: ... }.
  return doc.toString({ lineWidth: 0, flowCollectionPadding: false });
}

/**
 * Whether equipment the user has satisfies what an exercise needs: the same key, or a variant of it
 * (bench.adjustable for bench).
 * @param {string} have
 * @param {string} need
 */
export function equipmentSatisfies(have, need) {
  return have === need || have.startsWith(`${need}.`);
}
