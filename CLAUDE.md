# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Repscript is a YAML format for training programs (`*.repscript.yaml`), a validator whose report is
written for an AI agent to act on, a shared exercise catalog, training-guideline data, and a program
report that counts a valid program by those guidelines and gives findings with their sources. The
format is at `repscript: 0`, a draft that may still change before the first release.

```yaml
repscript: 0
id: home-strength
revision: 1
title: Home strength
goal: strength
schedule: {per_week: 2}
workouts:
  - id: A
    blocks:
      - {exercise: pullup, sets: 3, reps: 5-8, load: {bw: true, add_kg: 10}}
      - {exercise: plank, sets: 3, time: 30s}
```

## Commands

Users run the tools on plain Node 22.8+ with nothing installed. `npm ci` is only for the dev tools
(Biome, tsc, esbuild).

```sh
node tools/validate.mjs <file>...                 # check programs; exit 1 if any file has an error
node tools/stats.mjs <file>...                    # report numbers and findings; exit 1 only on an error
node scripts/build-catalog-index.mjs              # regenerate catalog/index.yaml (= npm run catalog:index)
node --test                                       # all tests
node --test schema/catalog.test.mjs               # one test file
node --test --test-name-pattern="fixture intent"  # one test by name; golden fixtures are "fixture <name>",
                                                  # stats fixtures "stats report <name>"
npm run check         # what CI checks: lint, typecheck, coverage, check:vendor
npm run lint          # biome ci; npm run format fixes what it can
npm run typecheck     # tsc over the JSDoc-typed .mjs files, no emit
npm run coverage      # tests with a 100% line and function, 95% branch gate
npm run check:vendor  # vendor/yaml.mjs must be the exact bundle of the yaml version in package.json
```

## Constraints that are easy to break

- **No runtime dependencies.** `core/`, `tools/`, `scripts/build-catalog-index.mjs` and the tests import
  only `node:` built-ins, `vendor/` and the project's own modules. CI runs the tests without `npm ci` on
  Ubuntu and Windows, Node 22 and 24.
- **`core/` has no I/O and no `node:` imports** (a test enforces it): callers pass decoded texts, so the
  planned player can reuse it with texts from its server. Reading files belongs in `tools/`.
- **`vendor/yaml.mjs` is generated**: the esbuild bundle of `yaml`'s browser build under a version header.
  Never edit it. After a `yaml` or `esbuild` bump, rebuild it with the command that `npm run check:vendor`
  prints and update the header.
- **The coverage gate** fails on any untested line or function: new code comes with its tests.
- **LF everywhere** (`.gitattributes`): golden reports compare exact text. Catalog file paths in reports
  and errors are written with `/` from the project root, on Windows too.
- **`my/` is the user's personal data** (profile, limitations, logs). It is gitignored, and CI fails if
  anything under it except `.gitkeep` is tracked. Never `git add -f` it.
- **Licenses**: `catalog/` is CC BY-SA 4.0 (`catalog/LICENSE`), the code MIT. Copy no text from ExRx or
  other sources into the catalog; cite a source by its key in `catalog/references.yaml`.
- **Workflows** pin actions to full commit SHAs with a version comment and set
  `persist-credentials: false`; CI lints them with zizmor.

## Architecture

### Validation pipeline

`tools/validate.mjs` reads each file with `readProgram()` in `tools/program.mjs`, which rejects one that
is not UTF-8 (fatal decoder, NUL check), and calls `validate(source, schema, catalog)` in
`core/validate.mjs`, which:

1. parses with the vendored `yaml` (YAML 1.2 core schema, string keys). A syntax error, an alias without
   an anchor or the alias-expansion limit ends the check there, each with its own hints;
2. checks the plain data against `schema/repscript.schema.json` with `check()` in `core/schema.mjs`;
3. runs `checkRules()` in `core/rules.mjs` (cross-field rules, the draft warning), which ends with
   `checkExercises()` in `core/exercises.mjs` (own `my.` exercises, exercise references, implements);
4. maps each issue's path array to a line (`locate()`) and sorts the issues by line. The CLI then prints
   `formatIssues(issues)` under the file path.

An issue is `{severity, path, line?, column?, value?, message, hint?}`. The report is the product: each
issue says what is wrong, where, and how to fix it, and the hint usually gives a literal example. Rule
checks skip a value of the wrong type, which the schema check already reports. The validator never
modifies files: a slip that `core/formats.mjs` recognizes (an en dash in a range, a decimal comma, `sec`,
`to failure`) is an error with a `Write <fixed>.` hint.

### Program report

`tools/stats.mjs` runs `readProgram()` → `checkProgram()` → `programStats()` → `formatStats()`:

- `checkProgram(source, schema, catalog)` in `core/validate.mjs` returns the validator's issues with the
  parsed `data` and `lineOf(path)`, so the report never parses twice; `validate` is its `.issues`. A file
  with an error, or one that cannot be read, gets the validator's report and
  `No numbers: fix the errors above first.` A valid file's warnings are not printed.
- `programStats(data, lineOf, catalog, guidelines)` in `core/stats.mjs` counts a valid program (weights
  per target, weekly values at both ends, values per block), places each value in the bands of the
  corridors that apply to the goal, and returns the report as data. `formatStats(report)` writes the text
  from the report alone, so the player can print the same text later.
- The guidelines come from `loadGuidelines()` in `tools/catalog.mjs`, which reads only `targets.yaml` and
  `corridors.yaml` and builds them with `buildGuidelines()` in `core/guidelines.mjs`: targets, groups,
  weights, corridors and the reach map of muscle keys to targets. It throws, naming the file, only for a
  shape the count cannot use; the full checks stay in the tests. It also checks every catalog entry's
  muscles with `musclesProblem()`, since the count reads them and the validator does not.
- A finding is atomic in the data (one corridor, band, subject and value, with the ends that fall in
  the band), and grouped per corridor and band in the text. Findings never change the exit code.
- Band placement is exact only while the weights are multiples of 0.5 and band bounds are whole numbers,
  and it checks both ends of a range only, which finds every finding band while those sit first or last
  in a corridor. Tests in `schema/stats.test.mjs` hold both on the project data.

### The schema is also the hint text

`core/schema.mjs` interprets only the keywords in its `KEYWORDS` list, and a field's `description` is the
hint printed for it, so descriptions are user-facing and include an `Example:`. A lint test in
`schema/schema.test.mjs` requires a description on every property and `items`, allows
`additionalProperties` only as `false` and only next to `patternProperties: {"^x-": {}}` (every mapping
accepts `x-` extension fields), and allows only `description` and `title` next to `format`, whose values
are the keys of `FORMATS` in `core/formats.mjs`. `DESCRIPTIONS` in `core/exercises.mjs` repeats some
descriptions because `core/` cannot read the schema; a test keeps them equal, so change both.

### Catalog

`tools/catalog.mjs` reads `catalog/` (`readCatalogFiles`, `loadCatalog`), and `buildCatalog()` in
`core/catalog.mjs` builds the catalog from the texts. Names and aliases match through `normalizeName()`
(NFKC, case, `ё`, separators, English plurals). Entries are checked by `schema/catalog.test.mjs`, not by
the validator, with `validateEntry()` and the same issue format; the entry schema is the program
schema's `exercises.items`. `catalog/index.yaml` is generated by `buildIndex()`: a test fails when it is
stale, and it is committed together with the entries.

Adding or changing an exercise follows `CONTRIBUTING.md`: id rules, field order, and what may go in
`muscles.secondary`. No stabilizers there: the program report counts a set as half a set for a
target that only secondary muscles reach. Before the first release (`repscript: 1`) ids and dictionary
keys may still change; after it they are only deprecated, with `deprecated: true` and `replaced_by`.

### Training guidelines

`catalog/references.yaml`, `targets.yaml` and `corridors.yaml` are the data of the program report.
`loadGuidelines()` and `core/guidelines.mjs` read `targets.yaml` and `corridors.yaml` at run time for the
report only, never for the validator: `loadCatalog` does not read them, so a broken guideline file cannot
stop the validator. `references.yaml` is read only by the tests (`readGuidelineFiles()`), and a finding
cites a source by its key and locator from the corridor data. Their checks are `guidelineProblems()` in
`schema/guidelines.test.mjs`.
A citation is `{key, at}` with a key from `references.yaml`. A new muscle key fails that test file until a
target in `targets.yaml` covers it or it joins the `unreached` list in the project-targets test.

### Tests

`node:test` with `node:assert/strict`, in `schema/*.test.mjs`, and in `tools/validate.test.mjs` and
`tools/stats.test.mjs`, which spawn the CLIs. Each `schema/tests/<name>.repscript.yaml` is a golden
fixture compared with `<name>.expected.txt`, the `formatIssues()` output without the file-path line.
Fixtures are validated against the small test catalog in `schema/tests/catalog/`, not the project one, so
a growing catalog does not change their reports.

Each `schema/stats/<name>.repscript.yaml` is a stats fixture compared with `<name>.stats.txt`, the
`formatStats()` output without the file-path line, in a test named `stats report <name>` (a validator
fixture's is `fixture <name>`). They are counted with the project's catalog and guidelines, so a change
to an entry's `muscles` that moves a count shows as a diff there. No script regenerates the expected
files of either kind: each number is checked by hand.

### Types and formatting

Plain `.mjs` with JSDoc types, checked by `tsc` (`checkJs`, `strict`, no unused locals or parameters), and
no build step. Biome formats and lints only `core/`, `tools/`, `schema/*.mjs` and `scripts/`. A
PostToolUse hook (`.claude/settings.json` → `scripts/format-hook.mjs`) runs Biome on each `.js` or `.mjs`
file Claude edits, so the file can change right after an edit; without `npm ci` it does nothing.

## Specs and changes (OpenSpec)

Requirements live in `openspec/specs/<capability>/spec.md`: `program-format`, `program-validation`,
`exercise-catalog`, `training-guidelines` and `program-stats`. A change of behavior goes through an
OpenSpec change in `openspec/changes/<name>/` (proposal, design, delta specs, tasks), driven by
`/opsx:propose`, `/opsx:apply` and `/opsx:archive`, whose skills call the `openspec` CLI (not a project
dependency). The `design.md` of each change in `openspec/changes/archive/` keeps the reasons for its
decisions: read it before reversing one. OpenSpec artifacts, like the rest of the repository, are written
in English even when the conversation is not (`openspec/config.yaml`).
