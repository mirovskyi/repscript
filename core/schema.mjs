// Interpreter for the JSON Schema subset that schema/repscript.schema.json uses.
// Works on plain values (the output of YAML toJS or JSON.parse) and returns issues with path arrays.

/** Keywords the interpreter understands. The schema lint test rejects any other. */
export const KEYWORDS = [
  '$schema', 'title', 'description',
  'type', 'enum', 'properties', 'required', 'patternProperties', 'items', 'additionalProperties',
];

/**
 * @typedef {object} Schema
 * @property {string} [description]
 * @property {string} [type]
 * @property {unknown[]} [enum]
 * @property {Record<string, Schema>} [properties]
 * @property {string[]} [required]
 * @property {Record<string, Schema>} [patternProperties]
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
        issues.push({ path: [...path, name], message: 'Unknown field.', hint: unknownFieldHint(name, Object.keys(properties)) });
      }
    }
  }
  if (type === 'array' && schema.items) {
    const items = schema.items;
    /** @type {unknown[]} */ (value).forEach((item, i) => check(item, items, [...path, i], issues));
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
