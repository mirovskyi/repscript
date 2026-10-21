// Exercise checks: a program's own exercises, each block's exercise reference and each load's implement.
// Works on the same plain data as checkRules() and returns issues in the same shape.
// A value of the wrong type is skipped: the schema check already reports it.

import { entryNames, normalizeName } from './catalog.mjs';
import { closest } from './schema.mjs';

/** @typedef {import('./rules.mjs').RuleIssue} RuleIssue */
/** @typedef {import('./catalog.mjs').Catalog} Catalog */

const ID_FORM = /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)*$/;

/**
 * An own id a hint may suggest: one in the id form starting with my. An entry with any other id gets its
 * own error, and suggesting that id would only pass the mistake on.
 * @param {string} id
 */
function isOwnId(id) {
  return ID_FORM.test(id) && id.startsWith('my.');
}
/**
 * Field descriptions from schema/repscript.schema.json that rules give as hints. core/ cannot read the
 * schema itself; schema/catalog.test.mjs checks that these match it.
 */
export const DESCRIPTIONS = {
  names:
    "The exercise's names by language: a mapping from a two-letter language code to the name, with at least one name. Example: names: {en: Towel pull-up, de: Handtuch-Klimmzug}",
  muscles:
    'The muscles the exercise works: primary for those that do the work, secondary for those that help, each a list of keys from catalog/muscles.yaml. Example: muscles: {primary: [lats], secondary: [biceps]}',
  replaced_by:
    'The id of the exercise that replaces this one, together with deprecated: true. Example: replaced_by: pullup.wide',
};
const INDEX =
  "Find the exercise's id in catalog/index.yaml. If it is not there, describe the exercise in exercises with an id starting with my., e.g. my.towel_pullup.";

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isMapping(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} data the program as plain values
 * @param {Catalog} catalog
 * @returns {RuleIssue[]}
 */
export function checkExercises(data, catalog) {
  /** @type {RuleIssue[]} */
  const issues = [];
  if (!isMapping(data)) return issues;
  const { own, firstIndex } = ownExercises(data);
  /** @type {Map<string, string>} a normalized name or alias to the own exercise that has it first */
  const ownNames = new Map();
  for (const [id, entry] of own) {
    if (entry.deprecated === true || !isOwnId(id)) continue;
    for (const { name } of entryNames(entry)) {
      const key = normalizeName(name);
      // A name of only punctuation normalizes to nothing and must not match every other such name.
      if (key && !ownNames.has(key)) ownNames.set(key, id);
    }
  }
  /** @param {string} id */
  const lookup = id => catalog.exercises.get(id) ?? own.get(id);

  /** @type {EntryContext} */
  const context = { catalog, scope: 'program', own, firstIndex };
  if (Array.isArray(data.exercises)) {
    for (const [i, entry] of data.exercises.entries()) {
      if (isMapping(entry)) issues.push(...checkEntry(entry, ['exercises', i], context));
    }
  }
  for (const { block, path } of blocks(data)) {
    if (typeof block.exercise === 'string') {
      const issue = referenceIssue(block.exercise, { catalog, own, ownNames, lookup });
      if (issue) issues.push({ ...issue, path: [...path, 'exercise'], value: block.exercise });
    }
    const load = block.load;
    if (isMapping(load) && typeof load.implement === 'string') {
      const issue = equipmentIssue(load.implement, catalog);
      if (issue) issues.push({ ...issue, path: [...path, 'load', 'implement'], value: load.implement });
    }
  }
  return issues;
}

/**
 * The equipment keys a program needs, sorted: the equipment of every known exercise its blocks reference,
 * own ones included, plus every implement. An exercise whose equipment is unknown adds nothing.
 * @param {unknown} data the program as plain values
 * @param {Catalog} catalog
 * @returns {string[]}
 */
export function programEquipment(data, catalog) {
  if (!isMapping(data)) return [];
  const { own } = ownExercises(data);
  /** @type {Set<string>} */
  const needed = new Set();
  /** @param {unknown} key */
  const add = key => typeof key === 'string' && needed.add(key);
  for (const { block } of blocks(data)) {
    const { exercise, load } = block;
    const entry = typeof exercise === 'string' ? (catalog.exercises.get(exercise) ?? own.get(exercise)) : undefined;
    if (Array.isArray(entry?.equipment)) entry.equipment.forEach(add);
    if (isMapping(load)) add(load.implement);
  }
  return [...needed].sort();
}

/**
 * The program's own exercises by id, the first entry winning for a repeated id, and that entry's index.
 * @param {Record<string, unknown>} data
 */
function ownExercises(data) {
  /** @type {Map<string, Record<string, unknown>>} */
  const own = new Map();
  /** @type {Map<string, number>} */
  const firstIndex = new Map();
  if (!Array.isArray(data.exercises)) return { own, firstIndex };
  for (const [i, entry] of data.exercises.entries()) {
    if (isMapping(entry) && typeof entry.id === 'string' && !own.has(entry.id)) {
      own.set(entry.id, entry);
      firstIndex.set(entry.id, i);
    }
  }
  return { own, firstIndex };
}

/**
 * @typedef {object} EntryContext
 * @property {Catalog} catalog
 * @property {'program' | 'catalog'} scope
 * @property {Map<string, Record<string, unknown>>} [own] program scope: own exercises by id
 * @property {Map<string, number>} [firstIndex] program scope: the index of the first entry with each id
 * @property {string} [fileName] catalog scope: the entry file's name, which must be its id with .yaml
 */

/**
 * Checks an exercise entry: a program's own exercise, or a catalog file with the catalog's stricter rules.
 * @param {Record<string, unknown>} entry
 * @param {(string|number)[]} path the entry's path, empty for a catalog file
 * @param {EntryContext} context
 * @returns {RuleIssue[]}
 */
export function checkEntry(entry, path, context) {
  /** @type {RuleIssue[]} */
  const issues = [];
  const { catalog, scope } = context;
  const { id } = entry;
  if (typeof id === 'string') {
    const issue = idIssue(id, path, context);
    if (issue) issues.push({ ...issue, path: [...path, 'id'], value: id });
  }

  if (scope === 'catalog') {
    if (isMapping(entry.names)) {
      for (const code of ['en', 'ru']) {
        if (!Object.hasOwn(entry.names, code)) {
          issues.push({
            severity: 'error',
            path: [...path, 'names', code],
            message: `A catalog entry needs a name in ${code}.`,
            hint: DESCRIPTIONS.names,
          });
        }
      }
    }
    if (!Object.hasOwn(entry, 'muscles'))
      issues.push({
        severity: 'error',
        path: [...path, 'muscles'],
        message: 'A catalog entry needs muscles.',
        hint: DESCRIPTIONS.muscles,
      });
    if (!Object.hasOwn(entry, 'equipment')) {
      issues.push({
        severity: 'error',
        path: [...path, 'equipment'],
        message: 'A catalog entry needs equipment.',
        hint: 'List what the exercise needs, or write equipment: [] when it needs nothing.',
      });
    }
    // catalog.names holds the first entry in id order to have each name, deprecated entries left out, so
    // another id there is an earlier entry. This holds when the catalog was built from the files this
    // entry is one of, as the catalog checks build it.
    if (entry.deprecated !== true) {
      for (const { name, at } of entryNames(entry)) {
        const owner = catalog.names.get(normalizeName(name));
        if (owner !== undefined && owner !== id) {
          issues.push({
            severity: 'error',
            path: [...path, ...at],
            value: name,
            message: `The catalog entry ${owner} already has a matching name.`,
            hint: 'Give each catalog exercise its own names. Keep a shared name as an alias of one entry only.',
          });
        }
      }
    }
  } else {
    const match = entryNames(entry).find(({ name }) => catalog.names.has(normalizeName(name)));
    if (match) {
      const same = catalog.names.get(normalizeName(match.name));
      issues.push({
        severity: 'warning',
        path: [...path, ...match.at],
        value: match.name,
        message: `The catalog has this exercise: ${same}.`,
        hint: `If it is the same exercise, remove this entry and write exercise: ${same}. Otherwise give it a name that tells it apart.`,
      });
    }
  }

  const { muscles, equipment } = entry;
  if (isMapping(muscles)) {
    for (const part of ['primary', 'secondary']) {
      const keys = muscles[part];
      if (!Array.isArray(keys)) continue;
      for (const [k, key] of keys.entries()) {
        const issue = typeof key === 'string' ? muscleIssue(key, context) : undefined;
        if (issue) issues.push({ ...issue, path: [...path, 'muscles', part, k], value: key });
      }
    }
  }
  if (Array.isArray(equipment)) {
    for (const [k, key] of equipment.entries()) {
      const issue = typeof key === 'string' ? equipmentIssue(key, catalog) : undefined;
      if (issue) issues.push({ ...issue, path: [...path, 'equipment', k], value: key });
    }
  }

  // replaced_by counts as present when its key is there, whatever its value. A deprecated other than
  // true is the schema's to report: deprecated: false needs no replaced_by.
  if (!Object.hasOwn(entry, 'deprecated') || entry.deprecated === true) {
    const deprecated = entry.deprecated === true;
    const replaced = Object.hasOwn(entry, 'replaced_by');
    if (deprecated && !replaced) {
      issues.push({
        severity: 'error',
        path,
        message: 'The entry has deprecated without replaced_by.',
        hint: 'Add replaced_by with the id of the exercise that replaces this one.',
      });
    } else if (replaced && !deprecated) {
      issues.push({
        severity: 'error',
        path,
        message: 'The entry has replaced_by without deprecated: true.',
        hint: 'Add deprecated: true, or remove replaced_by.',
      });
    }
  }
  const target = entry.replaced_by;
  if (typeof target === 'string' && !find(target, context)) {
    const ids = [...catalog.exercises.keys()];
    if (scope === 'program') ids.push(...[...(context.own?.keys() ?? [])].filter(isOwnId));
    const near = closest(target, ids.sort());
    issues.push({
      severity: 'error',
      path: [...path, 'replaced_by'],
      value: target,
      message: scope === 'program' ? 'No exercise has this id.' : 'No catalog exercise has this id.',
      hint: near ? `Did you mean ${near}?` : DESCRIPTIONS.replaced_by,
    });
  }
  // A repeated own id names its first entry, so a later one is on no chain.
  const repeated = scope === 'program' && typeof id === 'string' && context.firstIndex?.get(id) !== path[1];
  const cycle = repeated ? undefined : replacementCycle(entry, context);
  if (cycle) {
    issues.push({
      severity: 'error',
      path,
      message: `The replacements form a cycle: ${cycle.join(', ')}.`,
      hint: 'End the chain at an exercise that is not deprecated.',
    });
  }
  return issues;
}

/**
 * An exercise an entry may name: in a program a catalog or own exercise, in the catalog a catalog one.
 * @param {string} id
 * @param {EntryContext} context
 */
function find(id, { catalog, own }) {
  return catalog.exercises.get(id) ?? own?.get(id);
}

/**
 * The ids from a deprecated entry along replaced_by back to itself, when the chain is a cycle through
 * it. A chain that only leads into a cycle elsewhere gives nothing: that cycle is reported at its own
 * entries.
 * @param {Record<string, unknown>} entry
 * @param {EntryContext} context
 * @returns {string[] | undefined}
 */
function replacementCycle(entry, context) {
  const start = entry.id;
  if (typeof start !== 'string') return undefined;
  const ids = [start];
  let current = entry;
  while (current.deprecated === true && typeof current.replaced_by === 'string') {
    const next = current.replaced_by;
    if (next === start) return [...ids, next];
    const found = ids.includes(next) ? undefined : find(next, context);
    if (!found) return undefined;
    ids.push(next);
    current = found;
  }
  return undefined;
}

/**
 * A muscle key that is not in the dictionary, or a group in a catalog entry, which names the muscles
 * themselves.
 * @param {string} key
 * @param {EntryContext} context
 * @returns {Omit<RuleIssue, 'path'> | undefined}
 */
function muscleIssue(key, { catalog, scope }) {
  const muscle = catalog.muscles.get(key);
  if (muscle && (scope === 'program' || !muscle.group)) return undefined;
  if (muscle) {
    return {
      severity: 'error',
      message: 'This is a muscle group: a catalog entry names the muscles themselves.',
      hint: `Write one of its muscles: ${muscle.children.join(', ')}.`,
    };
  }
  const keys = [...catalog.muscles].filter(([, { group }]) => scope === 'program' || !group).map(([k]) => k);
  return {
    severity: 'error',
    message: 'Unknown muscle key.',
    hint: keyHint(key, keys, 'Muscle keys (catalog/muscles.yaml)'),
  };
}

/**
 * @param {string} key
 * @param {Catalog} catalog
 * @returns {Omit<RuleIssue, 'path'> | undefined}
 */
function equipmentIssue(key, catalog) {
  if (catalog.equipment.has(key)) return undefined;
  return {
    severity: 'error',
    message: 'Unknown equipment key.',
    hint: keyHint(key, [...catalog.equipment], 'Equipment keys (catalog/equipment.yaml)'),
  };
}

/**
 * "Did you mean" for the closest key, else every key in dictionary order.
 * @param {string} key
 * @param {string[]} keys in dictionary order
 * @param {string} label
 */
function keyHint(key, keys, label) {
  const near = closest(key, [...keys].sort());
  return near ? `Did you mean ${near}?` : `${label}: ${keys.join(', ')}.`;
}

/**
 * The one problem of an entry's id, if any.
 * @param {string} id
 * @param {(string|number)[]} path
 * @param {EntryContext} context
 * @returns {Omit<RuleIssue, 'path'> | undefined}
 */
function idIssue(id, path, { catalog, scope, firstIndex, fileName }) {
  const form = 'An exercise id is lowercase Latin letters, digits, _ and dots, starting with a letter.';
  if (scope === 'catalog') {
    if (!ID_FORM.test(id)) {
      return {
        severity: 'error',
        message: form,
        hint: 'Catalog ids name the movement, then a variant after a dot, e.g. id: row.dumbbell',
      };
    }
    if (id.startsWith('my.')) {
      return {
        severity: 'error',
        message: 'my. ids are for own exercises in programs, not for the catalog.',
        hint: 'Remove my. from the id and from the file name.',
      };
    }
    if (fileName !== `${id}.yaml`) {
      return {
        severity: 'error',
        message: `The file is named ${fileName}, but the id is ${id}.`,
        hint: `Name the file ${id}.yaml, or change the id.`,
      };
    }
  } else {
    if (!ID_FORM.test(id))
      return { severity: 'error', message: form, hint: 'Own exercise ids start with my., e.g. id: my.towel_pullup' };
    if (catalog.exercises.has(id)) {
      return {
        severity: 'error',
        message: 'This is a catalog exercise: changing catalog entries in a program is not supported yet.',
        hint: `Remove this entry and write exercise: ${id} in the blocks, or give your own variant an id starting with my.`,
      };
    }
    if (!id.startsWith('my.')) {
      return {
        severity: 'error',
        message: "An own exercise's id starts with my.",
        hint: `Write id: my.${id}, and use that id in the blocks.`,
      };
    }
    const first = firstIndex?.get(id);
    if (first !== path[1])
      return {
        severity: 'error',
        message: `exercises[${first}] already has this id.`,
        hint: 'Give each exercise its own id.',
      };
  }
  return undefined;
}

/**
 * Every block that is a mapping, with its path.
 * @param {Record<string, unknown>} data
 */
function* blocks(data) {
  if (!Array.isArray(data.workouts)) return;
  for (const [i, workout] of data.workouts.entries()) {
    if (!isMapping(workout) || !Array.isArray(workout.blocks)) continue;
    for (const [j, block] of workout.blocks.entries()) {
      if (isMapping(block)) yield { block, path: ['workouts', i, 'blocks', j] };
    }
  }
}

/**
 * @typedef {object} ReferenceContext
 * @property {Catalog} catalog
 * @property {Map<string, Record<string, unknown>>} own
 * @property {Map<string, string>} ownNames
 * @property {(id: string) => Record<string, unknown> | undefined} lookup
 */

/**
 * The one issue of a block's exercise, if any, from the first case that applies.
 * @param {string} value
 * @param {ReferenceContext} context
 * @returns {Omit<RuleIssue, 'path'> | undefined}
 */
function referenceIssue(value, { catalog, own, ownNames, lookup }) {
  const known = lookup(value);
  if (known) return known.deprecated === true ? deprecatedWarning(value, lookup) : undefined;

  // Names come before any test of the id form: agents write one-word names in that form (pushups).
  const key = normalizeName(value);
  const named = catalog.names.get(key) ?? ownNames.get(key);
  if (named)
    return { severity: 'error', message: 'The exercise needs an id, not a name.', hint: `Write exercise: ${named}.` };

  const lower = value.toLowerCase();
  if (lookup(lower))
    return { severity: 'error', message: 'Exercise ids are lowercase.', hint: `Write exercise: ${lower}.` };

  if (value.startsWith('my.')) {
    const near = closest(value, [...own.keys()].filter(isOwnId).sort());
    let hint = `Did you mean ${near}?`;
    if (!near) {
      // The value goes into the example only when it is a valid id: copying my.Box-Jump would give the
      // entry an id error next round.
      hint = ID_FORM.test(value)
        ? `Add an entry with this id and the exercise's name to exercises, e.g. {id: ${value}, names: {en: <the exercise's name>}}`
        : "Add an entry to exercises with an id of lowercase Latin letters, digits, _ and dots, starting with my., and the exercise's name, and write the same id here, e.g. {id: my.towel_pullup, names: {en: <the exercise's name>}}";
    }
    return { severity: 'error', message: 'This own exercise is not described in exercises.', hint };
  }

  if (ID_FORM.test(value)) {
    const near = own.has(`my.${value}`) ? `my.${value}` : nearestCatalogId(value, catalog);
    return {
      severity: 'error',
      message: 'No exercise in the catalog has this id.',
      hint: near ? `Did you mean ${near}?` : INDEX,
    };
  }

  return {
    severity: 'error',
    message: 'The exercise needs an id, not a name, and no exercise has this name.',
    hint: INDEX,
  };
}

/**
 * The closest catalog id that is not deprecated, among those of the same movement (the first dot-separated
 * part) when there are any; else the longest id made of the value's leading parts.
 * @param {string} value
 * @param {Catalog} catalog
 */
function nearestCatalogId(value, catalog) {
  const current = [...catalog.exercises].filter(([, entry]) => entry.deprecated !== true).map(([id]) => id);
  const movement = value.split('.')[0];
  const same = current.filter(id => id.split('.')[0] === movement);
  const near = closest(value, same.length ? same : current);
  if (near) return near;
  const parts = value.split('.');
  while (parts.length > 1) {
    parts.pop();
    const shorter = parts.join('.');
    if (current.includes(shorter)) return shorter;
  }
  return undefined;
}

/**
 * The warning for a deprecated exercise, naming where its replaced_by chain leads: the first exercise
 * that is not deprecated, the last existing one, or on a cycle the last id before it repeats.
 * @param {string} id
 * @param {(id: string) => Record<string, unknown> | undefined} lookup
 * @returns {Omit<RuleIssue, 'path'>}
 */
function deprecatedWarning(id, lookup) {
  /** @type {string | undefined} */
  let replacement;
  const seen = new Set([id]);
  let entry = lookup(id);
  while (entry?.deprecated === true) {
    const next = entry.replaced_by;
    if (typeof next !== 'string' || !lookup(next) || seen.has(next)) break;
    replacement = next;
    seen.add(next);
    entry = lookup(next);
  }
  if (replacement) {
    return {
      severity: 'warning',
      message: `This exercise is deprecated and replaced by ${replacement}.`,
      hint: `Write exercise: ${replacement}.`,
    };
  }
  const first = lookup(id)?.replaced_by;
  let hint = 'Choose another exercise: its replaced_by names no exercise.';
  if (typeof first !== 'string')
    hint = 'Choose another exercise: it has no replaced_by naming the one that replaces it.';
  else if (first === id) hint = 'Choose another exercise: its replaced_by names the exercise itself.';
  return { severity: 'warning', message: 'This exercise is deprecated.', hint };
}
