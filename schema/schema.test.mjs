import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { FORMATS } from '../core/formats.mjs';
import { check, KEYWORDS } from '../core/schema.mjs';
import { formatIssues, validate } from '../core/validate.mjs';

const schema = JSON.parse(readFileSync(new URL('./repscript.schema.json', import.meta.url), 'utf8'));

/**
 * Problems that would make the interpreter silently ignore part of the schema or leave an issue
 * without a hint.
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
for (const file of readdirSync(fixtures).filter(name => name.endsWith('.repscript.yaml'))) {
  const name = file.slice(0, -'.repscript.yaml'.length);
  test(`fixture ${name}`, () => {
    const source = readFileSync(new URL(file, fixtures), 'utf8');
    const expected = readFileSync(new URL(`${name}.expected.txt`, fixtures), 'utf8').replaceAll('\r\n', '\n');
    assert.equal(formatIssues(validate(source, schema)), expected);
  });
}
