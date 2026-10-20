# Spec Delta

## Purpose

Defines what a valid Repscript program file is: how it is encoded, which fields it holds and what they
mean. The validator, the player and the AI reference all follow this definition.

## ADDED Requirements

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
A program SHALL have a `workouts` field holding a list. Each workout SHALL be a mapping with an `id`
field holding a string.

#### Scenario: Workouts as a list
- **WHEN** a program has `workouts: [{id: A}, {id: B}]`
- **THEN** the workouts are accepted

#### Scenario: Workouts as a mapping
- **WHEN** a program has `workouts: {id: A}`
- **THEN** the file is invalid

#### Scenario: Workout without an id
- **WHEN** a workout has no `id` field
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
