// Checks a program's source text, or a catalog entry's, and formats the issues as the report an AI
// agent reads. No I/O: the caller passes the decoded text, the schema and the catalog.

import { Alias, LineCounter, parseDocument, Scalar, visit, YAMLMap, YAMLSeq } from '../vendor/yaml.mjs';
import { checkEntry } from './exercises.mjs';
import { checkRules } from './rules.mjs';
import { check } from './schema.mjs';

/** @typedef {import('./schema.mjs').Schema} Schema */
/** @typedef {import('./catalog.mjs').Catalog} Catalog */
/** @typedef {import('./rules.mjs').RuleIssue} RuleIssue */

/**
 * @typedef {object} Issue
 * @property {'error'|'warning'} severity
 * @property {string} path
 * @property {number} [line]
 * @property {number} [column]
 * @property {unknown} [value]
 * @property {string} message
 * @property {string} [hint]
 */

const TOP = '(top level)';

/** @type {Record<string, string>} */
const SYNTAX_HINTS = {
  BAD_INDENT:
    'Indent nested fields with spaces, the same amount at each level. If a [ or { above is not closed, close it.',
  TAB_AS_INDENT: 'Indent with spaces, not tabs.',
  DUPLICATE_KEY: 'Each field may appear only once in a mapping. Remove or rename this one.',
  MULTIPLE_DOCS:
    'Put one program per file. Remove this --- line and what follows it, or move that part to its own file.',
  MISSING_CHAR:
    'Check the indentation and that every bracket and quote is closed. An unclosed one may start well above this line.',
  BLOCK_AS_IMPLICIT_KEY:
    'A value containing ": " must be in quotes, e.g. title: "Week 1: Strength". Otherwise check the indentation of this line and the next one.',
  UNEXPECTED_TOKEN:
    'This character has a special meaning in YAML (for example * & [ ] { } #). Put the value in quotes.',
  BAD_SCALAR_START:
    'A value cannot start with this character (for example @ or a backtick). Put the value in quotes, e.g. title: "@home".',
  NON_STRING_KEY: 'A field name must be a plain word, not a list or a mapping.',
};
const SYNTAX_HINT = 'Fix the YAML at this line. The rest of the file was not checked.';
const ALIAS_HINT =
  'A value starting with * is read as a YAML alias, and one starting with & as an anchor. Put the value in quotes, e.g. title: "**Heavy**".';
const ALIAS_LIMIT_HINT = 'Write the values out instead of repeating them with YAML aliases (*name).';

/**
 * @typedef {object} Checked
 * @property {Issue[]} issues sorted by line, issues without a line first
 * @property {unknown} data the parsed program, or undefined after a YAML or alias error
 * @property {(path: (string|number)[]) => number | undefined} lineOf the line of a path, as an issue gets
 *   it; undefined for every path after a YAML or alias error
 */

/**
 * Checks a program.
 * @param {string} source the file's text, already decoded
 * @param {Schema} schema
 * @param {Catalog} catalog required: a missing catalog must not quietly skip the exercise checks
 * @returns {Issue[]} sorted by line, issues without a line first
 */
export function validate(source, schema, catalog) {
  return checkProgram(source, schema, catalog).issues;
}

/**
 * Checks a program and keeps what the program report needs: the parsed data and the line of a path,
 * so the report never parses the source a second time.
 * @param {string} source the file's text, already decoded
 * @param {Schema} schema
 * @param {Catalog} catalog
 * @returns {Checked}
 */
export function checkProgram(source, schema, catalog) {
  return checkSource(source, schema, data => checkRules(data, catalog));
}

/**
 * Checks one catalog entry file against the entry schema and the catalog's rules. Paths in the report
 * are relative to the entry, such as muscles.primary[0].
 * @param {string} source the file's text, already decoded
 * @param {Schema} schema the program schema, whose exercises items describe an entry
 * @param {Catalog} catalog
 * @param {string} file the path with /, such as catalog/exercises/pullup.wide.yaml: the part after the
 *   last / is the file name the id must match
 * @returns {Issue[]} sorted by line, issues without a line first
 */
export function validateEntry(source, schema, catalog, file) {
  const entry = /** @type {Schema} */ (schema.properties?.exercises?.items);
  const fileName = file.slice(file.lastIndexOf('/') + 1);
  return checkSource(source, entry, data =>
    typeof data === 'object' && data !== null && !Array.isArray(data)
      ? checkEntry(/** @type {Record<string, unknown>} */ (data), [], { catalog, scope: 'catalog', fileName })
      : [],
  ).issues;
}

/** What a source that does not parse gives: its issues, and no data or lines. */
const UNPARSED = { data: undefined, lineOf: () => undefined };

/**
 * Parses a source, checks the data against the schema and then the rules, and gives each issue its line.
 * @param {string} source
 * @param {Schema} schema
 * @param {(data: unknown) => RuleIssue[]} rules
 * @returns {Checked}
 */
function checkSource(source, schema, rules) {
  const lineCounter = new LineCounter();
  const doc = parseDocument(source, {
    lineCounter,
    schema: 'core',
    stringKeys: true,
    prettyErrors: false,
    resolveKnownTags: false,
  });
  if (!doc) throw new Error('yaml parseDocument returned no document');
  /** @param {number} offset */
  const at = offset => {
    const { line, col } = lineCounter.linePos(offset);
    return { line, column: col };
  };

  if (doc.errors.length) {
    const issues = sortByLine(
      doc.errors.map(error => ({
        severity: 'error',
        path: TOP,
        ...at(error.pos[0]),
        message: error.message,
        hint: SYNTAX_HINTS[error.code] ?? SYNTAX_HINT,
      })),
    );
    return { issues, ...UNPARSED };
  }

  // One pass in document order: an alias refers to an anchor above it. alias.resolve(doc) per alias
  // would walk the whole document each time.
  /** @type {Issue[]} */
  const aliases = [];
  const anchors = new Set();
  visit(doc, {
    /** @param {unknown} _ @param {unknown} node */
    Node(_, node) {
      if (node instanceof Alias) {
        if (!anchors.has(node.source)) {
          aliases.push({
            severity: 'error',
            path: TOP,
            ...at(start(node) ?? 0),
            message: `Alias *${node.source} has no anchor.`,
            hint: ALIAS_HINT,
          });
        }
      } else {
        const anchor = /** @type {{ anchor?: string }} */ (node).anchor;
        if (anchor) anchors.add(anchor);
      }
    },
  });
  if (aliases.length) return { issues: aliases, ...UNPARSED };

  let data;
  try {
    data = doc.toJS();
  } catch (error) {
    const issue = {
      severity: /** @type {const} */ ('error'),
      path: TOP,
      message: error instanceof Error ? error.message : String(error),
      hint: ALIAS_LIMIT_HINT,
    };
    return { issues: [issue], ...UNPARSED };
  }

  /** @param {(string|number)[]} path */
  const lineOf = path => {
    const offset = locate(doc.contents, path);
    return offset === undefined ? undefined : lineCounter.linePos(offset).line;
  };
  // Schema issues first: the stable sort keeps them before rule issues on a shared line.
  /** @type {RuleIssue[]} */
  const found = check(data, schema).map(issue => ({ ...issue, severity: 'error' }));
  const issues = sortByLine(
    found.concat(rules(data)).map(issue => ({ ...issue, path: formatPath(issue.path), line: lineOf(issue.path) })),
  );
  return { issues, data, lineOf };
}

/**
 * Offset of the deepest node the path reaches: a field's key, a list item's start, or the top-level
 * node for the empty path. A missing field therefore gets its parent's position.
 * ponytail: linear search per path step, so 10k unknown fields in one mapping take about a second;
 * index the pairs by key if files that large show up.
 * @param {unknown} node
 * @param {(string|number)[]} path
 * @returns {number | undefined}
 */
function locate(node, path) {
  let offset = start(node);
  for (const step of path) {
    if (node instanceof YAMLMap) {
      const pair = node.items.find(p => p.key instanceof Scalar && p.key.value === step);
      if (!pair) break;
      offset = start(pair.key) ?? offset;
      node = pair.value;
    } else if (node instanceof YAMLSeq && typeof step === 'number' && step < node.items.length) {
      node = node.items[step];
      offset = start(node) ?? offset;
    } else break;
  }
  return offset;
}

/**
 * @param {unknown} node a YAML node, or null for an empty value
 * @returns {number | undefined}
 */
function start(node) {
  return /** @type {{ range?: number[] } | null | undefined} */ (node)?.range?.[0];
}

/**
 * A path as an issue writes it, such as workouts[0].blocks[2].rest.
 * @param {(string|number)[]} path
 */
export function formatPath(path) {
  if (!path.length) return TOP;
  return path.map((step, i) => (typeof step === 'number' ? `[${step}]` : i ? `.${step}` : step)).join('');
}

/**
 * A value as an issue header writes it after =: JSON, so a string is quoted, cut at 60 characters.
 * @param {unknown} value
 * @returns {string | undefined} undefined for a value that is not a string, a number or a boolean
 */
export function formatValue(value) {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return undefined;
  // JSON has no Infinity or NaN: JSON.stringify would print null.
  const json = typeof value === 'number' && !Number.isFinite(value) ? String(value) : JSON.stringify(value);
  return json.length > 60 ? `${json.slice(0, 60)}...` : json;
}

/** @param {Issue[]} issues */
function sortByLine(issues) {
  return issues.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
}

/**
 * The report body: every issue, then the counts. The caller prints the file path above it.
 * @param {Issue[]} issues
 * @returns {string} lines ending with a newline
 */
export function formatIssues(issues) {
  const lines = [];
  for (const { severity, path, line, column, value, message, hint } of issues) {
    let header =
      column === undefined ? path + (line === undefined ? '' : ` (line ${line})`) : `(line ${line}, column ${column})`;
    const shown = formatValue(value);
    if (shown !== undefined) header += ` = ${shown}`;
    lines.push(`${severity}: ${header}`, `  ${message}`);
    if (hint) lines.push(`  Hint: ${hint}`);
  }
  const errors = issues.filter(issue => issue.severity === 'error').length;
  lines.push(`errors: ${errors}, warnings: ${issues.length - errors}`);
  return `${lines.join('\n')}\n`;
}
