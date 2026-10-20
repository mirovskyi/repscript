// Checks outside the schema: rules that span several fields, and the draft-version warning.
// Works on the same plain data as check() and returns issues in the same shape, plus a severity.
// A value of the wrong type is skipped: the schema check already reports it.

/** @typedef {import('./schema.mjs').SchemaIssue & { severity: 'error' | 'warning' }} RuleIssue */

const DRAFT = 'Format version 0 is a draft: the format may still change before the first release.';
const FORMS = ['kg', 'lb', 'bw'];
const EXTRAS = ['add_kg', 'add_lb'];

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isMapping(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The first problem of a load, if any. A field counts as present when its key is there.
 * @param {Record<string, unknown>} load
 * @param {(string|number)[]} path
 * @returns {RuleIssue | undefined}
 */
function loadIssue(load, path) {
  const forms = FORMS.filter(name => Object.hasOwn(load, name));
  const extras = EXTRAS.filter(name => Object.hasOwn(load, name));
  if (!forms.length) {
    return {
      severity: 'error', path, message: 'The load has no kg, lb or bw.',
      hint: 'Write load: {kg: 18} or load: {lb: 40} for an external weight, or load: {bw: true} for body weight, with add_kg or add_lb for extra weight.',
    };
  }
  if (forms.length > 1) {
    return {
      severity: 'error', path, message: `The load has ${forms.slice(0, -1).join(', ')} and ${forms[forms.length - 1]} together.`,
      hint: 'Keep one: kg or lb for an external weight, or bw: true for body weight with add_kg or add_lb for extra weight.',
    };
  }
  if (extras.length && forms[0] !== 'bw') {
    const [extra] = extras;
    return {
      severity: 'error', path: [...path, extra], message: `${extra} is extra weight on top of body weight and needs bw: true.`,
      hint: `Write the whole weight in ${extra.slice('add_'.length)}, or use load: {bw: true, ${extra}: 5}.`,
    };
  }
  if (extras.length > 1) return { severity: 'error', path, message: 'The load has add_kg and add_lb together.', hint: 'Keep one unit.' };
  return undefined;
}

/**
 * @param {unknown} data the program as plain values
 * @returns {RuleIssue[]}
 */
export function checkRules(data) {
  /** @type {RuleIssue[]} */
  const issues = [];
  if (!isMapping(data)) return issues;
  if (data.repscript === 0) issues.push({ severity: 'warning', path: ['repscript'], value: 0, message: DRAFT });
  if (!Array.isArray(data.workouts)) return issues;

  /** @type {Map<string, number>} index of the first workout with each id */
  const ids = new Map();
  /** @type {string | undefined} the unit of the first load that has one */
  let unit;
  let mixed = false;
  data.workouts.forEach((workout, i) => {
    if (!isMapping(workout)) return;
    if (typeof workout.id === 'string') {
      const first = ids.get(workout.id);
      if (first === undefined) ids.set(workout.id, i);
      else issues.push({ severity: 'error', path: ['workouts', i, 'id'], value: workout.id, message: `workouts[${first}] already has this id.`, hint: 'Give each workout its own id.' });
    }
    if (!Array.isArray(workout.blocks)) return;
    workout.blocks.forEach((block, j) => {
      if (!isMapping(block)) return;
      const path = ['workouts', i, 'blocks', j];
      const reps = Object.hasOwn(block, 'reps');
      const time = Object.hasOwn(block, 'time');
      if (reps && time) {
        issues.push({ severity: 'error', path, message: 'The block has reps and time together.', hint: 'Keep reps for sets counted in repetitions, or time for timed sets such as a plank.' });
      } else if (!reps && !time) {
        issues.push({ severity: 'error', path, message: 'The block has neither reps nor time.', hint: 'Add reps for sets counted in repetitions (reps: 8-12), or time for timed sets such as a plank (time: 30s).' });
      }
      const load = block.load;
      if (!isMapping(load)) return;
      const loadPath = [...path, 'load'];
      const issue = loadIssue(load, loadPath);
      if (issue) issues.push(issue);
      const kg = Object.hasOwn(load, 'kg') || Object.hasOwn(load, 'add_kg');
      const lb = Object.hasOwn(load, 'lb') || Object.hasOwn(load, 'add_lb');
      if (kg === lb || mixed) return;
      const here = kg ? 'kg' : 'lb';
      if (!unit) unit = here;
      else if (here !== unit) {
        mixed = true;
        issues.push({
          severity: 'warning', path: loadPath, message: `The program mixes ${unit} and ${here}: this load is in ${here}, earlier loads are in ${unit}.`,
          hint: 'Use one unit throughout, unless the equipment really is marked in both.',
        });
      }
    });
  });
  return issues;
}
