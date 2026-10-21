# Proposal

## Why

After `format-core`, `exercise` takes any string, so an agent can write `exercise: Wide-grip pull-ups`
and the file passes. A name in the file breaks the log and the history, which match workouts by id,
and gives the player nothing to show for the exercise. This change adds the shared exercise catalog
and makes every `exercise` a checked id: one from the catalog, or an own `my.*` exercise described in
the program. A name gets an error that gives the id. It comes now because `agent-workflow` writes the
instructions on top of the catalog, and the player reads programs that reference it.

## What Changes

- **Catalog files.** Under `catalog/`, licensed CC BY-SA 4.0 (`catalog/LICENSE`):
  - one file per exercise, `catalog/exercises/<id>.yaml`, about 30 entries;
  - the muscle dictionary `catalog/muscles.yaml`: keys and names in a group → muscle → bundle
    hierarchy;
  - the equipment dictionary `catalog/equipment.yaml`, where `X.Y` is a variant that satisfies `X`.
- **Exercise entries** hold `id`, `names` (by language code), `aliases`, `equipment`, `muscles`
  (`primary`, `secondary`), and `deprecated` with `replaced_by`. `references` and `status` come in
  `evidence-base`, `joints` in `agent-workflow`, and `cues` and `mistakes` in `workout-session`.
- **Ids.** Lowercase Latin letters, digits, `_` and dots, for example `pullup.wide`. A dot is only part
  of the name. `my.` is reserved for own exercises.
- **Own exercises.** A program may have `exercises:`, a list of entries in the same format, with ids
  starting with `my.`. Only `id` and `names` are required. Dictionary keys are checked whenever they
  are present. A group key such as `shoulders` is allowed here. An entry with a catalog id, which would
  override that entry, is an error for now.
- **Catalog entries are stricter**:
  - `names` in `en` and `ru`;
  - `muscles` with specific muscles, not groups;
  - `equipment`, where `[]` means none is needed;
  - names and aliases unique across the catalog;
  - the file named after the id.
- **`load.implement`**: an optional equipment key. A weight is always that of one implement, and a
  barbell is weighed whole. The equipment a program needs is that of its exercises plus every
  `implement`.
- **Validator errors for exercises**:
  - a name instead of an id gives the id (`Write exercise: pullup.wide.`), even a one-word name written
    like an id, such as `pushups`;
  - an id in capitals gives the lowercase id;
  - an unknown id gets the nearest id of the same movement, or the closest shorter variant;
  - an own exercise must be described in `exercises:`;
  - an unknown muscle or equipment key gets the nearest key or the list of keys.
- **Validator warnings for exercises**:
  - a deprecated id gives its replacement;
  - an own exercise whose name matches a catalog exercise names that exercise.
- **Name matching** compares names after normalization: letter case, separators, `ё`, and English
  plural endings are ignored. There is no fuzzy matching, which the `SPEC.md` draft had in mind.
  Aliases cover the other forms.
- **Exercise index** `catalog/index.yaml`, generated for chats: `id`, `names`, `aliases` and
  `equipment` of each entry that is not deprecated. A test fails when the index is out of date. The
  validator never reads it.
- **Replacements.** An exercise that another one replaces keeps its entry, with `deprecated: true` and
  `replaced_by`. Programs that use it get a warning naming the replacement.
- **Helpers for later readers**, tested now: the equipment a program needs, and whether one equipment
  key satisfies another (`bench.adjustable` for `bench`).
- **Interpreter.** The schema interpreter learns `minProperties`. An unknown field in a mapping whose
  fields are named by a pattern (language codes) gets the mapping's description as its hint.
- **Fixtures** run against a small test catalog in `schema/tests/catalog/`. Fixture ids that do not
  follow the id convention are renamed.
- **CONTRIBUTING.md**: how to add an exercise, with or without an agent.

Out of scope, placed in `ROADMAP.md`:
- `joints` and the joints dictionary (`agent-workflow`);
- `cues`, `mistakes` (`workout-session`);
- overrides of catalog entries;
- aliases in the muscle and equipment dictionaries;
- links to the dictionaries and the index from `spec/FORMAT.md` (`agent-workflow`);
- the CI check that catalog ids and dictionary keys are never removed or renamed: it waits for the
  first public release, since a review of the catalog may still rename ids;
- `references`, `status` and a review of the entries against professional sources (`evidence-base`).
  Until then the 30 entries are drafts, cross-checked against ExRx as they are written.

## Capabilities

### New Capabilities

- `exercise-catalog`:
  - the catalog files and their license;
  - the exercise entry format and the id form;
  - the muscle and equipment dictionaries;
  - the requirements on catalog entries;
  - name matching;
  - replacements;
  - the generated index;
  - the checks a contributor runs.

### Modified Capabilities

- `program-format`:
  - `exercise` references a catalog or own exercise;
  - the program's own `exercises`;
  - `load.implement`, with the weight per implement;
  - the equipment a program needs.
- `program-validation`:
  - the validate command checks against the project's catalog;
  - the minimum number of fields of a mapping;
  - the unknown-field hint for pattern-named fields;
  - new requirements for exercise names and unknown ids, undescribed own exercises, own exercise ids,
    dictionary keys, deprecated exercises, own exercises that match a catalog exercise, and
    replacements.

## Impact

- New `catalog/`: `exercises/*.yaml`, `muscles.yaml`, `equipment.yaml`, `index.yaml`, `LICENSE`.
- New `core/catalog.mjs`: builds the catalog from source texts, normalizes names, builds the index, and
  tells whether one equipment key satisfies another.
- New `core/exercises.mjs`: checks exercise references and entries, shared by program and catalog
  checks, and computes the equipment a program needs.
- `core/rules.mjs` and `core/validate.mjs`:
  - `validate()` takes the catalog;
  - a second entry point checks one catalog entry file.
- `core/schema.mjs`: `minProperties`, and the unknown-field hint for pattern-named fields.
- `schema/repscript.schema.json`: `exercises`, the entry schema, `load.implement`, and a new `exercise`
  description.
- New `tools/catalog.mjs` reads and loads a catalog directory for the tools, tests and scripts.
- `tools/validate.mjs` loads `catalog/`. Its print-and-exit lines for a broken catalog are the one
  coverage exception, tested end to end on a copy.
- New `scripts/build-catalog-index.mjs` and the npm script `catalog:index`.
- New `schema/catalog.test.mjs`. `schema/schema.test.mjs` loads the test catalog. `schema/tests/` gets
  new fixtures, the test catalog and renamed ids.
- New `CONTRIBUTING.md`.
- No new dependencies.
