# program-validation Specification

## Purpose

Checks program files against the program format and reports each problem as text an AI agent can act
on without help: what is wrong, where it is in the file, and how to fix it.

## Requirements

### Requirement: Validate command
Running `node tools/validate.mjs <file>...` with Node 22 or later and nothing installed SHALL check
each given file and print a report for each one to standard output. The command SHALL NOT modify any
file.

#### Scenario: Valid file
- **WHEN** the command is run on a file with no errors
- **THEN** it prints the file's report and exits with code 0, even if the report has warnings

#### Scenario: Invalid file among several
- **WHEN** the command is run on two files and one of them has an error
- **THEN** it prints a report for both files and exits with code 1

#### Scenario: Unreadable file
- **WHEN** a given file does not exist or cannot be read
- **THEN** that file's report has an error saying it cannot be read, the other files are still
  checked, and the command exits with code 1

#### Scenario: File not in UTF-8
- **WHEN** a given file is not valid UTF-8 text, for example saved as Windows-1251 or UTF-16
- **THEN** that file's report has an error saying it is not UTF-8 text, and the command exits with
  code 1

#### Scenario: No arguments
- **WHEN** the command is run without files
- **THEN** it prints a usage line and exits with code 1

### Requirement: Report layout
A file's report SHALL start with the file path, list its issues in file order, and end with the line
`errors: <N>, warnings: <M>`.

#### Scenario: Report of a file with issues
- **WHEN** a file has one error on line 3 and one warning on line 1
- **THEN** the report is the file path, then the warning, then the error, then
  `errors: 1, warnings: 1`

### Requirement: Issue format
Each issue SHALL be a header line, then an indented message line, then an indented line starting
with `Hint:` when a hint exists. The header SHALL hold the severity (`error` or `warning`), a colon,
the path, and the line in parentheses when known, for example `error: title (line 3)`.

#### Scenario: Error with value and hint
- **WHEN** `workouts[0].id` on line 7 holds the number `5`
- **THEN** the issue reads `error: workouts[0].id (line 7) = 5`, then a message that a string is
  expected, then a `Hint:` line describing the field

### Requirement: Values in issue headers
When an issue concerns a string, number or boolean value, its header SHALL end with ` = ` and the
value written as JSON. A JSON text longer than 60 characters SHALL be cut to its first 60 characters
followed by `...`, so the header always stays on one line.

#### Scenario: String value
- **WHEN** a program has `repscript: "0"`
- **THEN** the error header ends with `= "0"`

#### Scenario: Long or multi-line value
- **WHEN** a mistyped value is a 200-character string, or a string spanning several lines
- **THEN** the header is one line and shows the first 60 characters of the value's JSON form followed
  by `...`

### Requirement: Issue paths and lines
A path SHALL join mapping keys with `.` and write list positions as `[i]`, counting from 0. The top
level SHALL be written `(top level)`. Lines SHALL count from 1. An issue about a field SHALL carry the
line of the field's key, an issue about a list item the line where the item starts, and a top-level
issue the line where the top-level value starts, if the file has one.

#### Scenario: Nested path
- **WHEN** an issue concerns the `id` of the second workout
- **THEN** its path is `workouts[1].id`

#### Scenario: Top-level issue
- **WHEN** the file is empty
- **THEN** the issue path is `(top level)` and the header has no line

#### Scenario: Field with a block value
- **WHEN** `workouts:` is on line 5 and holds a mapping whose first field is on line 6
- **THEN** the type error for `workouts` is on line 5

### Requirement: Every issue in one run
The validator SHALL report every issue it finds in a file in one run, not only the first. When a value
has the wrong type, the validator SHALL NOT report issues inside that value.

#### Scenario: Several problems
- **WHEN** a file lacks `title` and has an unknown field `foo`
- **THEN** one run reports both errors

#### Scenario: No cascade from a wrong type
- **WHEN** `workouts` is a mapping instead of a list
- **THEN** only the type error for `workouts` is reported, not the fields inside it

### Requirement: YAML syntax errors
When a file cannot be read as YAML (a syntax error, or an alias `*name` with no matching anchor), the
validator SHALL report each problem as an error with the header `error: (line <L>, column <C>)`, or
`error: (top level)` when it has no position, plus a message and a hint. It SHALL NOT check the file
against the format.

#### Scenario: Broken indentation
- **WHEN** a file has a syntax error on line 4
- **THEN** the report has an error whose header is `error: (line 4, column <C>)`, with a message and
  a `Hint:` line, and no format errors

#### Scenario: Duplicate field
- **WHEN** a mapping holds the same field twice
- **THEN** the report has a syntax error at the second occurrence

#### Scenario: Unquoted value starting with an asterisk
- **WHEN** a program has `title: **Heavy**` on line 2
- **THEN** the report has an error at line 2 and column 8 whose hint says to put the value in quotes,
  and the validator does not stop

#### Scenario: Too many alias expansions
- **WHEN** aliases in a file expand beyond the parser's limit
- **THEN** the report has one error at `(top level)` with a hint, and the next file is still checked

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

### Requirement: Missing required fields
A missing required field SHALL be reported with the path the field would have and the line of its
enclosing mapping, located by the same rules as any other issue. The hint SHALL be the missing field's
description.

#### Scenario: Workout without an id
- **WHEN** the workout whose list item starts on line 6 has no `id`
- **THEN** the error has path `workouts[0].id` and line 6, and the hint describes a workout id

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

### Requirement: Draft version warning
When a program has `repscript: 0`, the validator SHALL report a warning that the format version is a
draft and may still change. The warning alone SHALL NOT make the file invalid.

#### Scenario: Draft program
- **WHEN** a valid program has `repscript: 0`
- **THEN** the report has exactly one issue, the draft-version warning at `repscript`, and the
  command exits with code 0

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
