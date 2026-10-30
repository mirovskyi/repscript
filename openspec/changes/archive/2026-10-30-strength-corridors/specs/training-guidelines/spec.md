# Spec Delta

## MODIFIED Requirements

### Requirement: Units
A corridor SHALL measure one value in one of six units: `fractional_sets_per_week` and
`fractional_sessions_per_week` per target, `days_involved_per_week` per major group, `reps_per_set`
and `rest_seconds` per block, and `exercise_sets_per_workout` per exercise of a workout. No other unit
SHALL be used.

#### Scenario: Unit outside the list
- **WHEN** a corridor has `unit: sets_per_session`
- **THEN** the guideline checks report the corridor

#### Scenario: Unit per exercise of a workout
- **WHEN** a corridor has `unit: exercise_sets_per_workout`
- **THEN** the unit is accepted

### Requirement: Corridors
`catalog/corridors.yaml` SHALL be a list of corridors. A corridor SHALL have an `id` in the exercise id
form, unique; a `unit`; `targets` for a unit per target, or `groups` for a unit per group, a list of at
least one id, and neither for a unit per block or per exercise of a workout; optionally a `goal`; and
`bands`.

#### Scenario: Unknown target
- **WHEN** a corridor has `targets: [delts]` and no target has the id `delts`
- **THEN** the guideline checks report the corridor

#### Scenario: Groups for a unit per target
- **WHEN** a corridor in `fractional_sets_per_week` has `groups: [arms]`
- **THEN** the guideline checks report the corridor

#### Scenario: Targets for a unit per block
- **WHEN** a corridor in `reps_per_set` has `targets: [chest]`
- **THEN** the guideline checks report the corridor

#### Scenario: Targets for a unit per exercise of a workout
- **WHEN** a corridor in `exercise_sets_per_workout` has `targets: [chest]`
- **THEN** the guideline checks report the corridor

### Requirement: Corridor goal
A corridor with a `goal`, one of the program goal values, SHALL apply only to programs with that goal; a
corridor without `goal` SHALL apply to every program. The id of a corridor with a `goal` SHALL start with
the goal and a dot, and the id of a corridor without `goal` SHALL NOT start with any goal value and a
dot. No two corridors that apply to one program SHALL measure one unit for a common target or group, or
one unit per block or per exercise of a workout.

#### Scenario: Goal outside the list
- **WHEN** a corridor has `goal: fat_loss`
- **THEN** the guideline checks report the corridor

#### Scenario: Two corridors for one value
- **WHEN** two corridors with `goal: hypertrophy` both measure `fractional_sets_per_week` for `chest`
- **THEN** the guideline checks report the second one

#### Scenario: Two corridors per exercise of a workout
- **WHEN** two corridors with `goal: strength` both measure `exercise_sets_per_workout`
- **THEN** the guideline checks report the second one

#### Scenario: Goal-independent corridor
- **WHEN** a program has `goal: power`
- **THEN** the corridors without `goal` apply to it, and those with another goal do not

#### Scenario: Id of another goal
- **WHEN** a corridor has `goal: strength` and `id: hypertrophy.reps`
- **THEN** the guideline checks report the corridor

#### Scenario: Goal named only in the id
- **WHEN** a corridor has `id: strength.reps` and no `goal`
- **THEN** the guideline checks report the corridor

## ADDED Requirements

### Requirement: Sets of an exercise in a workout
In `exercise_sets_per_workout`, each exercise that a workout's blocks name SHALL have one value in that
workout: the sum of the `sets` of the workout's blocks that name it, at both ends of a range. A block
SHALL count its sets whether it gives `reps`, `reps: max` or `time`, and whether or not its exercise
reaches a target.

#### Scenario: One block
- **WHEN** workout `A` has the block `{exercise: deadlift.barbell, sets: 1, reps: 5}` and no other block
  of `deadlift.barbell`
- **THEN** `deadlift.barbell` has 1 set in `A`

#### Scenario: Top set and back-off sets
- **WHEN** workout `A` has the blocks `{exercise: deadlift.barbell, sets: 1, reps: 3}` and
  `{exercise: deadlift.barbell, sets: 2, reps: 5}`
- **THEN** `deadlift.barbell` has 3 sets in `A`

#### Scenario: One exercise in two workouts
- **WHEN** workouts `A` and `B` each have the block `{exercise: squat.barbell, sets: 3, reps: 5}`
- **THEN** `squat.barbell` has 3 sets in `A` and 3 sets in `B`, not 6 in either

#### Scenario: Range of sets
- **WHEN** workout `A` has the blocks `{exercise: row.dumbbell, sets: 1-3, reps: 8}` and
  `{exercise: row.dumbbell, sets: 2, reps: 12}`
- **THEN** `row.dumbbell` has 3 sets in `A` at the lower end and 5 at the upper end

#### Scenario: Timed sets and sets to failure
- **WHEN** workout `A` has the blocks `{exercise: plank, sets: 1, time: 30s}` and
  `{exercise: pullup, sets: 3, reps: max}`
- **THEN** `plank` has 1 set in `A`, and `pullup` 3 sets

#### Scenario: Exercise without muscles
- **WHEN** workout `A` has the block `{exercise: my.towel_row, sets: 1, reps: 10}`, an own exercise with
  names only
- **THEN** `my.towel_row` has 1 set in `A`

### Requirement: Sets of an exercise for strength
The corridors SHALL include `strength.exercise_sets`, with `goal: strength`, in
`exercise_sets_per_workout`: a band below 2 sets with a finding, then bands from 2 to under 4 sets and
from 4 sets, without one. Its finding SHALL rest on the 2 to 3 sets per session, counted per exercise,
that `acsm2026` lists for strength, and SHALL also cite `paga2018` on what one set does and when. No
corridor with another goal or without a goal SHALL measure that unit.

#### Scenario: One heavy set
- **WHEN** a program with `goal: strength` has the block `{exercise: deadlift.barbell, sets: 1, reps: 5}`
  in workout `A`, and no other block of `deadlift.barbell` in `A`
- **THEN** the value of `deadlift.barbell` in `A` falls in the band below 2 sets, which gives a finding

#### Scenario: Three sets
- **WHEN** a program with `goal: strength` has `squat.barbell` 3 × 5 in workout `A`
- **THEN** its value falls in the band from 2 to under 4 sets, without a finding

#### Scenario: Five sets
- **WHEN** a program with `goal: strength` has `squat.barbell` 5 × 5 in workout `A`
- **THEN** its value falls in the last band, without a finding

#### Scenario: Another goal
- **WHEN** a program with `goal: hypertrophy`, `goal: power`, `goal: muscular_endurance`,
  `goal: health` or no goal has one set of an exercise in a workout
- **THEN** no corridor in `exercise_sets_per_workout` applies to it
