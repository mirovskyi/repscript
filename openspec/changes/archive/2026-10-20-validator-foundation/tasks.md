# Tasks

## 1. Repository basics and parser

- [x] 1.1 Add `LICENSE` (MIT, "Copyright (c) 2026 Repscript contributors") and `.gitignore` with
  `node_modules/`; verify both files exist at the repository root.
- [x] 1.2 Bundle `yaml` 2.9.1 into `vendor/yaml.mjs` with
  `npx esbuild <pkg>/browser/dist/index.js --bundle --format=esm` (not minified). Prepend a header
  that starts with `// @ts-nocheck` and records the version, the exact command and the ISC notice.
  Verify that
  `node -e "import('./vendor/yaml.mjs').then(y => console.log(JSON.stringify(y.parseDocument('%YAML 1.1\n---\na: yes\n', {schema: 'core'}).toJS())))"`
  prints `{"a":"yes"}` (without `schema: 'core'` it would print `{"a":true}`).

## 2. Schema and core validator

- [x] 2.1 Write `schema/repscript.schema.json`: a root object requiring `repscript` (integer,
  `enum: [0]`), `id` and `title` (strings) and `workouts` (a list whose `items` schema is an object
  requiring `id`, a string). Close each object with `additionalProperties: false` and
  `patternProperties: {"^x-": {}}`. Give the root, every property and the `items` schema a
  `description` that says what it is and gives an example. Verify with the lint test in 2.4.
- [x] 2.2 Implement `core/schema.mjs`: export `KEYWORDS`, and a check of a value against the schema
  that returns issues with path arrays. It covers `type` (stops checks inside a mismatched value),
  `enum`, `required`, `properties`, `patternProperties`, `additionalProperties: false` and `items`.
  For unknown fields it produces "did you mean" or the allowed-fields hint as described in the design
  (optimal string alignment distance, threshold by the defined name's length, ties to schema order).
  Types are named in YAML terms. Verify through the fixtures in 2.5–2.7.
- [x] 2.3 Implement `core/validate.mjs`: `validate(source, schema)` follows the design's loading
  steps. It parses with `{ lineCounter, schema: 'core', stringKeys: true, prettyErrors: false }` and
  stops on syntax errors. It then reports aliases without an anchor and stops. It runs `toJS()` inside
  `try`, turning a throw into a `(top level)` error. Finally it runs the schema check, locates lines
  by the design's rules, adds the draft-version warning and sorts issues by line. Also implement
  `formatIssues(issues)`: headers, values cut at 60 characters with `...`, messages and hints from the
  design's tables, and the `errors: N, warnings: M` line. No I/O and no `node:` imports in `core/`.
  Verify through the fixtures in 2.4–2.7.
- [x] 2.4 Add `schema/schema.test.mjs` with three parts:
  - The schema lint. Only `KEYWORDS` are allowed, `type` must be one string, `additionalProperties`
    must be `false`, and the root, every property and every `items` schema need a `description`.
  - The core purity check. No `core/*.mjs` may mention `node:`.
  - The fixture runner. It compares `formatIssues(validate(...))` with `<case>.expected.txt`, reading
    `\r\n` as `\n`.

  Add the fixtures `minimal`, `yaml-core`, `json`, `empty` and `top-level-list` from the design's
  table. Write each expected report by hand from the spec and the message table before running.
  Verify that `node --test` passes. Also verify that the lint fails when you temporarily add an
  unsupported keyword, or remove the `items` description.
- [x] 2.5 Add the YAML-level fixtures `multiple-docs`, `yaml-syntax`, `duplicate-key`,
  `unresolved-alias` and `alias-limit`. Verify that `node --test` passes. Check each expected report:
  - the header is `error: (line L, column C)`, or `error: (top level)` for the alias limit;
  - there is a `Hint:` line;
  - there are no format errors;
  - `validate()` never throws.
- [x] 2.6 Add the type and value fixtures `wrong-type`, `wrong-item-type` and `unsupported-version`
  from the design's table. Verify that `node --test` passes. Check the expected reports:
  - the `workouts` error is on the `workouts:` line, and nothing inside it is reported;
  - `repscript: "0"` shows `= "0"`;
  - the long multi-line item value is one line cut to 60 characters plus `...`;
  - the `workouts[0]` hint is the `items` description.
- [x] 2.7 Add the fixtures `missing-required`, `unknown-field` and `several-issues` from the design's
  table. Verify that `node --test` passes. Check the expected reports:
  - `titel` gets `Did you mean title?` and `di` gets `Did you mean id?`;
  - `foo` gets the allowed-fields hint;
  - `1` is reported on its own line;
  - no `x-` field is reported;
  - missing fields carry their parent's line.
- [x] 2.8 Add `tsconfig.json` (`allowJs`, `checkJs`, `noEmit`, `strict`, `module` and
  `moduleResolution` set to `nodenext`, `target: es2022`, `types: ["node"]`,
  `include: ["core", "tools", "schema"]`). Install `typescript@7.0.2` and `@types/node@22` with
  `npm install --no-save`. Verify that `npx tsc -p .` reports no errors. Then temporarily add a call
  to a method that does not exist on the parsed document in `core/validate.mjs` and confirm that
  `tsc` fails; remove the call.
- [x] 2.9 Change the `MISSING_CHAR` hint in `core/validate.mjs` to the design's syntax hint table, and
  add the fixture `list-indent` from the design's table. Verify that `node --test` passes and that the
  expected report has the header `error: (line L, column C)`, the parser's
  `Sequence item without - indicator` message and the new hint.

## 3. Command line

- [x] 3.1 Implement `tools/validate.mjs`. Load the schema relative to `import.meta.url` (not the
  current directory). For each argument:
  - read the bytes and decode them with `new TextDecoder('utf-8', { fatal: true })`;
  - a read failure becomes the "unreadable file" error from the design's message table, and a
    decoding failure the "not UTF-8" error;
  - print the path, then `formatIssues`.

  With no arguments, print a usage line. Exit 1 if any file has an error or there are no arguments,
  else 0. Verify by running it on `schema/tests/minimal.repscript.yaml` (exit 0, draft warning) and on
  `schema/tests/unknown-field.repscript.yaml` (exit 1).
- [x] 3.2 Add `tools/validate.test.mjs`. It runs the CLI as a child process for: a valid file, an
  invalid file among several, a missing file, a non-UTF-8 file (Windows-1251 bytes written to a temp
  directory), and no arguments. It asserts the exit codes and that each report starts with the file
  path. Verify that `node --test` and `npx tsc -p .` both pass.

## 4. CI

- [x] 4.1 Add `.github/workflows/ci.yml`: on push and pull request, `ubuntu-latest`, Node 22.
  Steps: checkout, `npm install --no-save typescript@7.0.2 @types/node@22`, `npx tsc -p .`,
  `node --test`. Verify by running the same three commands locally from a clean `node_modules/`; all
  succeed.

## 5. Integration check

- [x] 5.1 Check the roadmap's "done when" by hand. Write a scratch program outside the repository and
  change it step by step, running `node tools/validate.mjs <file>` after each step:
  1. broken YAML;
  2. fixed YAML with `title: **Heavy**`;
  3. the title quoted, plus a wrong type, a missing required field and a typo in a field name;
  4. a clean file.

  Confirm that:
  - every error has a path (or `(line L, column C)` for YAML problems), a line and a `Hint:`;
  - the typo gets `Did you mean`;
  - the clean file ends with only the draft-version warning and exit code 0.
- [x] 5.2 Run `openspec validate validator-foundation --strict` and verify that it passes.

## 6. Review fixes

- [x] 6.1 In `core/schema.mjs`, collect issues into one array passed down the recursion instead of
  `push(...check(...))`. Add a test to `schema/schema.test.mjs` that checks a program whose
  `workouts` holds 200,000 strings and expects 200,000 issues without a throw.
- [x] 6.2 Parse with `resolveKnownTags: false`. Add the fixture `yaml-1.1-tags` from the design's table
  and verify that its report has only the draft warning.
- [x] 6.3 Replace the per-alias `resolve(doc)` check with one `visit` pass that collects anchor names in
  document order. Add the fixture `alias-before-anchor`. Verify that `node --test` passes and that a
  file with 20,000 aliases of one anchor is reported in under a second.
- [x] 6.4 Show numbers that JSON cannot write with `String(value)` in headers. Add the fixture
  `not-finite` and verify the headers end with `= Infinity` and `= NaN`.
- [x] 6.5 Update the syntax hints in `core/validate.mjs` to the design's table (`BAD_INDENT`,
  `MISSING_CHAR`, `BLOCK_AS_IMPLICIT_KEY`, `BAD_SCALAR_START`). Add the fixtures `colon-in-value`,
  `unclosed-bracket` and `reserved-char`, and update the expected reports of `yaml-syntax` and
  `list-indent`. Verify that `node --test` passes.
- [x] 6.6 In `tools/validate.mjs`, treat decoded text containing U+0000 as not UTF-8. Add a case to
  `tools/validate.test.mjs` for a UTF-16LE file without a byte order mark that holds Cyrillic text.
  Verify that it gets the "not UTF-8" error and exit code 1.
- [x] 6.7 Verify that `node --test`, `npx tsc -p .` and
  `openspec validate validator-foundation --strict` all pass.

## Workflow follow-up

- Archive the change with `/opsx:archive` after review.
- CI runs only once the project is a git repository pushed to GitHub. Creating it is outside this
  change.
