# Tasks

## 1. The field in the format

- [x] 1.1 In `schema/repscript.schema.json`, add `main` to a block's properties, after `load`, in the form of
  `bw`: `type: boolean`, `enum: [true]`. Its description is the hint text (design decision 2), and says what
  the field marks, that only `main: true` is written and the field is otherwise left out, that with
  `goal: strength` the report then checks only marked blocks for load and sets per exercise, and ends with
  `Example: {exercise: squat.barbell, sets: 3, reps: 5, main: true}`.

  Add the validator fixture `schema/tests/main-field.repscript.yaml`, with exercises of the test catalog, and
  its `main-field.expected.txt` written by hand:
  - a block with `main: true`, which gives no issue;
  - a block with `main: false`, whose error reads `Expected one of: true.` with the field's description as
    its hint;
  - a block with `main: yes`, a string where a boolean is expected;
  - a block with `mian: true`, whose hint is `Did you mean main?`;
  - a workout with `main: true`, an unknown field there.

  Update line 23 of `schema/tests/unknown-field.expected.txt` to list `main` after `load`.

  Verify that `node --test schema/schema.test.mjs` and `node --test --test-name-pattern="fixture"` pass.

## 2. A corridor's limit in the guidelines

- [x] 2.1 In `core/guidelines.mjs`, read `main_only`, `main_only_reason` and `main_only_cites` into the `Corridor`
  as `mainOnly` (false when absent), `mainOnlyReason` and `mainOnlyCites`, with their JSDoc. `readCorridors` throws,
  naming the file and the corridor, when `main_only` is not `true`, when it comes without a string
  `main_only_reason`, without a list of citations each with a string `key` and `at`, or when the unit is per target
  or per group (design decision 4).

  Add the three fields to the `corridor()` helper in `schema/stats.test.mjs`, which lists a `Corridor`'s fields by
  hand, so that it still type-checks.

  Add tests in `schema/guidelines.test.mjs`: `buildGuidelines` builds a corridor with the limit and one without
  it, and throws in each of the four cases.

  Verify that `node --test schema/guidelines.test.mjs` and `npm run typecheck` pass.

- [x] 2.2 In `guidelineProblems()` in `schema/guidelines.test.mjs`, add `main_only`, `main_only_reason` and
  `main_only_cites` to the closed fields of a corridor, and report: the limit in a unit per target or per group,
  `main_only` holding anything but `true`, the limit without a reason or without citations, a reason or citations
  without the limit, and a reason that is not text. Check `main_only_cites` with the same `cites` helper as a band's,
  so a key it names counts as cited and an unknown key is reported.

  Add a test per scenario of `specs/training-guidelines/spec.md`, Corridors for main blocks, each with its
  expected line, including that a limited corridor per block and one per exercise of a workout are accepted.

  Verify that `node --test schema/guidelines.test.mjs` passes.

## 3. The sources and the data

- [x] 3.1 Read `schoenfeld2021` (doi:10.3390/sports9020032) and `androulakis2021` (doi:10.3389/fspor.2021.713655)
  in full. Both are open access; the Frontiers PDF and the Europe PMC full-text XML of PMC7927075 can be fetched
  directly, while MDPI refuses automated requests. Check against them each statement of the reason of `strength.reps`
  in design decision 4, including the repetitions in Table 12, the 6 to 10 repetitions in the Conclusions and whether
  they come from the survey, and the number of respondents behind them (21 of 58 in the text of study 5, while the
  abstract counts 57 and Table 12 prints no n). Verify by reporting the result to the user. If a source does not support its statement, stop and bring that to the user
  before writing any data.

- [x] 3.2 In `catalog/references.yaml`, add the two entries of design decision 4 in key order, with `read: full`. In
  `catalog/corridors.yaml`, add `main_only: true` and the `main_only_reason` and `main_only_cites` of design decision
  4 to `strength.reps` and `strength.exercise_sets`, in our words, copying no text from a source, and leave their
  bands as they are. Before writing them, reread the cited sentences at `acsm2026` p. 853, Table 6, Table 2 and
  p. 865, so the reasons say only what those pages state. Add the limit to the file's header comment.

  In `schema/guidelines.test.mjs`, add to the project data test that exactly these two corridors have `main_only`,
  with the citations of design decision 4.

  Verify that `node --test schema/guidelines.test.mjs` passes, which also shows that both new keys are cited.

## 4. The count and the report

- [x] 4.1 In `core/stats.mjs`, add `main?: true` to the `Block` typedef, and a `main` flag to each value from
  `blockValues` (the block's own mark) and `exerciseValues` (true when one of the exercise's blocks in that workout
  is marked). In the findings loop, a corridor with `mainOnly` skips a value without the flag when the program has
  at least one marked block (design decision 3).

  Add tests in `schema/stats.test.mjs`, one per scenario of `specs/program-stats/spec.md`, Values checked by a
  corridor for main blocks and Counting with main blocks, using the project's guidelines:
  - assistance work; a main lift that is too light; a single set of a main lift; a warm-up and a timed set;
    a marked timed set;
  - top set and back-off sets; a workout without a main block; an exercise marked in one workout only;
  - no block marked; every block marked, with the same findings;
  - numbers and coverage unchanged by marks; `hypertrophy.rest` and `power.reps` still checking unmarked blocks.

  Verify that `node --test schema/stats.test.mjs` and `npm run typecheck` pass.

- [x] 4.2 In `core/stats.mjs`, add the report's `main` field (design decision 6): undefined when no limited corridor
  applies, otherwise the limited corridors with their reasons and citations, in file order, and the marked blocks in
  program order. In `formatStats`, print the lines right after `corridors:`, with workout ids through `formatWorkout`,
  and each corridor's `Sources:` line formatted as a finding's.

  Add tests in `schema/stats.test.mjs`, one per scenario of Main blocks in the report, No main blocks in the report
  and Report layout, and the `main blocks` scenario of Workout ids in the report: the marked lines and their order,
  each `Sources:` line, one exercise marked twice, the line without marks, no line for a hypertrophy program or a
  program without a goal, and a quoted workout id.

  Add a line to `schema/stats/strength.stats.txt`, the line without marks, after `corridors:`.

  Add the stats fixture `schema/stats/main-lifts.repscript.yaml` and `main-lifts.stats.txt` from design decision 8,
  with the descriptions, reasons and sources in full. Write the expected file by hand and count each number by hand; do not
  generate it from the tool's output.

  Verify that `node --test --test-name-pattern="stats report"` passes, and that `git diff` shows no change to any
  other `*.stats.txt`.

## 5. Documentation

- [x] 5.1 In `CLAUDE.md`, in the Program report section, say in a few lines that a corridor can be limited to blocks
  with `main: true` through `main_only`, that a program without marks is checked on every block, and that marks never
  change the numbers. Verify that the commands and paths it names exist.

## 6. Whole-change checks

- [x] 6.1 Verify that `npm run check` passes (lint, typecheck, the coverage gate, the vendor check), and that
  `node --test` passes with no `node_modules`, as CI runs it.

- [x] 6.2 Run `node tools/stats.mjs schema/stats/main-lifts.repscript.yaml` and compare it by eye with design
  decision 8. Remove every `main: true` from a scratch copy, and verify that the report has the line without marks,
  the extra findings that decision 8 lists, and the same numbers.

- [x] 6.3 Ask the user for two or three programs not written for this change, such as a coach's sheet or a program
  they use. Run the report on each, without marks and with the main lifts marked. Report to the user which findings
  each gives, and whether the limit cleared noise or hid something a coach would want flagged. Keep these programs
  out of the repository, and keep their content out of the commit, which states only the result. If they show that
  the limit hides real problems, stop and bring that to the user before archiving.

## Workflow follow-up

- Archive the change after review, which applies the delta specs to the main specs.
- `training-defaults` takes up main lifts and assistance work, and needs a source for the latter.
