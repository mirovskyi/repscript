# Spec Delta

## MODIFIED Requirements

### Requirement: Type and value errors
When a value has the wrong type, the error message SHALL name the expected and the actual type, using
YAML terms (mapping, list, string, integer, number, boolean, empty value). When a value is not one of
the allowed values, the message SHALL list them. When a number is below its minimum, or a list has
fewer items than its minimum, the message SHALL state that minimum. The hint SHALL be the format's
description of that field, list item or top level.

#### Scenario: Wrong type
- **WHEN** `title` holds the number `5`
- **THEN** the error message says a string is expected and an integer was found, and the hint
  describes `title`

#### Scenario: List item of the wrong type
- **WHEN** a program has `workouts: [A]`
- **THEN** the error is at `workouts[0]`, says a mapping is expected and a string was found, and the
  hint describes a workout

#### Scenario: Value not allowed
- **WHEN** a program has `repscript: 1`
- **THEN** the error message lists `0` as the allowed value

#### Scenario: Number below its minimum
- **WHEN** a program has `revision: 0`
- **THEN** the error is at `revision`, the message says at least 1 is expected, and the hint describes
  `revision`

#### Scenario: Empty list
- **WHEN** a program has `workouts: []`
- **THEN** the error is at `workouts` and the message says at least 1 item is expected

### Requirement: Unknown fields
An unknown field SHALL be reported at the line of its key. When a defined field of the same mapping
is a close match, the hint SHALL be `Did you mean <field>?`. A match is close, ignoring letter case,
within two edits, or one edit when the defined name has four letters or fewer. An edit inserts,
deletes or replaces a letter, or swaps two adjacent letters. Otherwise the hint SHALL list the fields
allowed there. An empty field whose name is made only of digits SHALL instead get the decimal comma
hint (see Decimal comma inside braces). Fields starting with `x-` SHALL never be reported.

#### Scenario: Typo in a field name
- **WHEN** a program has `titel: Home strength`
- **THEN** the error is at `titel` and the hint is `Did you mean title?`

#### Scenario: Swapped letters in a short name
- **WHEN** a workout has `di: A`
- **THEN** the hint is `Did you mean id?`

#### Scenario: No close match
- **WHEN** a program has a field `foo`
- **THEN** the hint lists the fields allowed at the top level and mentions `x-` fields

#### Scenario: Numeric field name
- **WHEN** a program has a field `1: one` on line 4
- **THEN** it is reported as an unknown field `1` on line 4

## ADDED Requirements

### Requirement: Value notation errors
When a field with a value notation (set counts, repetitions, durations, weights) holds a value that
does not follow it and no known slip explains it, the validator SHALL report an error at that field.
The message SHALL describe the notation with examples, name the value's type when it is neither a
number nor a string, and state the minimum when the number is too small. The hint SHALL be the field's
description.

#### Scenario: Unknown word
- **WHEN** a block has `reps: lots`
- **THEN** the error is at `reps`, the message gives examples of the repetition notation, and the hint
  describes `reps`

#### Scenario: Wrong type for a notation
- **WHEN** a block has `time: [30s]`
- **THEN** the message says a duration is expected and a list was found

#### Scenario: Too small
- **WHEN** a block has `sets: 0`
- **THEN** the message says at least 1 is expected

#### Scenario: Negative number
- **WHEN** a load has `kg: -5`
- **THEN** the message says more than 0 is expected

#### Scenario: Reversed range below the minimum
- **WHEN** a block has `sets: 3-0`
- **THEN** the message says at least 1 is expected, and the hint is the description, not a corrected
  value

#### Scenario: Space between two numbers
- **WHEN** a block has `reps: 8 12`
- **THEN** the message gives examples of the repetition notation and the hint describes `reps`, not
  `Write 812.`

### Requirement: Slip corrections
When a value follows its notation once known slips are corrected, the validator SHALL report an error
whose message names each slip and whose hint is `Write <corrected value>.` The known slips: a dash or
minus sign instead of a hyphen, named by its Unicode code point; spaces, unless they stand between two
digits; a decimal comma; `failure` or
`amrap` instead of `max`; a unit word such as `min`; a unit on both ends of a range; a reversed range;
a range with equal ends.

#### Scenario: En dash in a range
- **WHEN** a block has `reps: 8–12`, written with an en dash
- **THEN** the message names `U+2013` and the hint is `Write 8-12.`

#### Scenario: Spaces around the hyphen
- **WHEN** a block has `reps: 8 - 12`
- **THEN** the hint is `Write 8-12.`

#### Scenario: Failure instead of max
- **WHEN** a block has `reps: failure`
- **THEN** the hint is `Write max.`

#### Scenario: Unit word
- **WHEN** a block has `rest: 2 min`
- **THEN** the hint is `Write 2m.`

#### Scenario: Decimal comma
- **WHEN** a load written in block style has `kg: 2,5`
- **THEN** the hint is `Write 2.5.`

#### Scenario: Unit on both ends of a range
- **WHEN** a block has `rest: 2m-3m`
- **THEN** the hint is `Write 2-3m.`

#### Scenario: Reversed range
- **WHEN** a block has `sets: 4-3`
- **THEN** the hint is `Write 3-4.`

#### Scenario: Range with equal ends
- **WHEN** a block has `sets: 3-3`
- **THEN** the hint is `Write 3.`

#### Scenario: Several slips at once
- **WHEN** a block has `reps: 12 – 8`, with spaces, an en dash and the larger number first
- **THEN** one error names all three slips and the hint is `Write 8-12.`

### Requirement: Duration without a unit
When a duration is written as a number or a range of numbers without a unit, the validator SHALL
report an error saying the unit is missing, with a hint that names the units `s`, `m` and `h` without
choosing one.

#### Scenario: Number without a unit
- **WHEN** a block has `rest: 90`
- **THEN** the message says the duration has no unit and the hint names `s`, `m` and `h`

#### Scenario: Range without a unit
- **WHEN** a block has `rest: 2-3`
- **THEN** the message says the duration has no unit

#### Scenario: Decimal without a unit
- **WHEN** a block has `rest: 1.5`
- **THEN** the message says the duration has no unit and the hint asks for a whole number with a unit

### Requirement: Field combination errors
When a block does not have exactly one of `reps` and `time`, or a load does not give its weight in
exactly one way, the validator SHALL report one error at the block or at the load. Its message SHALL
name the fields involved and its hint SHALL show a valid form. Extra weight next to `kg` or `lb` SHALL
be reported at the extra-weight field. These checks SHALL skip values of the wrong type.

#### Scenario: Reps and time in one block
- **WHEN** the block whose list item starts on line 8 has both `reps` and `time`
- **THEN** one error is reported at `workouts[0].blocks[0]` on line 8, naming `reps` and `time`

#### Scenario: Two units in one load
- **WHEN** a load has both `kg` and `lb`
- **THEN** one error is reported at the load, naming `kg` and `lb`

#### Scenario: Extra weight without body weight
- **WHEN** a load is `{kg: 18, add_kg: 5}`
- **THEN** the error is at the load's `add_kg` and the hint mentions `bw: true`

#### Scenario: Load of the wrong type
- **WHEN** a block has `load: 18`
- **THEN** only the type error for `load` is reported

#### Scenario: A field counts by its key
- **WHEN** a load is `{bw: false}`
- **THEN** only the error for the value of `bw` is reported, because the load does have a `bw` field

### Requirement: Decimal comma inside braces
When an unknown field's name is made only of digits and its value is empty, as when YAML reads
`{kg: 2,5}` as `kg: 2` plus a field `5`, the validator SHALL report it as an unknown field whose hint,
instead of the other unknown-field hints, says that a comma inside `{ }` separates fields and that
decimals take a dot and ranges a hyphen.

#### Scenario: Decimal comma in a flow mapping
- **WHEN** a block has `load: {kg: 2,5}`
- **THEN** the error is at `load.5` and the hint says that a comma inside `{ }` separates fields and
  shows `kg: 2.5`

#### Scenario: Numeric field name with a value
- **WHEN** a program has a field `1: one`
- **THEN** the hint lists the fields allowed at the top level, as for any other unknown field

### Requirement: Repeated workout ids
When two workouts have the same `id`, the validator SHALL report an error at the later workout's `id`,
naming the workout that has it first.

#### Scenario: Two workouts with id A
- **WHEN** `workouts[0]` and `workouts[1]` both have `id: A`
- **THEN** the error is at `workouts[1].id` and the message names `workouts[0]`

### Requirement: Mixed weight units warning
When the loads of one program use both kilograms (`kg`, `add_kg`) and pounds (`lb`, `add_lb`), the
validator SHALL report one mixed-units warning, at the first load whose unit differs from that of the
first load with a unit. A load with both units, or with none (`{bw: true}`), SHALL NOT count. The
warning alone SHALL NOT make the file invalid.

#### Scenario: Kilograms then pounds
- **WHEN** a valid program's first load is in `kg` and a later load is in `lb`
- **THEN** the report has one mixed-units warning, at the later load, besides the draft-version
  warning, and the command exits with code 0

#### Scenario: Body weight first
- **WHEN** the first load is `{bw: true}`, the second is in `lb` and the third in `kg`
- **THEN** the mixed-units warning is at the third load

#### Scenario: Several loads in the other unit
- **WHEN** the first load is in `kg` and two later loads are in `lb`
- **THEN** only one mixed-units warning is reported, at the first `lb` load
