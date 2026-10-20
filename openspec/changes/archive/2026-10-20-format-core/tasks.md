# Tasks

## 1. Notation parsers

- [x] 1.1 Write `schema/formats.test.mjs` from the design's tables before implementing. It imports
  `FORMATS` from `core/formats.mjs` and checks:
  - the parsed values of every accepted form: `3`, `"3"`, `3-4`, `10`, `8-12`, `5+` (5 to `Infinity`),
    `max` (0 to `Infinity`), `30s`, `2m`, `1h`, `1:30` (90), `2-3m` (120 to 180), `18`, `2.5`, `2-5`;
  - each text correction's message and `Write ...` hint, plus `12 – 8` giving the dash, spaces and
    reversed-range messages with `Write 8-12.`;
  - the reversed range, equal ends and no-unit problems with their own hints;
  - the generic messages, with no hint so that the description is used:
    - `Expected <expected>.`;
    - `Expected at least 1.` for `count` `0`, `-1`, `0-3` and `3-0`, and `reps` `0+`;
    - `Expected more than 0.` for `duration` `0s`, `0:00` and the number `0`, and `weight` `0`, `-5`
      and `0-5`;
  - the check order and its edge cases:
    - `duration` `3-2` and the number `1.5` get the no-unit problem, with the whole-number hint;
    - `duration` `90secs` gives `Write 90s.`;
    - `weight` `16, 20` gets the generic message, not `Write 16.20.`;
    - `reps` `8 12` gets the generic message, not `Write 812.`;
    - `count` `3-0` never gets a `Write` hint.

  Verify that `node --test` fails only because `core/formats.mjs` does not exist yet.
- [x] 1.2 Implement `core/formats.mjs`: `FORMATS` with `count`, `reps`, `duration` and `weight`, each
  `{ expected, parse }`. `parse` takes a number, checked by its value, or a string, checked by its
  text, and returns `{ min, max }` or `{ message, hint? }`. It follows the design's grammar, check
  order, correction order and message tables. No `node:` imports. Verify that `node --test` passes,
  including the core purity check.

## 2. Interpreter keywords

- [x] 2.1 In `core/schema.mjs`:
  - add `format`, `minimum` and `minItems` to `KEYWORDS`;
  - implement them in `check()` in the design's order. `format` sends numbers and strings to the
    parser and reports `Expected <expected>, found <a type>.` for other types. The description is the
    fallback hint. `minItems` writes `item` for 1 and `items` otherwise.

  Add a test to `schema/schema.test.mjs` that calls `check()` on inline schemas:
  - `{minimum: 1}` with `0`;
  - `{minItems: 1}` with `[]`;
  - `{format: 'reps'}` with `'lots'`, `[]` and `'8–12'`.

  It asserts the messages, the `Write 8-12.` hint and the description fallback. Verify that
  `node --test` passes, with the existing fixtures unchanged.
- [x] 2.2 Extend the schema lint:
  - a `format` must be a key of `FORMATS`;
  - a schema with `format` may hold only `description` and `title` besides it.

  Verify that the lint passes. Then make two temporary changes, each on its own: set a field's `format`
  to an unknown name, and add `type` or `minItems` next to a `format`. Confirm that each makes the lint
  fail, then revert.
- [x] 2.3 In `core/schema.mjs`, give an unknown field whose name is made only of digits and whose value
  is `null` the design's decimal-comma hint. Add a test to `schema/schema.test.mjs` that calls
  `check()` on `{kg: 2, '5': null}` against a closed mapping schema, and on `{'1': 'one'}`. Assert the
  comma hint for the first and the allowed-fields hint for the second. Verify that `node --test`
  passes.

## 3. Schema fields and fixtures

- [x] 3.1 Update `schema/repscript.schema.json` to the design's field table:
  - the program, workout, block and load mappings with their required fields, in schema order;
  - `revision` with `minimum: 1`, and `workouts` and `blocks` with `minItems: 1`;
  - the four notations through `format`, and `bw` as a boolean with `enum: [true]`;
  - every mapping closed with `additionalProperties: false` and `patternProperties: {"^x-": {}}`;
  - every description exactly as in the design's description table, the top level included.

  Verify that the schema lint passes.
- [x] 3.2 Update the existing fixtures listed in the design: `revision: 1` after `id`, and
  `blocks: [{exercise: pushup, sets: 3, reps: 10}]` in every workout. Also make the design's extra
  changes:
  - `yaml-core` gets `rest: 1:30` in its block;
  - `missing-required` drops `revision`, and adds a workout `C` without `blocks` and a block
    `{reps: 10}` without `exercise` and `sets`;
  - `unknown-field` adds a complete block with `type: superset`;
  - `wrong-type` adds `notes: [warm up, stretch]`.

  Rewrite each expected report by hand, then run. Each one changes for:
  - shifted lines;
  - the new missing-field and type errors;
  - the new allowed-fields lists;
  - the new top-level, `workouts` and workout descriptions in hints.

  Also update the expected reports of `empty` and `top-level-list` for the new top-level description,
  and the `errors:` count that `tools/validate.test.mjs` asserts for `unknown-field`. Verify that
  `node --test` passes, and that the other fixtures report the same issues as before.
- [x] 3.3 Add the fixtures `straight-blocks`, `pounds`, `minimums` and `no-workouts` from the design's
  table, following the design's rule for fixtures added before the rules: unique workout ids, complete
  blocks, kilograms and pounds not mixed. Write each expected report by hand first. Verify that
  `node --test` passes and that `straight-blocks` and `pounds` report only the draft warning.
- [x] 3.4 Add the fixtures `notation-slips` and `notation-errors` from the design's table, following the
  same rule for fixtures added before the rules. Write the comma values in block style, except the one
  flow-style `load: {kg: 2,5}`. Write the expected reports by hand first. Verify that `node --test`
  passes, and check in the reports that:
  - `8–12` names `U+2013`;
  - `12 – 8` is one error with three messages;
  - `load: {kg: 2,5}` gives an unknown field `load.5` with the comma hint;
  - `rest: 90`, `rest: 2-3` and `rest: 1.5` have the no-unit hint;
  - `sets: 3-0` says `Expected at least 1.` without a `Write` hint;
  - `kg: -5` says `Expected more than 0.`;
  - `kg: 16, 20` gets the generic message;
  - `time: [30s]` says `found a list`, and the empty `rest:` says `found an empty value`.

## 4. Rules that span several fields

- [x] 4.1 Implement `core/rules.mjs` with `checkRules(data)` following the design's rules table:
  - one problem per load, checked in table order;
  - only string ids are compared;
  - at most one mixed-units warning, with loads in both units or in neither not counted;
  - only values of the expected shape are inspected.

  Move the draft-version warning there from `core/validate.mjs`. `validate()` appends rule issues after
  schema issues, keeps their severity and locates their lines the same way. Verify that `node --test`
  passes with every existing expected report unchanged.
- [x] 4.2 Add the fixtures `block-rules`, `duplicate-workout-id` and `mixed-units` from the design's
  table. Write the expected reports by hand first. Verify that `node --test` passes, and check in the
  reports that:
  - each load has exactly one error;
  - `{kg, add_kg}` is reported at `load.add_kg`;
  - `load: 18` has only its type error;
  - `{bw: false}` has only its enum error;
  - the repeated id header ends with `= "A"` and names `workouts[0]`;
  - `mixed-units` has one mixed-units warning, at workout B's first load, past the leading `{bw: true}`,
    and `errors: 0`.

## 5. Integration check

- [x] 5.1 Check the roadmap's "done when" by hand. Write a scratch program outside the repository,
  newly written (two workouts of straight sets, with counted and timed blocks and loads in kg and body
  weight), and break it in steps,
  running `node tools/validate.mjs <file>` after each step:
  1. no `revision`, `reps: 5–8` with an en dash, and `rest: 2-3 min`;
  2. `reps: failure` and a load `{kg: 18, lb: 40}`;
  3. a block with `reps` and `time` together;
  4. the clean file.

  Confirm that every error has a path, a line and a hint, and that slip hints give the exact
  corrected value. Confirm that the clean file reports only the draft warning, with exit code 0.
- [x] 5.2 Verify that `node --test`, `npx tsc -p .` and `openspec validate format-core --strict` all
  pass.

## 6. Review fixes

- [x] 6.1 In `core/formats.mjs`, skip the spaces correction when whitespace stands between two digits.
  Add to `schema/formats.test.mjs` that `reps` `8 12` and `weight` `16 20` get the generic message.
- [x] 6.2 Say "a whole number with the unit s, m or h" in the `time` and `rest` descriptions, as in the
  design's description table, and update the `notation-errors` expected report. Add to
  `schema/formats.test.mjs` that `duration` `1.5m` gets the generic message.
- [x] 6.3 Add the design's lint test to `schema/schema.test.mjs`: `lint()` on an inline schema with an
  unknown format and a `type` next to it reports both problems.
- [x] 6.4 In `core/formats.mjs` and `schema/formats.test.mjs`, write the non-ASCII dashes and spaces as
  Unicode escape sequences. In `parse()`, keep the corrected text in its own variable instead of
  assigning it inside a call argument.
- [x] 6.5 Verify that `node --test`, `npx tsc -p .` and `openspec validate format-core --strict` all
  pass.

## Workflow follow-up

- Archive the change with `/opsx:archive` after review.
- `agent-workflow` must document each notation in `spec/FORMAT.md`. The CI check from ROADMAP
  invariant 2 must cover `format` names.
