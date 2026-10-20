import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { KEYWORDS, check } from '../core/schema.mjs';
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
  const problems = Object.keys(schema).filter(key => !KEYWORDS.includes(key)).map(key => `${where}: unsupported keyword ${key}`);
  if ('type' in schema && typeof schema.type !== 'string') problems.push(`${where}: type must be one string`);
  if ('additionalProperties' in schema && schema.additionalProperties !== false) problems.push(`${where}: additionalProperties must be false`);
  if (needsDescription && !schema.description) problems.push(`${where}: no description`);
  for (const [name, sub] of Object.entries(schema.properties ?? {})) problems.push(...lint(sub, `${where}.properties.${name}`, true));
  for (const [pattern, sub] of Object.entries(schema.patternProperties ?? {})) problems.push(...lint(sub, `${where}.patternProperties.${pattern}`, false));
  if (schema.items) problems.push(...lint(schema.items, `${where}.items`, true));
  return problems;
}

test('schema uses only interpreted keywords and describes every field', () => {
  assert.deepEqual(lint(schema, '(root)', true), []);
});

test('core does not use Node modules', () => {
  const core = new URL('../core/', import.meta.url);
  for (const file of readdirSync(core).filter(name => name.endsWith('.mjs'))) {
    assert.doesNotMatch(readFileSync(new URL(file, core), 'utf8'), /node:/, file);
  }
});

test('a program with 200,000 issues does not overflow the call stack', () => {
  const program = { repscript: 0, id: 'p', title: 'T', workouts: Array(200_000).fill('A') };
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
