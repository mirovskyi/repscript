# Design

## Context

The repository holds only drafts (`SPEC.md`, `ROADMAP.md`) and the OpenSpec setup; there is no code
yet. Constraints already decided (see `ROADMAP.md`, Stack): plain ESM JavaScript with JSDoc types,
`tsc --noEmit` in CI only, Node 22+ standard library, no build step and no `npm install` for users. A
pure `core/` is shared by `tools/*.mjs` and the future browser player. Requirements are in
`specs/program-format` and `specs/program-validation`.

## Goals / Non-Goals

**Goals:**
- Fix the module layout, parser, schema dialect and report format that later format changes extend
  by adding schema fields, fixtures and, when needed, one interpreter keyword at a time.
- Keep `core/` free of I/O and Node APIs so the player can load it unchanged.

**Non-Goals:**
- Any check the schema cannot express yet: unique workout ids, id patterns, catalog references.
- Keywords not used by this schema (`pattern`, `oneOf`, `minItems`, `$ref`…). Each arrives with the
  change that first needs it.
- Banning YAML anchors and aliases. They stay legal; only broken or runaway ones are reported.
- Machine-readable output (`--json`), directory or glob arguments, column numbers for format errors.
- Validating `examples/` in CI (there are no examples yet) and the `yaml-language-server` header.

## Decisions

### File layout and `.mjs` everywhere

```
vendor/yaml.mjs               parser, bundled once; starts with // @ts-nocheck
core/schema.mjs               JSON Schema subset interpreter + "did you mean"; exports KEYWORDS
core/validate.mjs             validate(source, schema) -> Issue[]; formatIssues(issues) -> string
schema/repscript.schema.json  the format
schema/tests/*.repscript.yaml fixtures; *.expected.txt golden reports
schema/schema.test.mjs        fixture runner, schema lint, core purity check
tools/validate.mjs            CLI: reads and decodes files, prints reports, sets exit code
tools/validate.test.mjs       CLI behaviour
```

All sources use `.mjs`. Without a `package.json`, `.js` is ambiguous: Node guesses the module type, and
`tsc` with `module: nodenext` treats it as CommonJS. `.mjs` is ESM in Node, in `tsc` and in browsers.
The player's server will serve it as `text/javascript`.

`core/` takes the source text and the schema as arguments, so it does no I/O and needs no import
attributes. Issue shape: `{ severity: 'error'|'warning', path: string, line?: number, column?: number,
value?: unknown, message: string, hint?: string }`.

### Parser: `yaml` 2.9.1, bundled once into one file

`yaml` (eemeli, ISC, no dependencies) gives a document tree with a source range on every node plus a
`LineCounter`, and reads YAML 1.2 core. Its package has no single-file build (`browser/dist` is 73
modules), so a maintainer bundles it once:
`npx esbuild <pkg>/browser/dist/index.js --bundle --format=esm --outfile=vendor/yaml.mjs` (not
minified, so it stays reviewable). A header records the version, the command and the ISC notice, and
starts with `// @ts-nocheck`. Users never run this.

With `// @ts-nocheck`, `tsc` does not report errors inside the bundle but still infers its types, so
`core/` is checked against the real API (a call to a method that does not exist fails `tsc`). That
avoids a hand-written declaration file that could drift from the library. Inferred types are looser:
`parseDocument` returns a possibly-null document, so `core/` checks for that.

Alternatives: js-yaml 4 ships a single `.mjs` but exposes no node positions (only a parse-event
listener) and needs care to get core-schema behaviour. Vendoring the 73-file `browser/dist` tree
avoids esbuild but is not a single file. The jsDelivr `+esm` bundle is minified. A hand-written
`yaml.d.mts` gives tighter types but can drift unnoticed.

Parse call: `parseDocument(source, { lineCounter, schema: 'core', stringKeys: true, prettyErrors: false, resolveKnownTags: false })`.
- `schema: 'core'` overrides a `%YAML 1.1` directive, so `yes` stays a string and `<<` stays a plain key.
- `resolveKnownTags: false` stops YAML 1.1 tags outside the core schema (`!!timestamp`, `!!binary`,
  `!!set`, `!!omap`, `!!pairs`) from producing a `Date`, bytes, a `Set` or a `Map`. Such a value is read
  as the plain string, list or mapping it is written as. Core tags such as `!!str` still apply.
- `stringKeys: true` turns scalar keys such as `1:` or `null:` into strings, so every key can be
  located. A list or mapping used as a key becomes a `NON_STRING_KEY` syntax error.
- `uniqueKeys` stays on (the default), so a duplicate key is a syntax error.
- `prettyErrors: false` keeps messages to one line. Line and column come from `error.pos[0]` through
  the `LineCounter`.
- A second document, even a bare trailing `---`, is a `MULTIPLE_DOCS` error from the library.

### Loading: decode, parse, resolve aliases, convert

1. The CLI reads bytes and decodes them with `new TextDecoder('utf-8', { fatal: true })`. This drops a
   byte order mark and rejects Windows-1251 and UTF-16 input, which would otherwise pass as garbled or
   one long string. UTF-16 without a byte order mark can still decode cleanly (Latin and Cyrillic
   letters turn into a character plus a NUL), so decoded text containing U+0000 is also rejected. YAML
   does not allow NUL anyway. Either failure becomes the "not UTF-8" error.
2. `core` parses. If `doc.errors` is not empty, it returns those errors and stops.
3. It then visits every node once, in document order, collecting anchor names. An alias whose name has
   no anchor before it (an AI writing `title: **Heavy**`) is reported at the alias's position, and
   checking stops. Without this step, `toJS()` throws. One pass keeps the check linear; calling
   `alias.resolve(doc)` per alias walks the whole document each time, which takes seconds for a file
   with thousands of aliases, before `maxAliasCount` gets a chance to stop it.
4. `doc.toJS()` runs inside `try`. The default `maxAliasCount` makes it throw on an alias bomb. That
   becomes an `(top level)` error, so the CLI never crashes and goes on to the next file.

### Validate plain values, locate lines afterwards

The interpreter walks the plain data from `toJS()` and returns issues with a path array. A locator then
turns a path into a line by walking the document tree. When the last step is a field, it uses the line
of that field's key node. When the last step is a list position, it uses the line where the item starts.
The empty path uses the start of the top-level value. A missing field is located at its parent's
path. A type error on `workouts:` with a block value therefore points at the `workouts:` line, not at
the first nested line. Unknown fields use the same rule. The line is omitted only when there is no node,
as for the top level of an empty file.

Alternative: walk the YAML tree directly. That ties the interpreter to the parser; the player will
also need to check data it already holds as plain objects.

### Schema dialect: a small subset, enforced by a lint test

`core/schema.mjs` exports `KEYWORDS`, the keywords it interprets:
- annotations: `$schema`, `title`, `description`;
- `type`, one JSON type name;
- `enum`, `properties`, `required`, `patternProperties`, `items`;
- `additionalProperties`, only `false`.

The lint test in `schema/schema.test.mjs` walks the schema and fails when:
- a keyword is not in `KEYWORDS`;
- `type` is not a single string;
- `additionalProperties` is anything other than `false`;
- the root, a property or an `items` schema has no `description`. These are every schema a hint can
  come from.

A keyword the interpreter would silently ignore can never enter the schema.

Each object schema closes its field set with `additionalProperties: false` plus
`patternProperties: { "^x-": {} }`. This is standard JSON Schema, so editors using the same file agree
with the validator about `x-*` fields.

Rules of the walk:
- A `type` mismatch stops checks inside that value (no cascade).
- Unknown keys are checked against `properties`, then `patternProperties`, then reported.
- Actual types are named in YAML terms. A JS number is `integer` when `Number.isInteger`, otherwise
  `number`. `null` is `empty value`.
- Issues go into one array passed down the recursion. Spreading a child's issues into `push(...)`
  overflows the call stack once a file has about 125,000 issues, and the CLI would crash.

### Hints come from `description`

The hint for a type, value or missing-field error is the `description` of the schema for that value:
a property, an `items` schema, or the root for top-level errors. `description` is the standard
annotation that editors show on hover, so a human and an AI read the same text, and there is no custom
keyword to interpret. Each description says what the value is and gives an example. If a later field
needs fix advice that differs from its description, an `x-hint` keyword can be added then.

"Did you mean": the unknown name and each defined field of the same mapping are compared ignoring
letter case. The comparison uses optimal string alignment distance, where a swap of two adjacent
letters is one edit. A candidate qualifies within 2 edits, or within 1 edit when the defined name has
four letters or fewer. The nearest qualifying candidate wins, with ties going to schema order.

Checks the schema cannot express run in `core/validate.mjs` after the schema walk. In this change
there is one: the draft-version warning when `repscript === 0`.

### Messages

This table is the AI-facing wording. The fixtures pin it, and golden reports are written from it.
`<a type>` is one of `a mapping`, `a list`, `a string`, `an integer`, `a number`, `a boolean`,
`an empty value`.

| Issue | Header | Message | Hint |
|---|---|---|---|
| YAML syntax | `error: (line L, column C)` | the parser's message | by error code, below |
| Alias without anchor | `error: (line L, column C)` | `Alias *<name> has no anchor.` | `A value starting with * is read as a YAML alias, and one starting with & as an anchor. Put the value in quotes, e.g. title: "**Heavy**".` |
| Alias limit | `error: (top level)` | the parser's message | `Write the values out instead of repeating them with YAML aliases (*name).` |
| Wrong type | `error: <path> (line L)[ = v]` | `Expected <a type>, found <a type>.` | description |
| Value not allowed | `error: <path> (line L)[ = v]` | `Expected one of: <values as JSON, comma-separated>.` | description |
| Missing field | `error: <path> (line L)` | `Missing required field.` | description of the missing field |
| Unknown field | `error: <path> (line L)` | `Unknown field.` | `Did you mean <field>?`, or `Allowed fields here: <a, b, c>. Extension fields start with x-.` |
| Draft version | `warning: repscript (line L) = 0` | `Format version 0 is a draft: the format may still change before the first release.` | none |
| Unreadable file | `error: (top level)` | `Cannot read the file: <system message>.` | `Check the file path.` |
| Not UTF-8 | `error: (top level)` | `The file is not UTF-8 text.` | `Save the file as UTF-8.` |

Syntax hints by error code:

| Code | Hint |
|---|---|
| `BAD_INDENT` | `Indent nested fields with spaces, the same amount at each level. If a [ or { above is not closed, close it.` |
| `TAB_AS_INDENT` | `Indent with spaces, not tabs.` |
| `DUPLICATE_KEY` | `Each field may appear only once in a mapping. Remove or rename this one.` |
| `MULTIPLE_DOCS` | `Put one program per file. Remove this --- line and what follows it, or move that part to its own file.` |
| `MISSING_CHAR` | `Check the indentation and that every bracket and quote is closed. An unclosed one may start well above this line.` |
| `BLOCK_AS_IMPLICIT_KEY` | `A value containing ": " must be in quotes, e.g. title: "Week 1: Strength". Otherwise check the indentation of this line and the next one.` |
| `UNEXPECTED_TOKEN` | `This character has a special meaning in YAML (for example * & [ ] { } #). Put the value in quotes.` |
| `BAD_SCALAR_START` | `A value cannot start with this character (for example @ or a backtick). Put the value in quotes, e.g. title: "@home".` |
| `NON_STRING_KEY` | `A field name must be a plain word, not a list or a mapping.` |
| any other code | `Fix the YAML at this line. The rest of the file was not checked.` |

Several codes have more than one cause, so their hints name each one:
- `MISSING_CHAR`: an unclosed quote or bracket, reported where the parser gives up (often the end of
  the file), and a list item's field indented less than the field above it
  (`Sequence item without - indicator`).
- `BAD_INDENT`: wrong indentation, and an unclosed `[` or `{`, reported on the line after it.
- `BLOCK_AS_IMPLICIT_KEY`: an unquoted value containing `: ` (`title: Week 1: Strength`), and a line
  indented under a plain value.

### Report format: ASCII severity words

`error:` and `warning:` instead of `✗` and `⚠` from the `SPEC.md` sketch. Agents on Windows often read
tool output through a pipe decoded with a non-UTF-8 code page, where those symbols turn into garbage.
Words also grep cleanly. For the same reason a cut value ends with `...`, not `…`.

Values in headers: only for strings, numbers and booleans, written with `JSON.stringify`. A JSON text
longer than 60 characters is cut to 60 characters plus `...`. JSON escapes newlines, so a header is
always one line, and a string shows its quotes (`= "0"` is not mistaken for `= 0`). A number JSON cannot
write (`.inf`, `-.inf`, `.nan`) is shown with `String(value)` as `Infinity`, `-Infinity` or `NaN`,
because `JSON.stringify` would print `null`.

Issues are sorted by line, issues without a line first, keeping their original order on ties.
`formatIssues` produces everything after the file path line, so golden files do not depend on path
separators.

### Fixtures as golden reports

Each `schema/tests/<case>.repscript.yaml` has a `<case>.expected.txt` holding the exact `formatIssues`
output, written by hand from the spec and the message table. The runner compares them and normalizes
`\r\n` to `\n` when reading, so a Windows checkout does not break it. A wording change shows up in
review as a diff of the `.expected.txt` files.

Cases:

| Case | Content | Expected |
|---|---|---|
| `minimal`, `yaml-core`, `json` | valid programs; `yaml-core` has `title: no` and `id: 2026-10-19` | only the draft warning |
| `empty` | empty file | top-level error, no line |
| `top-level-list` | a list at the top level | top-level error |
| `multiple-docs` | a second document after `---` | `MULTIPLE_DOCS` |
| `yaml-syntax` | a nested field indented less than the field above it | `BAD_INDENT` |
| `list-indent` | a workout's field indented less than the field above it | `MISSING_CHAR` |
| `colon-in-value` | `title: Week 1: Strength` | `BLOCK_AS_IMPLICIT_KEY` with the quoting hint |
| `unclosed-bracket` | `workouts: [{id: A}` with more fields below | `BAD_INDENT` on the line after it |
| `reserved-char` | `title: @home` | `BAD_SCALAR_START` |
| `alias-before-anchor` | an alias used above its anchor | alias error |
| `duplicate-key` | a field written twice | `DUPLICATE_KEY` |
| `unresolved-alias` | `title: **Heavy**` | alias error |
| `alias-limit` | a few lines of nested aliases | alias-limit error |
| `wrong-type` | `workouts` as a block mapping with fields inside, `title: 5`, `repscript: "0"` | type errors; `workouts` on its key line; no errors from inside it |
| `yaml-1.1-tags` | `id: !!timestamp 2026-10-19`, an `!!set` in an `x-` field | only the draft warning |
| `not-finite` | `title: .inf`, `id: .nan` | type errors showing `= Infinity` and `= NaN` |
| `wrong-item-type` | `workouts` holding one long, multi-line string item | type error at `workouts[0]`; value cut to 60 characters |
| `unsupported-version` | `repscript: 1` | value-not-allowed error |
| `missing-required` | no `title`; a workout without `id` | missing-field errors on the parent's line |
| `unknown-field` | `titel`, `foo`, `1: one`, a top-level `x-note`; a workout with `di` and `x-note` | unknown-field errors; `x-` fields not reported |
| `several-issues` | missing `title`, unknown `foo`, a wrong type | all reported in one run |

`tools/validate.test.mjs` runs the CLI as a child process for the command scenarios: a valid file, an
invalid file among several, a missing file, a non-UTF-8 file (Windows-1251 bytes written to a temp
directory), and no arguments. It also checks that each report starts with the file path. The core
purity check in `schema/schema.test.mjs` fails if any `core/*.mjs` mentions a `node:` module.

### Type checking without a package.json

`tsconfig.json`: `allowJs`, `checkJs`, `noEmit`, `strict`, `module`/`moduleResolution: nodenext`,
`target: es2022`, `types: ["node"]`, `include: ["core", "tools", "schema"]`. CI runs
`npm install --no-save typescript@7.0.2 @types/node@22`, then `npx tsc -p .` and `node --test`.
With no `package.json`, this install only creates `node_modules/` (verified). `.gitignore` gets
`node_modules/`. Contributors run the same commands locally.

Alternative: a dev-only `package.json` with a lockfile. Rejected for now: users would see an npm
project and assume they must run `npm install`.

### CI and license

GitHub Actions runs one job on `ubuntu-latest` with Node 22: install, `tsc`, `node --test`. Windows is
covered by running the tests locally. `LICENSE` is MIT, "Copyright (c) 2026 Repscript contributors".

## Risks / Trade-offs

- [The bundled parser is a 204 KB file nobody reads] → Its header records the version and the exact
  command, so an update is a rerun and a diff. The fixtures exercise every parser API that `core/` uses.
- [Types inferred from the bundle are loose] → `tsc` still catches calls to APIs that do not exist.
  The fixtures cover runtime behaviour. A hand-written `.d.mts` remains an option if looseness starts
  hiding bugs.
- [`description` has to work both as hover documentation and as fix advice] → Descriptions are written
  as "what it is + example". If that stops being enough for some field, add `x-hint` for it.
- [The "did you mean" thresholds can suggest the wrong field for short names] → Short names use the
  tighter threshold. A wrong suggestion still points at the right line.
- [Golden files make every wording change touch fixtures] → Intended: the wording is the interface
  for the AI.
- [The project folder is not a git repository, so CI does not run yet] → Tests run locally with
  `node --test`. Creating the repository is outside this change.

## Open Questions

- Licensing of the schema, spec and examples (CC0 in `SPEC.md` §2.3) and of the catalog (CC-BY-SA):
  add per-directory license notes when `spec/`, `examples/` and `catalog/` arrive. This change ships
  only the root MIT `LICENSE`.
