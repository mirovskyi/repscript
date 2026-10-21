# program-validation Specification

## Purpose

Checks program files against the program format and reports each problem as text an AI agent can act
on without help: what is wrong, where it is in the file, and how to fix it.

## Requirements

### Requirement: Validate command
Running `node tools/validate.mjs <file>...` with Node 22 or later and nothing installed SHALL check
each given file against the format and the project's exercise catalog, and print a report for each one
to standard output. The command SHALL NOT modify any file. When the catalog cannot be read, it SHALL
print the catalog file and the problem to standard error, check no file, and exit with code 1.

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

#### Scenario: Broken catalog
- **WHEN** a file in `catalog/exercises/` is not valid YAML
- **THEN** the command names that file and the problem on standard error, prints no report and exits
  with code 1

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
the allowed values, the message SHALL list them. When a number, a list's item count or a mapping's
field count is below its minimum, the message SHALL state that minimum. The hint SHALL be the format's
description of that field, list item or top level, except for an allowed-value near miss.

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

#### Scenario: Goal not allowed
- **WHEN** a program has `goal: fat_loss`
- **THEN** the error is at `goal`, the message lists the five goal values, and the hint describes
  `goal`, saying that a goal is the training adaptation and that the person's wish goes in `notes`

#### Scenario: Number below its minimum
- **WHEN** a program has `revision: 0`
- **THEN** the error is at `revision`, the message says at least 1 is expected, and the hint describes
  `revision`

#### Scenario: Empty list
- **WHEN** a program has `workouts: []`
- **THEN** the error is at `workouts` and the message says at least 1 item is expected

#### Scenario: Empty mapping
- **WHEN** an own exercise has `names: {}`
- **THEN** the error is at its `names`, the message says at least 1 field is expected, and the hint
  describes `names`

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
allowed there, or, in a mapping whose fields are only named by a pattern, such as language codes, be
the mapping's description. An empty field whose name is made only of digits SHALL instead get the
decimal comma hint (see Decimal comma inside braces). Fields starting with `x-` SHALL never be
reported.

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

#### Scenario: Field named by a pattern
- **WHEN** an own exercise has `names: {english: Pull-up}`
- **THEN** the error is at `names.english` and the hint describes `names`

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

### Requirement: Order of exercise reference checks
A block's `exercise` that is a string and not a known id (a catalog id, deprecated ones included, or an
own exercise's id) SHALL get exactly one error, from the first case that applies: it matches a name;
its lowercase form is a known id; it starts with `my.`; it has the id form; otherwise. The following
requirements give each case's error.

#### Scenario: Id-shaped name
- **WHEN** a block has `exercise: pushups` and the catalog names `pushup` `Push-up`
- **THEN** the only error is the name error, with the hint `Write exercise: pushup.`

#### Scenario: Known id
- **WHEN** a block has `exercise: pullup.wide` and the catalog has `pullup.wide`
- **THEN** the validator reports no error at `exercise`

### Requirement: Exercise names instead of ids
When a block's `exercise` is not a known id and matches a name or alias of a catalog exercise that is
not deprecated, or of an own exercise in the program whose id has the id form and starts with `my.`,
the validator SHALL report an error at `exercise`
saying that an id is needed, with the hint `Write exercise: <id>.` A catalog match SHALL win over an own
one.

#### Scenario: English name
- **WHEN** a block has `exercise: Wide-grip pull-ups` and the catalog names `pullup.wide`
  `Wide-grip pull-up`
- **THEN** the error says an id is needed and the hint is `Write exercise: pullup.wide.`

#### Scenario: Russian name
- **WHEN** a block has `exercise: подтягивания широким хватом` and the catalog names `pullup.wide`
  `Подтягивания широким хватом`
- **THEN** the hint is `Write exercise: pullup.wide.`

#### Scenario: Name of an own exercise
- **WHEN** a block has `exercise: Ring row` and the program describes `my.ring_row` with that name
- **THEN** the hint is `Write exercise: my.ring_row.`

### Requirement: Exercise ids in capitals
When a block's `exercise` is not a known id, matches no name, and its lowercase form is a known id, the
validator SHALL report an error at `exercise` saying that ids are lowercase, with the hint
`Write exercise: <id>.`

#### Scenario: Capital letters
- **WHEN** a block has `exercise: Pullup.Wide` and the catalog has `pullup.wide`
- **THEN** the error says ids are lowercase and the hint is `Write exercise: pullup.wide.`

### Requirement: Own exercise not described
When a block's `exercise` starts with `my.`, is not described in the program's `exercises`, and none of
the earlier cases applies, the validator SHALL report an error at `exercise`. The hint SHALL be
`Did you mean <id>?` for the nearest close valid own id, and otherwise say to add an entry with this id
and the exercise's name to `exercises`. A value not in the id form SHALL NOT be offered as the id.

#### Scenario: Typo in an own id
- **WHEN** a block has `exercise: my.towel_pulup` and the program describes `my.towel_pullup`
- **THEN** the hint is `Did you mean my.towel_pullup?`

#### Scenario: No exercises field
- **WHEN** a block has `exercise: my.box_jump` and the program has no `exercises`
- **THEN** the hint says to add an entry with the id `my.box_jump` and the exercise's name to
  `exercises`

#### Scenario: Own id not in the id form
- **WHEN** a block has `exercise: my.Box-Jump` and no own exercise is close
- **THEN** the hint describes the id form, gives an example id, and does not offer `my.Box-Jump`

### Requirement: Unknown exercise ids
When a block's `exercise` has the id form, does not start with `my.`, and none of the earlier cases
applies, the validator SHALL report an error at `exercise`, with the first hint that applies: an own id
`my.<value>`; the nearest close catalog id, as for field names, among those sharing the value's first
dot-separated part if any do; the longest catalog id made of the value's leading parts; the index hint.

#### Scenario: Typo in an id
- **WHEN** a block has `exercise: pullup.wdie`
- **THEN** the hint is `Did you mean pullup.wide?`

#### Scenario: Variant that does not exist
- **WHEN** a block has `exercise: pullup.wide.weighted` and the catalog has `pullup.wide`
- **THEN** the hint is `Did you mean pullup.wide?`

#### Scenario: Close id of another movement
- **WHEN** a block has `exercise: pushup.wide`, and the catalog has `pushup` and `pullup.wide` but no
  `pushup.wide`
- **THEN** the hint is `Did you mean pushup?`, not `pullup.wide`

#### Scenario: Own id without the prefix
- **WHEN** a block has `exercise: towel_pullup` and the program describes `my.towel_pullup` under
  another name
- **THEN** the hint is `Did you mean my.towel_pullup?`

#### Scenario: Nothing close
- **WHEN** a block has `exercise: zercher_squat` and no catalog id is close
- **THEN** the hint names `catalog/index.yaml` and `my.`

### Requirement: Unknown exercise names
When a block's `exercise` does not have the id form and none of the earlier cases applies, the validator
SHALL report an error at `exercise` saying that an id is needed and that no exercise has this name. The
hint SHALL say to find the id in `catalog/index.yaml` or to describe the exercise in `exercises` with an
id starting with `my.`.

#### Scenario: Exercise missing from the catalog
- **WHEN** a block has `exercise: Towel pull-ups` and no exercise has this name
- **THEN** the error says no exercise has this name, and the hint names `catalog/index.yaml` and `my.`

### Requirement: Deprecated exercise warning
When a block's `exercise` names a deprecated exercise, the validator SHALL report a warning at
`exercise`, which alone SHALL NOT make the file invalid. Following `replaced_by` while it names an
existing exercise, up to one that is not deprecated, gives the replacement, which the warning names with
the hint `Write exercise: <id>.` When that gives no other exercise, the warning SHALL only say that the
exercise is deprecated.

#### Scenario: Renamed catalog exercise
- **WHEN** a block has `exercise: pullup.wide_grip`, which the catalog replaced by `pullup.wide`
- **THEN** the warning names `pullup.wide`, the hint is `Write exercise: pullup.wide.`, and the file
  stays valid

#### Scenario: Replacement that does not exist
- **WHEN** a block uses `my.old`, which has `deprecated: true` and `replaced_by: my.nothing`, and no
  exercise `my.nothing` exists
- **THEN** the warning only says that `my.old` is deprecated and names no id, and the error at its
  `replaced_by` reports the missing exercise

#### Scenario: Replaced by itself
- **WHEN** a block uses `my.c`, which has `deprecated: true` and `replaced_by: my.c`
- **THEN** the warning only says that `my.c` is deprecated, and its hint says that `replaced_by` names
  the exercise itself

### Requirement: Own exercise id form
When an own exercise's `id` does not have the exercise id form, the validator SHALL report an error at
that `id` that describes the form, with an example starting with `my.`.

#### Scenario: Id with capitals and a hyphen
- **WHEN** an own exercise has `id: My.Towel-Pullup`
- **THEN** the error is at its `id` and describes the id form

### Requirement: Own exercise id prefix
When an own exercise's `id` has the id form, does not start with `my.` and is not a catalog id, the
validator SHALL report an error at that `id` saying that own exercise ids start with `my.`, with the
hint `Write id: my.<id>, and use that id in the blocks.`

#### Scenario: Missing prefix
- **WHEN** an own exercise has `id: towel_pullup`
- **THEN** the hint is `Write id: my.towel_pullup, and use that id in the blocks.`

### Requirement: Own exercise with a catalog id
When an own exercise's `id` is a catalog id, the validator SHALL report an error at that `id` saying
that changing catalog entries in a program is not supported yet. The hint SHALL say to remove the entry
and reference the catalog id, or to give an own variant an id starting with `my.`.

#### Scenario: Override of a catalog entry
- **WHEN** an own exercise has `id: pullup.wide` and the catalog has `pullup.wide`
- **THEN** the error says changing catalog entries is not supported yet

### Requirement: Repeated own exercise ids
When two own exercises have the same `id`, the validator SHALL report an error at the later one's `id`,
naming the entry that has it first.

#### Scenario: Same id twice
- **WHEN** `exercises[0]` and `exercises[2]` both have `id: my.towel_pullup`
- **THEN** the error is at `exercises[2].id` and names `exercises[0]`

### Requirement: Dictionary keys
When a muscle key of an own exercise, an equipment key of an own exercise, or a load's `implement` is
not a key of its dictionary, the validator SHALL report an error at that value. The hint SHALL be
`Did you mean <key>?` for a close match, as for field names, and otherwise list the dictionary's keys
and name its file.

#### Scenario: Typo in an implement
- **WHEN** a block has `load: {kg: 18, implement: dumbells}`
- **THEN** the error is at `load.implement` and the hint is `Did you mean dumbbells?`

#### Scenario: Unknown muscle
- **WHEN** an own exercise has `muscles: {primary: [wings]}` and no muscle key is close
- **THEN** the hint lists the muscle keys and names `catalog/muscles.yaml`

### Requirement: Own exercise like a catalog exercise
When a name or alias of an own exercise matches a name or alias of a catalog exercise that is not
deprecated, the validator SHALL report one warning for that own exercise, at its first matching name or
alias, naming the catalog exercise's id. The warning alone SHALL NOT make the file invalid.

#### Scenario: Own copy of a catalog exercise
- **WHEN** an own exercise `my.wide_pullup` has `names: {en: Wide-grip pull-up}` and the catalog has
  `pullup.wide` with that name
- **THEN** a warning at `exercises[0].names.en` names `pullup.wide`, and the file stays valid

### Requirement: Replacements in a program
An own exercise SHALL follow the catalog's rules for `deprecated` and `replaced_by`, except that
`replaced_by` MAY name a catalog exercise or an own exercise of the program. The validator SHALL report
an error at the entry when one of the two fields is missing, at `replaced_by` when it names no
exercise, and at the entry when replacements form a cycle.

#### Scenario: Renamed own exercise
- **WHEN** `my.pullup_towel` has `deprecated: true` and `replaced_by: my.towel_pullup`, and the program
  describes `my.towel_pullup`
- **THEN** the entries are accepted, and a block using `my.pullup_towel` gets the deprecated warning

#### Scenario: Replacement that does not exist
- **WHEN** an own exercise has `replaced_by: my.nothing`
- **THEN** the error is at its `replaced_by`

#### Scenario: Not deprecated
- **WHEN** an own exercise has `deprecated: false` and no `replaced_by`
- **THEN** the only error is at its `deprecated` and lists `true` as the allowed value

### Requirement: Allowed-value near misses
When a string is not one of the allowed values but one of them is a close match, the hint SHALL be
`Did you mean <value>?`. A match SHALL be close by the rule for unknown fields: ignoring letter case,
within two edits, or one edit when the allowed value has four letters or fewer. Values that are not
strings SHALL get no such hint.

#### Scenario: Goal in capitals
- **WHEN** a program has `goal: Hypertrophy`
- **THEN** the message lists the five goal values and the hint is `Did you mean hypertrophy?`

#### Scenario: Goal with swapped letters
- **WHEN** a program has `goal: strenght`
- **THEN** the hint is `Did you mean strength?`

#### Scenario: Hyphen instead of underscore
- **WHEN** a program has `goal: muscular-endurance`
- **THEN** the hint is `Did you mean muscular_endurance?`

#### Scenario: No close value
- **WHEN** a program has `goal: endurance`
- **THEN** the hint is the description of `goal`

#### Scenario: Number not allowed
- **WHEN** a program has `repscript: 1`
- **THEN** the hint is the description of `repscript`
