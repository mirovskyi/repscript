# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
