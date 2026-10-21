# program-format Specification

## Purpose

Defines what a valid Repscript program file is: how it is encoded, which fields it holds and what they
mean. The validator, the player and the AI reference all follow this definition.

## Requirements

### Requirement: Program file encoding
A program SHALL be a UTF-8 text file (a byte order mark is allowed) holding a single YAML 1.2
document read with the YAML 1.2 core schema. JSON SHALL be accepted, since JSON is valid YAML 1.2. The
top level of the document SHALL be a mapping of fields.

#### Scenario: Not UTF-8
- **WHEN** a program file is saved as Windows-1251 or UTF-16
- **THEN** the file is invalid

#### Scenario: YAML 1.1 lookalikes stay strings
- **WHEN** a program has `title: no` and `id: 2026-10-19`
- **THEN** both values are read as strings, not as a boolean and a date, and the file is valid

#### Scenario: JSON program
- **WHEN** a program file contains a JSON object with valid fields
- **THEN** it is read the same way as the equivalent YAML and is valid

#### Scenario: More than one document
- **WHEN** a program file contains a second document after a `---` separator
- **THEN** the file is invalid

#### Scenario: Top level is not a mapping
- **WHEN** a program file is empty, or its top level is a list or a scalar
- **THEN** the file is invalid

### Requirement: Format version
A program SHALL have a `repscript` field holding the format version as an integer. The only defined
version SHALL be `0`, the draft version used until the first public release.

#### Scenario: Draft version
- **WHEN** a program has `repscript: 0`
- **THEN** the version is accepted

#### Scenario: Undefined version
- **WHEN** a program has `repscript: 1`
- **THEN** the file is invalid

#### Scenario: Version written as a string
- **WHEN** a program has `repscript: "0"`
- **THEN** the file is invalid

### Requirement: Program identity
A program SHALL have an `id` field and a `title` field, both strings.

#### Scenario: Identity present
- **WHEN** a program has `id: home-strength` and `title: Home strength`
- **THEN** both fields are accepted

#### Scenario: Title missing
- **WHEN** a program has no `title` field
- **THEN** the file is invalid

### Requirement: Workouts
A program SHALL have a `workouts` field holding a list of at least one workout. Each workout SHALL be a
mapping with an `id` field holding a string and a `blocks` field holding a list of at least one block.
A workout MAY have a `title` field, shown to the user, and a `notes` field, both strings. No two
workouts in a program SHALL have the same `id`.

#### Scenario: Workouts as a list
- **WHEN** a program has two workouts with ids `A` and `B`, each with one block
- **THEN** the workouts are accepted

#### Scenario: Workouts as a mapping
- **WHEN** a program has `workouts: {id: A}`
- **THEN** the file is invalid

#### Scenario: Workout without an id
- **WHEN** a workout has no `id` field
- **THEN** the file is invalid

#### Scenario: No workouts
- **WHEN** a program has `workouts: []`
- **THEN** the file is invalid

#### Scenario: Workout without blocks
- **WHEN** a workout has no `blocks` field, or has `blocks: []`
- **THEN** the file is invalid

#### Scenario: Repeated workout id
- **WHEN** two workouts of a program both have `id: A`
- **THEN** the file is invalid

### Requirement: Closed field set with extensions
A mapping in a program SHALL hold only the fields this format defines for it, plus extension fields
whose names start with `x-`. Extension fields SHALL be valid in any mapping, hold any value, and carry
no meaning for Repscript tools.

#### Scenario: Extension field
- **WHEN** a program or a workout has a field `x-note: anything`
- **THEN** the field is accepted

#### Scenario: Undefined field
- **WHEN** a program has a field `name` that the format does not define
- **THEN** the file is invalid

### Requirement: Program revision
A program SHALL have a `revision` field holding a whole number of at least 1: the version of the
program, starting at 1.

#### Scenario: First revision
- **WHEN** a program has `revision: 1`
- **THEN** the field is accepted

#### Scenario: Revision zero
- **WHEN** a program has `revision: 0`
- **THEN** the file is invalid

#### Scenario: Revision missing
- **WHEN** a program has no `revision` field
- **THEN** the file is invalid

### Requirement: Descriptive program fields
The optional program fields `notes`, `source`, `author` and `language` SHALL each hold a string: notes
for the person training, where the program comes from, who wrote it, and the language of its texts as
a code such as `en`.

#### Scenario: All descriptive fields
- **WHEN** a program has `notes`, `source`, `author` and `language: en`, all strings
- **THEN** the fields are accepted

#### Scenario: Notes as a list
- **WHEN** a program has `notes: [warm up, stretch]`
- **THEN** the file is invalid

### Requirement: Straight blocks
A block SHALL be a mapping describing all sets of one exercise. It SHALL have an `exercise` field
holding the exercise's id as a string (see Exercise references), a `sets` field holding the number of
sets, and exactly one of `reps` (the repetitions in each set) and `time` (the duration of each set). It
MAY have a `rest` field holding the rest after each set, and a `load` field holding the weight.

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

### Requirement: Set counts
`sets` SHALL be a whole number of at least 1, or a range of two such numbers joined by a hyphen with
the smaller one first, meaning a count within that range. The number MAY also be written as a string.

#### Scenario: Single count
- **WHEN** a block has `sets: 3` or `sets: "3"`
- **THEN** the count is accepted as 3 sets

#### Scenario: Count range
- **WHEN** a block has `sets: 3-4`
- **THEN** the count is accepted as 3 to 4 sets

#### Scenario: Zero sets
- **WHEN** a block has `sets: 0`
- **THEN** the file is invalid

#### Scenario: Reversed range
- **WHEN** a block has `sets: 4-3`
- **THEN** the file is invalid

#### Scenario: Range with equal ends
- **WHEN** a block has `sets: 3-3`
- **THEN** the file is invalid

#### Scenario: Fractional count
- **WHEN** a block has `sets: 2.5`
- **THEN** the file is invalid

### Requirement: Repetitions
`reps` SHALL be one of: a whole number of at least 1 or a range written like a set count, giving the
repetitions in each set; a whole number of at least 1 followed by `+`, meaning at least that many and
then as many as possible; or `max`, meaning as many as possible.

#### Scenario: Exact repetitions
- **WHEN** a block has `reps: 10`
- **THEN** the value is accepted as 10 repetitions

#### Scenario: Repetition range
- **WHEN** a block has `reps: 8-12`
- **THEN** the value is accepted as 8 to 12 repetitions

#### Scenario: Minimum then as many as possible
- **WHEN** a block has `reps: 5+`
- **THEN** the value is accepted as at least 5 repetitions with no upper limit

#### Scenario: As many as possible
- **WHEN** a block has `reps: max`
- **THEN** the value is accepted as as many repetitions as possible

#### Scenario: Other words
- **WHEN** a block has `reps: failure`
- **THEN** the file is invalid

### Requirement: Durations
`time` and `rest` SHALL hold a duration greater than zero. It SHALL be written in one of three ways:
a whole number directly followed by the unit `s` (seconds), `m` (minutes) or `h` (hours); minutes,
a colon and seconds from `00` to `59`; or a range of two whole numbers joined by a hyphen, the smaller
one first, with the unit once at the end.

#### Scenario: Seconds
- **WHEN** a block has `rest: 90s`
- **THEN** the value is accepted as 90 seconds

#### Scenario: Minutes and seconds
- **WHEN** a block has `rest: 1:30`
- **THEN** the value is accepted as 90 seconds

#### Scenario: Duration range
- **WHEN** a block has `rest: 2-3m`
- **THEN** the value is accepted as 2 to 3 minutes

#### Scenario: No unit
- **WHEN** a block has `rest: 90`
- **THEN** the file is invalid

#### Scenario: Seconds out of range
- **WHEN** a block has `rest: 1:75`
- **THEN** the file is invalid

#### Scenario: Unit on both ends
- **WHEN** a block has `rest: 2m-3m`
- **THEN** the file is invalid

### Requirement: Load
`load` SHALL be a mapping that gives the weight of each set in exactly one way: `kg` (an external
weight in kilograms), `lb` (an external weight in pounds) or `bw: true` (body weight). Only together
with `bw: true` it MAY have one of `add_kg` and `add_lb`: extra weight on top of body weight. It MAY
have `implement` (see Load implement).

#### Scenario: Kilograms
- **WHEN** a block has `load: {kg: 18}`
- **THEN** the load is accepted

#### Scenario: Pounds
- **WHEN** a block has `load: {lb: 40}`
- **THEN** the load is accepted

#### Scenario: Body weight with extra weight
- **WHEN** a block has `load: {bw: true, add_kg: 2-5}`
- **THEN** the load is accepted

#### Scenario: Two units
- **WHEN** a block has `load: {kg: 18, lb: 40}`
- **THEN** the file is invalid

#### Scenario: Extra weight without body weight
- **WHEN** a block has `load: {kg: 18, add_kg: 5}`
- **THEN** the file is invalid

#### Scenario: Extra weight alone
- **WHEN** a block has `load: {add_kg: 5}`
- **THEN** the file is invalid

#### Scenario: Extra weight in both units
- **WHEN** a block has `load: {bw: true, add_kg: 5, add_lb: 10}`
- **THEN** the file is invalid

#### Scenario: Body weight set to false
- **WHEN** a block has `load: {bw: false}`
- **THEN** the file is invalid

### Requirement: Weights
`kg`, `lb`, `add_kg` and `add_lb` SHALL hold a number greater than zero, written with a dot for
decimals, or a range of two such numbers joined by a hyphen with the smaller one first, meaning a
weight within that range.

#### Scenario: Whole weight
- **WHEN** a load has `kg: 18`
- **THEN** the weight is accepted as 18 kg

#### Scenario: Decimal weight
- **WHEN** a load has `kg: 2.5`
- **THEN** the weight is accepted as 2.5 kg

#### Scenario: Weight range
- **WHEN** a load has `add_kg: 2-5`
- **THEN** the weight is accepted as 2 to 5 kg

#### Scenario: Decimal comma
- **WHEN** a load written in block style has `kg: 2,5`
- **THEN** the file is invalid

#### Scenario: Decimal comma inside braces
- **WHEN** a block has `load: {kg: 2,5}`, which YAML reads as `kg: 2` plus a field `5`
- **THEN** the file is invalid

#### Scenario: Zero weight
- **WHEN** a load has `kg: 0`
- **THEN** the file is invalid

### Requirement: Exercise references
Each block's `exercise` SHALL hold the id of a catalog exercise, or the id of an own exercise described
in the program's `exercises`. A deprecated catalog id SHALL still be valid.

#### Scenario: Catalog exercise
- **WHEN** a block has `exercise: pullup.wide` and the catalog has `pullup.wide`
- **THEN** the reference is accepted

#### Scenario: Own exercise
- **WHEN** a block has `exercise: my.towel_pullup` and the program's `exercises` describes
  `my.towel_pullup`
- **THEN** the reference is accepted

#### Scenario: Name instead of an id
- **WHEN** a block has `exercise: Wide-grip pull-ups`
- **THEN** the file is invalid

#### Scenario: Own exercise not described
- **WHEN** a block has `exercise: my.towel_pullup` and `exercises` does not describe it
- **THEN** the file is invalid

### Requirement: Own exercises
A program MAY have an `exercises` field holding a list of exercise entries in the catalog's entry
format. Their ids SHALL start with `my.` and SHALL be unique within the program. An entry with a
catalog id, which would change that catalog entry, SHALL NOT be allowed.

#### Scenario: Own exercise with names only
- **WHEN** a program has `exercises: [{id: my.towel_pullup, names: {ru: Подтягивания на полотенце}}]`
- **THEN** the field is accepted

#### Scenario: Own exercise with a muscle group
- **WHEN** an own exercise has `muscles: {primary: [back]}` and `back` is a muscle group
- **THEN** the entry is accepted

#### Scenario: Id without the prefix
- **WHEN** an own exercise has `id: towel_pullup`
- **THEN** the file is invalid

#### Scenario: Catalog id
- **WHEN** an own exercise has `id: pullup.wide` and the catalog has `pullup.wide`
- **THEN** the file is invalid, because changing catalog entries in a program is not supported

#### Scenario: Repeated id
- **WHEN** two entries in `exercises` have `id: my.towel_pullup`
- **THEN** the file is invalid

### Requirement: Load implement
`implement` SHALL hold a key of the equipment dictionary: what carries the weight, such as `dumbbells`
or `backpack`. A weight SHALL be that of one implement, with a barbell weighed whole. How many
implements are used SHALL follow from the exercise, not from `implement`.

#### Scenario: Dumbbells
- **WHEN** a block has `load: {kg: 18, implement: dumbbells}`
- **THEN** each dumbbell weighs 18 kg

#### Scenario: Added load in a backpack
- **WHEN** a block for `pullup.wide` has `load: {bw: true, add_kg: 5, implement: backpack}`
- **THEN** the load is accepted, although `backpack` is not in the exercise's `equipment`

#### Scenario: Unknown implement
- **WHEN** a block has `load: {kg: 18, implement: dumbells}`
- **THEN** the file is invalid

### Requirement: Program equipment
The equipment a program needs SHALL be the `equipment` of every exercise its blocks reference, plus the
`implement` of every load. An exercise whose equipment is unknown SHALL add nothing.

#### Scenario: Equipment from exercises and implements
- **WHEN** a program has `row.dumbbell` with `equipment: [dumbbells, bench]` and `pullup.wide` with
  `equipment: [pullup_bar]` and `load: {bw: true, add_kg: 5, implement: backpack}`
- **THEN** the program needs `dumbbells`, `bench`, `pullup_bar` and `backpack`

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
