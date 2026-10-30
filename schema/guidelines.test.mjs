import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildCatalog } from '../core/catalog.mjs';
import { buildGuidelines, musclesProblem } from '../core/guidelines.mjs';
import { loadCatalog, loadGuidelines, readCatalogFiles, readGuidelineFiles } from '../tools/catalog.mjs';
import { LineCounter, parse, parseDocument } from '../vendor/yaml.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TEST_CATALOG = new URL('./tests/catalog/', import.meta.url);
const SCHEMA = JSON.parse(readFileSync(new URL('./repscript.schema.json', import.meta.url), 'utf8'));
const GOALS = /** @type {string[]} */ (SCHEMA.properties.goal.enum);

/**
 * Runs a test on a temporary directory, removed afterwards.
 * @param {(dir: string) => void} body
 */
function inTempDir(body) {
  const dir = mkdtempSync(join(tmpdir(), 'repscript-guidelines-'));
  try {
    body(dir);
  } finally {
    rmSync(dir, { recursive: true });
  }
}

test('readGuidelineFiles returns the three texts with their / paths from the project root', () => {
  inTempDir(dir => {
    const texts = { references: '- key: a\n', targets: 'targets: []\n', corridors: '- id: b\n' };
    for (const [name, text] of Object.entries(texts)) writeFileSync(join(dir, `${name}.yaml`), text);
    const fileOf = (/** @type {string} */ name) => relative(ROOT, join(dir, name)).replaceAll('\\', '/');
    assert.deepEqual(readGuidelineFiles(pathToFileURL(`${dir}/`)), {
      references: { file: fileOf('references.yaml'), source: texts.references },
      targets: { file: fileOf('targets.yaml'), source: texts.targets },
      corridors: { file: fileOf('corridors.yaml'), source: texts.corridors },
    });
  });
});

test('readGuidelineFiles names a file that is not UTF-8 text', () => {
  inTempDir(dir => {
    for (const name of ['references', 'targets', 'corridors']) writeFileSync(join(dir, `${name}.yaml`), '[]\n');
    const url = pathToFileURL(`${dir}/`);
    const notUtf8 = `${relative(ROOT, join(dir, 'targets.yaml')).replaceAll('\\', '/')}: the file is not UTF-8 text.`;
    // "names: {ru: Грудь}" with the Cyrillic word in Windows-1251.
    writeFileSync(
      join(dir, 'targets.yaml'),
      Buffer.concat([Buffer.from('names: {ru: '), Buffer.from([0xc3, 0xf0, 0xf3, 0xe4, 0xfc]), Buffer.from('}\n')]),
    );
    assert.throws(() => readGuidelineFiles(url), { message: notUtf8 });
    // Every byte is below 0x80, so it decodes as UTF-8, but with NULs.
    writeFileSync(join(dir, 'targets.yaml'), Buffer.from('targets: []\n', 'utf16le'));
    assert.throws(() => readGuidelineFiles(url), { message: notUtf8 });
  });
});

test('loadCatalog does not read the guideline files', () => {
  inTempDir(dir => {
    cpSync(fileURLToPath(TEST_CATALOG), dir, { recursive: true });
    writeFileSync(join(dir, 'corridors.yaml'), '- id: [hypertrophy\n');
    const result = loadCatalog(pathToFileURL(`${dir}/`));
    assert.ok('catalog' in result, 'error' in result ? result.error : '');
    assert.ok(result.catalog.exercises.has('pushup'));
  });
});

/** A reference key, a target id or a group id. */
const KEY_FORM = /^[a-z][a-z0-9_]*$/;
/** A corridor id, in the exercise id form. */
const ID_FORM = /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)*$/;
/** A key of names that holds a name. */
const LANGUAGE = /^[a-z]{2}$/;
/** What each unit is measured for: targets, groups, a block, or an exercise of a workout. */
const UNITS = /** @type {Record<string, 'targets' | 'groups' | 'block' | 'exercise of a workout'>} */ ({
  fractional_sets_per_week: 'targets',
  fractional_sessions_per_week: 'targets',
  days_involved_per_week: 'groups',
  reps_per_set: 'block',
  rest_seconds: 'block',
  exercise_sets_per_workout: 'exercise of a workout',
});

/** What the guideline check takes for a file that is not valid YAML, which it has reported. */
const UNREAD = Symbol('not valid YAML');

/** @param {unknown} value @returns {value is Record<string, any>} */
function isMapping(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {unknown} value @returns {value is string} */
function isText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/** @param {unknown} value @returns {value is number} */
function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * A value as a problem line shows it. JSON cannot show a list or a mapping that an alias makes hold
 * itself.
 * @param {unknown} value
 */
function show(value) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return '(a value that holds itself)';
  }
}

/**
 * Whether two muscle keys are the same, or one lies under the other in the muscle dictionary: a key
 * reaches a target when it overlaps one of the target's nodes.
 * @param {import('../core/catalog.mjs').Catalog} catalog
 * @param {string} a
 * @param {string} b
 */
function overlap(catalog, a, b) {
  /** @param {string} key @returns {string[]} the key and every key under it */
  const under = key => [key, ...(catalog.muscles.get(key)?.children ?? []).flatMap(under)];
  return under(a).includes(b) || under(b).includes(a);
}

/**
 * Problems in the guideline files against the training-guidelines requirements, as lines of the form
 * <file>: <item>: <problem>, the references first, then the targets, then the corridors.
 * @param {import('../tools/catalog.mjs').GuidelineFiles} files
 * @param {import('../core/catalog.mjs').Catalog} catalog
 * @param {string[]} goals the program goal values
 * @returns {string[]}
 */
function guidelineProblems(files, catalog, goals) {
  /** @type {Record<keyof typeof files, string[]>} */
  const problems = { references: [], targets: [], corridors: [] };
  /** @param {keyof typeof files} which @returns {(item: string, problem: string) => void} */
  const reporter = which => (item, problem) => problems[which].push(`${files[which].file}: ${item}: ${problem}`);

  /**
   * A file's content, read with the options of a catalog file, or UNREAD after reporting why not.
   * @param {keyof typeof files} which
   * @returns {any}
   */
  const parseFile = which => {
    const lineCounter = new LineCounter();
    const doc = parseDocument(files[which].source, {
      lineCounter,
      schema: 'core',
      stringKeys: true,
      prettyErrors: false,
      resolveKnownTags: false,
    });
    if (!doc) throw new Error('yaml parseDocument returned no document');
    const [error] = doc.errors;
    if (error) {
      reporter(which)(`(line ${lineCounter.linePos(error.pos[0]).line})`, error.message);
      return UNREAD;
    }
    try {
      return doc.toJS();
    } catch (error) {
      // An unresolved alias, or too many of them.
      reporter(which)('(top level)', /** @type {Error} */ (error).message);
      return UNREAD;
    }
  };
  const references = parseFile('references');
  const targetsFile = parseFile('targets');
  const corridors = parseFile('corridors');
  // A check that needs another file's content is skipped when that file gave none, so one broken file
  // is reported once instead of at every place that refers to it.
  const referencesRead = Array.isArray(references);
  const citingRead = isMapping(targetsFile) && Array.isArray(corridors);
  // Set when a place that holds citations is not a mapping or a list, so its citations are unknown.
  let citesLost = false;
  const targetsRead = isMapping(targetsFile) && Array.isArray(targetsFile.targets) && targetsFile.targets.length > 0;
  const groupsRead =
    isMapping(targetsFile) &&
    isMapping(targetsFile.major_groups) &&
    Array.isArray(targetsFile.major_groups.groups) &&
    targetsFile.major_groups.groups.length > 0;

  /** @type {(report: (item: string, problem: string) => void, item: string, mapping: Record<string, unknown>, fields: string[]) => void} */
  const closed = (report, item, mapping, fields) => {
    for (const field of Object.keys(mapping)) if (!fields.includes(field)) report(item, `unknown field ${field}`);
  };
  /** @type {(report: (item: string, problem: string) => void, item: string, value: unknown) => void} */
  const names = (report, item, value) => {
    if (value !== undefined && !isMapping(value)) {
      report(item, 'names is not a mapping');
      return;
    }
    const mapping = value ?? {};
    for (const code of Object.keys(mapping)) {
      if (!LANGUAGE.test(code)) report(item, `unknown field names.${code}`);
      else if (code !== 'en' && code !== 'ru' && !isText(mapping[code]))
        report(item, `name in ${code} is not a string`);
    }
    for (const code of ['en', 'ru']) if (!isText(mapping[code])) report(item, `no name in ${code}`);
  };

  const referenceKeys = new Set(
    (Array.isArray(references) ? references : []).filter(isMapping).map(entry => entry.key),
  );
  /** @type {Set<unknown>} */
  const cited = new Set();
  /** @type {(report: (item: string, problem: string) => void, item: string, value: unknown) => void} */
  const cites = (report, item, value) => {
    if (!Array.isArray(value) || value.length === 0) {
      report(item, 'no cites');
      return;
    }
    for (const [i, citation] of value.entries()) {
      const where = `${item} cites[${i}]`;
      if (!isMapping(citation)) {
        report(where, 'not a mapping');
        citesLost = true;
        continue;
      }
      closed(report, where, citation, ['key', 'at']);
      if (typeof citation.key !== 'string') report(where, 'no key');
      else if (referencesRead && !referenceKeys.has(citation.key)) report(where, `unknown key ${citation.key}`);
      cited.add(citation.key);
      if (!isText(citation.at)) report(where, 'no at');
    }
  };

  // targets.yaml
  const target = reporter('targets');
  /** @type {string[]} */
  const targetIds = [];
  /** @type {string[]} */
  const groupIds = [];
  if (!isMapping(targetsFile)) {
    if (targetsFile !== UNREAD) target('(top level)', 'not a mapping');
  } else {
    closed(target, '(top level)', targetsFile, ['counting', 'targets', 'major_groups']);
    for (const field of ['counting', 'targets', 'major_groups'])
      if (!(field in targetsFile)) target('(top level)', `no ${field}`);

    const { counting } = targetsFile;
    if (isMapping(counting)) {
      closed(target, 'counting', counting, ['primary', 'secondary', 'description', 'cites']);
      if (counting.primary !== 1) target('counting', 'primary is not 1');
      if (counting.secondary !== 0.5) target('counting', 'secondary is not 0.5');
      if (!isText(counting.description)) target('counting', 'no description');
      cites(target, 'counting', counting.cites);
    } else if ('counting' in targetsFile) {
      target('counting', 'not a mapping');
      citesLost = true;
    }

    const list = targetsFile.targets;
    if (!Array.isArray(list) && 'targets' in targetsFile) target('targets', 'not a list');
    else if (Array.isArray(list) && list.length === 0) target('targets', 'no targets');
    /** @type {[string, string[]][]} the nodes of each target before this one */
    const earlier = [];
    for (const [i, item] of (Array.isArray(list) ? list : []).entries()) {
      if (!isMapping(item)) {
        target(`target [${i}]`, 'not a mapping');
        continue;
      }
      const where = `target ${typeof item.id === 'string' ? item.id : `[${i}]`}`;
      closed(target, where, item, ['id', 'names', 'nodes']);
      if (typeof item.id !== 'string') target(where, 'no id');
      else {
        if (!KEY_FORM.test(item.id)) target(where, 'not in the key form');
        if (targetIds.includes(item.id)) target(where, 'repeated');
        else targetIds.push(item.id);
      }
      names(target, where, item.names);
      if (!Array.isArray(item.nodes) || item.nodes.length === 0) target(where, 'no nodes');
      /** @type {string[]} */
      const nodes = [];
      const listed = Array.isArray(item.nodes) ? item.nodes : [];
      for (const [k, node] of listed.entries()) {
        const muscle = typeof node === 'string' ? catalog.muscles.get(node) : undefined;
        if (listed.indexOf(node) < k) target(where, `node ${show(node)} listed twice`);
        else if (!muscle) target(where, `unknown node ${show(node)}`);
        else if (muscle.group) target(where, `node ${node} is a group`);
        else {
          for (const [other, otherNodes] of earlier)
            for (const otherNode of otherNodes)
              if (overlap(catalog, node, otherNode)) target(where, `node ${node} overlaps ${otherNode} of ${other}`);
          nodes.push(node);
        }
      }
      earlier.push([where, nodes]);
    }

    const majorGroups = targetsFile.major_groups;
    if (isMapping(majorGroups)) {
      closed(target, 'major_groups', majorGroups, ['description', 'cites', 'groups']);
      if (!isText(majorGroups.description)) target('major_groups', 'no description');
      cites(target, 'major_groups', majorGroups.cites);
      const groups = majorGroups.groups;
      if (!Array.isArray(groups) || groups.length === 0) target('major_groups', 'no groups');
      else {
        /** @type {Map<string, string[]>} the groups that list each target */
        const groupsOf = new Map(targetIds.map(id => [id, []]));
        for (const [i, item] of groups.entries()) {
          if (!isMapping(item)) {
            target(`group [${i}]`, 'not a mapping');
            continue;
          }
          const name = typeof item.id === 'string' ? item.id : `[${i}]`;
          const where = `group ${name}`;
          closed(target, where, item, ['id', 'names', 'targets']);
          if (typeof item.id !== 'string') target(where, 'no id');
          else {
            if (!KEY_FORM.test(item.id)) target(where, 'not in the key form');
            if (groupIds.includes(item.id)) target(where, 'repeated');
            else groupIds.push(item.id);
          }
          names(target, where, item.names);
          if (!Array.isArray(item.targets) || item.targets.length === 0) target(where, 'no targets');
          const listedHere = new Set();
          for (const id of Array.isArray(item.targets) ? item.targets : []) {
            if (listedHere.has(id)) {
              target(where, `target ${show(id)} listed twice`);
              continue;
            }
            listedHere.add(id);
            const listed = groupsOf.get(id);
            if (listed) listed.push(name);
            else if (targetsRead) target(where, `unknown target ${show(id)}`);
          }
        }
        for (const [id, listed] of groupsOf) {
          if (listed.length === 0) target(`target ${id}`, 'in no group');
          if (listed.length > 1) target(`target ${id}`, `in more than one group: ${listed.join(', ')}`);
        }
      }
    } else if ('major_groups' in targetsFile) {
      target('major_groups', 'not a mapping');
      citesLost = true;
    }
  }

  // corridors.yaml
  const corridor = reporter('corridors');
  if (!Array.isArray(corridors) && corridors !== UNREAD) corridor('(top level)', 'not a list');
  /** @type {string[]} */
  const corridorIds = [];
  /** @type {{ id: string, goal: unknown, unit: string, subjects: unknown[] }[]} the corridors before this one */
  const measured = [];
  for (const [i, item] of (Array.isArray(corridors) ? corridors : []).entries()) {
    if (!isMapping(item)) {
      corridor(`[${i}]`, 'not a mapping');
      continue;
    }
    const id = typeof item.id === 'string' ? item.id : `[${i}]`;
    closed(corridor, id, item, ['id', 'goal', 'unit', 'targets', 'groups', 'extrapolated', 'extrapolation', 'bands']);
    if (typeof item.id !== 'string') corridor(id, 'no id');
    else {
      if (!ID_FORM.test(item.id)) corridor(id, 'not in the id form');
      if (corridorIds.includes(item.id)) corridor(id, 'repeated');
      else corridorIds.push(item.id);
    }
    if ('goal' in item && !goals.includes(item.goal)) corridor(id, `goal ${show(item.goal)} is not a program goal`);
    // A goal's corridor is <goal>.<value>, so that the id says which programs it applies to.
    if (typeof item.id === 'string') {
      const named = goals.find(goal => item.id.startsWith(`${goal}.`));
      if (goals.includes(item.goal) && named !== item.goal) corridor(id, `id does not start with ${item.goal}.`);
      if (!('goal' in item) && named) corridor(id, `id names the goal ${named}, but the corridor has no goal`);
    }

    const { unit } = item;
    const known = typeof unit === 'string' && Object.hasOwn(UNITS, unit);
    if (!('unit' in item)) corridor(id, 'no unit');
    else if (!known) corridor(id, `unit ${show(unit)} is not one of the six units`);
    /** @type {unknown[]} */
    let subjects = [];
    if (known) {
      const per = UNITS[unit];
      // The field that lists the subjects, or null for a unit per block or per exercise of a workout.
      const kind = per === 'targets' || per === 'groups' ? per : null;
      for (const field of /** @type {const} */ (['targets', 'groups']))
        if (field !== kind && field in item)
          corridor(id, `${field} for a unit per ${kind === null ? per : kind.slice(0, -1)}`);
      if (kind !== null) {
        const ids = kind === 'targets' ? targetIds : groupIds;
        const value = item[kind];
        if (!Array.isArray(value) || value.length === 0) corridor(id, `no ${kind}`);
        else {
          const listed = kind === 'targets' ? targetsRead : groupsRead;
          for (const [k, subject] of value.entries()) {
            if (value.indexOf(subject) < k) corridor(id, `${kind.slice(0, -1)} ${show(subject)} listed twice`);
            else if (listed && !ids.includes(subject)) corridor(id, `unknown ${kind.slice(0, -1)} ${show(subject)}`);
          }
          subjects = value;
        }
      }
      // Two corridors apply to one program unless both have a goal and the goals differ.
      for (const other of measured) {
        if (other.unit !== unit) continue;
        if (other.goal !== undefined && item.goal !== undefined && other.goal !== item.goal) continue;
        const common = subjects.filter(subject => other.subjects.includes(subject));
        if (kind === null) corridor(id, `measures ${unit}, as ${other.id} does`);
        else if (common.length)
          corridor(id, `measures ${unit} for ${common.map(show).join(', ')}, as ${other.id} does`);
      }
      measured.push({ id, goal: item.goal, unit, subjects });
    }

    if ('extrapolated' in item) {
      const extrapolated = Array.isArray(item.extrapolated) ? item.extrapolated : [];
      if (extrapolated.length === 0) corridor(id, 'extrapolated is not a list of its subjects');
      for (const [k, subject] of extrapolated.entries()) {
        if (extrapolated.indexOf(subject) < k) corridor(id, `extrapolated ${show(subject)} listed twice`);
        // With an unknown unit, the corridor's subjects are unknown too.
        else if (known && !subjects.includes(subject))
          corridor(id, `extrapolated ${show(subject)} is not one of its subjects`);
      }
      if (!('extrapolation' in item)) corridor(id, 'extrapolated without extrapolation');
    } else if ('extrapolation' in item) corridor(id, 'extrapolation without extrapolated');
    if ('extrapolation' in item && !isText(item.extrapolation)) corridor(id, 'extrapolation is not a string');

    if ('bands' in item && !Array.isArray(item.bands)) citesLost = true;
    const bands = Array.isArray(item.bands) ? item.bands : [];
    if (bands.length < 2) corridor(id, 'fewer than two bands');
    /** @type {number | undefined} where the band before ends */
    let end = 0;
    const findings = new Set();
    // Whether every band says if it gives a finding: only then can the corridor lack one kind.
    let judged = true;
    for (const [k, band] of bands.entries()) {
      const where = `${id} bands[${k}]`;
      if (!isMapping(band)) {
        corridor(where, 'not a mapping');
        end = undefined;
        judged = false;
        citesLost = true;
        continue;
      }
      closed(corridor, where, band, ['from', 'to', 'label', 'description', 'finding', 'cites']);
      if (!isNumber(band.from)) corridor(where, 'from is not a number');
      else if (k === 0 && band.from !== 0) corridor(where, 'does not start at 0');
      else if (k > 0 && end !== undefined && band.from !== end)
        corridor(where, 'does not start where the band before ends');
      if (k === bands.length - 1) {
        if ('to' in band) corridor(where, 'the last band has a to');
      } else if (!('to' in band)) corridor(where, 'no to');
      else if (!isNumber(band.to)) corridor(where, 'to is not a number');
      else if (isNumber(band.from) && band.to <= band.from) corridor(where, 'to is not above from');
      end = isNumber(band.to) ? band.to : undefined;
      if (!isText(band.label)) corridor(where, 'no label');
      if (!isText(band.description)) corridor(where, 'no description');
      if (!('finding' in band)) corridor(where, 'no finding');
      else if (typeof band.finding !== 'boolean') corridor(where, 'finding is not a boolean');
      else findings.add(band.finding);
      if (typeof band.finding !== 'boolean') judged = false;
      cites(corridor, where, band.cites);
    }
    if (bands.length && judged && !findings.has(true)) corridor(id, 'no band with a finding');
    if (bands.length && judged && !findings.has(false)) corridor(id, 'no band without a finding');
  }

  // references.yaml, last: a key needs every citation to be known.
  const reference = reporter('references');
  if (!Array.isArray(references) && references !== UNREAD) reference('(top level)', 'not a list');
  const keys = new Set();
  /** @type {string | undefined} the key of the entry before this one */
  let previous;
  for (const [i, entry] of (Array.isArray(references) ? references : []).entries()) {
    if (!isMapping(entry)) {
      reference(`[${i}]`, 'not a mapping');
      continue;
    }
    const where = typeof entry.key === 'string' ? entry.key : `[${i}]`;
    closed(reference, where, entry, ['key', 'citation', 'doi', 'isbn', 'url', 'read']);
    if (typeof entry.key !== 'string') reference(where, 'no key');
    else {
      if (!KEY_FORM.test(entry.key)) reference(where, 'not in the key form');
      // Compared by code unit, as catalog ids are.
      if (previous !== undefined && entry.key < previous) reference(where, `not in key order: after ${previous}`);
      previous = entry.key;
      if (keys.has(entry.key)) reference(where, 'repeated');
      else if (citingRead && !citesLost && !cited.has(entry.key)) reference(where, 'cited nowhere');
      keys.add(entry.key);
    }
    if (!isText(entry.citation)) reference(where, 'no citation');
    const identifiers = ['doi', 'isbn', 'url'].filter(field => field in entry);
    if (identifiers.length !== 1) reference(where, 'not exactly one of doi, isbn and url');
    for (const field of identifiers) {
      if (typeof entry[field] !== 'string') reference(where, `${field} is not a string`);
      else if (!entry[field].trim()) reference(where, `${field} is empty`);
    }
    if (typeof entry.read !== 'string') reference(where, 'no read');
    else if (!entry.read.trim()) reference(where, 'read is empty');
  }

  return [...problems.references, ...problems.targets, ...problems.corridors];
}

/** The test catalog: its muscle dictionary has groups, muscles and bundles. */
const testCatalog = () => buildCatalog(readCatalogFiles(TEST_CATALOG));

/** A minimal valid set of the three files over the test catalog's muscles. */
const VALID = {
  references: `- key: smith2020
  citation: Smith J. A dose-response study. J Test. 2020;1(1):1-9.
  doi: 10.1000/test.1
  read: full
- key: who_guide
  citation: A guideline. 2nd edition. 2018.
  url: https://example.org/guide/
  read: chapters 2, 4
`,
  targets: `counting:
  primary: 1
  secondary: 0.5
  description: A set counts 1 for a target that its exercise drives and half a set for one it trains.
  cites:
    - {key: smith2020, at: Section 2.5}
targets:
  - id: chest
    names: {en: Chest, ru: Грудь, de: Brust}
    nodes: [pecs]
  - id: delts
    names: {en: Delts, ru: Дельты}
    nodes: [deltoids]
  - id: arms
    names: {en: Arms, ru: Руки}
    nodes: [biceps, triceps]
major_groups:
  description: The groups that the guideline asks to train.
  cites:
    - {key: who_guide, at: p. 30}
  groups:
    - id: chest
      names: {en: Chest, ru: Грудь}
      targets: [chest]
    - id: upper
      names: {en: Upper body, ru: Верх тела}
      targets: [delts, arms]
`,
  corridors: `- id: hypertrophy.weekly_sets
  goal: hypertrophy
  unit: fractional_sets_per_week
  targets: [chest, delts]
  extrapolated: [delts]
  extrapolation: The study measured the chest, not the delts.
  bands:
    - from: 0
      to: 4
      label: too few
      finding: true
      description: Fewer sets than the study's least effective dose.
      cites:
        - {key: smith2020, at: Table 3}
    - from: 4
      label: enough
      finding: false
      description: At least the least effective dose.
      cites:
        - {key: smith2020, at: Table 3}
- id: strength.weekly_sets
  goal: strength
  unit: fractional_sets_per_week
  targets: [chest]
  bands:
    - {from: 0, to: 2.5, label: few, finding: true, description: Few., cites: [{key: smith2020, at: Fig. 6}]}
    - {from: 2.5, label: more, finding: false, description: More., cites: [{key: smith2020, at: Fig. 6}]}
- id: major_groups
  unit: days_involved_per_week
  groups: [chest, upper]
  bands:
    - {from: 0, to: 2, label: rare, finding: true, description: Rare., cites: [{key: who_guide, at: p. 56}]}
    - {from: 2, label: often, finding: false, description: Often., cites: [{key: who_guide, at: p. 56}]}
- id: strength.reps
  goal: strength
  unit: reps_per_set
  bands:
    - {from: 0, to: 9, label: heavy, finding: false, description: Heavy., cites: [{key: smith2020, at: Table 6}]}
    - {from: 9, label: light, finding: true, description: Light., cites: [{key: smith2020, at: Table 6}]}
`,
};

/**
 * The problems of the valid set with some files replaced.
 * @param {Partial<Record<keyof typeof VALID, string>>} sources
 */
function problemsWith(sources) {
  const texts = { ...VALID, ...sources };
  /** @param {keyof typeof VALID} name */
  const file = name => ({ file: `catalog/${name}.yaml`, source: texts[name] });
  return guidelineProblems(
    { references: file('references'), targets: file('targets'), corridors: file('corridors') },
    testCatalog(),
    GOALS,
  );
}

test('the guideline check accepts a minimal valid set of files', () => {
  assert.deepEqual(problemsWith({}), []);
});

test('the guideline check finds each kind of problem in the bibliography', () => {
  const references = `${VALID.references}- key: Pelland2026
  citation: Pelland JC, et al. 2026.
  doi: 10.1000/b
  url: https://example.org/pelland/
  read: ''
  pages: 1
- key: smith2020
  doi: 10.1000/test.1
- citation: 5
  isbn: 9789240015128
- A guideline. 2018.
- key: schoenfeld2017
  citation: Schoenfeld BJ, et al. 2017.
  doi: ''
  read: full
`;
  assert.deepEqual(problemsWith({ references }), [
    'catalog/references.yaml: Pelland2026: unknown field pages',
    'catalog/references.yaml: Pelland2026: not in the key form',
    'catalog/references.yaml: Pelland2026: not in key order: after who_guide',
    'catalog/references.yaml: Pelland2026: cited nowhere',
    'catalog/references.yaml: Pelland2026: not exactly one of doi, isbn and url',
    'catalog/references.yaml: Pelland2026: read is empty',
    'catalog/references.yaml: smith2020: repeated',
    'catalog/references.yaml: smith2020: no citation',
    'catalog/references.yaml: smith2020: no read',
    'catalog/references.yaml: [4]: no key',
    'catalog/references.yaml: [4]: no citation',
    'catalog/references.yaml: [4]: isbn is not a string',
    'catalog/references.yaml: [4]: no read',
    'catalog/references.yaml: [5]: not a mapping',
    'catalog/references.yaml: schoenfeld2017: not in key order: after smith2020',
    'catalog/references.yaml: schoenfeld2017: cited nowhere',
    'catalog/references.yaml: schoenfeld2017: doi is empty',
  ]);
});

test('the guideline check finds each kind of problem in the targets', () => {
  const targets = `counting:
  primary: 2
  secondary: 1
  weights: [1, 0.5]
targets:
  - id: chest
    names: {en: Chest, ru: Грудь, EN: Chest, de: 5}
    nodes: [pecs, back, lat, pecs, lat]
  - id: Chest
    names: {en: Chest}
    nodes: [pecs]
  - id: front
    names: {en: Front, ru: Перед}
    nodes: [delt_front]
  - id: delts
    names: {en: Delts, ru: Дельты}
    nodes: [deltoids]
  - id: side_delts
    names: {en: Side delts, ru: Средние дельты}
    nodes: [delt_side]
  - id: delts
    names: {en: Delts, ru: Дельты}
    nodes: []
  - names: {en: Arms, ru: Руки}
    nodes: [biceps]
    muscles: [triceps]
  - Arms
major_groups:
  cites: []
  note: x
  groups:
    - id: chest
      names: {en: Chest, ru: Грудь}
      targets: [chest, side_delts, calves]
      size: 2
    - id: Upper
      names: {en: Upper body}
      targets: [side_delts, side_delts]
    - id: chest
      names: {en: Chest, ru: Грудь}
      targets: []
    - {names: All, targets: [chest]}
    - Upper
`;
  // Nothing cites the bibliography here: targets.yaml has no citation that is valid, and there are no corridors.
  assert.deepEqual(problemsWith({ targets, corridors: '[]' }), [
    'catalog/references.yaml: smith2020: cited nowhere',
    'catalog/references.yaml: who_guide: cited nowhere',
    'catalog/targets.yaml: counting: unknown field weights',
    'catalog/targets.yaml: counting: primary is not 1',
    'catalog/targets.yaml: counting: secondary is not 0.5',
    'catalog/targets.yaml: counting: no description',
    'catalog/targets.yaml: counting: no cites',
    'catalog/targets.yaml: target chest: unknown field names.EN',
    'catalog/targets.yaml: target chest: name in de is not a string',
    'catalog/targets.yaml: target chest: node back is a group',
    'catalog/targets.yaml: target chest: unknown node lat',
    'catalog/targets.yaml: target chest: node pecs listed twice',
    'catalog/targets.yaml: target chest: node lat listed twice',
    'catalog/targets.yaml: target Chest: not in the key form',
    'catalog/targets.yaml: target Chest: no name in ru',
    'catalog/targets.yaml: target Chest: node pecs overlaps pecs of target chest',
    'catalog/targets.yaml: target delts: node deltoids overlaps delt_front of target front',
    'catalog/targets.yaml: target side_delts: node delt_side overlaps deltoids of target delts',
    'catalog/targets.yaml: target delts: repeated',
    'catalog/targets.yaml: target delts: no nodes',
    'catalog/targets.yaml: target [6]: unknown field muscles',
    'catalog/targets.yaml: target [6]: no id',
    'catalog/targets.yaml: target [7]: not a mapping',
    'catalog/targets.yaml: major_groups: unknown field note',
    'catalog/targets.yaml: major_groups: no description',
    'catalog/targets.yaml: major_groups: no cites',
    'catalog/targets.yaml: group chest: unknown field size',
    'catalog/targets.yaml: group chest: unknown target calves',
    'catalog/targets.yaml: group Upper: not in the key form',
    'catalog/targets.yaml: group Upper: no name in ru',
    'catalog/targets.yaml: group Upper: target side_delts listed twice',
    'catalog/targets.yaml: group chest: repeated',
    'catalog/targets.yaml: group chest: no targets',
    'catalog/targets.yaml: group [3]: no id',
    'catalog/targets.yaml: group [3]: names is not a mapping',
    'catalog/targets.yaml: group [4]: not a mapping',
    'catalog/targets.yaml: target chest: in more than one group: chest, [3]',
    'catalog/targets.yaml: target Chest: in no group',
    'catalog/targets.yaml: target front: in no group',
    'catalog/targets.yaml: target delts: in no group',
    'catalog/targets.yaml: target side_delts: in more than one group: chest, Upper',
  ]);
  const fields =
    'counting: 1\ntargets: {}\nmajor_groups:\n  description: Groups.\n  cites: [{key: who_guide, at: p. 30}]\nextra: 1\n';
  // counting holds citations but is not a mapping, so no key is reported as cited nowhere.
  assert.deepEqual(problemsWith({ targets: fields, corridors: '[]' }), [
    'catalog/targets.yaml: (top level): unknown field extra',
    'catalog/targets.yaml: counting: not a mapping',
    'catalog/targets.yaml: targets: not a list',
    'catalog/targets.yaml: major_groups: no groups',
  ]);
  assert.deepEqual(problemsWith({ targets: 'major_groups: []\n', corridors: '[]' }), [
    'catalog/targets.yaml: (top level): no counting',
    'catalog/targets.yaml: (top level): no targets',
    'catalog/targets.yaml: major_groups: not a mapping',
  ]);
  // After the two references that nothing cites: a missing counting rule loses no citation.
  assert.deepEqual(problemsWith({ targets: '{}\n', corridors: '[]' }).slice(2), [
    'catalog/targets.yaml: (top level): no counting',
    'catalog/targets.yaml: (top level): no targets',
    'catalog/targets.yaml: (top level): no major_groups',
  ]);
});

test('the guideline check finds each kind of problem in the corridors', () => {
  const band = (/** @type {string} */ fields) =>
    `    - {${fields}, description: A band., cites: [{key: smith2020, at: Table 3}]}\n`;
  const corridors = `- id: Hypertrophy.weekly_sets
  goal: hypertrophy
  unit: fractional_sets_per_week
  targets: [chest, delt, chest]
  groups: [upper]
  extrapolate: [delts]
  bands:
${band('from: 0, to: 4, label: too few, finding: true')}    - {from: 5, to: 4, label: '', finding: yes, description: Some., cites: []}
    - {from: 4, to: 11, finding: false, description: More., source: Table 3}
    - {from: 11, to: 19, label: lots, finding: false, description: Lots., cites: [{key: pelland2025, at: Table 3}, {key: smith2020, page: 5}, 5]}
- id: hypertrophy.weekly_sets
  goal: hypertrophy
  unit: fractional_sets_per_week
  targets: [chest]
  extrapolated: [calves, calves]
  bands:
${band('from: 1, label: all, finding: true')}- id: hypertrophy.weekly_sets
  goal: fat_loss
  unit: sets_per_session
  extrapolation: Because.
  bands: []
- id: major_groups
  unit: days_involved_per_week
  groups: [chest, legs]
  bands:
${band('from: 0, to: 2, label: rare, finding: true')}${band('from: 2, label: often, finding: false')}- id: strength.reps
  unit: reps_per_set
  targets: [chest]
  bands:
${band('from: 0, to: 9, label: heavy, finding: false')}${band('to: 12, label: light, finding: false')}    - not a band
${band('from: .inf, label: lighter, finding: false')}- id: power.reps
  goal: power
  unit: reps_per_set
  extrapolated: []
  extrapolation: 5
  bands:
${band('from: 0, to: 29, label: within, finding: false')}${band('from: 29, label: lighter, finding: false')}- id: health.weekly_sessions
  goal: health
  unit: fractional_sessions_per_week
  targets: []
  extrapolated: chest
  bands:
${band('from: 0, to: 1, label: rare, finding: true')}${band('from: 1, label: often, finding: false')}- goal: health
  bands:
${band('from: 0, to: 1, label: rare, finding: true')}${band('from: 1, label: often, finding: false')}- [not, a, corridor]
- id: rest.check
  unit: rest_seconds
  groups: [upper]
  bands:
    - {from: 0, label: short, finding: true, description: Short., cites: [{at: p. 11}]}
    - {from: 60, to: x, label: long, cites: [{key: smith2020, at: p. 11}]}
${band('from: 120, label: longer, finding: false')}`;
  assert.deepEqual(problemsWith({ corridors }), [
    'catalog/corridors.yaml: Hypertrophy.weekly_sets: unknown field extrapolate',
    'catalog/corridors.yaml: Hypertrophy.weekly_sets: not in the id form',
    'catalog/corridors.yaml: Hypertrophy.weekly_sets: id does not start with hypertrophy.',
    'catalog/corridors.yaml: Hypertrophy.weekly_sets: groups for a unit per target',
    'catalog/corridors.yaml: Hypertrophy.weekly_sets: unknown target delt',
    'catalog/corridors.yaml: Hypertrophy.weekly_sets: target chest listed twice',
    'catalog/corridors.yaml: Hypertrophy.weekly_sets bands[1]: does not start where the band before ends',
    'catalog/corridors.yaml: Hypertrophy.weekly_sets bands[1]: to is not above from',
    'catalog/corridors.yaml: Hypertrophy.weekly_sets bands[1]: no label',
    'catalog/corridors.yaml: Hypertrophy.weekly_sets bands[1]: finding is not a boolean',
    'catalog/corridors.yaml: Hypertrophy.weekly_sets bands[1]: no cites',
    'catalog/corridors.yaml: Hypertrophy.weekly_sets bands[2]: unknown field source',
    'catalog/corridors.yaml: Hypertrophy.weekly_sets bands[2]: no label',
    'catalog/corridors.yaml: Hypertrophy.weekly_sets bands[2]: no cites',
    'catalog/corridors.yaml: Hypertrophy.weekly_sets bands[3]: the last band has a to',
    'catalog/corridors.yaml: Hypertrophy.weekly_sets bands[3] cites[0]: unknown key pelland2025',
    'catalog/corridors.yaml: Hypertrophy.weekly_sets bands[3] cites[1]: unknown field page',
    'catalog/corridors.yaml: Hypertrophy.weekly_sets bands[3] cites[1]: no at',
    'catalog/corridors.yaml: Hypertrophy.weekly_sets bands[3] cites[2]: not a mapping',
    'catalog/corridors.yaml: hypertrophy.weekly_sets: measures fractional_sets_per_week for chest, as Hypertrophy.weekly_sets does',
    'catalog/corridors.yaml: hypertrophy.weekly_sets: extrapolated calves is not one of its subjects',
    'catalog/corridors.yaml: hypertrophy.weekly_sets: extrapolated calves listed twice',
    'catalog/corridors.yaml: hypertrophy.weekly_sets: extrapolated without extrapolation',
    'catalog/corridors.yaml: hypertrophy.weekly_sets: fewer than two bands',
    'catalog/corridors.yaml: hypertrophy.weekly_sets bands[0]: does not start at 0',
    'catalog/corridors.yaml: hypertrophy.weekly_sets: no band without a finding',
    'catalog/corridors.yaml: hypertrophy.weekly_sets: repeated',
    'catalog/corridors.yaml: hypertrophy.weekly_sets: goal fat_loss is not a program goal',
    'catalog/corridors.yaml: hypertrophy.weekly_sets: unit sets_per_session is not one of the six units',
    'catalog/corridors.yaml: hypertrophy.weekly_sets: extrapolation without extrapolated',
    'catalog/corridors.yaml: hypertrophy.weekly_sets: fewer than two bands',
    'catalog/corridors.yaml: major_groups: unknown group legs',
    'catalog/corridors.yaml: strength.reps: id names the goal strength, but the corridor has no goal',
    'catalog/corridors.yaml: strength.reps: targets for a unit per block',
    'catalog/corridors.yaml: strength.reps bands[1]: from is not a number',
    'catalog/corridors.yaml: strength.reps bands[2]: not a mapping',
    'catalog/corridors.yaml: strength.reps bands[3]: from is not a number',
    'catalog/corridors.yaml: power.reps: measures reps_per_set, as strength.reps does',
    'catalog/corridors.yaml: power.reps: extrapolated is not a list of its subjects',
    'catalog/corridors.yaml: power.reps: extrapolation is not a string',
    'catalog/corridors.yaml: power.reps: no band with a finding',
    'catalog/corridors.yaml: health.weekly_sessions: no targets',
    'catalog/corridors.yaml: health.weekly_sessions: extrapolated is not a list of its subjects',
    'catalog/corridors.yaml: health.weekly_sessions: extrapolated without extrapolation',
    'catalog/corridors.yaml: [7]: no id',
    'catalog/corridors.yaml: [7]: no unit',
    'catalog/corridors.yaml: [8]: not a mapping',
    'catalog/corridors.yaml: rest.check: groups for a unit per block',
    'catalog/corridors.yaml: rest.check bands[0]: no to',
    'catalog/corridors.yaml: rest.check bands[0] cites[0]: no key',
    'catalog/corridors.yaml: rest.check bands[1]: to is not a number',
    'catalog/corridors.yaml: rest.check bands[1]: no description',
    'catalog/corridors.yaml: rest.check bands[1]: no finding',
  ]);
});

/**
 * A corridor in sets of an exercise in a workout, for the tests.
 * @param {string} id
 * @param {string} goal
 * @param {string} [fields] more lines of fields
 */
function exerciseSets(id, goal, fields = '') {
  return `- id: ${id}
  goal: ${goal}
  unit: exercise_sets_per_workout
${fields}  bands:
    - {from: 0, to: 2, label: few, finding: true, description: Few., cites: [{key: smith2020, at: Table 6}]}
    - {from: 2, label: more, finding: false, description: More., cites: [{key: smith2020, at: Table 6}]}
`;
}

test('the guideline check: a corridor per exercise of a workout has no targets, and one applies to a program', () => {
  const one = VALID.corridors + exerciseSets('strength.exercise_sets', 'strength');
  assert.deepEqual(problemsWith({ corridors: one }), []);
  assert.deepEqual(
    problemsWith({ corridors: VALID.corridors + exerciseSets('power.exercise_sets', 'power', '  targets: [chest]\n') }),
    ['catalog/corridors.yaml: power.exercise_sets: targets for a unit per exercise of a workout'],
  );
  assert.deepEqual(problemsWith({ corridors: one + exerciseSets('strength.exercise_sets_again', 'strength') }), [
    'catalog/corridors.yaml: strength.exercise_sets_again: measures exercise_sets_per_workout, as strength.exercise_sets does',
  ]);
});

test('the guideline check names a top level of the wrong kind and a file that is not valid YAML', () => {
  assert.deepEqual(problemsWith({ references: '{}\n', targets: '[]\n', corridors: '{}\n' }), [
    'catalog/references.yaml: (top level): not a list',
    'catalog/targets.yaml: (top level): not a mapping',
    'catalog/corridors.yaml: (top level): not a list',
  ]);
  assert.deepEqual(problemsWith({ corridors: '- id: [hypertrophy\n' }), [
    'catalog/corridors.yaml: (line 2): Flow sequence in block collection must be sufficiently indented and end with a ]',
  ]);
});

const PROJECT_CATALOG = new URL('../catalog/', import.meta.url);

/** The project's targets file, parsed. @returns {any} */
function projectTargets() {
  return parse(readFileSync(new URL('targets.yaml', PROJECT_CATALOG), 'utf8'), { schema: 'core' });
}

test('the project targets and major groups are those of the spec, in its order', () => {
  const { targets, major_groups } = projectTargets();
  assert.deepEqual(
    targets.map((/** @type {any} */ { id, names, nodes }) => [id, names.en, names.ru, nodes]),
    [
      ['chest', 'Chest', 'Грудь', ['pecs']],
      ['back', 'Back', 'Спина', ['lats', 'rhomboids', 'traps']],
      ['front_delts', 'Front delts', 'Передние дельты', ['delt_front']],
      ['side_delts', 'Side delts', 'Средние дельты', ['delt_side']],
      ['rear_delts', 'Rear delts', 'Задние дельты', ['delt_rear']],
      ['biceps', 'Biceps', 'Бицепс', ['biceps', 'brachialis']],
      ['triceps', 'Triceps', 'Трицепс', ['triceps']],
      ['quads', 'Quads', 'Квадрицепсы', ['quads']],
      ['hamstrings', 'Hamstrings', 'Задняя поверхность бедра', ['hamstrings']],
      ['glutes', 'Glutes', 'Ягодицы', ['glute_max', 'glute_med']],
      ['calves', 'Calves', 'Икры', ['gastrocnemius', 'soleus']],
      ['abs', 'Abs', 'Пресс', ['abs', 'obliques', 'transverse_abs']],
    ],
  );
  assert.deepEqual(
    major_groups.groups.map((/** @type {any} */ { id, names, targets }) => [id, names.en, names.ru, targets]),
    [
      ['legs', 'Legs', 'Ноги', ['quads', 'hamstrings', 'calves']],
      ['hips', 'Hips', 'Бёдра', ['glutes']],
      ['back', 'Back', 'Спина', ['back']],
      ['abdomen', 'Abdomen', 'Живот', ['abs']],
      ['chest', 'Chest', 'Грудь', ['chest']],
      ['shoulders', 'Shoulders', 'Плечи', ['front_delts', 'side_delts', 'rear_delts']],
      ['arms', 'Arms', 'Руки', ['biceps', 'triceps']],
    ],
  );
  // Every muscle and bundle of the dictionary reaches a target, except the six that no corridor speaks
  // of: a key added later counts for nothing until a target takes it or this list does.
  const catalog = buildCatalog(readCatalogFiles(PROJECT_CATALOG));
  const unreached = [...catalog.muscles]
    .filter(([, { group }]) => !group)
    .map(([key]) => key)
    .filter(
      key =>
        !targets.some((/** @type {any} */ { nodes }) =>
          nodes.some((/** @type {string} */ node) => overlap(catalog, key, node)),
        ),
    );
  assert.deepEqual(unreached, ['erector_spinae', 'serratus', 'rotator_cuff', 'forearms', 'adductors', 'hip_flexors']);
});

test('pushing exercises reach no node of back, pulling exercises none of chest, presses none of rear_delts', () => {
  const catalog = buildCatalog(readCatalogFiles(PROJECT_CATALOG));
  const { targets } = projectTargets();
  /** The muscle keys of a catalog entry that reach a target. @param {string} id @param {string} target */
  const reaching = (id, target) => {
    const { nodes } = targets.find((/** @type {any} */ { id }) => id === target);
    const { primary, secondary = [] } = /** @type {any} */ (catalog.exercises.get(id)).muscles;
    return [...primary, ...secondary].filter(key =>
      nodes.some((/** @type {string} */ node) => overlap(catalog, key, node)),
    );
  };
  for (const [target, exercises] of /** @type {[string, string[]][]} */ ([
    ['back', ['pushup', 'dip', 'overhead_press.barbell', 'overhead_press.dumbbell']],
    ['chest', ['chinup', 'pullup', 'pullup.wide', 'row.dumbbell']],
    ['rear_delts', ['bench_press.barbell', 'overhead_press.barbell']],
  ]))
    for (const id of exercises) assert.deepEqual(reaching(id, target), [], `${id} reaches ${target}`);
  // The presses do count for the other two delt targets.
  assert.deepEqual(reaching('bench_press.barbell', 'front_delts'), ['delt_front']);
  assert.deepEqual(reaching('overhead_press.barbell', 'front_delts'), ['delt_front']);
  assert.deepEqual(reaching('overhead_press.barbell', 'side_delts'), ['delt_side']);
});

test('the project guideline files follow their requirements', () => {
  const catalog = buildCatalog(readCatalogFiles(PROJECT_CATALOG));
  assert.deepEqual(guidelineProblems(readGuidelineFiles(PROJECT_CATALOG), catalog, GOALS), []);
});

test('the guideline check reports a file it cannot use once, not at every place that refers to it', () => {
  // No citation is unknown when the bibliography is unread, and no target or group of a corridor, nor
  // any key, when the targets are.
  assert.deepEqual(problemsWith({ references: '- key: [smith2020\n' }), [
    'catalog/references.yaml: (line 2): Flow sequence in block collection must be sufficiently indented and end with a ]',
  ]);
  assert.deepEqual(problemsWith({ targets: 'counting: *missing\n' }), [
    'catalog/targets.yaml: (top level): Unresolved alias (the anchor must be set before the alias): missing',
  ]);
  assert.deepEqual(problemsWith({ targets: VALID.targets.replace(/ {2}groups:[\s\S]*/, '  groups: []\n') }), [
    'catalog/targets.yaml: major_groups: no groups',
  ]);
  assert.deepEqual(
    problemsWith({
      targets: VALID.targets.replace(/^targets:\n[\s\S]*?^major_groups:/m, 'targets: []\nmajor_groups:'),
    }),
    ['catalog/targets.yaml: targets: no targets'],
  );
  // An unknown unit leaves the corridor's subjects unknown too.
  const corridors = `- id: hypertrophy.weekly_sets
  goal: hypertrophy
  unit: sets_per_week
  targets: [chest]
  extrapolated: [calves]
  extrapolation: The study measured no calf muscle.
  bands:
    - {from: 0, to: 4, label: few, finding: true, description: Few., cites: [{key: smith2020, at: Table 3}]}
    - {from: 4, label: more, finding: false, description: More., cites: [{key: who_guide, at: p. 56}]}
`;
  assert.deepEqual(problemsWith({ corridors }), [
    'catalog/corridors.yaml: hypertrophy.weekly_sets: unit sets_per_week is not one of the six units',
  ]);
});

test('the guideline check reports odd YAML instead of failing', () => {
  assert.deepEqual(problemsWith({ corridors: '- id: *missing\n' }), [
    'catalog/corridors.yaml: (top level): Unresolved alias (the anchor must be set before the alias): missing',
  ]);
  // Lists that an alias makes hold themselves.
  const targets = VALID.targets.replace('nodes: [pecs]', 'nodes: &n [pecs, *n]');
  const corridors = VALID.corridors.replace(
    'goal: strength\n  unit: reps_per_set',
    'goal: &g [*g]\n  unit: reps_per_set',
  );
  assert.deepEqual(problemsWith({ targets, corridors }), [
    'catalog/targets.yaml: target chest: unknown node (a value that holds itself)',
    'catalog/corridors.yaml: strength.reps: goal (a value that holds itself) is not a program goal',
  ]);
});

test('loadGuidelines reads targets.yaml and corridors.yaml, and names a file it cannot use', () => {
  const catalog = buildCatalog(readCatalogFiles(PROJECT_CATALOG));
  const loaded = loadGuidelines(PROJECT_CATALOG, catalog);
  assert.ok('guidelines' in loaded, 'error' in loaded ? loaded.error : '');
  assert.equal(loaded.guidelines.targets.length, 12);
  const restore =
    'The catalog comes with the project: restore catalog/ with git checkout -- catalog, or download the project again.';
  inTempDir(dir => {
    cpSync(fileURLToPath(PROJECT_CATALOG), dir, { recursive: true });
    const url = pathToFileURL(`${dir}/`);
    const fileOf = (/** @type {string} */ name) => relative(ROOT, join(dir, name)).replaceAll('\\', '/');
    const load = () => loadGuidelines(url, catalog);
    const corridors = readFileSync(join(dir, 'corridors.yaml'), 'utf8');

    writeFileSync(join(dir, 'corridors.yaml'), '- id: [hypertrophy\n');
    assert.deepEqual(load(), {
      error: `Cannot read the guidelines: ${fileOf('corridors.yaml')} (line 2): Flow sequence in block collection must be sufficiently indented and end with a ]\n${restore}`,
    });
    writeFileSync(join(dir, 'corridors.yaml'), corridors.replace('      label: less than twice a week\n', ''));
    assert.deepEqual(load(), {
      error: `Cannot read the guidelines: ${fileOf('corridors.yaml')}: corridor major_groups bands[0]: label is not a string.\n${restore}`,
    });
    writeFileSync(join(dir, 'corridors.yaml'), corridors);

    // references.yaml is not read: broken or missing, it does not stop the report.
    writeFileSync(join(dir, 'references.yaml'), '- key: [pelland2026\n');
    assert.ok('guidelines' in load());
    rmSync(join(dir, 'references.yaml'));
    assert.ok('guidelines' in load());

    // An entry's muscles, which the validator does not read, name the entry's file in the catalog.
    const pushup = join(dir, 'exercises', 'pushup.yaml');
    writeFileSync(pushup, readFileSync(pushup, 'utf8').replace('primary: [pecs]', 'primary: [pec]'));
    assert.deepEqual(loadGuidelines(url, buildCatalog(readCatalogFiles(url))), {
      error: `Cannot read the catalog: ${fileOf('exercises/pushup.yaml')}: muscles.primary is not a list of muscle keys.\n${restore}`,
    });

    rmSync(join(dir, 'targets.yaml'));
    assert.deepEqual(load(), {
      error: `Cannot read the guidelines: ${fileOf('targets.yaml')}: the file cannot be read (ENOENT).\n${restore}`,
    });
  });
});

test('musclesProblem: what the count cannot read in an entry muscles', () => {
  const guidelines = buildGuidelines(
    readGuidelineFiles(PROJECT_CATALOG),
    buildCatalog(readCatalogFiles(PROJECT_CATALOG)),
  );
  /** @param {unknown} muscles */
  const problem = muscles => musclesProblem(muscles === undefined ? { id: 'x' } : { id: 'x', muscles }, guidelines);
  assert.equal(problem(undefined), undefined);
  assert.equal(problem({ primary: ['lats'] }), undefined);
  assert.equal(problem({ primary: ['back'], secondary: ['biceps', 'delt_rear'] }), undefined);
  assert.equal(problem([['lats']]), 'muscles is not a mapping.');
  assert.equal(problem(null), 'muscles is not a mapping.');
  assert.equal(problem({ secondary: ['lats'] }), 'muscles.primary is not a list of muscle keys.');
  assert.equal(problem({ primary: 'lats' }), 'muscles.primary is not a list of muscle keys.');
  assert.equal(problem({ primary: ['lat'] }), 'muscles.primary is not a list of muscle keys.');
  assert.equal(problem({ primary: ['lats'], secondary: [5] }), 'muscles.secondary is not a list of muscle keys.');
  assert.equal(problem({ primary: ['lats'], secondary: null }), 'muscles.secondary is not a list of muscle keys.');
});

/**
 * buildGuidelines over the test catalog, with some of the valid files replaced.
 * @param {{ targets?: string, corridors?: string }} sources
 */
function buildWith(sources) {
  const texts = { targets: VALID.targets, corridors: VALID.corridors, ...sources };
  return buildGuidelines(
    {
      targets: { file: 'catalog/targets.yaml', source: texts.targets },
      corridors: { file: 'catalog/corridors.yaml', source: texts.corridors },
    },
    testCatalog(),
  );
}

test('buildGuidelines builds the project guideline files', () => {
  const catalog = buildCatalog(readCatalogFiles(PROJECT_CATALOG));
  const guidelines = buildGuidelines(readGuidelineFiles(PROJECT_CATALOG), catalog);
  const { counting, targets, major_groups } = projectTargets();
  assert.deepEqual(guidelines.weights, { primary: counting.primary, secondary: counting.secondary });
  assert.deepEqual(
    guidelines.targets,
    targets.map((/** @type {any} */ { id, nodes }) => ({ id, nodes })),
  );
  assert.deepEqual(
    guidelines.groups,
    major_groups.groups.map((/** @type {any} */ { id, targets }) => ({ id, targets })),
  );
  assert.deepEqual(
    guidelines.corridors.map(({ id, goal, unit }) => [id, goal, unit]),
    [
      ['major_groups', undefined, 'days_involved_per_week'],
      ['hypertrophy.weekly_sets', 'hypertrophy', 'fractional_sets_per_week'],
      ['hypertrophy.reps', 'hypertrophy', 'reps_per_set'],
      ['hypertrophy.rest', 'hypertrophy', 'rest_seconds'],
      ['strength.reps', 'strength', 'reps_per_set'],
      ['strength.exercise_sets', 'strength', 'exercise_sets_per_workout'],
      ['power.reps', 'power', 'reps_per_set'],
    ],
  );
  const [coverage, volume] = guidelines.corridors;
  assert.deepEqual(coverage.subjects, ['legs', 'hips', 'back', 'abdomen', 'chest', 'shoulders', 'arms']);
  assert.deepEqual(coverage.extrapolated, []);
  assert.equal(coverage.extrapolation, undefined);
  assert.deepEqual(volume.extrapolated, ['back', 'side_delts', 'rear_delts', 'glutes', 'calves', 'abs']);
  assert.match(volume.extrapolation ?? '', /^The meta-regression measured/);
  // A band's range is its own: the last band has no to.
  assert.deepEqual(
    volume.bands.map(({ from, to, finding }) => [from, to, finding]),
    [
      [0, 4, true],
      [4, 5, false],
      [5, 11, false],
      [11, 19, false],
      [19, 30, false],
      [30, 43, false],
      [43, undefined, true],
    ],
  );
  assert.deepEqual(volume.bands[0].cites, [
    { key: 'pelland2026', at: 'Table 3' },
    { key: 'pelland2026', at: 'Section 4.6' },
  ]);
  assert.deepEqual(guidelines.corridors[2].subjects, []);
  // Sets of an exercise in a workout: for strength only, with its one finding below two sets, which rests
  // on ACSM and cites PAGA beside it.
  const sets = guidelines.corridors.filter(({ unit }) => unit === 'exercise_sets_per_workout');
  assert.deepEqual(
    sets.map(({ id, goal, subjects }) => [id, goal, subjects]),
    [['strength.exercise_sets', 'strength', []]],
  );
  assert.deepEqual(
    sets[0].bands.map(({ from, to, finding }) => [from, to, finding]),
    [
      [0, 2, true],
      [2, 4, false],
      [4, undefined, false],
    ],
  );
  assert.deepEqual(sets[0].bands[0].cites, [
    { key: 'acsm2026', at: 'Table 6' },
    { key: 'acsm2026', at: 'Table 2' },
    { key: 'acsm2026', at: 'p. 865' },
    { key: 'paga2018', at: 'p. 61' },
  ]);
});

test('buildGuidelines builds a corridor per exercise of a workout without subjects', () => {
  const { corridors } = buildWith({ corridors: VALID.corridors + exerciseSets('strength.exercise_sets', 'strength') });
  const built = corridors[corridors.length - 1];
  assert.deepEqual([built.id, built.unit, built.subjects], ['strength.exercise_sets', 'exercise_sets_per_workout', []]);
});

test('the reach map: a group key, a muscle with bundles and a key in no target', () => {
  const catalog = buildCatalog(readCatalogFiles(PROJECT_CATALOG));
  const { reach } = buildGuidelines(readGuidelineFiles(PROJECT_CATALOG), catalog);
  const delts = ['front_delts', 'side_delts', 'rear_delts'];
  assert.deepEqual([...(reach.get('shoulders') ?? [])], delts);
  assert.deepEqual([...(reach.get('deltoids') ?? [])], delts);
  assert.deepEqual([...(reach.get('delt_side') ?? [])], ['side_delts']);
  assert.deepEqual([...(reach.get('lats') ?? [])], ['back']);
  assert.deepEqual([...(reach.get('back') ?? [])], ['back']);
  assert.deepEqual([...(reach.get('arms') ?? [])], ['biceps', 'triceps']);
  assert.deepEqual([...(reach.get('erector_spinae') ?? ['missing'])], []);
  assert.equal(reach.size, catalog.muscles.size);
  // A node outside the dictionary, which the guideline checks report, still reaches its target.
  const targets = VALID.targets.replace('nodes: [pecs]', 'nodes: [pecs, pec_minor]');
  assert.deepEqual([...(buildWith({ targets }).reach.get('pec_minor') ?? [])], ['chest']);
});

test('buildGuidelines names the file and the place of a shape the count cannot use', () => {
  /** @param {{ targets?: string, corridors?: string }} sources */
  const error = sources => {
    try {
      buildWith(sources);
    } catch (thrown) {
      return /** @type {Error} */ (thrown).message;
    }
    return 'no error';
  };
  assert.equal(error({}), 'no error');
  /** @param {string | RegExp} from @param {string} to */
  const targets = (from, to) => error({ targets: VALID.targets.replace(from, to) });
  /** @param {string | RegExp} from @param {string} to */
  const corridors = (from, to) => error({ corridors: VALID.corridors.replace(from, to) });
  const bandCites = 'cites: [{key: who_guide, at: p. 56}]}\n    - {from: 2';
  for (const [actual, expected] of [
    [error({ targets: '[]\n' }), 'catalog/targets.yaml: the top level is not a mapping.'],
    [targets('primary: 1', 'primary: one'), 'catalog/targets.yaml: counting.primary is not a number.'],
    [targets('  secondary: 0.5\n', ''), 'catalog/targets.yaml: counting.secondary is not a number.'],
    [error({ targets: 'counting: {primary: 1, secondary: 0.5}\n' }), 'catalog/targets.yaml: targets is not a list.'],
    [targets(/^major_groups:[\s\S]*/m, ''), 'catalog/targets.yaml: major_groups.groups is not a list.'],
    [
      targets('  - id: delts\n', '  - name: delts\n'),
      'catalog/targets.yaml: targets[1] is not a mapping with a string id.',
    ],
    [
      targets('nodes: [deltoids]', 'nodes: deltoids'),
      'catalog/targets.yaml: target delts: nodes is not a list of strings.',
    ],
    [
      targets('    - id: upper\n', '    - id: 5\n'),
      'catalog/targets.yaml: major_groups.groups[1] is not a mapping with a string id.',
    ],
    [
      targets('targets: [chest]', 'targets: [chest, 5]'),
      'catalog/targets.yaml: group chest: targets is not a list of strings.',
    ],
    [error({ corridors: '{}\n' }), 'catalog/corridors.yaml: the top level is not a list.'],
    [
      corridors('- id: major_groups\n', '- name: major_groups\n'),
      'catalog/corridors.yaml: [2] is not a mapping with a string id.',
    ],
    [
      corridors('unit: days_involved_per_week', 'unit: days_per_week'),
      'catalog/corridors.yaml: corridor major_groups: unit is not one the report counts.',
    ],
    [
      corridors('  targets: [chest, delts]\n', ''),
      'catalog/corridors.yaml: corridor hypertrophy.weekly_sets: targets is not a list of strings.',
    ],
    [
      corridors('groups: [chest, upper]', 'groups: chest'),
      'catalog/corridors.yaml: corridor major_groups: groups is not a list of strings.',
    ],
    [
      corridors('goal: strength\n  unit: reps', 'goal: [strength]\n  unit: reps'),
      'catalog/corridors.yaml: corridor strength.reps: goal is not a string.',
    ],
    [
      corridors('extrapolation: The study', 'extrapolation:\n    - The study'),
      'catalog/corridors.yaml: corridor hypertrophy.weekly_sets: extrapolation is not a string.',
    ],
    [
      corridors('extrapolated: [delts]', 'extrapolated: delts'),
      'catalog/corridors.yaml: corridor hypertrophy.weekly_sets: extrapolated is not a list of strings.',
    ],
    [
      corridors('  extrapolation: The study measured the chest, not the delts.\n', ''),
      'catalog/corridors.yaml: corridor hypertrophy.weekly_sets: extrapolated without extrapolation.',
    ],
    [
      corridors(/ {2}bands:\n {4}- \{from: 0, to: 9[\s\S]*/, '  bands: []\n'),
      'catalog/corridors.yaml: corridor strength.reps: bands is not a list of at least one band.',
    ],
    [
      corridors('    - {from: 0, to: 2, label: rare,', '    - rare\n    - {from: 0, to: 2, label: rare,'),
      'catalog/corridors.yaml: corridor major_groups bands[0]: not a mapping.',
    ],
    [
      corridors('{from: 2, label: often', '{label: often'),
      'catalog/corridors.yaml: corridor major_groups bands[1]: from is not a number.',
    ],
    [
      corridors('{from: 0, to: 2, label: rare', '{from: 0, label: rare'),
      'catalog/corridors.yaml: corridor major_groups bands[0]: to is not a number.',
    ],
    [
      corridors('label: too few', 'label: 5'),
      'catalog/corridors.yaml: corridor hypertrophy.weekly_sets bands[0]: label is not a string.',
    ],
    [
      corridors('description: Fewer sets', 'descriptions: Fewer sets'),
      'catalog/corridors.yaml: corridor hypertrophy.weekly_sets bands[0]: description is not a string.',
    ],
    [
      corridors('finding: false, description: Often.', 'finding: no, description: Often.'),
      'catalog/corridors.yaml: corridor major_groups bands[1]: finding is not a boolean.',
    ],
    [
      corridors(bandCites, bandCites.replace(', at: p. 56', '')),
      'catalog/corridors.yaml: corridor major_groups bands[0]: cites is not a list of citations with a string key and at.',
    ],
    [
      corridors(bandCites, bandCites.replace('[{key: who_guide, at: p. 56}]', 'who_guide')),
      'catalog/corridors.yaml: corridor major_groups bands[0]: cites is not a list of citations with a string key and at.',
    ],
    [
      error({ corridors: '- id: [hypertrophy\n' }),
      'catalog/corridors.yaml (line 2): Flow sequence in block collection must be sufficiently indented and end with a ]',
    ],
  ])
    assert.equal(actual, expected);
  // The last band needs no to, and one there is not read.
  const open = buildWith({
    corridors: VALID.corridors.replace('{from: 2, label: often', '{from: 2, to: 3, label: often'),
  });
  assert.equal(open.corridors[2].bands[1].to, undefined);
});
