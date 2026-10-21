import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildCatalog } from '../core/catalog.mjs';
import { FORMATS } from '../core/formats.mjs';
import { check, closest, KEYWORDS } from '../core/schema.mjs';
import { formatIssues, validate } from '../core/validate.mjs';
import { readCatalogFiles } from '../tools/catalog.mjs';

const schema = JSON.parse(readFileSync(new URL('./repscript.schema.json', import.meta.url), 'utf8'));

/**
 * Problems that would make the interpreter silently ignore part of the schema, leave an issue without
 * a hint, or reject the x- fields that every mapping allows.
 * @param {Record<string, any>} schema
 * @param {string} where
 * @param {boolean} needsDescription
 * @returns {string[]}
 */
function lint(schema, where, needsDescription) {
  const problems = Object.keys(schema)
    .filter(key => !KEYWORDS.includes(key))
    .map(key => `${where}: unsupported keyword ${key}`);
  if ('type' in schema && typeof schema.type !== 'string') problems.push(`${where}: type must be one string`);
  if ('additionalProperties' in schema && schema.additionalProperties !== false)
    problems.push(`${where}: additionalProperties must be false`);
  if (needsDescription && !schema.description) problems.push(`${where}: no description`);
  // The format allows x- fields in every mapping.
  if (schema.additionalProperties === false && !Object.hasOwn(schema.patternProperties ?? {}, '^x-'))
    problems.push(`${where}: no ^x- pattern next to additionalProperties: false`);
  if ('format' in schema) {
    if (!Object.hasOwn(FORMATS, schema.format)) problems.push(`${where}: unknown format ${schema.format}`);
    // check() stops after format, so any other keyword next to it would be ignored.
    const others = Object.keys(schema).filter(key => !['format', 'description', 'title'].includes(key));
    if (others.length) problems.push(`${where}: ${others.join(', ')} next to format`);
  }
  for (const [name, sub] of Object.entries(schema.properties ?? {}))
    problems.push(...lint(sub, `${where}.properties.${name}`, true));
  for (const [pattern, sub] of Object.entries(schema.patternProperties ?? {}))
    problems.push(...lint(sub, `${where}.patternProperties.${pattern}`, false));
  if (schema.items) problems.push(...lint(schema.items, `${where}.items`, true));
  return problems;
}

test('schema uses only interpreted keywords and describes every field', () => {
  assert.deepEqual(lint(schema, '(root)', true), []);
});

test('lint rejects an unknown format and keywords next to a format', () => {
  assert.deepEqual(lint({ description: 'x', format: 'nope', type: 'string' }, 'x', true), [
    'x: unknown format nope',
    'x: type next to format',
  ]);
});

test('lint rejects a closed mapping without x- fields', () => {
  const closed = { description: 'x', type: 'object', additionalProperties: false };
  assert.deepEqual(lint(closed, 'x', true), ['x: no ^x- pattern next to additionalProperties: false']);
  assert.deepEqual(lint({ ...closed, patternProperties: { '^x-': {} } }, 'x', true), []);
});

test('core does not use Node modules', () => {
  const core = new URL('../core/', import.meta.url);
  for (const file of readdirSync(core).filter(name => name.endsWith('.mjs'))) {
    assert.doesNotMatch(readFileSync(new URL(file, core), 'utf8'), /node:/, file);
  }
});

test('minimum, minItems and format', () => {
  const description = 'The field.';
  assert.deepEqual(check(0, { minimum: 1, description }), [
    { path: [], value: 0, message: 'Expected at least 1.', hint: description },
  ]);
  assert.deepEqual(check([], { minItems: 1, description }), [
    { path: [], value: [], message: 'Expected at least 1 item.', hint: description },
  ]);
  assert.deepEqual(check([1], { minItems: 2 })[0].message, 'Expected at least 2 items.');
  const reps = { format: 'reps', description };
  const expected = 'a whole number such as 10, a range such as 8-12, a minimum such as 5+, or max';
  assert.deepEqual(check('lots', reps), [
    { path: [], value: 'lots', message: `Expected ${expected}.`, hint: description },
  ]);
  assert.deepEqual(check([], reps), [
    { path: [], value: [], message: `Expected ${expected}, found a list.`, hint: description },
  ]);
  assert.deepEqual(check('8–12', reps), [
    {
      path: [],
      value: '8–12',
      message: 'The range is joined with U+2013 instead of a hyphen (-).',
      hint: 'Write 8-12.',
    },
  ]);
  assert.deepEqual(check('8-12', reps), []);
});

test('minProperties counts every field', () => {
  const description = 'The mapping.';
  assert.deepEqual(check({}, { type: 'object', minProperties: 2, description }), [
    { path: [], value: {}, message: 'Expected at least 2 fields.', hint: description },
  ]);
  assert.deepEqual(check({ a: 1 }, { type: 'object', minProperties: 2, description }), [
    { path: [], value: { a: 1 }, message: 'Expected at least 2 fields.', hint: description },
  ]);
  assert.deepEqual(check({ a: 1 }, { type: 'object', minProperties: 1, description }), []);
  assert.deepEqual(
    check({}, { type: 'object', minProperties: 1, description })[0].message,
    'Expected at least 1 field.',
  );
});

test('an unknown field in a mapping named by a pattern gets the mapping description', () => {
  const names = {
    type: 'object',
    description: 'Names by language code.',
    patternProperties: { '^[a-z]{2}$': { type: 'string' } },
    additionalProperties: /** @type {const} */ (false),
  };
  assert.deepEqual(check({ english: 'Pull-up' }, names), [
    { path: ['english'], message: 'Unknown field.', hint: 'Names by language code.' },
  ]);
});

test('closest finds the nearest candidate within reach', () => {
  assert.equal(closest('titel', ['id', 'title', 'notes']), 'title');
  assert.equal(closest('DI', ['id']), 'id');
  // Two edits from a long candidate, but one is the limit for four characters or fewer.
  assert.equal(closest('pullup.wdie', ['pullup', 'pullup.wide']), 'pullup.wide');
  assert.equal(closest('lat', ['abs', 'lats']), 'lats');
  // A tie goes to the first candidate.
  assert.equal(closest('cat', ['bat', 'hat']), 'bat');
  assert.equal(closest('wings', ['lats', 'pecs']), undefined);
  assert.equal(closest('ab', ['abcd']), undefined);
});

test('a string close to an allowed value gets "Did you mean"', () => {
  const description = 'The goal.';
  const goal = { type: 'string', enum: ['strength', 'hypertrophy', 'muscular_endurance'], description };
  const message = 'Expected one of: "strength", "hypertrophy", "muscular_endurance".';
  for (const [value, hint] of [
    ['Hypertrophy', 'Did you mean hypertrophy?'],
    ['strenght', 'Did you mean strength?'],
    ['muscular-endurance', 'Did you mean muscular_endurance?'],
    ['endurance', description],
  ]) {
    assert.deepEqual(check(value, goal), [{ path: [], value, message, hint }], value);
  }
  // Values that are not strings are not compared, with each other or with strings.
  assert.deepEqual(check(1, { type: 'integer', enum: [0], description }), [
    { path: [], value: 1, message: 'Expected one of: 0.', hint: description },
  ]);
  assert.deepEqual(check(1, { enum: ['1'], description }), [
    { path: [], value: 1, message: 'Expected one of: "1".', hint: description },
  ]);
  assert.deepEqual(check('o', { enum: [0, 'on'], description }), [
    { path: [], value: 'o', message: 'Expected one of: 0, "on".', hint: 'Did you mean on?' },
  ]);
});

test('an empty field named by digits gets the flow comma hint', () => {
  const load = {
    type: 'object',
    properties: { kg: { format: 'weight', description: 'kg' } },
    additionalProperties: /** @type {const} */ (false),
  };
  assert.deepEqual(check({ kg: 2, 5: null }, load), [
    {
      path: ['5'],
      message: 'Unknown field.',
      hint: 'A comma inside { } separates fields, so a value such as 2,5 is read as 2 plus a field 5. Write decimals with a dot (kg: 2.5) and ranges with a hyphen (reps: 8-12).',
    },
  ]);
  assert.deepEqual(check({ 1: 'one' }, load), [
    {
      path: ['1'],
      message: 'Unknown field.',
      hint: 'Allowed fields here: kg. Extension fields start with x-.',
    },
  ]);
});

test('a program with 200,000 issues does not overflow the call stack', () => {
  const program = { repscript: 0, id: 'p', revision: 1, title: 'T', workouts: Array(200_000).fill('A') };
  assert.equal(check(program, schema).length, 200_000);
});

const fixtures = new URL('./tests/', import.meta.url);
// The test catalog, not the project's: the real one grows, and its growth would change suggestions and
// key lists in the pinned reports.
const catalog = buildCatalog(readCatalogFiles(new URL('catalog/', fixtures)));
for (const file of readdirSync(fixtures).filter(name => name.endsWith('.repscript.yaml'))) {
  const name = file.slice(0, -'.repscript.yaml'.length);
  test(`fixture ${name}`, () => {
    const source = readFileSync(new URL(file, fixtures), 'utf8');
    const expected = readFileSync(new URL(`${name}.expected.txt`, fixtures), 'utf8').replaceAll('\r\n', '\n');
    assert.equal(formatIssues(validate(source, schema, catalog)), expected);
  });
}

/**
 * The errors in a small valid program with extra top-level lines, without line numbers.
 * @param {string} lines
 */
function errors(lines) {
  const source = `repscript: 0\nid: p\nrevision: 1\ntitle: T\n${lines}\nworkouts: [{id: A, blocks: [{exercise: pushup, sets: 3, reps: 10}]}]\n`;
  return validate(source, schema, catalog)
    .filter(issue => issue.severity === 'error')
    .map(({ path, message, hint }) => ({ path, message, hint }));
}

test('goal takes one of five values, with "Did you mean" for near misses', () => {
  const hint = schema.properties.goal.description;
  for (const goal of ['strength', 'hypertrophy', 'power', 'muscular_endurance', 'health'])
    assert.deepEqual(errors(`goal: ${goal}`), [], goal);
  const message = 'Expected one of: "strength", "hypertrophy", "power", "muscular_endurance", "health".';
  for (const [goal, expected] of [
    ['Hypertrophy', 'Did you mean hypertrophy?'],
    ['strenght', 'Did you mean strength?'],
    ['muscular-endurance', 'Did you mean muscular_endurance?'],
    ['endurance', hint],
  ])
    assert.deepEqual(errors(`goal: ${goal}`), [{ path: 'goal', message, hint: expected }], goal);
  assert.deepEqual(errors('goal: [strength, hypertrophy]'), [
    { path: 'goal', message: 'Expected a string, found a list.', hint },
  ]);
});

test('schedule requires per_week, a count', () => {
  const hint = schema.properties.schedule.properties.per_week.description;
  assert.deepEqual(errors('schedule: {}'), [{ path: 'schedule.per_week', message: 'Missing required field.', hint }]);
  assert.deepEqual(errors('schedule: {per_week: "3–4"}'), [
    {
      path: 'schedule.per_week',
      message: 'The range is joined with U+2013 instead of a hyphen (-).',
      hint: 'Write 3-4.',
    },
  ]);
  assert.deepEqual(errors('schedule: {per_week: "3"}'), []);
  assert.deepEqual(errors('schedule: {per_week: 3-4}'), []);
  assert.deepEqual(errors('schedule: 3'), [
    {
      path: 'schedule',
      message: 'Expected a mapping, found an integer.',
      hint: schema.properties.schedule.description,
    },
  ]);
  // per_week belongs in schedule; at the top level it is unknown, and the allowed fields name schedule.
  const [topLevel, ...others] = errors('per_week: 3');
  assert.deepEqual(others, []);
  assert.equal(topLevel.path, 'per_week');
  assert.equal(topLevel.message, 'Unknown field.');
  assert.match(topLevel.hint ?? '', /^Allowed fields here: .*\bschedule\b/);
});
