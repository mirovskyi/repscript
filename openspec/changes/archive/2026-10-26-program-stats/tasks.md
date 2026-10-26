# Tasks

## 1. One parse, shared, and one program reader

- [x] 1.1 In `core/validate.mjs`, add `checkProgram(source, schema, catalog)` (design decision 2).
  - It returns `issues`, `data` (`undefined` after a YAML or alias error) and `lineOf(path)`, which
    gives `undefined` for every path after such an error.
  - `validate` returns `checkProgram(...).issues`.
  - Export `formatPath`, and move the writing of a value in an issue header out of `formatIssues` into
    an exported helper.

  Add tests to `schema/schema.test.mjs`:
  - on a valid program, `data` is the parsed program and `lineOf` gives the line of
    `workouts[0].blocks[0].rest`;
  - on broken YAML, `data` is `undefined` and `lineOf` gives `undefined`.

  Verify that `npm test` passes with every fixture in `schema/tests/` unchanged.
- [x] 1.2 Move the reading of a program file (cannot read, not UTF-8 with the NUL check) from
  `tools/validate.mjs` to `readProgram(file)` in a new `tools/program.mjs`, and import it in
  `tools/validate.mjs`. Verify that `tools/validate.test.mjs` passes unchanged.

## 2. Guidelines at run time

- [x] 2.1 Export the YAML helper of `core/catalog.mjs`, which `buildCatalog` uses, for
  `core/guidelines.mjs`. Verify that `npm test` passes.
- [x] 2.2 Add `buildGuidelines({ targets, corridors }, catalog)` in a new `core/guidelines.mjs`, as
  design decision 3 gives it:
  - the targets, the groups and the weights;
  - the corridors, with `extrapolated` and `extrapolation`;
  - the reach map.

  Add tests to `schema/guidelines.test.mjs`:
  - the project's files build;
  - each shape listed in decision 3 throws an error that names the file. The tests include:
    - a band without `to` before the last;
    - a `goal` that is not a string;
    - a per-target corridor without `targets`;
    - an `extrapolated` that is not a list;
    - a `targets.yaml` without `major_groups.groups`;
  - the reach map:
    - `shoulders` and `deltoids` reach the three delt targets;
    - `lats` reaches `back`;
    - `erector_spinae` reaches no target;
  - the weights are those of `counting`.

  Verify that `npm run coverage` passes.
- [x] 2.3 In `tools/catalog.mjs`, make `readText` report a file it cannot read as
  `<file>: the file cannot be read (<code>).`, with the path from the project root and the error's
  code. Make `readCatalogFiles` do the same for the `readdirSync` of `exercises/`. In
  `schema/catalog.test.mjs`:
  - update the test that matches `ENOENT` at the start of the message;
  - add that a missing `muscles.yaml` and a missing `exercises/` give
    `Cannot read the catalog: catalog/<path>: the file cannot be read (ENOENT).`, with the copy's path
    from the project root (scenario Missing catalog file of `program-validation`).

  Then add `loadGuidelines(dir, catalog)`:
  - it reads only `targets.yaml` and `corridors.yaml`, through `readText`;
  - it returns `{ guidelines }` or `{ error }`. The error is the line
    `Cannot read the guidelines: <file> (line N): <problem>` for a YAML error, or `... <file>: <problem>`
    otherwise, then the restore-`catalog/` line.

  Add tests to `schema/guidelines.test.mjs`, each in a temporary copy of `catalog/`:
  - a `corridors.yaml` that is not valid YAML gives an error naming the file and the line;
  - a band without `label` gives an error naming the file, without a line;
  - a missing `targets.yaml` gives an error naming it by its project path, not by a path of the
    operating system;
  - a `references.yaml` that is not valid YAML, or is missing, still gives `{ guidelines }`.

  Verify that the tests pass, and that the existing test still shows `loadCatalog` not reading the
  guideline files.

## 3. The count

- [x] 3.1 In a new `core/stats.mjs`, count a valid program as design decision 4 gives it:
  - each exercise's weights per target, from the entry the block names;
  - the sets, sessions and involvement per workout;
  - the weekly values at both ends, `unknown` without `per_week` unless 0;
  - the values per block;
  - `notCounted`.

  Add unit tests in a new `schema/stats.test.mjs`. They cover the scenarios of `training-guidelines`:
  - two workouts three times a week, `per_week: 2-3`, and no schedule;
  - the full-body rotation's sets, sessions and days;
  - timed sets;
  - `reps` of `8-12`, `5+` and `max`;
  - `rest` of `1:30` and `2-3m`.

  They also cover:
  - 6 sets over three workouts at 2 a week being exactly 4, and 7 sets being 14/3;
  - `sets: 3-4` at both ends;
  - each reason of `notCounted`;
  - a deprecated own exercise without muscles, whose `replaced_by` has muscles, counting for nothing;
  - the exactness assumption on the project's guideline files: the weights are multiples of 0.5, and
    every band bound is a whole number;
  - the edge assumption on the project's corridors: every band with a finding is the first or the last
    of its corridor (design decision 5).

  Verify that `npm test` passes.
- [x] 3.2 In `core/stats.mjs`, select the corridors that apply to the goal. Place every value at each
  end in a band of a corridor in its unit, sets and sessions alike, and give atomic findings as design
  decision 5 types them:
  - block subjects with their path, line and value, from task 1.1;
  - the corridor's `extrapolation` when it lists the subject;
  - no finding for an unknown value.

  Add unit tests to `schema/stats.test.mjs`:
  - no goal applies `major_groups` only, and `strength` applies `major_groups` and `strength.reps`;
  - a value of 4 falls in the band from 4;
  - a value whose lower end only is in a finding band gives one finding marked `lower`;
  - a subject whose ends fall in two finding bands gives two findings;
  - `side_delts` in `hypertrophy.weekly_sets` carries the extrapolation, and `chest` does not.

  Verify that `npm run coverage` passes.

## 4. The text and the fixtures

- [x] 4.1 Add `formatStats(report)` to `core/stats.mjs`, following the spec from Report layout to
  Findings count, and design decision 6:
  - the header;
  - the findings grouped by corridor and band, with:
    - subject lines starting with `targets:` or `groups:`, and marks such as
      `(lower end, extrapolated)`;
    - block lines with path, line, value and end mark;
    - one `Extrapolation:` line when a subject is extrapolated;
  - `numbers (information, no action needed)`, then the targets heading and lines with:
    - padding, and bands after known sets and sessions, with ` *` and `to`;
    - `unknown` without a band, and the singular forms;
    - `; per workout: ` last;
  - workout ids quoted as JSON strings when they hold other characters than letters, digits, `_`, `-`
    and `.`, in the header and after `per workout:`;
  - numbers rounded to two decimals, a half up;
  - the groups heading and the days lines in band order, pair-of-bands lines, the `unknown` line, and
    one line without a band when no corridor in days applies;
  - `not counted`, and `findings: N`.

  Add unit tests of `formatStats` to `schema/stats.test.mjs`, on small reports:
  - the last band's header, `too little data, 43 or more fractional sets a week`;
  - a value shown as `4.67`, 1.125 shown as `1.13`, and `1 set` and `1 session`;
  - a target line ending with `; per workout: A 3, B 3`, and one with `per workout: "Day 1" 3`;
  - a subject marked `(lower end, extrapolated)`, and one `Extrapolation:` line for several such
    subjects;
  - a block line with ` (upper end)`;
  - a band after the sessions, from a small hand-made corridor in `fractional_sessions_per_week`;
  - a pair-of-bands days line placed between the single-band lines;
  - the `unknown` days line, and the days line without a band, from a report with no days corridor.

  Verify that `npm run coverage` passes.
- [x] 4.2 Add the eight fixtures of design decision 7 to `schema/stats/`, each a
  `<name>.repscript.yaml` and a `<name>.stats.txt`. Add their runner to `schema/stats.test.mjs`, with
  the project's catalog and guideline files, each as test `stats report <name>`. Before committing each
  expected report:
  - check every number in it by hand against the design's table and the spec scenarios;
  - fix the code, not the expected file, when they disagree.

  Verify that every fixture passes, that each program in `schema/stats/` passes
  `node tools/validate.mjs`, and that `--test-name-pattern="fixture own-exercises"` selects only the
  validator's fixture.

## 5. The command

- [x] 5.1 Add `tools/stats.mjs`:
  - the usage line when there are no files;
  - `loadCatalog` and `loadGuidelines`, whose errors go to standard error with exit code 1. That
    branch runs only in a copied tree in the tests, so mark it `/* node:coverage ignore next N */`, as
    in `tools/validate.mjs`;
  - per file, `readProgram` and `checkProgram`. With an error, or a file that cannot be read: the path,
    `formatIssues` and `No numbers: fix the errors above first.` Otherwise: the path and `formatStats`;
  - exit code 1 when any file had an error, and 0 otherwise.
- [x] 5.2 Add `tools/stats.test.mjs`, like `tools/validate.test.mjs`, covering:
  - a valid file with findings exits 0;
  - an invalid file among two gives two reports and exit 1;
  - a missing file gives the validator's report, then `No numbers: fix the errors above first.`, and
    exit 1;
  - no arguments give the usage line and exit 1;
  - the draft warning is absent from a valid file's report;
  - in a copied tree, for a broken `corridors.yaml`, a missing `targets.yaml` and a broken catalog
    entry: standard error names the file by its project path, standard output is empty, exit 1.

  Verify that `npm run coverage` passes.
- [x] 5.3 Update `CLAUDE.md`:
  - `node tools/stats.mjs <file>...` under Commands;
  - in Architecture, a section on the program report:
    - `readProgram` → `checkProgram` → `programStats` → `formatStats`;
    - the modules `core/stats.mjs`, `core/guidelines.mjs`, `tools/program.mjs` and `loadGuidelines`;
    - findings atomic in the data and grouped in the text;
  - in Training guidelines: the guideline data is now read at run time by `loadGuidelines` and
    `core/guidelines.mjs`, for the report only, never by the validator;
  - in Tests:
    - the stats fixtures in `schema/stats/`, compared on the project's catalog, with tests named
      `stats report <name>` beside the validator's `fixture <name>`;
    - `tools/stats.test.mjs`;
  - the wording about a "planned" report, in What this is and in Catalog, now says the report exists.

  Verify that every command in it runs as written, and that no "planned" report is left.
- [x] 5.4 Update `CONTRIBUTING.md`:
  - where it says what the report will check or count, say what it does;
  - in the steps of checking the muscles and running the tests: a change to an entry's `muscles` can
    change the expected reports in `schema/stats/`. They are updated in the same commit, each number
    checked by hand, not copied from the tool's output.

  Verify that `node --test` passes, and that the steps read in order.

## 6. Integration

- [x] 6.1 Run `node tools/stats.mjs` on the fixtures of the proposal's done-when list and check each
  by hand:
  - full-body: two findings with their sources and the extrapolation, sets and sessions per target,
    days per group;
  - push-only: coverage only, back 0;
  - strength: header with `major_groups` and `strength.reps`;
  - a file with a validator error: the validator's report and no numbers.

  Then run `npm run check` and verify that it passes.

## Workflow follow-up

- Archive the change with `/opsx:archive` after review, and sync `program-stats` into
  `openspec/specs/`.
