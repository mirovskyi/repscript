# Tasks

## 1. The unit in the guidelines

- [x] 1.1 In `core/guidelines.mjs`, add `exercise_sets_per_workout` to `UNITS` with a fourth kind,
  `exercise`, which takes neither `targets` nor `groups` (design decision 9):
  - `readCorridors` reads a subject list only for `target` and `group`;
  - update the JSDoc of `UNITS` and of `Corridor.subjects`.

  In `schema/guidelines.test.mjs`:
  - give the test's `UNITS` the new unit, telling it apart from a unit per block;
  - make the overlap check (`if (kind === null)`) treat the new kind, like a unit per block, as one
    without subjects;
  - make "one of the five units" read "six", in the check and in the expected messages of its tests.

  Add tests:
  - `buildGuidelines` builds a corridor in the new unit without `targets`, with `subjects: []`;
  - the guideline checks report a corridor in that unit with `targets: [chest]` as targets for a unit
    per exercise of a workout;
  - two corridors with `goal: strength` in that unit report the second one;
  - the guideline checks accept the unit.

  Verify that `node --test schema/guidelines.test.mjs` and `npm run typecheck` pass.

## 2. The count per exercise of a workout and its text

- [x] 2.1 In `core/stats.mjs`, add the subject kind `exercise`, the values of
  `exercise_sets_per_workout`, and their text (design decisions 4 and 9). One task, because until
  `formatSubject` handles the new kind, its read of `subject.id` fails `npm run typecheck`.

  The count:
  - one value per exercise of each workout: the summed range of its blocks' `sets`, with the `sets`
    path and line of each block;
  - workouts in list order, and exercises in the order of their first block;
  - the findings loop treats `exercise` subjects as it treats `block` ones, in the subject filter and
    in the extrapolation check;
  - in `schema/stats.test.mjs`, narrow the reads of `subject.id` to target and group subjects.

  The text, in `formatStats`:
  - print one line per subject for `exercise` as for `block`;
  - write an `exercise` subject as `<workout> <exercise> <value><marks>: <path> (line N), ...`, with the
    workout through `formatWorkout`, the paths in program order, and no ` (line N)` when the line is
    unknown;
  - add the unit's words, `sets of an exercise in a workout`, to `UNIT_WORDS`.

  Add tests to `schema/stats.test.mjs`, with a test corridor in the unit whose every band has a finding.
  For the count:
  - one block;
  - a top set and back-off sets summed to 3;
  - one exercise in two workouts, kept apart;
  - `sets: 1-3` plus `sets: 2`, giving 3 to 5;
  - blocks with `time` and `reps: max`;
  - an own exercise without muscles;
  - the order across two workouts;
  - a value without `schedule`.

  For the text:
  - two exercise subjects in one finding, each on its own line;
  - one block;
  - two blocks of one exercise, both paths joined by `, `;
  - `(lower end)` on a range;
  - a block whose line is unknown;
  - the workout `Day 1` written as `"Day 1"`;
  - the band range in the finding's header.

  Verify that `node --test schema/stats.test.mjs`, `npm run typecheck` and `npm run coverage` (100% of
  lines and functions in `core/`) pass, and that every stats fixture is unchanged.

## 3. The strength corridor and its report

- [x] 3.1 Add the corridor and its expected report together: the strength fixture's test fails between
  the two.
  - **Data.** Add `strength.exercise_sets` to `catalog/corridors.yaml`, after `strength.reps`, with the
    bands, labels, descriptions and citations of design decision 5.
  - **Guideline tests.** In `schema/guidelines.test.mjs`:
    - add the corridor to the list of project corridors;
    - check its bands `[0, 2, true]`, `[2, 4, false]` and `[4, undefined, false]`;
    - check that the band below 2 cites `acsm2026` at Table 6 and Table 2, and `paga2018`;
    - check that no other project corridor measures `exercise_sets_per_workout`.
  - **Stats test.** In `schema/stats.test.mjs`, the `.corridors` assertion for `goal: strength` (the
    test "the corridors that apply to the goal") reads
    `['major_groups', 'strength.reps', 'strength.exercise_sets']`.
  - **Fixture.** In `schema/stats/strength.repscript.yaml`, the comment says the program is also
    checked for sets per exercise. It stays on two lines, so the deadlift blocks stay on lines 14 and
    19.
  - **Expected report.** Write `schema/stats/strength.stats.txt` by hand from design decision 10 and
    the corridor data:
    - the new header line;
    - the finding with `A deadlift.barbell 1` and `B deadlift.barbell 1`;
    - the band's description and sources;
    - `findings: 2`;
    - the numbers part unchanged.

    Check each line against the specs, not only against the output.

  Verify that the guideline checks pass with no key in `references.yaml` left uncited, that
  `node --test --test-name-pattern="stats report strength"` passes, and that the other stats fixtures'
  tests pass unchanged.
- [x] 3.2 In `CLAUDE.md`, name the values per exercise of a workout in the sentence on what
  `programStats` counts. Verify that the line reads correctly beside the code.

## 4. Integration

- [x] 4.1 Run `npm run check` (lint, typecheck, coverage, vendor) and `node --test`, and verify that
  both pass.
- [x] 4.2 Run `node tools/stats.mjs schema/stats/strength.repscript.yaml` and verify that its output,
  after the file path, equals `schema/stats/strength.stats.txt`. Run
  `openspec validate strength-corridors --strict` and verify that it passes.

## Workflow follow-up

- Archive the change with `/opsx:archive` after review, which syncs the delta specs into
  `openspec/specs/`.
