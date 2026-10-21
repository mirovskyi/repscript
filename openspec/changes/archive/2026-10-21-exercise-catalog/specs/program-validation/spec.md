# Spec Delta

## MODIFIED Requirements

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

### Requirement: Type and value errors
When a value has the wrong type, the error message SHALL name the expected and the actual type, using
YAML terms (mapping, list, string, integer, number, boolean, empty value). When a value is not one of
the allowed values, the message SHALL list them. When a number is below its minimum, a list has fewer
items than its minimum, or a mapping has fewer fields than its minimum, the message SHALL state that
minimum. The hint SHALL be the format's description of that field, list item or top level.

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

#### Scenario: Empty mapping
- **WHEN** an own exercise has `names: {}`
- **THEN** the error is at its `names`, the message says at least 1 field is expected, and the hint
  describes `names`

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

## ADDED Requirements

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
