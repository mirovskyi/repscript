# Spec Delta

## ADDED Requirements

### Requirement: Program goal
A program MAY have a `goal` field holding one goal value as a string: what the program trains for. A
program without `goal` SHALL state no goal. The goal SHALL NOT change how the rest of the program is
validated, nor how it is played.

#### Scenario: Program with a goal
- **WHEN** a program has `goal: hypertrophy`
- **THEN** the field is accepted

#### Scenario: Program without a goal
- **WHEN** an otherwise valid program has no `goal` field
- **THEN** the file is valid and states no goal

#### Scenario: Several goals
- **WHEN** a program has `goal: [strength, hypertrophy]`
- **THEN** the file is invalid

### Requirement: Goal values
`goal` SHALL hold one of `strength` (maximal force), `hypertrophy` (muscle size), `power` (force at
speed), `muscular_endurance` (many repetitions under fatigue) and `health` (general health and physical
function). A goal SHALL name the training adaptation the program aims at, not the person's own wish such
as losing weight, which belongs in `notes`.

#### Scenario: Every value
- **WHEN** a program has `goal` set to each of `strength`, `hypertrophy`, `power`,
  `muscular_endurance` and `health` in turn
- **THEN** each is accepted

#### Scenario: A wish instead of a goal
- **WHEN** a program has `goal: fat_loss`
- **THEN** the file is invalid

#### Scenario: Value in capitals
- **WHEN** a program has `goal: Hypertrophy`
- **THEN** the file is invalid

### Requirement: Schedule
A program MAY have a `schedule` field holding a mapping: how its workouts are spread over time. The only
field this format defines in `schedule` SHALL be `per_week`, and `schedule` SHALL have it.

#### Scenario: Schedule with workouts per week
- **WHEN** a program has `schedule: {per_week: 3}`
- **THEN** the field is accepted

#### Scenario: Empty schedule
- **WHEN** a program has `schedule: {}`
- **THEN** the file is invalid

#### Scenario: Field not defined yet
- **WHEN** a program has `schedule: {per_week: 3, order: [A, B]}`
- **THEN** the file is invalid

### Requirement: Workouts per week
`per_week` SHALL hold the number of workouts in a week: a whole number of at least 1, or a range written
like a set count, meaning that a week holds at least the lower and at most the upper number of
workouts. The number MAY also be written as a string. A program without `per_week` SHALL leave the
number of workouts in a week unstated.

#### Scenario: Whole number
- **WHEN** a program has `schedule: {per_week: 3}`
- **THEN** the program has 3 workouts a week

#### Scenario: Range
- **WHEN** a program has `schedule: {per_week: 3-4}`
- **THEN** the field is accepted, and a week holds at least 3 and at most 4 workouts

#### Scenario: Zero
- **WHEN** a program has `schedule: {per_week: 0}`
- **THEN** the file is invalid

#### Scenario: No schedule
- **WHEN** an otherwise valid program has no `schedule` field
- **THEN** the file is valid and states no number of workouts a week

### Requirement: Workout rotation
A program's workouts SHALL follow one another in list order, and after the last one the first comes
again, whatever the calendar days. A tool that counts by the week SHALL take a week as the next
`per_week` workouts in that order, so a week MAY end in the middle of the list and weeks MAY differ in
the workouts they hold. With a range, it SHALL count a week at each end of the range.

#### Scenario: Two workouts three times a week
- **WHEN** a program has workouts `A` and `B` and `schedule: {per_week: 3}`
- **THEN** the first week is `A`, `B`, `A` and the second week is `B`, `A`, `B`

#### Scenario: More workouts than a week holds
- **WHEN** a program has workouts `A`, `B` and `C` and `schedule: {per_week: 2}`
- **THEN** the first week is `A`, `B` and the second week is `C`, `A`

#### Scenario: Range of workouts a week
- **WHEN** a program has workouts `A` and `B` and `schedule: {per_week: 2-3}`
- **THEN** at the lower end every week is `A`, `B`, and at the upper end the first week is `A`, `B`,
  `A` and the second is `B`, `A`, `B`
