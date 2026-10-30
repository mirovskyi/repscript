// The training guidelines as data for the program report: the targets, the major groups, the counting
// weights and the corridors, built from the texts of targets.yaml and corridors.yaml. No I/O, like the
// rest of core/. The full checks of the files are schema/guidelines.test.mjs; this module checks only the
// shape the count relies on.

import { parseCatalogFile } from './catalog.mjs';

/** @typedef {import('./catalog.mjs').Catalog} Catalog */
/** @typedef {import('./catalog.mjs').CatalogFile} CatalogFile */

/**
 * What a unit is measured for: a target, a major group, a block, or an exercise of a workout.
 * @type {Record<string, 'target' | 'group' | 'block' | 'exercise'>}
 */
export const UNITS = {
  fractional_sets_per_week: 'target',
  fractional_sessions_per_week: 'target',
  days_involved_per_week: 'group',
  reps_per_set: 'block',
  rest_seconds: 'block',
  exercise_sets_per_workout: 'exercise',
};

/**
 * @typedef {object} Band
 * @property {number} from
 * @property {number | undefined} to undefined for the last band
 * @property {string} label
 * @property {boolean} finding
 * @property {string} description
 * @property {{ key: string, at: string }[]} cites
 */

/**
 * @typedef {object} Corridor
 * @property {string} id
 * @property {string | undefined} goal undefined: the corridor applies to every program
 * @property {string} unit a key of UNITS
 * @property {string[]} subjects the targets or groups it measures, none for a unit per block or per
 *   exercise of a workout
 * @property {string[]} extrapolated the subjects its sources did not measure
 * @property {string | undefined} extrapolation
 * @property {Band[]} bands
 */

/**
 * @typedef {object} Guidelines
 * @property {{ primary: number, secondary: number }} weights what a set counts for a target that a
 *   primary or only a secondary muscle reaches
 * @property {{ id: string, nodes: string[] }[]} targets in file order
 * @property {{ id: string, targets: string[] }[]} groups the major groups, in file order
 * @property {Corridor[]} corridors in file order
 * @property {Map<string, Set<string>>} reach every key of the muscle dictionary, with the targets it
 *   reaches in target order
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isMapping(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {unknown} value @returns {value is string[]} */
function isStrings(value) {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

/** @param {unknown} value @returns {value is number} */
function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * The one throw for a guideline file the report cannot use.
 * @param {string} file
 * @param {string} message
 * @returns {never}
 */
function fail(file, message) {
  throw new Error(`${file}: ${message}`);
}

/**
 * Builds the guidelines from the texts of the targets and corridors files. Throws an Error naming the
 * file when one is not valid YAML or lacks the shape the count relies on; anything deeper is the
 * guideline checks' job.
 * @param {{ targets: CatalogFile, corridors: CatalogFile }} files
 * @param {Catalog} catalog
 * @returns {Guidelines}
 */
export function buildGuidelines(files, catalog) {
  const { weights, targets, groups } = readTargets(files.targets);
  const corridors = readCorridors(files.corridors);
  return { weights, targets, groups, corridors, reach: reachMap(targets, catalog) };
}

/**
 * What is wrong with a catalog entry's muscles for the count, which reads them while the validator does
 * not: muscles that are not a mapping, or a primary or a present secondary that is not a list of keys of
 * the muscle dictionary. The catalog checks report the rest.
 * @param {Record<string, unknown>} entry
 * @param {Guidelines} guidelines
 * @returns {string | undefined} undefined for usable muscles, or none
 */
export function musclesProblem(entry, { reach }) {
  if (!('muscles' in entry)) return undefined;
  const { muscles } = entry;
  if (!isMapping(muscles)) return 'muscles is not a mapping.';
  for (const field of ['primary', 'secondary']) {
    if (field === 'secondary' && !('secondary' in muscles)) continue;
    const keys = muscles[field];
    if (!isStrings(keys) || !keys.every(key => reach.has(key))) return `muscles.${field} is not a list of muscle keys.`;
  }
  return undefined;
}

/** @param {CatalogFile} targetsFile */
function readTargets(targetsFile) {
  const { file } = targetsFile;
  const data = parseCatalogFile(targetsFile);
  if (!isMapping(data)) fail(file, 'the top level is not a mapping.');
  const counting = isMapping(data.counting) ? data.counting : {};
  for (const weight of ['primary', 'secondary'])
    if (!isNumber(counting[weight])) fail(file, `counting.${weight} is not a number.`);
  if (!Array.isArray(data.targets)) fail(file, 'targets is not a list.');
  const groupList = isMapping(data.major_groups) ? data.major_groups.groups : undefined;
  if (!Array.isArray(groupList)) fail(file, 'major_groups.groups is not a list.');

  const targets = data.targets.map((item, i) => {
    if (!isMapping(item) || typeof item.id !== 'string') fail(file, `targets[${i}] is not a mapping with a string id.`);
    if (!isStrings(item.nodes)) fail(file, `target ${item.id}: nodes is not a list of strings.`);
    return { id: item.id, nodes: item.nodes };
  });
  const groups = groupList.map((item, i) => {
    if (!isMapping(item) || typeof item.id !== 'string')
      fail(file, `major_groups.groups[${i}] is not a mapping with a string id.`);
    if (!isStrings(item.targets)) fail(file, `group ${item.id}: targets is not a list of strings.`);
    return { id: item.id, targets: item.targets };
  });
  const weights = { primary: Number(counting.primary), secondary: Number(counting.secondary) };
  return { weights, targets, groups };
}

/**
 * @param {CatalogFile} corridorsFile
 * @returns {Corridor[]}
 */
function readCorridors(corridorsFile) {
  const { file } = corridorsFile;
  const data = parseCatalogFile(corridorsFile);
  if (!Array.isArray(data)) fail(file, 'the top level is not a list.');
  return data.map((item, i) => {
    if (!isMapping(item) || typeof item.id !== 'string') fail(file, `[${i}] is not a mapping with a string id.`);
    const where = `corridor ${item.id}`;
    const { unit } = item;
    if (typeof unit !== 'string' || !Object.hasOwn(UNITS, unit))
      fail(file, `${where}: unit is not one the report counts.`);
    const kind = UNITS[unit];
    /** @type {string[]} */
    let subjects = [];
    if (kind === 'target' || kind === 'group') {
      const field = `${kind}s`;
      const listed = item[field];
      if (!isStrings(listed)) fail(file, `${where}: ${field} is not a list of strings.`);
      subjects = listed;
    }
    for (const field of ['goal', 'extrapolation'])
      if (field in item && typeof item[field] !== 'string') fail(file, `${where}: ${field} is not a string.`);
    if ('extrapolated' in item && !isStrings(item.extrapolated))
      fail(file, `${where}: extrapolated is not a list of strings.`);
    // The report marks an extrapolated subject only together with the reason it prints.
    if ('extrapolated' in item && !('extrapolation' in item))
      fail(file, `${where}: extrapolated without extrapolation.`);
    const list = item.bands;
    if (!Array.isArray(list) || list.length === 0) fail(file, `${where}: bands is not a list of at least one band.`);
    const bands = list.map((band, k) => readBand(band, `${where} bands[${k}]`, k === list.length - 1, file));
    return {
      id: item.id,
      goal: /** @type {string | undefined} */ (item.goal),
      unit,
      subjects,
      extrapolated: /** @type {string[] | undefined} */ (item.extrapolated) ?? [],
      extrapolation: /** @type {string | undefined} */ (item.extrapolation),
      bands,
    };
  });
}

/**
 * @param {unknown} band
 * @param {string} where
 * @param {boolean} last
 * @param {string} file
 * @returns {Band}
 */
function readBand(band, where, last, file) {
  if (!isMapping(band)) fail(file, `${where}: not a mapping.`);
  if (!isNumber(band.from)) fail(file, `${where}: from is not a number.`);
  if (!last && !isNumber(band.to)) fail(file, `${where}: to is not a number.`);
  for (const field of ['label', 'description'])
    if (typeof band[field] !== 'string') fail(file, `${where}: ${field} is not a string.`);
  if (typeof band.finding !== 'boolean') fail(file, `${where}: finding is not a boolean.`);
  const { cites } = band;
  if (
    !Array.isArray(cites) ||
    !cites.every(cite => isMapping(cite) && typeof cite.key === 'string' && typeof cite.at === 'string')
  )
    fail(file, `${where}: cites is not a list of citations with a string key and at.`);
  return {
    from: band.from,
    // The last band is open: whatever lies above its from falls in it.
    to: last ? undefined : /** @type {number} */ (band.to),
    label: /** @type {string} */ (band.label),
    finding: band.finding,
    description: /** @type {string} */ (band.description),
    cites: cites.map(cite => ({ key: String(cite.key), at: String(cite.at) })),
  };
}

/**
 * The targets each muscle key reaches: a key reaches a target when it is one of the target's nodes, lies
 * under one of them in the muscle dictionary, or has one of them under it.
 * @param {{ id: string, nodes: string[] }[]} targets
 * @param {Catalog} catalog
 * @returns {Map<string, Set<string>>}
 */
function reachMap(targets, catalog) {
  /** @type {Map<string, string>} */
  const parents = new Map();
  for (const [key, { children }] of catalog.muscles) for (const child of children) parents.set(child, key);
  /** @type {Map<string, Set<string>>} */
  const reach = new Map([...catalog.muscles.keys()].map(key => [key, new Set()]));
  /** @param {string} key @param {string} target */
  const add = (key, target) => {
    const set = reach.get(key) ?? new Set();
    set.add(target);
    reach.set(key, set);
  };
  /** @param {string} key @param {string} target */
  const addUnder = (key, target) => {
    add(key, target);
    for (const child of catalog.muscles.get(key)?.children ?? []) addUnder(child, target);
  };
  for (const { id, nodes } of targets) {
    for (const node of nodes) {
      addUnder(node, id);
      for (let parent = parents.get(node); parent !== undefined; parent = parents.get(parent)) add(parent, id);
    }
  }
  return reach;
}
