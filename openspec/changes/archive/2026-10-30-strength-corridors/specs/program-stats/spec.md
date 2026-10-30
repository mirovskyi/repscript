# Spec Delta

## MODIFIED Requirements

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
- the line `Extrapolation: <the corridor's extrapolation>`, when a subject is extrapolated;
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

## ADDED Requirements

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
