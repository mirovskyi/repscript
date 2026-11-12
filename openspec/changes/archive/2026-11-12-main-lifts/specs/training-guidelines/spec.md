# Spec Delta

## ADDED Requirements

### Requirement: Corridors for main blocks
A corridor in a unit per block or per exercise of a workout MAY have `main_only: true`, which limits it
to main blocks in the way the program report defines. `main_only` SHALL hold only `true`. A corridor with
it SHALL say why in `main_only_reason`, in our words, and SHALL cite its sources in `main_only_cites`, a
list of at least one citation. Both SHALL be present exactly when `main_only` is.

#### Scenario: Corridor per block
- **WHEN** a corridor in `reps_per_set` has `main_only: true`, a `main_only_reason` and `main_only_cites`
- **THEN** the corridor is accepted

#### Scenario: Corridor per exercise of a workout
- **WHEN** a corridor in `exercise_sets_per_workout` has `main_only: true`, a `main_only_reason` and
  `main_only_cites`
- **THEN** the corridor is accepted

#### Scenario: Corridor per target
- **WHEN** a corridor in `fractional_sets_per_week` has `main_only: true`
- **THEN** the guideline checks report the corridor

#### Scenario: Corridor per group
- **WHEN** a corridor in `days_involved_per_week` has `main_only: true`
- **THEN** the guideline checks report the corridor

#### Scenario: Limit without a reason
- **WHEN** a corridor has `main_only: true` and `main_only_cites`, and no `main_only_reason`
- **THEN** the guideline checks report the corridor

#### Scenario: Limit without citations
- **WHEN** a corridor has `main_only: true` and a `main_only_reason`, and no `main_only_cites`, or
  `main_only_cites: []`
- **THEN** the guideline checks report the corridor

#### Scenario: Reason or citations without a limit
- **WHEN** a corridor has `main_only_reason` or `main_only_cites`, and no `main_only`
- **THEN** the guideline checks report the corridor

#### Scenario: Limit set to false
- **WHEN** a corridor has `main_only: false`
- **THEN** the guideline checks report the corridor

#### Scenario: Empty reason
- **WHEN** a corridor has `main_only: true` and an empty `main_only_reason`
- **THEN** the guideline checks report the corridor

#### Scenario: Citation of an unknown key
- **WHEN** `main_only_cites` holds `{key: schoenfeld2020, at: Section 2}` and the bibliography has no
  `schoenfeld2020`
- **THEN** the guideline checks report the citation and name the key

#### Scenario: Key cited only by a limit
- **WHEN** the bibliography has `schoenfeld2021`, and only a corridor's `main_only_cites` names it
- **THEN** the key counts as cited

### Requirement: Main blocks for strength
`strength.reps` and `strength.exercise_sets` SHALL have `main_only: true`, and no other corridor SHALL
have it. The reason of each SHALL say that no source it cites says that assistance work may go unchecked,
and that the limit is our reading. The bands of both corridors SHALL NOT change.

#### Scenario: The project's corridors
- **WHEN** the project's corridors are checked
- **THEN** `strength.reps` and `strength.exercise_sets` have `main_only: true`, and `power.reps`,
  `hypertrophy.reps`, `hypertrophy.rest` and every other corridor do not

#### Scenario: Reason of the load
- **WHEN** the `main_only_reason` of `strength.reps` is read
- **THEN** it says that the position stand counts strength, unless a review says otherwise, as a
  one-repetition maximum in the same mode as the training
- **AND** that a review finds the advantage of heavy loads smaller when strength is measured on another
  kind of device, and that powerlifters in one survey who had tried a minimum-dose approach reported more
  repetitions per set on accessory exercises than on the powerlifts
- **AND** it calls the limit our reading, and states as part of that reading that this load describes
  strength in the exercise trained

#### Scenario: Citations of the load
- **WHEN** the `main_only_cites` of `strength.reps` is read
- **THEN** it holds `acsm2026` at p. 853 and Table 6, `schoenfeld2021` at Section 2, and `androulakis2021`
  at Table 12 and at Conclusions

#### Scenario: Reason of the sets
- **WHEN** the `main_only_reason` of `strength.exercise_sets` is read
- **THEN** it says that the same position stand also advises at least two sets per exercise and names no
  exception, that no bound of the corridor rests on that advice, and that the limit is our reading

#### Scenario: Citations of the sets
- **WHEN** the `main_only_cites` of `strength.exercise_sets` is read
- **THEN** it holds `acsm2026` at Table 6, Table 2, p. 853 and p. 865, and neither `schoenfeld2021` nor
  `androulakis2021`, which do not speak to sets per exercise in a session

## MODIFIED Requirements

### Requirement: Sets of an exercise for strength
The corridors SHALL include `strength.exercise_sets`, with `goal: strength`, in
`exercise_sets_per_workout`: a band below 2 sets with a finding, then bands from 2 to under 4 sets and
from 4 sets, without one. Its finding SHALL rest on the 2 to 3 sets per session, counted per exercise,
that `acsm2026` lists for strength, and SHALL also cite `paga2018` on what one set does and when. No
corridor with another goal or without a goal SHALL measure that unit.

#### Scenario: One heavy set
- **WHEN** a program with `goal: strength` has the block `{exercise: deadlift.barbell, sets: 1, reps: 5}`
  in workout `A`, and no other block of `deadlift.barbell` in `A`
- **THEN** the value of `deadlift.barbell` in `A` falls in the band below 2 sets, which gives a finding
  when the corridor checks that value

#### Scenario: Three sets
- **WHEN** a program with `goal: strength` has `squat.barbell` 3 × 5 in workout `A`
- **THEN** its value falls in the band from 2 to under 4 sets, without a finding

#### Scenario: Five sets
- **WHEN** a program with `goal: strength` has `squat.barbell` 5 × 5 in workout `A`
- **THEN** its value falls in the last band, without a finding

#### Scenario: Another goal
- **WHEN** a program with `goal: hypertrophy`, `goal: power`, `goal: muscular_endurance`,
  `goal: health` or no goal has one set of an exercise in a workout
- **THEN** no corridor in `exercise_sets_per_workout` applies to it
