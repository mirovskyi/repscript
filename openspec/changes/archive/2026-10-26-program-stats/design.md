# Design

## Context

- `training-guidelines` defines the counting and the units:
  - what a set counts for, and which muscle keys reach a target;
  - the mean week of the rotation, and both ends of a range;
  - the values per block.
  `catalog/targets.yaml` and `catalog/corridors.yaml` hold the data, and `node --test` checks it.
  Nothing reads the data at run time yet.
- `tools/catalog.mjs` already has `readGuidelineFiles(dir)`, which returns the texts of the three
  files with the UTF-8 check, and `loadCatalog` does not call it.
- `core/validate.mjs` parses a program once, checks it, and maps each issue's path to a line through
  the parsed document. It returns only the issues. The data and the line lookup stay inside
  `checkSource`.
- `core/formats.mjs` parses `sets`, `rest` and `per_week` into `{min, max}`, and on a valid program
  every such value parses. It also parses `reps`, but gives `{min: N, max: Infinity}` for `N+` and
  `{min: 0, max: Infinity}` for `max`. The count maps those itself (decision 4) and never places the
  raw range in a band.
- `core/` is pure, with no I/O, so the player can run it in the browser later. Coverage must stay at
  100% of lines and functions, and 95% of branches.
- The requirements are in `specs/program-stats/spec.md`. This document covers how.

## Goals / Non-Goals

**Goals:**
- One count, in `core/`, that the tools use now and the player later, with the report as data.
- The text is a function of the report data alone, so the tool and a later "Copy for AI" button print
  the same text.
- The expected reports are checked by hand against the counting rules, not generated from the code.

**Non-Goals:**
- Checking the guideline data at run time beyond what the count needs to run: the full checks stay in
  `schema/guidelines.test.mjs`.
- Reading `catalog/references.yaml` at run time. A finding prints a citation as its key and locator,
  which the corridor data already holds.
- Any change to what the validator reports. The one change to the validator's output is on standard
  error: a missing catalog file is named by its project path (decision 1).

## Decisions

### 1. Modules and the flow of data

```
 tools/stats.mjs <file>...
   |
   +-- loadCatalog(catalog/)            -> Catalog         (tools/catalog.mjs, exists)
   +-- loadGuidelines(catalog/, Catalog) -> Guidelines     (tools/catalog.mjs, new)
   |
   +-- per file:
         readProgram(file)            -> source | issue  (tools/program.mjs, new)
         checkProgram(source, ...)    -> issues, data, lineOf  (core/validate.mjs)
           errors? --> path + formatIssues(issues) + "No numbers: ..."
         programStats(data, lineOf, Catalog, Guidelines) -> Report  (core/stats.mjs)
         formatStats(Report)          -> text            (core/stats.mjs)
```

- **`core/guidelines.mjs`**: `buildGuidelines({ targets, corridors }, catalog)` returns the targets,
  the major groups, the counting weights, the corridors and the reach map (decision 3).
- **`core/stats.mjs`**: `programStats` and `formatStats`, pure.
- **`tools/program.mjs`**: `readProgram(file)`, the reading of a program file now inside
  `tools/validate.mjs`. It reads the file, decodes UTF-8 with the NUL check, and returns the source or
  the single issue (cannot read, not UTF-8). Both commands import it, so their reports of an unreadable
  file match.
- **`tools/catalog.mjs`** gets `loadGuidelines(dir, catalog)`, built like `loadCatalog`.
  - It reads only `targets.yaml` and `corridors.yaml`, with the UTF-8 check of `readText`, so a broken
    `references.yaml` never stops the report. `readGuidelineFiles` stays as it is, for the tests.
  - It returns `{ guidelines }` or `{ error }`, where the error has two lines:
    - `Cannot read the guidelines: <file> (line N): <problem>` for a YAML error, or
      `Cannot read the guidelines: <file>: <problem>` for a shape error;
    - the same "restore catalog/" line that a broken catalog gets.
  - It also checks the muscles of every catalog entry with `musclesProblem` of `core/guidelines.mjs`:
    a mapping whose `primary`, and `secondary` when present, are lists of keys of the muscle dictionary.
    The count reads them, but `buildCatalog` does not check them, because the validator does not need
    them. A local edit such as `primary: [pec]` would otherwise pass the validator and crash the count
    before the catalog tests run. The error reads `Cannot read the catalog: <entry file>: <problem>`,
    with the entry file named by its id, which the catalog checks keep equal to the file name.
- **A missing file is named by its project path.** `readText` catches the error of `readFileSync` and
  throws `<file>: the file cannot be read (<code>).`, with the path from the project root and the
  error's code, such as `ENOENT`. `readCatalogFiles` does the same for the `readdirSync` of
  `exercises/`.
  - Without this, a missing `targets.yaml`, `muscles.yaml` or `exercises/` would print the path of the
    operating system.
  - This changes the standard error of `tools/validate.mjs` for a missing catalog file. It now does
    what `program-validation` asks, "print the catalog file", and the delta adds that scenario.
  - The test in `schema/catalog.test.mjs` that matches `ENOENT` at the start of the message is updated
    to the new message.
- **Coverage of `tools/stats.mjs`.** The branch that prints a catalog or guidelines error runs only in
  a copied tree in the tests, and coverage drops the copy's file. It is marked
  `/* node:coverage ignore next N */`, as the same branch of `tools/validate.mjs` is.
- **Alternative: a `--stats` flag on `tools/validate.mjs`.** Rejected. The validator checks form
  only, and an error fails it. The report's findings never fail, and mixing both in one output would
  blur that rule.
- **Alternative: `core/stats` takes the source text and validates it itself.** Rejected. The tool
  needs the validator's issues to print them, so it would validate twice.

### 2. One parse, shared

- `core/validate.mjs` exports `checkProgram(source, schema, catalog)`. It returns:
  - `issues`, exactly what `validate` returns today;
  - `data`, the parsed program, or `undefined` after a YAML or alias error;
  - `lineOf(path)`, which gives `undefined` for every path after such an error.
- `validate` becomes `checkProgram(...).issues`, and every fixture report stays the same.
- The same module exports `formatPath`, and the helper that writes a value in an issue header (JSON,
  strings quoted, a cut at 60 characters), which moves out of `formatIssues`. The report stores block
  subjects with both, so a block reads exactly as in a validator issue.
- `programStats` is called only when no issue is an error. It may then rely on the schema and the
  rules having held, as `buildCatalog`'s callers rely on the catalog checks: every `sets`, `reps`,
  `time`, `rest` and `per_week` parses, every exercise id resolves, and workout ids are unique.
- **Alternative: parse again in `core/stats`.** Rejected. Two parses can drift apart in their
  options, and the block findings need the same line lookup as the validator.

### 3. Guidelines at run time

- `core/catalog.mjs` exports its YAML helper (the core schema, string keys, the line of the first
  error), so guideline files parse exactly as catalog files do.
- `buildGuidelines` throws `Error('<file>: <problem>')` on the first shape the count cannot use:
  - `targets.yaml` without `counting.primary` and `counting.secondary` as numbers, without a list
    `targets`, or without a list `major_groups.groups`;
  - a target without a string `id` and a list of string `nodes`;
  - a group without a string `id` and a list of string `targets`;
  - a corridor without a string `id`, a `unit` the code counts, or a list of `bands`;
  - a corridor in a unit per target without a list of string `targets`, or in a unit per group without
    a list of string `groups`;
  - a corridor whose `goal` or `extrapolation` is not a string, or whose `extrapolated` is not a list of
    strings, when present;
  - a corridor with `extrapolated` and no `extrapolation`: the report marks a subject `extrapolated` only
    with the reason it prints, so the mark would be lost;
  - a band without a number `from`, a number `to` (every band but the last), a string `label` and
    `description`, a boolean `finding`, or a list of `cites` with string `key` and `at`. A band's range
    is its own `from` and `to`, never the next band's `from`.
  Anything deeper, such as gaps between bands or an unknown target id, is the guideline checks' job.
  The tool trusts them, as the validator trusts the catalog checks.
- **The reach map**, `Map<muscle key, Set<target id>>`, is built once from the dictionary tree. A
  key reaches a target when it is one of the target's nodes, lies under one, or has one under it
  (spec `training-guidelines`: Keys that reach a target). The parents come from `catalog.muscles`'
  children lists.
- The weights come from `counting.primary` and `counting.secondary`, not from constants. A change to
  the rule's data changes the count.

### 4. The count

For each exercise that a block uses, its weight per target:
- the `primary` weight when one of its `primary` keys reaches the target;
- otherwise the `secondary` weight when one of its `secondary` keys does;
- otherwise 0.

The entry is the one the block names: the catalog's, deprecated entries included, or the program's
own. The count never follows `replaced_by`, because the report counts what the program states. An
exercise without `muscles`, or whose weights are all 0, goes into `notCounted` with its reason. So a
deprecated own stub without muscles shows there, and the agent sees it.

Per workout, from its blocks, with `sets` at its lower and upper end:
- **sets per target**: the sum of `sets × weight`;
- **sessions per target**: the largest weight among its blocks;
- **involvement per group**: 1 when a block's exercise has a weight above 0 for one of the group's
  targets.

Per week, for `n` workouts and `per_week` from `p_min` to `p_max`:
- lower = `p_min × Σ lower / n`, upper = `p_max × Σ upper / n`;
- written in that order, never as `p / n × Σ`;
- without `per_week`, a value is unknown unless its sum is 0, which is 0 at both ends.

Per block:
- `reps`: the number, both ends of a range, or `N` for `N+`; nothing for `max` or for a timed block;
- `rest`: its seconds at both ends; nothing without `rest`.

**Exactness.** A sum of `sets × weight` is a multiple of 0.5, held exactly in binary, and so is
`p × Σ`. One division by `n` follows. When a weekly value is a whole number, the division is exact.
When it is not, it lies at least `1 / (2n)` from every whole number, far beyond the error of one
division. Every band bound is a whole number, so the band of a value never depends on floating point.
For `n` below 100, a value within 0.005 of a whole number is that whole number, so rounding to two
decimals for display never moves a value across a bound. The argument rests on the data: weights that
are multiples of 0.5 (now 1 and 0.5), and whole band bounds.
- A test in `schema/stats.test.mjs` checks both on the project's guideline files, so a data change that
  breaks the argument fails CI.
- The run time does not check them. The training guidelines do not forbid other numbers, and
  `buildGuidelines` trusts the data as the other checks leave it.

### 5. Bands and atomic findings

- A value is placed at each end: the band where `from ≤ v < to`, or the last band.
  - This finds every finding band that a range touches only while finding bands sit at the edges of a
    corridor, first or last. A band with a finding in the middle could lie between the two ends and be
    missed.
  - Every corridor today has its finding bands at the edges: below a minimum or beyond a range.
  - A test on the project's corridors keeps it so. A corridor that needs a finding band in the middle
    makes the placement check every band between the ends, in the same change.
- **A finding in the data is atomic**: one corridor, one band, one subject, its value at both ends,
  and which ends fall in that band (`lower`, `upper` or `both`).
  - A subject whose ends fall in two bands with findings gives two atomic findings.
  - An unknown value gives none.
- **The grouping happens only in `formatStats`**: a group per corridor and band in data order, with
  its subjects in order.
- **Why both levels**: an upper-body rotation, A: 3 sets of push-ups and B: 3 sets of pull-ups, three
  times a week, has 15 subjects in findings: ten targets below the minimum effective dose and five
  groups trained on fewer than two days.
  - One finding per subject would ask the agent to act on or explain fifteen items whose reasons are
    two.
  - Grouped, the text has two findings, each with its description once.
  - The player and later evals still get each subject on its own, to highlight it or to check that it
    was answered.
- **Overlap is kept.** `legs 0` in coverage and `quads 0` in volume both appear. They cite different
  sources and thresholds (days involved against fractional sets), and suppressing one by the other is
  a rule about meaning that the data does not state.
- **Extrapolation shows in the findings.** `hypertrophy.weekly_sets` applies its source's tiers to six
  targets the source did not measure, and lists them in `extrapolated` with the reason in
  `extrapolation`.
  - An atomic finding records whether its subject is extrapolated.
  - The text marks the subject and prints the corridor's `extrapolation` once in the finding, so a
    citation never reads as if the source had measured that target.
  - The numbers are not marked. They are information, and a second parenthesis on each line would only
    crowd it. The finding is what the agent explains, and that is where the reason belongs.
- **The kind of a subject is named.** Some target ids equal group ids (`back`, `chest`). So a subject
  line starts with `targets:` or `groups:`, and the numbers have the headings
  `targets: fractional sets and sessions a week` and `major groups: days involved a week`.
- **A band follows every value whose unit has an applying corridor.** Today only the sets of a target
  and the days of a group have corridors. A later corridor in sessions, from `strength-corridors` or
  `training-defaults`, then needs no change to the report.

The report data, in JSDoc:

```js
/**
 * @typedef {{ min: number, max: number }} Range
 * @typedef {Range | 'unknown'} Value
 * @typedef {{ value: Value, bands: Band[] | undefined }} Measure bands: the band at each end, when a
 *   corridor in the value's unit applies
 * @typedef {object} Report
 * @property {string | undefined} goal
 * @property {string[]} workouts ids in list order
 * @property {Range | undefined} perWeek
 * @property {string[]} corridors ids of the applying corridors, in file order
 * @property {{ id: string, sets: Measure, sessions: Measure,
 *   byWorkout: { workout: string, sets: Range }[] }[]} targets
 * @property {{ id: string, days: Measure }[]} groups
 * @property {{ exercise: string, reason: 'no muscles' | 'muscles in no target' }[]} notCounted
 * @property {Finding[]} findings atomic, in data order
 * @typedef {object} Band
 * @property {number} from
 * @property {number | undefined} to undefined for the last band
 * @property {string} label
 * @property {boolean} finding
 * @property {string} description
 * @property {{ key: string, at: string }[]} cites
 * @typedef {{ kind: 'target' | 'group', id: string }
 *   | { kind: 'block', path: string, line: number | undefined, value: unknown }} Subject
 *   path: as a validator issue writes it, such as workouts[0].blocks[2].rest; value: as written
 * @typedef {object} Finding
 * @property {string} corridor
 * @property {string} unit
 * @property {Band} band
 * @property {Subject} subject
 * @property {Range} value
 * @property {'lower' | 'upper' | 'both'} ends the ends that fall in this band
 * @property {string | undefined} extrapolation the corridor's extrapolation, when it lists the subject
 */
```

A block subject holds its path, line and value as decision 2 writes them, and a finding holds the
extrapolation text, so `formatStats` depends on the report alone.

### 6. The text

The spec fixes the lines. The choices behind them:
- **Findings first, numbers after, under `numbers (information, no action needed)`.**
  - The agent must act on or explain each finding. The numbers are there so that it never counts by
    itself, whether to answer the person, to fix a finding, or to read a goal that has no corridor.
  - The mark keeps a band without a finding from reading as a target to reach.
- **The weekly sessions per target stay in the text.**
  - No corridor uses them yet. A band follows them once one does (decision 5).
  - They show a target trained less often than its group. In a program with overhead presses in `A`
    and pull-ups in `B`, three times a week, `shoulders` is involved every workout while `side_delts`
    gets 0.75 sessions.
  - They spare the agent from computing a frequency by hand.
- **A number by workout lists only the workouts that add to the target.** A matrix of every workout
  is mostly empty cells, and with six workouts it passes 100 columns. It also asks the reader to match
  columns by position. A list of `push1 4, push2 7` grows only with the workouts that train the target
  and labels every number.
- **The sets by workout come last, after `per workout:`.** They are sets in one workout, not in a
  week, so they get their own label. Placed in parentheses after the weekly band, `(A 3, B 3)` beside
  `9 sets` read as a sum that does not add up, and as part of the band.
- **The unit of every number is named on its line or in the heading above it.**
  - On the line: `sets`, `sessions` and `per workout` in the numbers.
  - In the heading: the finding header for its subjects, and the group heading for the days.
  - A band follows its own value with `:`, so a band never reads as belonging to the next value.
- **A workout id with other characters is quoted.** Ids are free strings, so `Day 1` written bare would
  read as `Day` and `1`. An id of letters, digits, `_`, `-` and `.` stays bare, and any other is a JSON
  string, as a validator issue writes a value.
- **Rounding**: two decimals, a half rounded up. Rotations of four workouts give values such as 1.125,
  shown as `1.13`.
  - `toFixed` is not enough. A value of 20 or more workouts can end in 5 at the third decimal without
    being held exactly: 1.5 / 20 = 0.075 is held a little below it, and `toFixed` gives `0.07`.
  - The code rounds `value × 100` with a margin of `1e-9` added. A weekly value is `k / (2n)` for a whole
    `k`, so a value that is not a tie lies at least `1 / (2n)` hundredths from one, 0.005 for `n` up to
    100, far beyond the margin.
  - Tests pin `1.13` and `0.08`.
- **Days lines when a days corridor covers only some groups.** No corridor does today: `major_groups`
  lists all seven. If one did, the groups it leaves out would go on the line without a band, after the
  band lines and before the `unknown` line, as with no days corridor at all. Band lines are keyed by the
  band's `from` and `label`, so two days corridors with a band of the same `from` and `label` would share
  a line. Neither case needs code until such a corridor exists.
- **No line wrapping.** Each line is one item: a header, a subject list, a description. The AI reads
  lines, and terminals wrap long ones, so a fixed width would add code and nothing for the reader.
- **Padding**: target ids are padded to the longest target id, the only alignment in the text.
- **Number words**: `set` and `session` at exactly 1, `sets` and `sessions` otherwise, ranges
  included.

The report of fixture 1, with the descriptions cut:

```
goal: hypertrophy
workouts: A, B; 3 a week
corridors: major_groups, hypertrophy.weekly_sets, hypertrophy.reps, hypertrophy.rest
finding: major_groups: less than twice a week, 0 to under 2 days involved a week
  groups: back 1.5, abdomen 0, chest 1.5
  The group is trained on fewer than two days a week. ...
  Sources: who2020 p. 32; paga2018 p. 56; paga2018 p. 61; acsm2026 p. 862
finding: hypertrophy.weekly_sets: below the minimum effective dose, 0 to under 4 fractional sets a week
  targets: front_delts 2.25, side_delts 0 (extrapolated), rear_delts 2.25 (extrapolated), biceps 2.25, triceps 2.25, calves 0 (extrapolated), abs 0 (extrapolated)
  Fewer than 4 fractional sets a week, ...
  Extrapolation: The meta-regression measured the growth of the quadriceps, ...
  Sources: pelland2026 Table 3; pelland2026 Section 4.6
numbers (information, no action needed)
targets: fractional sets and sessions a week
  chest       4.5 sets: minimum effective dose; 1.5 sessions; per workout: A 3
  back        4.5 sets: minimum effective dose; 1.5 sessions; per workout: B 3
  front_delts 2.25 sets: below the minimum effective dose *; 0.75 sessions; per workout: A 1.5
  side_delts  0 sets: below the minimum effective dose *; 0 sessions
  rear_delts  2.25 sets: below the minimum effective dose *; 0.75 sessions; per workout: B 1.5
  biceps      2.25 sets: below the minimum effective dose *; 0.75 sessions; per workout: B 1.5
  triceps     2.25 sets: below the minimum effective dose *; 0.75 sessions; per workout: A 1.5
  quads       4.5 sets: minimum effective dose; 1.5 sessions; per workout: A 3
  hamstrings  4.5 sets: minimum effective dose; 1.5 sessions; per workout: B 3
  glutes      9 sets: higher efficiency; 3 sessions; per workout: A 3, B 3
  calves      0 sets: below the minimum effective dose *; 0 sessions
  abs         0 sets: below the minimum effective dose *; 0 sessions
major groups: days involved a week
  back 1.5, abdomen 0, chest 1.5: less than twice a week *
  legs 3, hips 3, shoulders 3, arms 3: twice a week or more
findings: 2
```

### 7. Fixtures

- **Location**: `schema/stats/<name>.repscript.yaml` with `<name>.stats.txt`, run by
  `schema/stats.test.mjs` as `schema/schema.test.mjs` runs `schema/tests/`. The expected text is the
  report without the file path line, which the tool adds.
- **Test names**: `stats report <name>`. A validator fixture's test is `fixture <name>`, so a name
  pattern for one never matches the other, even where the names are the same, as with
  `own-exercises`.
- **Data**: the project's catalog and guideline files, not `schema/tests/catalog/`.
  - The test catalog does not follow the definition of `secondary`, while the spec scenarios name real
    entries and their muscles.
  - A later change to a real entry that moves a count must show in these reports. That is the point:
    `catalog-review` and `strength-corridors` will review their effect as a diff.
- **The numbers** below were counted by hand from the catalog entries. Each expected report is checked
  against them and the spec, never only taken from the code's output.

| # | Fixture | Program | Expected, by hand |
|---|---|---|---|
| 1 | `full-body` | A: `squat.barbell`, `bench_press.barbell`; B: `romanian_deadlift.dumbbell`, `pullup`; 3 × 8-12 each, rest 2m; hypertrophy; 3 a week | As in decision 6. Coverage: back 1.5, abdomen 0, chest 1.5. Volume below the dose: front_delts, rear_delts, biceps, triceps 2.25; side_delts, calves, abs 0. Glutes 9; chest, back, quads, hamstrings 4.5. `findings: 2` |
| 2 | `push-only` | A: `pushup`, `dip`, `overhead_press.barbell`, 3 × 8-12; no goal; 2 a week | Corridors: `major_groups`. Chest, front_delts, triceps 12; side_delts 3; back 0. Sessions: chest, front_delts, triceps 2; side_delts 1. Coverage: legs, hips, back, abdomen 0. `findings: 1` |
| 3 | `per-week-range` | A: `pushup` 3 × 8-12, rest 90s; B: `pullup` 3 × 5-8, rest 2m; hypertrophy; 2-3 a week | Chest 3-4.5 `(lower end)`, back 3-4.5 `(lower end, extrapolated)`; front_delts, rear_delts, biceps, triceps 1.5-2.25; the other six targets 0. Coverage: legs 0, hips 0, back 1-1.5, abdomen 0, chest 1-1.5. Shoulders and arms 2-3, without a finding. `findings: 2` |
| 4 | `no-schedule` | Fixture 1 without `schedule` | Weekly values `unknown`, except side_delts, calves, abs and abdomen at 0, which give the only findings. `findings: 2` |
| 5 | `block-findings` | One workout `A`, hypertrophy, 2 a week: `pushup` 3 × 10, rest 45s; `curl.dumbbell` 3 × 8-30, rest 90s; `pullup` 3 × max, rest 2m; `plank` 3 × 30s without rest | Coverage: legs 0, hips 0. Volume below the dose: front_delts 3, side_delts 0, rear_delts 3, triceps 3, quads, hamstrings, glutes, calves 0 (chest, back, abs 6; biceps 9). `hypertrophy.reps` lists the curl's `reps` `(upper end)`. `hypertrophy.rest` lists the push-up's `rest`. The pull-up and the plank are in neither. `findings: 4` |
| 6 | `own-exercises` | One workout `A`, no goal, 2 a week: `my.towel_row` 3 × 10 (names only), `my.pullup_towel` 3 × 5 (deprecated, no muscles, `replaced_by: my.towel_pullup`, which has `primary: [lats]` and is in no block), `my.band_press` 3 × 12 (`primary: [shoulders]`), `my.wrist_roller` 3 × 30s (`primary: [forearms]`), each with `names` | `not counted: my.towel_row (no muscles), my.pullup_towel (no muscles), my.wrist_roller (muscles in no target)`. front_delts, side_delts, rear_delts 6 sets and 2 sessions each, every other target 0, back included. Coverage: legs, hips, back, abdomen, chest, arms 0; shoulders 2. `findings: 1` |
| 7 | `strength` | A: `squat.barbell` 3 × 5, `bench_press.barbell` 3 × 5, `deadlift.barbell` 1 × 5; B: `squat.barbell` 3 × 5, `overhead_press.barbell` 3 × 5, `deadlift.barbell` 1 × 5; strength; 3 a week | Corridors: `major_groups`, `strength.reps`. Glutes 12, quads 10.5, front_delts 6.75, chest 4.5, triceps 4.5, side_delts 2.25, hamstrings 1.5; back, rear_delts, biceps, calves, abs 0, without bands. Coverage: back 0, abdomen 0, chest 1.5. `findings: 1` |
| 8 | `ppl` | push1, pull1, legs1, push2, pull2, legs2 (exercises below); hypertrophy; 6 a week; reps 8-12 (calves 12-15), rest 2m or 90s | Chest 11, back 14, front_delts 11.5, side_delts 7.5, rear_delts 7, biceps 13, triceps 14.5, quads 8.5, hamstrings 4.5, glutes 13, calves 8, abs 6. Sessions: rear_delts 1; front_delts and hamstrings 1.5; the rest 2. Days: shoulders, arms 4, the rest 2. `findings: 0` |

Fixture 8 exercises:
- push1: `bench_press.barbell` 4, `overhead_press.dumbbell` 3, `lateral_raise.dumbbell` 3,
  `triceps_extension.dumbbell` 3;
- pull1: `pullup` 4, `row.dumbbell` 3, `curl.dumbbell` 3;
- legs1: `squat.barbell` 4, `romanian_deadlift.dumbbell` 3, `calf_raise` 4, `crunch` 3;
- push2: `bench_press.dumbbell` 4, `dip` 3, `lateral_raise.dumbbell` 3, `triceps_extension.dumbbell` 3;
- pull2: `chinup` 4, `row.dumbbell` 3, `curl.dumbbell` 3;
- legs2: `split_squat.bulgarian` 3, `deadlift.barbell` 3, `calf_raise` 4, `plank` 3 × 30s.

**Other tests:**
- `tools/stats.test.mjs`, like `tools/validate.test.mjs`:
  - exit codes, with findings and with an invalid file among several;
  - an unreadable file, and the usage line;
  - a broken `corridors.yaml` in a copied tree (standard error names the file, standard output is
    empty);
  - a missing `targets.yaml`, named by its project path;
  - a broken catalog entry.
- Unit tests of `core/stats` and `core/guidelines`:
  - the boundary value of the spec (three workouts, 2 a week, 6 sets: exactly 4);
  - a value in thirds (4.67);
  - `sets: 3-4` at both ends, and `N+` counted at `N`;
  - a subject whose ends fall in two finding bands;
  - every shape `buildGuidelines` rejects, and the reach map for a group key, a muscle with bundles
    and a key in no target;
  - the exactness assumption on the project's data: the weights are multiples of 0.5, and every band
    bound is a whole number;
  - the edge assumption on the project's corridors: every band with a finding is the first or the last;
  - with a small hand-made corridor in `fractional_sessions_per_week`, a band after the sessions;
  - 1.125 shown as `1.13`, a quoted workout id such as `"Day 1"`, and the days line with no band when
    no corridor in days applies.
- The validator's catalog tests: a missing `muscles.yaml` and a missing `exercises/` are named by their
  project path, with `(ENOENT)`.

## Risks / Trade-offs

- [The expected reports change whenever a catalog entry's muscles change] → Intended: the diff shows
  the effect of the change on real programs. Each such change updates the reports in the same commit,
  and its review reads the diff.
- [An agent treats a band without a finding as a target, and raises volume to reach a higher band] →
  The numbers are marked as information. `agent-workflow` writes the rule to act only on findings into
  `spec/AUTHORING.md`.
- [A strength program gets few checks] → The header names the corridors that applied, so silence is
  not read as approval. `strength-corridors` decides the rest.
- [A coverage finding for a group that an own exercise without `muscles` may train] → The
  `not counted` line names the exercise. The agent adds its muscles, or explains.
- [Long lines in a terminal] → They wrap there. The reader that matters, the AI, reads whole lines.
- [The validator's warnings do not appear in the stats report] → The agent runs `tools/validate.mjs`
  before `tools/stats.mjs`, and the player shows the validator's issues apart from the report.
- [A group key in an own exercise counts for its whole group] → As the training guidelines define it.
  The report counts what the program states.
- [The display rounding argument holds below 100 workouts] → No real rotation comes near that. The
  band always comes from the exact value in any case.
- [Exact comparison rests on weights that are multiples of 0.5 and whole band bounds] → A test on the
  project's data fails when either breaks (decision 4). The change that breaks it then reviews the
  comparison.
- [Extrapolation is marked in the findings only, not in the numbers] → The numbers are information and
  give no source. Where a band leads to a finding, the finding gives the reason.

## Migration Plan

- Additive: no program changes validity or meaning, and no validator report changes. `checkProgram`
  is new, and `validate` keeps its signature and output.
- The one visible change outside the new tool: a missing catalog file is named by its project path on
  the validator's standard error, with the error's code.
- Rollback is reverting the commit. Nothing else reads the new modules.

## Open Questions

- How the player presents the report and full citations (`player-shell`). It may then read
  `references.yaml` at run time. Nothing in this design depends on it.
