# program-stats Specification

## Purpose

Counts a valid program by the rules of the training guidelines and reports its numbers and findings,
each finding with the band it falls in and the sources behind it, as text an AI agent can act on or
explain to the person.

## Requirements

### Requirement: Stats command
Running `node tools/stats.mjs <file>...` with Node 22 or later and nothing installed SHALL print a
report for each given file to standard output, using the project's catalog and guideline files. The
command SHALL NOT modify any file. It SHALL exit with code 0 when every given file gets a report and
none has a validator error or cannot be read, and with code 1 otherwise. A finding SHALL NOT change the
exit code.

#### Scenario: Valid file with findings
- **WHEN** the command is run on a valid program whose report has findings
- **THEN** it prints the report and exits with code 0

#### Scenario: Invalid file among several
- **WHEN** the command is run on two files and one of them has a validator error
- **THEN** it prints a report for both files and exits with code 1

#### Scenario: Unreadable file
- **WHEN** a given file does not exist
- **THEN** that file's report is the validator's report saying the file cannot be read, then
  `No numbers: fix the errors above first.`; the other files still get their reports, and the command
  exits with code 1

#### Scenario: No arguments
- **WHEN** the command is run without files
- **THEN** it prints the usage line `Usage: node tools/stats.mjs <file>...` to standard error and exits
  with code 1

### Requirement: Broken catalog or guidelines
When the catalog or a guideline file that the count needs cannot be read or lacks the shape the count
relies on, the command SHALL print the file, by its path from the project root written with `/`, and
the problem to standard error, print no report, and exit with code 1.

#### Scenario: Broken corridors file
- **WHEN** `catalog/corridors.yaml` is not valid YAML and the command is run on a valid program
- **THEN** standard error names `catalog/corridors.yaml` and the problem, standard output is empty, and
  the command exits with code 1

#### Scenario: Missing targets file
- **WHEN** `catalog/targets.yaml` does not exist
- **THEN** standard error names `catalog/targets.yaml`, not a path of the operating system

#### Scenario: Broken catalog entry
- **WHEN** a file in `catalog/exercises/` is not valid YAML
- **THEN** standard error names that file and the problem, and no report is printed

### Requirement: Programs with errors
A file with a validator error, or that cannot be read, SHALL get, after its path, the report that
`tools/validate.mjs` prints for it, followed by the line `No numbers: fix the errors above first.` A
valid file's warnings SHALL NOT appear in its stats report.

#### Scenario: Unknown field
- **WHEN** a program has a field `titel`
- **THEN** its report is the validator's report with the error for `titel`, then
  `No numbers: fix the errors above first.`

#### Scenario: Draft version warning
- **WHEN** a valid program has `repscript: 0`
- **THEN** its stats report does not mention the draft version

### Requirement: Report layout
The report of a valid file SHALL be, in this order:
- the file path;
- the header;
- the findings;
- the line `numbers (information, no action needed)`;
- the numbers per target;
- the days involved per major group;
- the line of exercises that count for no target, when there is one;
- the line `findings: <N>`, where `N` is the number of findings.

#### Scenario: Valid program
- **WHEN** a valid program is reported
- **THEN** its report starts with the file path and the header, and ends with a `findings:` line

### Requirement: Report header
The header SHALL be three lines:
- `goal: <goal>`, or `goal: not stated`;
- `workouts: <ids in list order>; <per_week> a week`, or `; per week not stated`;
- `corridors: <ids>`, naming every corridor that applies to the program's goal, as the training
  guidelines define, in the order of the corridors file.

#### Scenario: Program with a goal and a schedule
- **WHEN** a program has `goal: hypertrophy`, workouts `A` and `B`, and `schedule: {per_week: 3}`
- **THEN** the header reads `goal: hypertrophy`, `workouts: A, B; 3 a week` and
  `corridors: major_groups, hypertrophy.weekly_sets, hypertrophy.reps, hypertrophy.rest`

#### Scenario: Program without a goal
- **WHEN** a program has no `goal`
- **THEN** the header reads `goal: not stated` and `corridors: major_groups`

#### Scenario: Strength program
- **WHEN** a program has `goal: strength`
- **THEN** the header reads `corridors: major_groups, strength.reps, strength.exercise_sets`

#### Scenario: Range of workouts a week
- **WHEN** a program has `schedule: {per_week: 2-3}`
- **THEN** the workouts line ends with `; 2-3 a week`

#### Scenario: No schedule
- **WHEN** a program has no `schedule`
- **THEN** the workouts line ends with `; per week not stated`

### Requirement: Findings
A value of an applying corridor SHALL give a finding when it falls in a band with `finding: true`. The
report's text SHALL hold one finding for each corridor and band that holds at least one such value,
listing every subject whose value falls in it: a target, a major group, a block or an exercise of a
workout. An unknown value SHALL give no finding.

#### Scenario: Full-body rotation
- **WHEN** workout `A` holds `squat.barbell` and `bench_press.barbell`, workout `B` holds
  `romanian_deadlift.dumbbell` and `pullup`, each block `sets: 3`, `reps: 8-12` and `rest: 2m`, with
  `goal: hypertrophy` and `schedule: {per_week: 3}`
- **THEN** the report has a finding for `hypertrophy.weekly_sets` in the band below the minimum
  effective dose, whose targets are `front_delts 2.25`, `side_delts 0`, `rear_delts 2.25`,
  `biceps 2.25`, `triceps 2.25`, `calves 0` and `abs 0`
- **AND** a finding for `major_groups` in the band of less than twice a week, whose groups are
  `back 1.5`, `abdomen 0` and `chest 1.5`

#### Scenario: Unknown weekly value
- **WHEN** the same program has no `schedule`
- **THEN** no target or group that a workout trains is listed in a finding, and `side_delts`,
  `calves`, `abs` and `abdomen`, at 0, still are

#### Scenario: Value per exercise without a schedule
- **WHEN** a program with `goal: strength` and no `schedule` has 1 set of `deadlift.barbell` in workout
  `A`
- **THEN** the finding of `strength.exercise_sets` lists `deadlift.barbell` in `A`, since a value per
  workout needs no number of workouts a week

### Requirement: Finding format
A finding SHALL be a header line `finding: <corridor id>: <band label>, <band range>`, then indented
lines:
- its subjects: one line of targets or groups, or one line per block or per exercise of a workout;
- the band's description;
- `Extrapolation: <the corridor's extrapolation>`, when a subject is extrapolated;
- `Sources: `, then the band's citations as `<key> <at>`, joined by `; `.

The band range SHALL read `<from> to under <to> <unit>`, or `<from> or more <unit>` for the last band.

#### Scenario: Volume finding
- **WHEN** the full-body rotation above is reported
- **THEN** a finding starts with the line
  `finding: hypertrophy.weekly_sets: below the minimum effective dose, 0 to under 4 fractional sets a week`
  and ends with the line `  Sources: pelland2026 Table 3; pelland2026 Section 4.6`

#### Scenario: Last band
- **WHEN** a hypertrophy program gives a target 45 fractional sets a week
- **THEN** its finding's header ends with `too little data, 43 or more fractional sets a week`

### Requirement: Units in the report
The report SHALL name the units in these words:
- `fractional_sets_per_week`: `fractional sets a week`;
- `fractional_sessions_per_week`: `fractional sessions a week`;
- `days_involved_per_week`: `days involved a week`;
- `reps_per_set`: `repetitions per set`;
- `rest_seconds`: `seconds of rest`;
- `exercise_sets_per_workout`: `sets of an exercise in a workout`.

#### Scenario: Coverage finding
- **WHEN** a finding of `major_groups` is reported
- **THEN** its header ends with `less than twice a week, 0 to under 2 days involved a week`

#### Scenario: Sets finding
- **WHEN** a finding of `strength.exercise_sets` is reported
- **THEN** its header ends with `fewer than two sets, 0 to under 2 sets of an exercise in a workout`

### Requirement: Subjects of a finding
Targets SHALL be listed on one line starting with `targets: `, and groups on one line starting with
`groups: `, each as `<id> <value>`, joined by `, `. A value SHALL be given at both ends, as
`<lower>-<upper>`, when the ends differ. A subject whose two ends fall in two bands with findings SHALL
be listed in both findings.

#### Scenario: Two kinds with one id
- **WHEN** the full-body rotation above is reported
- **THEN** the coverage finding's subjects read `  groups: back 1.5, abdomen 0, chest 1.5`, and the
  volume finding's subjects start with `  targets: front_delts 2.25`

### Requirement: Marks of a subject
A subject SHALL be followed by its marks in parentheses, joined by `, `, when it has any: first
`lower end` or `upper end` when only that end falls in the band, then `extrapolated` when its corridor
lists it in `extrapolated`.

#### Scenario: Lower end only
- **WHEN** workout `A` holds 3 sets of `pushup` and workout `B` 3 sets of `pullup`, with
  `goal: hypertrophy` and `schedule: {per_week: 2-3}`
- **THEN** the finding below the minimum effective dose lists `chest 3-4.5 (lower end)` and
  `back 3-4.5 (lower end, extrapolated)`, and lists `front_delts 1.5-2.25` without a mark, since both
  ends fall in it and the corridor measured the front delts

### Requirement: Extrapolated subjects
A finding that lists a subject marked `extrapolated` SHALL hold, after the band's description, the
indented line `Extrapolation: ` followed by the corridor's `extrapolation`, once, however many of its
subjects are marked.

#### Scenario: Targets the source did not measure
- **WHEN** the full-body rotation above is reported
- **THEN** the volume finding lists `side_delts 0 (extrapolated)`, `rear_delts 2.25 (extrapolated)`,
  `calves 0 (extrapolated)` and `abs 0 (extrapolated)`, and holds one line starting with
  `  Extrapolation: The meta-regression measured`

#### Scenario: Only measured targets
- **WHEN** a finding of `hypertrophy.weekly_sets` lists only `chest` and `quads`
- **THEN** it has no `Extrapolation:` line

### Requirement: Findings on blocks
A block whose value falls in a band with a finding SHALL be listed on its own indented line, as
`<path> (line <N>) = <value>`, written as in a validator issue header, followed by ` (lower end)` or
` (upper end)` when only one end falls in the band. A block with `reps: max`, with `time` instead of
`reps`, or without `rest` SHALL give no value to a corridor that needs it.

#### Scenario: Short rest
- **WHEN** a hypertrophy program's first block, on line 9, has `rest: 45s`
- **THEN** the finding for `hypertrophy.rest` in the band shorter than recommended lists
  `workouts[0].blocks[0].rest (line 9) = "45s"`

#### Scenario: Range of repetitions
- **WHEN** a hypertrophy program's second block, on line 10, has `reps: 8-30`
- **THEN** the finding lighter than the loads studied lists
  `workouts[0].blocks[1].reps (line 10) = "8-30" (upper end)`

#### Scenario: Timed sets
- **WHEN** a hypertrophy program's block is `{exercise: plank, sets: 3, time: 30s}`
- **THEN** no finding lists the block

### Requirement: Findings on exercises of a workout
An exercise of a workout whose value falls in a band with a finding SHALL be listed on its own indented
line: `<workout> <exercise> <value>`, then its mark as for a target, then `: ` and the `sets` path of
each of its blocks in that workout, in program order, as `<path> (line <N>)` written as in a validator
issue header, joined by `, `.

#### Scenario: Strength program with one set of deadlifts
- **WHEN** a program with `goal: strength` and `schedule: {per_week: 3}` has workout `A` with
  `squat.barbell` 3 × 5, `bench_press.barbell` 3 × 5 and `deadlift.barbell` 1 × 5, and workout `B`
  with `squat.barbell` 3 × 5, `overhead_press.barbell` 3 × 5 and `deadlift.barbell` 1 × 5, its blocks
  of `deadlift.barbell` on lines 14 and 19
- **THEN** the finding of `strength.exercise_sets` lists the lines
  `  A deadlift.barbell 1: workouts[0].blocks[2].sets (line 14)` and
  `  B deadlift.barbell 1: workouts[1].blocks[2].sets (line 19)`
- **AND** the report ends with `findings: 2`

#### Scenario: Range of sets
- **WHEN** a strength program's workout `A` has as its first block, on line 9, the only block of
  `row.dumbbell` in `A`, with `sets: 1-3`
- **THEN** the finding lists `  A row.dumbbell 1-3 (lower end): workouts[0].blocks[0].sets (line 9)`

#### Scenario: Two blocks of one exercise
- **WHEN** the guideline data that the report reads holds a corridor in `exercise_sets_per_workout`
  whose band with a finding holds 3, and a program's workout `A` has as its first two blocks 1 set of
  `deadlift.barbell` on line 9 and 2 sets of it on line 10
- **THEN** that finding lists
  `  A deadlift.barbell 3: workouts[0].blocks[0].sets (line 9), workouts[0].blocks[1].sets (line 10)`

### Requirement: Order of findings
Findings SHALL follow the order of their corridors in the corridors file, and within a corridor the
order of its bands. Targets SHALL be listed in the order of the targets, groups in the order of the
major groups, and blocks in the order of the program. Exercises of a workout SHALL be listed by
workout in list order, and within a workout by the first block that names each exercise.

#### Scenario: Two findings
- **WHEN** the full-body rotation above is reported
- **THEN** the finding of `major_groups` comes before the finding of `hypertrophy.weekly_sets`

#### Scenario: Exercises in two workouts
- **WHEN** a strength program has 1 set of `deadlift.barbell` and then 1 set of `pullup` in workout
  `A`, and 1 set of `deadlift.barbell` in workout `B`
- **THEN** the finding of `strength.exercise_sets` lists `A deadlift.barbell`, `A pullup`, then
  `B deadlift.barbell`

### Requirement: Numbers per target
After the line `numbers (information, no action needed)`, the report SHALL print the line
`targets: fractional sets and sessions a week`, then one indented line per target, in target order:
- the target id, padded to the longest target id;
- the weekly sets with `sets`, and their band;
- `; `, then the weekly sessions with `sessions`, and their band;
- when a workout adds to the target, `; per workout: `, then each such workout in list order with its
  fractional sets, joined by `, `.

#### Scenario: Target in one workout
- **WHEN** the full-body rotation above is reported
- **THEN** the line for `chest` reads, after the padded id,
  `4.5 sets: minimum effective dose; 1.5 sessions; per workout: A 3`

#### Scenario: Target in two workouts
- **WHEN** the same program is reported
- **THEN** the line for `glutes` reads, after the padded id,
  `9 sets: higher efficiency; 3 sessions; per workout: A 3, B 3`

#### Scenario: Target in no workout
- **WHEN** the same program is reported
- **THEN** the line for `side_delts` reads, after the padded id,
  `0 sets: below the minimum effective dose *; 0 sessions`

#### Scenario: No corridor for the goal
- **WHEN** a program with `goal: strength` and `schedule: {per_week: 3}` has workout `A` with
  `squat.barbell` 3 × 5, `bench_press.barbell` 3 × 5 and `deadlift.barbell` 1 × 5, and workout `B`
  with `squat.barbell` 3 × 5, `overhead_press.barbell` 3 × 5 and `deadlift.barbell` 1 × 5
- **THEN** the line for `chest` reads, after the padded id, `4.5 sets; 1.5 sessions; per workout: A 3`

#### Scenario: No schedule
- **WHEN** a program without `schedule` holds 3 sets of `bench_press.barbell` in workout `A`
- **THEN** the line for `chest` reads, after the padded id,
  `unknown sets; unknown sessions; per workout: A 3`

#### Scenario: Corridor for sessions
- **WHEN** a corridor in `fractional_sessions_per_week` applies to the program, and `chest` gets 1.5
  sessions
- **THEN** the line for `chest` holds `; 1.5 sessions: ` followed by the band of 1.5 in that corridor

### Requirement: Bands in the numbers
A known weekly value SHALL be followed by `: ` and its band when a corridor in its unit applies to it,
and by nothing otherwise. An unknown value SHALL have no band. A band with `finding: true` SHALL be followed by ` *`. When the two ends of a value
fall in different bands, both bands SHALL be named, the lower first, joined by ` to `.

#### Scenario: Ends in two bands
- **WHEN** a hypertrophy program gives `chest` 3 sets a week at the lower end and 4.5 at the upper end
- **THEN** its line holds `3-4.5 sets: below the minimum effective dose * to minimum effective dose`

### Requirement: Days per major group
After the target lines, the report SHALL print the line `major groups: days involved a week`, then one
indented line for each band that holds both ends of a group's value, or each pair of bands that holds
its lower and upper end, ordered by the band of the lower end and then of the upper end. A line SHALL
list its groups in group order as `<id> <days>`, joined by `, `, followed by `: ` and its band or pair
of bands, named as in Bands in the numbers.

#### Scenario: Full-body rotation
- **WHEN** the full-body rotation above is reported
- **THEN** the lines read `  back 1.5, abdomen 0, chest 1.5: less than twice a week *` and
  `  legs 3, hips 3, shoulders 3, arms 3: twice a week or more`

#### Scenario: Ends in two bands
- **WHEN** workouts `A` and `B` have `schedule: {per_week: 3-4}`, and only `A` trains the chest
- **THEN** `chest 1.5-2` is listed on a line ending with
  `: less than twice a week * to twice a week or more`, after the line of the groups below twice a
  week at both ends and before the line of those at twice a week or more at both ends

### Requirement: Unknown days
Groups whose days a week are unknown SHALL be listed after the other days lines, on one indented line,
as `<id> unknown` joined by `, `, with no band.

#### Scenario: No schedule
- **WHEN** the full-body rotation above has no `schedule`
- **THEN** the days lines read `  abdomen 0: less than twice a week *` and
  `  legs unknown, hips unknown, back unknown, chest unknown, shoulders unknown, arms unknown`

### Requirement: Days without a corridor
When no corridor in days involved a week applies to the program, the groups with a known value SHALL
be listed on one indented line, in group order as `<id> <days>` joined by `, `, with no band, before
the line of unknown values.

#### Scenario: Corridors without coverage
- **WHEN** the guideline data that the report reads holds no corridor in `days_involved_per_week`, and
  a program's workouts train every group on 2 days a week
- **THEN** the days lines are one line listing the seven groups, each with `2`, and no `:` with a band

### Requirement: Number display
A number SHALL be shown rounded to two decimals, a half rounded up, without trailing zeros, and a range
as `<lower>-<upper>`. The band SHALL be found from the exact value, not the shown one. `sets` and
`sessions` SHALL read `set` and `session` when the value is exactly 1.

#### Scenario: Half of the last decimal
- **WHEN** four workouts at 3 a week give a target 1.5 sets over the rotation, which is 1.125 a week
- **THEN** it shows `1.13`

#### Scenario: Value on a boundary
- **WHEN** a hypertrophy program has three workouts, `schedule: {per_week: 2}`, and 6 sets for
  `chest`, all in one workout
- **THEN** `chest` shows 4 sets a week, in the band of the minimum effective dose

#### Scenario: Value in thirds
- **WHEN** the same program has 7 sets for `chest`
- **THEN** `chest` shows 4.67 sets a week

### Requirement: Workout ids in the report
A workout id SHALL be written as it is when it holds only letters, digits, `_`, `-` and `.`, and as a
JSON string otherwise, in the header, after `per workout:`, and in a finding's line for an exercise of
a workout.

#### Scenario: Id with a space
- **WHEN** a program's workouts have the ids `Day 1` and `Day 2`, and `chest` gets 3 sets in `Day 1`
- **THEN** the header reads `workouts: "Day 1", "Day 2"; ...`, and the line for `chest` ends with
  `per workout: "Day 1" 3`

#### Scenario: Id with a space in a finding
- **WHEN** a strength program's workout `Day 1` has 1 set of `deadlift.barbell` as its first block, on
  line 9
- **THEN** the finding of `strength.exercise_sets` lists
  `  "Day 1" deadlift.barbell 1: workouts[0].blocks[0].sets (line 9)`

### Requirement: Exercises that count for nothing
A block's exercise whose sets count for no target SHALL be named once each, in the order of first use,
on the line `not counted: <id> (<reason>), ...`. The reason SHALL be `no muscles` for an exercise
without `muscles`, and `muscles in no target` for one whose muscles reach no target. The count SHALL use
the entry that the block names, never its `replaced_by`.

#### Scenario: Own exercise without muscles
- **WHEN** a block holds `my.towel_row`, an own exercise with names only
- **THEN** the report has the line `not counted: my.towel_row (no muscles)`, and the coverage finding
  still lists `back` when no other exercise trains it

#### Scenario: Muscles in no target
- **WHEN** an own exercise has `muscles: {primary: [forearms]}`
- **THEN** the line names it with `(muscles in no target)`

#### Scenario: Deprecated own exercise
- **WHEN** a block holds `my.pullup_towel`, deprecated without `muscles` and with
  `replaced_by: my.towel_pullup`, which has muscles
- **THEN** the line names `my.pullup_towel (no muscles)`, and no set counts for the muscles of
  `my.towel_pullup`

### Requirement: Findings count
The last line of a valid file's report SHALL be `findings: <N>`, where `N` is the number of findings,
each a corridor and a band, not the number of subjects.

#### Scenario: Two findings with ten subjects
- **WHEN** the full-body rotation above is reported
- **THEN** the report ends with `findings: 2`

#### Scenario: Balanced program
- **WHEN** six workouts of pushing, pulling and legs, each twice in a rotation of six a week, with
  repetitions from 8 to 15 and rest of 90 seconds or more, are reported with `goal: hypertrophy`
- **THEN** the report ends with `findings: 0`
