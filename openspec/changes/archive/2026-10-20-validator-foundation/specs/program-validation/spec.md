# Spec Delta

## Purpose

Checks program files against the program format and reports each problem as text an AI agent can act
on without help: what is wrong, where it is in the file, and how to fix it.

## ADDED Requirements

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
the allowed values, the message SHALL list them. The hint SHALL be the format's description of that
field, list item or top level.

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
allowed there. Fields starting with `x-` SHALL never be reported.

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
