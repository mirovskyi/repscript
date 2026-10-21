# Tasks

## 1. Near-miss hint for allowed values

- [x] 1.1 Add a test to `schema/schema.test.mjs` that calls `check()` on inline `enum` schemas with a
  description:
  - a string enum `['strength', 'hypertrophy', 'muscular_endurance']`:
    - `'Hypertrophy'` gets `Did you mean hypertrophy?`;
    - `'strenght'` gets `Did you mean strength?`;
    - `'muscular-endurance'` gets `Did you mean muscular_endurance?`;
    - `'endurance'` gets the description as its hint;
    - each message is `Expected one of: "strength", "hypertrophy", "muscular_endurance".`;
  - a number enum `[0]` with `1` gets the description, as before.

  Verify that `npm test` fails only on the near-miss assertions.
- [x] 1.2 In `check()` in `core/schema.mjs`, give a string that misses an `enum` the hint
  `Did you mean <value>?` when `closest()` finds one among the enum's strings, and the description
  otherwise. Verify that `npm test` passes with every existing fixture unchanged: no existing enum holds
  strings.

## 2. Schema fields

- [x] 2.1 Add `goal` and `schedule` to `schema/repscript.schema.json`, right after `language`, as the
  design gives them:
  - `goal`: `type: string`, the five values as `enum`;
  - `schedule`: a mapping with `required: [per_week]`, `per_week` in `format: count`, `x-` pattern
    properties and `additionalProperties: false`;
  - the descriptions from the design's Wording table.

  Verify that the schema lint test passes. Verify that `npm test` then fails only on the `unknown-field`
  and `several-issues` fixtures, whose list of allowed top-level fields is now out of date.
- [x] 2.2 In `schema/tests/unknown-field.expected.txt` (two lines) and
  `schema/tests/several-issues.expected.txt` (one line), update the list of allowed top-level fields to
  `repscript, id, revision, title, notes, source, author, language, goal, schedule, exercises,
  workouts`. Change nothing else in them. Verify that `npm test` passes.

## 3. Fixtures and tests for the new fields

- [x] 3.1 Add the fixture `schema/tests/intent.repscript.yaml`:
  - a valid program with workouts `A` and `B`, using only exercises that exist in both `catalog/` and
    `schema/tests/catalog/`, such as `pushup` and `pullup`: the fixture runner uses the test catalog,
    and `tools/validate.mjs` uses the real one;
  - `goal: hypertrophy`;
  - `schedule: {per_week: 3}`;
  - `notes` holding the person's wish, such as `Wants to lose weight.`

  Its expected report has only the draft-version warning. Verify that the fixture passes and that
  `node tools/validate.mjs schema/tests/intent.repscript.yaml` exits with code 0.
- [x] 3.2 Add the fixture `schema/tests/goal-not-allowed.repscript.yaml` with `goal: fat_loss`. Its
  expected report has the draft-version warning and one error: at `goal` with the value, the message
  `Expected one of: "strength", "hypertrophy", "power", "muscular_endurance", "health".` and the `goal`
  description as the hint. Verify that the fixture passes and that `tools/validate.mjs` exits with
  code 1 on it.
- [x] 3.3 Add the fixture `schema/tests/schedule-errors.repscript.yaml` with
  `schedule: {per_week: 0, order: [A, B]}`. Its expected report has the draft-version warning and two
  errors:
  - at `schedule.per_week`, `Expected at least 1.` with the `per_week` description as the hint;
  - at `schedule.order`, `Unknown field.` with
    `Allowed fields here: per_week. Extension fields start with x-.`

  Verify that the fixture passes.
- [x] 3.4 Add a test to `schema/schema.test.mjs` that runs `validate()` with the real schema and the
  test catalog on small inline programs, and asserts each issue:
  - each of `strength`, `hypertrophy`, `power`, `muscular_endurance` and `health` is accepted;
  - `goal: Hypertrophy` gets `Did you mean hypertrophy?`;
  - `goal: strenght` gets `Did you mean strength?`;
  - `goal: muscular-endurance` gets `Did you mean muscular_endurance?`;
  - `goal: endurance` gets the five values in the message and the `goal` description as the hint;
  - `goal: [strength, hypertrophy]` says a string is expected and a list was found;
  - `schedule: {}` gets `Missing required field.` at `schedule.per_week`, with the `per_week`
    description;
  - `schedule: {per_week: "3–4"}` gets the `U+2013` message and `Write 3-4.`;
  - `schedule: {per_week: "3"}` and `schedule: {per_week: 3-4}` are valid;
  - `schedule: 3` says a mapping is expected;
  - a top-level `per_week: 3` gets `Unknown field.`, with an allowed-fields list that names `schedule`.

  Verify that `npm test` passes.

## 4. Integration

- [x] 4.1 Run `npm run check`: lint, typecheck, coverage at the floors of 100% lines, 100% functions
  and 95% branches, and the vendor check. Verify that it passes. Run `openspec validate program-intent --strict` and verify that
  it passes.

## Workflow follow-up

- Archive the change once it is reviewed (`/opsx:archive`), which merges the deltas into
  `openspec/specs/program-format` and `openspec/specs/program-validation`.
- Next on the roadmap: `evidence-base`, whose corridors key on these `goal` values.
