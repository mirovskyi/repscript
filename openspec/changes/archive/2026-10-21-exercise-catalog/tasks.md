# Tasks

## 1. Interpreter

- [x] 1.1 In `core/schema.mjs`, add `minProperties` to `KEYWORDS` and implement it in `check()`. The
  message is `Expected at least 1 field.`, or `fields` above 1, and the description is the hint. Count
  every key, `x-` fields included. Add a test to `schema/schema.test.mjs` that calls `check()` on an
  inline schema with `{}`, `{a: 1}` against `minProperties: 2`, and `{a: 1}` against `minProperties: 1`.
  Verify that `node --test` passes with every fixture unchanged.
- [x] 1.2 In `core/schema.mjs`, make the hint for an unknown field in a mapping with no `properties` the
  mapping's description. Export `closest(value, candidates)` with the closeness rule of field names,
  and use it in the unknown-field hint. Add tests to `schema/schema.test.mjs`:
  - `check()` on `{english: 'Pull-up'}` against a mapping with only `patternProperties` `^[a-z]{2}$`
    returns the mapping's description as the hint;
  - `closest` returns the nearest candidate within reach, the first one on a tie, and `undefined` when
    nothing is in reach.

  Verify that `node --test` passes with every fixture unchanged.

## 2. Catalog module

- [x] 2.1 Create the test catalog `schema/tests/catalog/` from the design's Fixtures section:
  - `exercises/` with the eleven entries, each with `names` in `en` and `ru`, `equipment` and specific
    `muscles`;
  - the deprecated `pullup.wide_grip`, with the same names as `pullup.wide`;
  - `muscles.yaml` and `equipment.yaml` with the listed keys.

  Verify that every file parses as YAML with `node -e`.
- [x] 2.2 Write the tests first, in a new `schema/catalog.test.mjs`:
  - **`normalizeName`** on the spec's examples: `Wide-grip pull-ups` against `Wide grip pullup`,
    `PUSH UPS` against `Push-up`, `Жим лёжа`, and the two Russian pull-up names. On single words:
    `flies`, `crunches`, `presses`, `raises`, `squats` and `ups` fold, and `press`, `glass` and `us`
    stay;
  - **`buildCatalog` on the test catalog's files:**
    - the `exercises`, `names`, `muscles` (groups and children) and `equipment` fields;
    - entries in id order, `pullup` before `pullup.wide` before `pullup.wide_grip`;
    - `names` pointing to `pullup.wide`, not to the deprecated entry;
  - **`buildCatalog` on inline files:** an error naming the file for:
    - broken YAML;
    - an entry without a string `id`;
    - a dictionary that is not a list;
    - a dictionary item without a string `id`;
    - `children` that is not a list;
  - **`readCatalogFiles`** on `schema/tests/catalog/`: every file, each with its `/` path relative to
    the project root;
  - **`loadCatalog`** on a catalog in a temporary directory with one broken entry: `{ error }` holding
    the design's two lines;
  - **`equipmentSatisfies`:** `bench.adjustable` satisfies `bench`, `bench` does not satisfy
    `bench.adjustable`, and `bench` satisfies `bench`.

  Verify that `node --test` fails only because the modules do not exist yet.
- [x] 2.3 Implement `core/catalog.mjs` with `normalizeName`, `buildCatalog` and `equipmentSatisfies` as
  in the design, with no `node:` imports and one throw helper for the shape errors. Implement
  `tools/catalog.mjs` with `readCatalogFiles(dir)` and `loadCatalog(dir)`. Verify that `node --test`
  passes, including the core purity check, and that `npx tsc -p .` passes.

## 3. Project catalog

- [x] 3.1 Write `catalog/muscles.yaml` with the design's eight groups, muscles and the three deltoid
  bundles, and `catalog/equipment.yaml` with the design's twelve keys, all with `names` in `en` and
  `ru`. Write `catalog/LICENSE` as the design describes. Verify that both dictionaries load through
  `buildCatalog` and that `bench.adjustable` has `bench` in the dictionary.
- [x] 3.2 Write the 30 entries of the design's table in `catalog/exercises/`, each file named after its
  id, in the design's field order:
  - the table's `en`, `ru`, `equipment` and `primary`;
  - `secondary` muscles;
  - aliases for the forms a user is likely to write, not for plurals.

  Cross-check each entry's muscles against ExRx (Target as `primary`, Synergists as `secondary`) and
  note in the commit message where the entry departs from the design's table. Copy no text from ExRx:
  only which muscles work.

  Add a test to `schema/catalog.test.mjs` that `loadCatalog` on `catalog/` succeeds and has `pushup` and
  `pullup`, which the CLI tests rely on. Do not pin the number of entries: contributions change it.
  Verify that `node --test` passes.

## 4. Schema and plumbing

- [x] 4.1 Update `schema/repscript.schema.json` to the design's Schema fields section:
  - `exercises` between `language` and `workouts`;
  - the entry schema with `names` (`minProperties`, the language-code pattern), `aliases`,
    `equipment`, `muscles`, `deprecated` and `replaced_by`;
  - `implement` in the load;
  - every new or changed description exactly as in the design's table, all ASCII.

  Verify that the schema lint passes and that `grep -P '[^\x00-\x7F]' schema/repscript.schema.json`
  finds nothing.
- [x] 4.2 Change `validate(source, schema)` to `validate(source, schema, catalog)` and
  `checkRules(data)` to `checkRules(data, catalog)`, with no new checks yet. Make the fixture runner in
  `schema/schema.test.mjs` load `schema/tests/catalog/` once and pass it to every call. Rename the
  fixture ids listed in the design. Update the expected reports of `missing-required`, `block-rules`,
  `unknown-field` and `several-issues` by hand for the new descriptions and the `exercises` field.
  Verify that `node --test` passes and that no other expected report changed.
- [x] 4.3 Make `tools/validate.mjs` call `loadCatalog` once, before the first file, and on `{ error }`
  print it to standard error and exit with code 1. Mark those print-and-exit lines with
  `/* node:coverage ignore next N */` and a comment pointing to the end-to-end test. Add that test to
  `tools/validate.test.mjs`: it copies `tools/`, `core/`, `vendor/`, `schema/repscript.schema.json`
  and `catalog/` into a temporary directory, breaks one entry's YAML there and runs the copied tool. It
  asserts the standard error text, the empty standard output and exit code 1. Verify that
  `node --test` passes, with the `unknown-field` count unchanged, and that `npm run coverage` passes.

## 5. Exercise checks in programs

- [x] 5.1 Write the fixtures `own-exercises`, `exercise-names` and `exercise-ids` from the design's
  table, with their expected reports by hand, in the design's issue order. Then implement in a new
  `core/exercises.mjs`, called from `checkRules`, the reference checks in the design's order:
  - known id;
  - name match, catalog first;
  - lowercase id;
  - undescribed own id;
  - unknown id, with `my.<value>`, the closest id limited to the same movement, and the prefix fallback;
  - unknown name.

  Use the design's messages. Verify that `node --test` passes, and check in the reports that:
  - `pushups` and `PUSH UPS` get `Write exercise: pushup.`;
  - `Pullup.Wide` gets the capitals error;
  - `pushup.wide` gets `Did you mean pushup?`;
  - `towel_pullup` gets `Did you mean my.towel_pullup?`;
  - `pullup.wide_grip` is a warning;
  - `own-exercises` has only the draft warning.
- [x] 5.2 Write the fixture `own-exercise-ids` with its expected report by hand. Then implement the own
  entry id checks: id form, `my.` prefix with the computed `Write id:` hint, catalog id, repeated id.
  Verify that `node --test` passes, that each problem is one error at its `id`, and that the report has
  no warning.
- [x] 5.3 Write the fixture `own-exercise-fields` with its expected report by hand. Then implement in
  `checkEntry`:
  - muscle and equipment key checks, with group keys allowed in the program scope;
  - the `implement` check;
  - the like-catalog warning at the first matching name or alias.

  Verify that `node --test` passes, and check in the report that:
  - `names: {}` gets the minimum message;
  - `names: {english: ...}` gets the `names` description as its hint;
  - `wings` gets the full muscle key list naming `catalog/muscles.yaml`.
- [x] 5.4 Write the fixture `own-exercise-replacements` with its expected report by hand. Then implement
  the replacement checks: the two fields together, a `replaced_by` that resolves to a catalog or own
  exercise, cycles reported at each entry on them, and the deprecated warning following the chain as
  the design says. Verify that `node --test` passes, and check in the report that:
  - `my.a` and `my.b` each get one cycle error;
  - the warning for `my.old` names no id.
- [x] 5.5 Write the fixture `exercise-wrong-types` from the design's table, with its expected report by
  hand. Verify that `node --test` passes and that the report holds only type errors, one per value. Fix
  any rule that inspects a value of the wrong type.
- [x] 5.6 Add `programEquipment(data, catalog)` to `core/exercises.mjs`. Test it in
  `schema/catalog.test.mjs` on the spec's "Program equipment" example built from the test catalog,
  plus an own exercise without `equipment` that adds nothing. Verify that `node --test` and
  `npm run coverage` pass.

## 6. Catalog checks

- [x] 6.1 Add `validateEntry(source, schema, catalog, file)` to `core/validate.mjs`, sharing parsing,
  alias checks and line lookup with `validate()` through one internal function. Add the catalog scope
  of `checkEntry` with the design's catalog-only messages. Write the tests first, in
  `schema/catalog.test.mjs`: `validateEntry` on inline sources for each catalog-only case:
  - an id not in the id form, with the catalog hint;
  - an id starting with `my.`;
  - a file name that differs from the id;
  - a missing `ru` name, missing `muscles` and missing `equipment`;
  - a group key, with its muscles in the hint;
  - an unknown muscle key whose list leaves out groups;
  - an alias taken by an earlier entry;
  - a `replaced_by` outside the catalog.

  Each asserts the formatted report. Verify that `node --test` passes and that `core/validate.mjs`
  still has no `node:` import.
- [x] 6.2 Add tests to `schema/catalog.test.mjs` that run `validateEntry` on every file of both
  catalogs and print each failing file's formatted report under its path. The test catalog's
  `pullup.wide_grip` must pass, which pins that uniqueness skips deprecated entries. Add tests that both
  dictionaries of both catalogs follow their requirements:
  - muscle keys in the key form, unique across levels, at most three levels;
  - equipment keys in the id form, unique, with each `X.Y` having `X`;
  - names in `en` and `ru`.

  Fix the project catalog until they pass. Then break `catalog/exercises/pushup.yaml` with an unknown
  muscle key, confirm the report shows the file, the path `muscles.primary[0]`, its line and a hint,
  and revert.

## 7. Index

- [x] 7.1 Write a test first, in `schema/catalog.test.mjs`, that pins `buildIndex` on a small inline
  catalog:
  - the two comment lines;
  - id order;
  - `aliases` only when present;
  - flow style without padding;
  - a deprecated entry left out;
  - a name longer than 80 characters kept on its line.

  Implement `buildIndex` in `core/catalog.mjs` with a `vendor/yaml` `Document`, `lineWidth: 0` and
  `flowCollectionPadding: false`. Verify that `node --test` passes.
- [x] 7.2 Add `scripts/build-catalog-index.mjs` and the npm script `catalog:index`, and generate
  `catalog/index.yaml`. Add the freshness test with the design's failure message. Verify that
  `node --test` passes. Add an alias to one entry, confirm the test fails with the message, rerun
  `node scripts/build-catalog-index.mjs`, confirm it passes, and revert both.

## 8. Contributor documentation

- [x] 8.1 Write `CONTRIBUTING.md`. It covers:
  - adding an exercise, with or without an agent: one file per id, the id form and the
    `<movement>.<variant>` convention, `names` in `en` and `ru`, aliases, specific muscle keys,
    `equipment: []`;
  - running `node --test` and `node scripts/build-catalog-index.mjs`;
  - ids: until the first public release they may still change; from then on an exercise is replaced
    with `deprecated` and `replaced_by`, and a dictionary key is kept;
  - that entries are drafts until reviewed against professional sources, and muscles are checked
    against ExRx without copying its text;
  - the catalog's CC BY-SA 4.0 license.

  Verify by following it to add a scratch entry: the commands run as written and the tests pass.
  Then remove the entry and rebuild the index.
- [x] 8.2 In `SPEC.md` §5, replace "нечёткий поиск по `names` + `aliases`" with matching after
  normalization, as in the design. Verify that the sentence no longer mentions fuzzy search.

## 9. Integration check

- [x] 9.1 Check the roadmap's "done when" by hand. Write a scratch program outside the repository with
  `exercise: Wide-grip pull-ups`, an own exercise used in a block, and
  `load: {kg: 18, implement: dumbells}`, then run `node tools/validate.mjs <file>`:
  - confirm the name gets `Write exercise: pullup.wide.`;
  - confirm the implement gets `Did you mean dumbbells?`;
  - fix both and confirm that only the draft warning remains, with exit code 0.
- [x] 9.2 Verify that `npm run check` passes: lint, typecheck, coverage at the configured floors and
  the vendor check. Verify that `openspec validate exercise-catalog --strict` passes.

## Workflow follow-up

- Archive the change with `/opsx:archive` after review.
- Before the first public release, the id stability check from `ROADMAP.md`.
- `agent-workflow`:
  - `spec/FORMAT.md` links to `catalog/muscles.yaml`, `catalog/equipment.yaml` and
    `catalog/index.yaml`;
  - `spec/AUTHORING.md` tells a chat to write a name when it cannot find the id;
  - `joints` and the joints dictionary come there, added to the 30 entries.
- `evidence-base` adds `catalog/references.yaml`, `spec/TRAINING.md`, and `references` and `status` to
  the entries, and reviews the 30 entries against the sources.
- `workout-session` adds `cues` and `mistakes` to the entries.
- `player-shell`:
  - builds the catalog with `buildCatalog` from texts its server sends;
  - adds `catalog/` to what it serves;
  - shows `programEquipment` in the preview.
