# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
