# Spec Delta

## ADDED Requirements

### Requirement: Main blocks
A block MAY have `main: true`, which marks an exercise whose own result the program is built to raise, as
opposed to assistance work. `true` SHALL be the only valid value, and a block that is not a main block
SHALL leave the field out. The field SHALL be valid in a program of any goal or of none, and on any number
of a workout's blocks. It SHALL NOT change how the block is performed.

#### Scenario: Main lift
- **WHEN** a block is `{exercise: squat.barbell, sets: 3, reps: 5, main: true}`
- **THEN** the block is accepted

#### Scenario: Assistance work
- **WHEN** a block is `{exercise: row.dumbbell, sets: 3, reps: 8-12}`
- **THEN** the block is accepted, and it is not a main block

#### Scenario: Two main blocks in a workout
- **WHEN** a workout has `squat.barbell` and `bench_press.barbell` both with `main: true`
- **THEN** both blocks are accepted

#### Scenario: A program of another goal
- **WHEN** a program with `goal: hypertrophy` has a block with `main: true`
- **THEN** the block is accepted

#### Scenario: Main set to false
- **WHEN** a block has `main: false`
- **THEN** the file is invalid

#### Scenario: Main as a string
- **WHEN** a block has `main: yes`
- **THEN** the file is invalid, because `yes` is a string in YAML 1.2

#### Scenario: Main on a workout
- **WHEN** a workout has `main: true` beside its `id` and `blocks`
- **THEN** the file is invalid, because the field belongs to a block

## MODIFIED Requirements

### Requirement: Straight blocks
A block SHALL be a mapping describing all sets of one exercise. It SHALL have an `exercise` field
holding the exercise's id as a string (see Exercise references), a `sets` field holding the number of
sets, and exactly one of `reps` (the repetitions in each set) and `time` (the duration of each set). It
MAY have a `rest` field holding the rest after each set, a `load` field holding the weight, and a `main`
field (see Main blocks).

#### Scenario: Counted sets
- **WHEN** a block is `{exercise: pushup, sets: 3, reps: 8-12, rest: 90s}`
- **THEN** the block is accepted

#### Scenario: Timed sets
- **WHEN** a block is `{exercise: plank, sets: 3, time: 30s}`
- **THEN** the block is accepted

#### Scenario: Sets missing
- **WHEN** a block is `{exercise: plank, time: 30s}`
- **THEN** the file is invalid

#### Scenario: Reps and time together
- **WHEN** a block has both `reps: 10` and `time: 30s`
- **THEN** the file is invalid

#### Scenario: Neither reps nor time
- **WHEN** a block is `{exercise: pushup, sets: 3}`
- **THEN** the file is invalid

#### Scenario: Block type
- **WHEN** a block has `type: superset`
- **THEN** the file is invalid, because block types are not defined
