# Spec Delta

## ADDED Requirements

### Requirement: Values checked by a corridor for main blocks
When a program has at least one block with `main: true`, a corridor with `main_only: true` SHALL check
only those blocks, in every workout. An exercise of a workout SHALL be checked when one of its blocks in
that workout has `main: true`, and its value SHALL still sum all its blocks in that workout. In a program
without such a block, the corridor SHALL check every value.

#### Scenario: Assistance work after a main lift
- **WHEN** a program with `goal: strength` has `{exercise: squat.barbell, sets: 3, reps: 5, main: true}`
  and `{exercise: row.dumbbell, sets: 3, reps: 8-12}`
- **THEN** no finding of `strength.reps` lists the row, and no finding of `strength.exercise_sets` lists
  it either

#### Scenario: A main lift that is too light
- **WHEN** a program with `goal: strength` has `{exercise: squat.barbell, sets: 3, reps: 10, main: true}`
- **THEN** the finding of `strength.reps` lists that block

#### Scenario: A single set of a main lift
- **WHEN** a program with `goal: strength` has `{exercise: deadlift.barbell, sets: 1, reps: 5, main: true}`
  in workout `A`, and no other block of it there
- **THEN** the finding of `strength.exercise_sets` lists `deadlift.barbell` in `A`

#### Scenario: A warm-up and a single timed set
- **WHEN** a program with `goal: strength` and a block with `main: true` also has
  `{exercise: my.bike, sets: 1, time: 5m}` and `{exercise: plank, sets: 1, time: 60s}`
- **THEN** no finding of `strength.exercise_sets` lists `my.bike` or `plank`

#### Scenario: A marked timed set
- **WHEN** a program with `goal: strength` has `{exercise: plank, sets: 1, time: 60s, main: true}` in
  workout `A`, its only block with `main: true`, and `{exercise: pullup, sets: 3, reps: 10}`
- **THEN** no finding of `strength.reps` lists a block, since the plank gives it no value and the pull-up
  is not marked
- **AND** the finding of `strength.exercise_sets` lists `plank` in `A`

#### Scenario: Top set and back-off sets
- **WHEN** workout `A` of a program with `goal: strength` has
  `{exercise: deadlift.barbell, sets: 1, reps: 3, main: true}` and
  `{exercise: deadlift.barbell, sets: 1, reps: 10}`
- **THEN** `deadlift.barbell` has 2 sets in `A` and no finding of `strength.exercise_sets`, and no finding
  of `strength.reps` lists the second block

#### Scenario: A workout without a main block
- **WHEN** a program with `goal: strength` has a block with `main: true` in workout `A`, and workout `B`
  has `{exercise: pullup, sets: 1, reps: 10}` and no block with `main: true`
- **THEN** no finding of `strength.reps` or `strength.exercise_sets` lists the pull-up

#### Scenario: One exercise marked in one workout only
- **WHEN** a program with `goal: strength` has `{exercise: squat.barbell, sets: 3, reps: 5, main: true}` in
  workout `A`, and `{exercise: squat.barbell, sets: 1, reps: 5}` in workout `B`
- **THEN** no finding of `strength.exercise_sets` lists `squat.barbell` in `B`

#### Scenario: No block marked
- **WHEN** a program with `goal: strength` has no block with `main: true`
- **THEN** `strength.reps` and `strength.exercise_sets` check every value of every block

#### Scenario: Every block marked
- **WHEN** a program with `goal: strength` has `main: true` on every block
- **THEN** it has the findings of the same program with no block marked

### Requirement: Counting with main blocks
`main` SHALL NOT change a number in the report: the weekly sets and sessions, the sets per workout, the
days per major group and the line of exercises that count for nothing SHALL count every block. A corridor
without `main_only` SHALL check every value, whether or not the block has `main: true`.

#### Scenario: Numbers of an assistance exercise
- **WHEN** a program has `{exercise: row.dumbbell, sets: 3, reps: 8-12}` and a block with `main: true`
- **THEN** the sets of the row count for `back` as they do in a program with no block marked

#### Scenario: Coverage from assistance work
- **WHEN** a program with `goal: strength` trains the back only with an unmarked block of `row.dumbbell`,
  done on two days a week, and another block has `main: true`
- **THEN** `back` has 2 days involved a week, and `major_groups` gives it no finding

#### Scenario: Corridors of another goal
- **WHEN** a program with `goal: hypertrophy` has `main: true` on one block, and another block with
  `rest: 45s` and no mark
- **THEN** the finding of `hypertrophy.rest` lists the unmarked block

#### Scenario: Power
- **WHEN** a program with `goal: power` has `main: true` on one block, and another block with `reps: 30`
  and no mark
- **THEN** the finding of `power.reps` lists the unmarked block

### Requirement: Main blocks in the report
When a corridor with `main_only: true` applies and the program has a block with `main: true`, the report
SHALL print `main blocks: `, then each such block as `<workout> <exercise>`, in program order, joined by
`, `. For each such corridor, in file order, it SHALL print two indented lines:
`only these are checked by <corridor id>: <its main_only_reason>`, then `Sources: ` with the corridor's
`main_only_cites` as in a finding.

#### Scenario: Marked main lifts
- **WHEN** a program with `goal: strength` has workout `A` with `squat.barbell` and `bench_press.barbell`,
  and workout `B` with `deadlift.barbell` and `overhead_press.barbell`, all with `main: true`
- **THEN** the report has the line
  `main blocks: A squat.barbell, A bench_press.barbell, B deadlift.barbell, B overhead_press.barbell`
- **AND** the next four lines are, in order: a line that starts with
  `  only these are checked by strength.reps: `,
  `  Sources: acsm2026 p. 853; acsm2026 Table 6; schoenfeld2021 Section 2; androulakis2021 Table 12; androulakis2021 Conclusions`,
  a line that starts with `  only these are checked by strength.exercise_sets: `, and
  `  Sources: acsm2026 Table 6; acsm2026 Table 2; acsm2026 p. 853; acsm2026 p. 865`

#### Scenario: Top set and back-off sets both marked
- **WHEN** workout `A` of a strength program has two blocks of `deadlift.barbell`, both with `main: true`
- **THEN** the line reads `main blocks: A deadlift.barbell, A deadlift.barbell`

#### Scenario: Findings on the marked blocks
- **WHEN** the program of the `main-lifts` stats fixture is reported, with `deadlift.barbell` 1 × 5 marked
  in workout `B`, and assistance work, a warm-up and a timed set unmarked
- **THEN** the findings are `major_groups` for `abdomen 1` and `chest 1`, and `strength.exercise_sets` for
  `B deadlift.barbell 1`
- **AND** the report ends with `findings: 2`

### Requirement: No main blocks in the report
When a corridor with `main_only: true` applies and the program has no block with `main: true`, the report
SHALL print `main blocks: none marked with main: true, every block checked by <ids>`, the ids of those
corridors in file order, joined by `, `. When no such corridor applies, the report SHALL print no main
blocks line, whether or not blocks are marked.

#### Scenario: Strength program without marks
- **WHEN** a program with `goal: strength` has no block with `main: true`
- **THEN** the report has the line
  `main blocks: none marked with main: true, every block checked by strength.reps, strength.exercise_sets`

#### Scenario: Hypertrophy program with a mark
- **WHEN** a program with `goal: hypertrophy` has a block with `main: true`
- **THEN** the report has no line that starts with `main blocks:`

#### Scenario: Program without a goal
- **WHEN** a program without `goal` has a block with `main: true`
- **THEN** the report has no line that starts with `main blocks:`

## MODIFIED Requirements

### Requirement: Report layout
The report of a valid file SHALL be, in this order:
- the file path;
- the header;
- the main blocks lines, when a corridor limited to main blocks applies;
- the findings;
- the line `numbers (information, no action needed)`;
- the numbers per target;
- the days involved per major group;
- the line of exercises that count for no target, when there is one;
- the line `findings: <N>`, where `N` is the number of findings.

#### Scenario: Valid program
- **WHEN** a valid program is reported
- **THEN** its report starts with the file path and the header, and ends with a `findings:` line

#### Scenario: Main blocks lines before the findings
- **WHEN** a program with `goal: strength` is reported
- **THEN** the line that starts with `main blocks:` comes right after the line that starts with
  `corridors:`, and before the first finding

### Requirement: Findings
A value of an applying corridor SHALL give a finding when it falls in a band with `finding: true`, unless
the corridor does not check it (see Values checked by a corridor for main blocks). The report's text SHALL
hold one finding for each corridor and band that holds at least one such value, listing every subject
whose value falls in it: a target, a major group, a block or an exercise of a workout. An unknown value
SHALL give no finding.

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

### Requirement: Findings on blocks
A block that the corridor checks, and whose value falls in a band with a finding, SHALL be listed on its
own indented line, as `<path> (line <N>) = <value>`, written as in a validator issue header, followed by
` (lower end)` or ` (upper end)` when only one end falls in the band. A block with `reps: max`, with
`time` instead of `reps`, or without `rest` SHALL give no value to a corridor that needs it.

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
An exercise of a workout that the corridor checks, and whose value falls in a band with a finding, SHALL
be listed on its own indented line: `<workout> <exercise> <value>`, then its mark as for a target, then
`: ` and the `sets` path of each of its blocks in that workout, in program order, as `<path> (line <N>)`
written as in a validator issue header, joined by `, `.

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

### Requirement: Workout ids in the report
A workout id SHALL be written as it is when it holds only letters, digits, `_`, `-` and `.`, and as a
JSON string otherwise, in the header, after `per workout:`, in a finding's line for an exercise of a
workout, and on the main blocks line.

#### Scenario: Id with a space
- **WHEN** a program's workouts have the ids `Day 1` and `Day 2`, and `chest` gets 3 sets in `Day 1`
- **THEN** the header reads `workouts: "Day 1", "Day 2"; ...`, and the line for `chest` ends with
  `per workout: "Day 1" 3`

#### Scenario: Id with a space in a finding
- **WHEN** a strength program's workout `Day 1` has 1 set of `deadlift.barbell` as its first block, on
  line 9
- **THEN** the finding of `strength.exercise_sets` lists
  `  "Day 1" deadlift.barbell 1: workouts[0].blocks[0].sets (line 9)`

#### Scenario: Id with a space on the main blocks line
- **WHEN** a strength program's workout `Day 1` has a block of `squat.barbell` with `main: true`, the only
  such block
- **THEN** the report has the line `main blocks: "Day 1" squat.barbell`
