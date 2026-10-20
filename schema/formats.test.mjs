import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FORMATS } from '../core/formats.mjs';

const NO_UNIT = 'Write a whole number with a unit: s for seconds, m for minutes, h for hours. Example: rest: 90s';

/** @param {string} name @param {number|string} value @param {number} min @param {number} [max] */
function parses(name, value, min, max = min) {
  assert.deepEqual(FORMATS[name].parse(value), { min, max }, `${name} ${JSON.stringify(value)}`);
}

/**
 * A hint of the form "Write X." must offer an X that parses with no problem.
 * @param {string} name @param {number|string} value @param {string} message @param {string} [hint]
 */
function fails(name, value, message, hint) {
  const result = FORMATS[name].parse(value);
  assert.deepEqual(result, hint === undefined ? { message } : { message, hint }, `${name} ${JSON.stringify(value)}`);
  const fix = hint?.match(/^Write (.+)\.$/)?.[1];
  if (fix !== undefined) assert.ok(!('message' in FORMATS[name].parse(fix)), `${name} ${fix} from the hint`);
}

test('accepted forms parse to ranges', () => {
  parses('count', 3, 3);
  parses('count', '3', 3);
  parses('count', '3-4', 3, 4);
  parses('reps', 10, 10);
  parses('reps', '8-12', 8, 12);
  parses('reps', '5+', 5, Infinity);
  parses('reps', 'max', 0, Infinity);
  parses('duration', '30s', 30);
  parses('duration', '2m', 120);
  parses('duration', '1h', 3600);
  parses('duration', '1:30', 90);
  parses('duration', '2-3m', 120, 180);
  parses('weight', 18, 18);
  parses('weight', 2.5, 2.5);
  parses('weight', '2-5', 2, 5);
});

test('text corrections name the slip and give the corrected value', () => {
  fails('reps', 'failure', 'A set to failure is written as max.', 'Write max.');
  fails('reps', 'To Failure', 'A set to failure is written as max.', 'Write max.');
  fails('reps', 'AMRAP', 'A set to failure is written as max.', 'Write max.');
  fails('reps', '8\u201312', 'The range is joined with U+2013 instead of a hyphen (-).', 'Write 8-12.');
  fails('count', '3\u22124', 'The range is joined with U+2212 instead of a hyphen (-).', 'Write 3-4.');
  fails('weight', '2,5', 'The number has a decimal comma instead of a dot.', 'Write 2.5.');
  fails('reps', '8 - 12', 'The value has spaces in it.', 'Write 8-12.');
  fails('weight', '16\u00a0-\u00a020', 'The value has spaces in it.', 'Write 16-20.');
  fails('duration', '90secs', 'Duration units are written as s, m or h.', 'Write 90s.');
  fails('duration', '2 min', 'The value has spaces in it. Duration units are written as s, m or h.', 'Write 2m.');
  fails('duration', '30 Сек', 'The value has spaces in it. Duration units are written as s, m or h.', 'Write 30s.');
  fails('duration', '2m-3m', 'A range has its unit once, at the end.', 'Write 2-3m.');
  fails('duration', '2min-3min', 'Duration units are written as s, m or h. A range has its unit once, at the end.', 'Write 2-3m.');
  fails('reps', '12 \u2013 8',
    'The range is joined with U+2013 instead of a hyphen (-). The value has spaces in it. The range starts with the larger number.',
    'Write 8-12.');
});

test('range order and a missing unit have their own hints', () => {
  fails('count', '4-3', 'The range starts with the larger number.', 'Write 3-4.');
  fails('count', '3-3', 'The range has the same number at both ends.', 'Write 3.');
  fails('duration', '3-2m', 'The range starts with the larger number.', 'Write 2-3m.');
  fails('duration', '2-2m', 'The range has the same number at both ends.', 'Write 2m.');
  fails('weight', '5-2.5', 'The range starts with the larger number.', 'Write 2.5-5.');
  fails('duration', 90, 'The duration has no unit.', NO_UNIT);
  fails('duration', '2-3', 'The duration has no unit.', NO_UNIT);
});

test('generic messages leave the hint to the description', () => {
  fails('count', 2.5, 'Expected a whole number such as 3, or a range such as 3-4.');
  fails('reps', 'lots', 'Expected a whole number such as 10, a range such as 8-12, a minimum such as 5+, or max.');
  fails('duration', '1:75', 'Expected a duration such as 30s, 2m, 1h or 1:30, or a range such as 2-3m.');
  fails('weight', 'heavy', 'Expected a number such as 18 or 2.5, or a range such as 2-5.');
  for (const value of [0, -1, '0-3', '3-0']) fails('count', value, 'Expected at least 1.');
  fails('reps', '0+', 'Expected at least 1.');
  for (const value of ['0s', '0:00', 0]) fails('duration', value, 'Expected more than 0.');
  for (const value of [0, -5, '0-5']) fails('weight', value, 'Expected more than 0.');
});

test('check order', () => {
  // The minimum comes before the range order, so 3-0 gets no Write hint.
  fails('count', '3-0', 'Expected at least 1.');
  // A missing unit comes before the range order, and the minimum before a missing unit.
  fails('duration', '3-2', 'The duration has no unit.', NO_UNIT);
  fails('duration', 0, 'Expected more than 0.');
  fails('duration', 1.5, 'The duration has no unit.', NO_UNIT);
  fails('weight', -5, 'Expected more than 0.');
  // The comma before a space is not a decimal comma, so 16, 20 is not offered as 16.20.
  fails('weight', '16, 20', 'Expected a number such as 18 or 2.5, or a range such as 2-5.');
  // Spaces between two digits stay, so 8 12 is not offered as 812.
  fails('reps', '8 12', 'Expected a whole number such as 10, a range such as 8-12, a minimum such as 5+, or max.');
  fails('weight', '16 20', 'Expected a number such as 18 or 2.5, or a range such as 2-5.');
  // A unit takes a whole number.
  fails('duration', '1.5m', 'Expected a duration such as 30s, 2m, 1h or 1:30, or a range such as 2-3m.');
});
