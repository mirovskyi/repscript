// Interpreter for the JSON Schema subset that schema/repscript.schema.json uses.
// Works on plain values (the output of YAML toJS or JSON.parse) and returns issues with path arrays.

import { FORMATS } from './formats.mjs';

/** Keywords the interpreter understands. The schema lint test rejects any other. */
export const KEYWORDS = [
  '$schema', 'title', 'description',
  'type', 'enum', 'minimum', 'format', 'properties', 'required', 'patternProperties', 'additionalProperties',
  'minItems', 'items',
];

/**
 * @typedef {object} Schema
 * @property {string} [description]
 * @property {string} [type]
 * @property {unknown[]} [enum]
 * @property {number} [minimum]
 * @property {string} [format] a key of FORMATS
 * @property {Record<string, Schema>} [properties]
 * @property {string[]} [required]
 * @property {Record<string, Schema>} [patternProperties]
 * @property {number} [minItems]
 * @property {Schema} [items]
 * @property {false} [additionalProperties]
 */

/**
 * @typedef {object} SchemaIssue
 * @property {(string|number)[]} path
 * @property {unknown} [value]
 * @property {string} message
 * @property {string} [hint]
 */

/** JSON type names as the reader of a YAML file knows them. @type {Record<string, string>} */
const TYPE_NAMES = {
  object: 'a mapping', array: 'a list', string: 'a string', integer: 'an integer',
  number: 'a number', boolean: 'a boolean', null: 'an empty value',
};

/** For {kg: 2,5}, which YAML reads as kg: 2 plus an empty field 5. */
const FLOW_COMMA_HINT = 'A comma inside { } separates fields, so a value such as 2,5 is read as 2 plus a field 5. Write decimals with a dot (kg: 2.5) and ranges with a hyphen (reps: 8-12).';

/** @param {unknown} value */
function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

/**
 * Checks a value against a schema. A value of the wrong type is not looked into.
 * @param {unknown} value
 * @param {Schema} schema
 * @param {(string|number)[]} [path]
 * @param {SchemaIssue[]} [issues] filled in place; one array for the whole walk, because spreading
 *   child results into push(...) overflows the call stack on a file with ~125,000 issues
 * @returns {SchemaIssue[]}
 */
export function check(value, schema, path = [], issues = []) {
  const type = typeOf(value);
  if (schema.type && type !== schema.type && !(schema.type === 'number' && type === 'integer')) {
    issues.push({ path, value, message: `Expected ${TYPE_NAMES[schema.type]}, found ${TYPE_NAMES[type]}.`, hint: schema.description });
    return issues;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    const allowed = schema.enum.map(v => JSON.stringify(v)).join(', ');
    issues.push({ path, value, message: `Expected one of: ${allowed}.`, hint: schema.description });
  }
  if (schema.minimum !== undefined && typeof value === 'number' && value < schema.minimum) {
    issues.push({ path, value, message: `Expected at least ${schema.minimum}.`, hint: schema.description });
  }
  if (schema.format) {
    const { expected, parse } = FORMATS[schema.format];
    const result = typeof value === 'number' || typeof value === 'string' ? parse(value)
      : { message: `Expected ${expected}, found ${TYPE_NAMES[type]}.` };
    if ('message' in result) issues.push({ path, value, message: result.message, hint: result.hint ?? schema.description });
    return issues;
  }
  if (type === 'object') {
    const fields = /** @type {Record<string, unknown>} */ (value);
    const properties = schema.properties ?? {};
    for (const name of schema.required ?? []) {
      if (!Object.hasOwn(fields, name)) {
        issues.push({ path: [...path, name], message: 'Missing required field.', hint: properties[name]?.description });
      }
    }
    for (const [name, field] of Object.entries(fields)) {
      const fieldSchema = Object.hasOwn(properties, name) ? properties[name]
        : Object.entries(schema.patternProperties ?? {}).find(([pattern]) => new RegExp(pattern, 'u').test(name))?.[1];
      if (fieldSchema) check(field, fieldSchema, [...path, name], issues);
      else if (schema.additionalProperties === false) {
        const hint = field === null && /^\d+$/.test(name) ? FLOW_COMMA_HINT : unknownFieldHint(name, Object.keys(properties));
        issues.push({ path: [...path, name], message: 'Unknown field.', hint });
      }
    }
  }
  if (type === 'array') {
    const list = /** @type {unknown[]} */ (value);
    const min = schema.minItems;
    if (min !== undefined && list.length < min) {
      issues.push({ path, value, message: `Expected at least ${min} item${min === 1 ? '' : 's'}.`, hint: schema.description });
    }
    const items = schema.items;
    if (items) list.forEach((item, i) => check(item, items, [...path, i], issues));
  }
  return issues;
}

/**
 * "Did you mean" for the nearest defined field within reach, else the list of allowed fields.
 * @param {string} name
 * @param {string[]} defined
 */
function unknownFieldHint(name, defined) {
  let best = '';
  let bestDistance = Infinity;
  for (const field of defined) {
    const d = distance(name.toLowerCase(), field.toLowerCase());
    if (d <= (field.length <= 4 ? 1 : 2) && d < bestDistance) [best, bestDistance] = [field, d];
  }
  return best ? `Did you mean ${best}?` : `Allowed fields here: ${defined.join(', ')}. Extension fields start with x-.`;
}

/**
 * Optimal string alignment distance: insertions, deletions, replacements and swaps of adjacent letters.
 * @param {string} a
 * @param {string} b
 */
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => i || j));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
