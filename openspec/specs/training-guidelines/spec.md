# training-guidelines Specification

## Purpose

Defines the training data that the program report checks programs against: the sources it cites, the
targets that sets are counted for and how a set counts toward them, the major muscle groups, the units,
and the corridors whose bands give findings.

## Requirements

### Requirement: Guideline files
The guidelines SHALL be three files in `catalog/`: the bibliography `catalog/references.yaml`, the
targets `catalog/targets.yaml` and the corridors `catalog/corridors.yaml`. Each SHALL be UTF-8 text
holding one YAML 1.2 document read with the core schema, as a catalog file is. The validator SHALL NOT
read them.

#### Scenario: Broken corridors file
- **WHEN** `catalog/corridors.yaml` is not valid YAML, and `node tools/validate.mjs` checks a valid
  program
- **THEN** the program's report is the same as before and the command exits with code 0

#### Scenario: File not in UTF-8
- **WHEN** `catalog/targets.yaml` is saved as Windows-1251
- **THEN** the guideline checks fail and name the file

### Requirement: Guideline license
The guideline files SHALL be licensed under CC BY-SA 4.0, as the catalog files are, and
`catalog/LICENSE` SHALL name them.

#### Scenario: License notice
- **WHEN** someone copies `catalog/corridors.yaml`
- **THEN** `catalog/LICENSE` tells them that the file is under CC BY-SA 4.0 and where the license text is

### Requirement: Closed fields
A mapping in a guideline file SHALL hold only the fields that these requirements define for it, except
that `names` SHALL accept a name under any other two-letter lowercase language code.

#### Scenario: Misspelled field
- **WHEN** a corridor has a field `extrapolate`
- **THEN** the guideline checks report the field

#### Scenario: Name in another language
- **WHEN** a target has `names: {en: Chest, ru: Грудь, de: Brust}`
- **THEN** the names are accepted

#### Scenario: Field of a band
- **WHEN** a band has a field `source`
- **THEN** the guideline checks report the field

### Requirement: Reference entries
`catalog/references.yaml` SHALL be a list of entries, one per source, in key order. An entry SHALL have
`key`, `citation`, exactly one identifier among `doi`, `isbn` and `url`, and `read`, each a string. A
key SHALL be lowercase Latin letters, digits and `_`, start with a letter, and be unique.

#### Scenario: Article
- **WHEN** an entry has `key: pelland2026`, a `citation`, `doi: 10.1007/s40279-025-02344-w` and
  `read: full`
- **THEN** the entry is accepted

#### Scenario: Two identifiers
- **WHEN** an entry has both `doi` and `url`
- **THEN** the guideline checks report the entry

#### Scenario: Nothing said about the reading
- **WHEN** an entry has no `read`
- **THEN** the guideline checks report the entry

#### Scenario: Key in capitals
- **WHEN** an entry has `key: Pelland2026`
- **THEN** the guideline checks report the key

#### Scenario: Repeated key
- **WHEN** two entries have `key: acsm2026`
- **THEN** the guideline checks report the second one

#### Scenario: Entries out of key order
- **WHEN** the entry `acsm2026` follows the entry `who2020`
- **THEN** the guideline checks report `acsm2026`

### Requirement: Reference keys and citations
A key SHALL name the author, the body or the document's accepted abbreviation, followed by the year of
the cited version; a book's key SHALL give its edition instead of the year. `citation` SHALL name the
version of record, whichever copy was read. Review of each entry checks this.

#### Scenario: Journal version of a preprint
- **WHEN** a meta-analysis was read as a preprint posted in 2024 and as the journal version of 2026
- **THEN** its key ends in `2026`, and its citation names the journal, the volume, the issue and the pages

#### Scenario: Book
- **WHEN** the 10th edition of ACSM's Guidelines for Exercise Testing and Prescription enters the
  bibliography
- **THEN** its key is `acsm_getp10`

### Requirement: What was read
`read` SHALL say what of the source was read in full: `full` for an article, the chapters or sections
for a longer document, and `full, accepted manuscript` when the copy read was not the version of record.
A source SHALL be cited only for what `read` covers. Review of each entry checks this.

#### Scenario: Guideline document read in part
- **WHEN** chapters 2 and 4 of a 118-page guideline were read in full
- **THEN** its entry has `read: chapters 2, 4`, and the data cites it only from those chapters

### Requirement: Citations
A citation from the guideline data SHALL be a mapping with `key`, a key of `catalog/references.yaml`,
and `at`, a string that locates the statement: a table, figure, section or page. A page SHALL be given
only when the copy read has the page numbers of the version of record; otherwise `at` SHALL name a
table, figure or section.

#### Scenario: Table
- **WHEN** a band cites `{key: pelland2026, at: Table 3}`
- **THEN** the citation is accepted

#### Scenario: Unknown key
- **WHEN** a band cites `{key: pelland2025, at: Table 3}` and the bibliography has no `pelland2025`
- **THEN** the guideline checks report the citation and name the key

#### Scenario: No locator
- **WHEN** a band cites `{key: pelland2026}`
- **THEN** the guideline checks report the citation

#### Scenario: Copy without the issue's pages
- **WHEN** the copy read of an article is its online version, without the page numbers of the journal
  issue
- **THEN** the data cites the article by table, figure or section, never by page

### Requirement: Bibliography by citation
Every key of `catalog/references.yaml` SHALL be cited somewhere in the guideline data, so that a source
enters the bibliography with the first statement that cites it.

#### Scenario: Key that nothing cites
- **WHEN** `catalog/references.yaml` has `schoenfeld2017` and no citation names it
- **THEN** the guideline checks report the key

### Requirement: Targets file
`catalog/targets.yaml` SHALL be a mapping with three fields: `counting`, the counting rule; `targets`,
the list of targets; and `major_groups`. `counting` SHALL have `primary` and `secondary`, the two
weights, a `description` in our words and `cites`. `major_groups` SHALL have a `description`, `cites`
and `groups`, the list of groups.

#### Scenario: No counting rule
- **WHEN** `catalog/targets.yaml` has no `counting`
- **THEN** the guideline checks report the file

#### Scenario: Weights without a source
- **WHEN** `counting` has no `cites`
- **THEN** the guideline checks report the counting rule

### Requirement: Targets
`catalog/targets.yaml` SHALL list the targets, the parts of the body that sets are counted for. A target
SHALL have an `id` of lowercase Latin letters, digits and `_`, unique among targets, `names` in `en` and
`ru`, and `nodes`: a list of at least one key of the muscle dictionary that names a muscle or a bundle,
not a group.

#### Scenario: Group as a node
- **WHEN** a target has `nodes: [back]` and `back` is a group of the muscle dictionary
- **THEN** the guideline checks report the node

#### Scenario: Unknown node
- **WHEN** a target has `nodes: [lat]` and the muscle dictionary has no `lat`
- **THEN** the guideline checks report the node

#### Scenario: Missing Russian name
- **WHEN** a target has `names: {en: Chest}`
- **THEN** the guideline checks report the target

### Requirement: Disjoint targets
No muscle SHALL count for two targets: no node of one target SHALL be, hold or lie under a node of
another target in the muscle dictionary.

#### Scenario: Same node twice
- **WHEN** two targets both have the node `delt_front`
- **THEN** the guideline checks report the second target

#### Scenario: Muscle and its bundle
- **WHEN** one target has the node `deltoids` and another the node `delt_side`
- **THEN** the guideline checks report the overlap

### Requirement: The twelve targets
The targets SHALL be, in this order: `chest` (`pecs`), `back` (`lats`, `rhomboids`, `traps`),
`front_delts` (`delt_front`), `side_delts` (`delt_side`), `rear_delts` (`delt_rear`), `biceps`
(`biceps`, `brachialis`), `triceps` (`triceps`), `quads` (`quads`), `hamstrings` (`hamstrings`),
`glutes` (`glute_max`, `glute_med`), `calves` (`gastrocnemius`, `soleus`) and `abs` (`abs`, `obliques`,
`transverse_abs`).

#### Scenario: Muscles in no target
- **WHEN** the targets are read
- **THEN** none of them holds `erector_spinae`, `serratus`, `rotator_cuff`, `forearms`, `adductors` or
  `hip_flexors`

#### Scenario: Three delt targets
- **WHEN** the workouts hold only `bench_press.barbell` and `overhead_press.barbell`
- **THEN** sets count for `front_delts` and `side_delts`, and none for `rear_delts`

### Requirement: Major muscle groups
`catalog/targets.yaml` SHALL list the major muscle groups that guidelines for adults ask to train, with
citations of their source. A group SHALL have an `id` of lowercase Latin letters, digits and `_`, unique
among groups, `names` in `en` and `ru`, and `targets`: a list of at least one target id. Every target
SHALL be in exactly one group.

#### Scenario: Target in no group
- **WHEN** no group lists `calves`
- **THEN** the guideline checks report the target

#### Scenario: Target in two groups
- **WHEN** both `legs` and `hips` list `glutes`
- **THEN** the guideline checks report the target

### Requirement: The seven groups
The groups SHALL be the seven major muscle groups of the US physical activity guidelines, in this order:
`legs` (`quads`, `hamstrings`, `calves`), `hips` (`glutes`), `back` (`back`), `abdomen` (`abs`), `chest`
(`chest`), `shoulders` (`front_delts`, `side_delts`, `rear_delts`) and `arms` (`biceps`, `triceps`).

#### Scenario: Hips as a group
- **WHEN** the groups are read
- **THEN** `hips` is a group of its own, holding `glutes`, although the WHO guidelines list six groups
  without it

### Requirement: Counting rule
A set SHALL count for a target with its exercise's weight for the target: 1 when one of the exercise's
`primary` muscles reaches the target, otherwise 0.5 when one of its `secondary` muscles does, and
otherwise 0. A target SHALL take this one largest weight, never a sum over its nodes.
`catalog/targets.yaml` SHALL state both weights, with citations.

#### Scenario: Press
- **WHEN** a block holds `bench_press.barbell`, with `primary: [pecs]` and
  `secondary: [delt_front, triceps]`
- **THEN** each set counts 1 for `chest`, 0.5 for `front_delts`, 0.5 for `triceps` and 0 for every other
  target

#### Scenario: Two nodes of one target
- **WHEN** a block holds `chinup`, whose `secondary` lists both `biceps` and `brachialis`
- **THEN** each set counts 0.5 for `biceps`, not 1

#### Scenario: Primary and secondary nodes of one target
- **WHEN** a block holds `chinup`, with `lats` in `primary` and `rhomboids` and `traps` in `secondary`
- **THEN** each set counts 1 for `back`

#### Scenario: Exercise without muscles
- **WHEN** a block holds an own exercise that has no `muscles`
- **THEN** its sets count for no target

#### Scenario: Pushing only
- **WHEN** the workouts hold only `pushup`, `dip` and `overhead_press.barbell`
- **THEN** no set counts for `back`

### Requirement: Keys that reach a target
A muscle key SHALL reach a target when it is one of the target's nodes, lies under one of them in the
muscle dictionary, or has one of them under it. A group key in a program's own exercise therefore
reaches every target that has a node in the group.

#### Scenario: Own exercise with a group
- **WHEN** an own exercise has `muscles: {primary: [shoulders]}`
- **THEN** each of its sets counts 1 for `front_delts`, 1 for `side_delts` and 1 for `rear_delts`

#### Scenario: Muscle with bundles
- **WHEN** an own exercise has `muscles: {primary: [lats], secondary: [deltoids]}`
- **THEN** each of its sets counts 0.5 for each of the three delt targets

#### Scenario: Key in no target
- **WHEN** an exercise lists `erector_spinae`
- **THEN** that key reaches no target

### Requirement: Units
A corridor SHALL measure one value in one of six units: `fractional_sets_per_week` and
`fractional_sessions_per_week` per target, `days_involved_per_week` per major group, `reps_per_set`
and `rest_seconds` per block, and `exercise_sets_per_workout` per exercise of a workout. No other unit
SHALL be used.

#### Scenario: Unit outside the list
- **WHEN** a corridor has `unit: sets_per_session`
- **THEN** the guideline checks report the corridor

#### Scenario: Unit per exercise of a workout
- **WHEN** a corridor has `unit: exercise_sets_per_workout`
- **THEN** the unit is accepted

### Requirement: Weekly values
A weekly value SHALL be the mean week of the workout rotation: for a program of `n` workouts and
`per_week: p`, `p / n` times the sum of the workouts' values. With a range in `per_week` or `sets`, it
SHALL be given at a lower end, taking every range at its lower end, and at an upper end, taking every
range at its upper end. Without `per_week` it SHALL be unknown, except that it is 0 when no workout adds
to it.

#### Scenario: Two workouts three times a week
- **WHEN** a program has workouts `A` and `B` and `schedule: {per_week: 3}`, and `chest` gets 3
  fractional sets in `A` and none in `B`
- **THEN** `chest` gets 4.5 fractional sets a week: 6 in the weeks `A`, `B`, `A` and 3 in the weeks `B`,
  `A`, `B`

#### Scenario: Range of workouts a week
- **WHEN** the same program has `schedule: {per_week: 2-3}`
- **THEN** `chest` gets 3 fractional sets a week at the lower end and 4.5 at the upper end

#### Scenario: No workouts a week
- **WHEN** the same program has no `schedule`, and no workout trains `abs`
- **THEN** the weekly value of `chest` is unknown, and that of `abs` is 0

### Requirement: Fractional sets a week
In `fractional_sets_per_week`, a workout's value for a target SHALL be the sum over its blocks of the
block's `sets` times its exercise's weight for the target. A block SHALL count its sets whether it gives
`reps` or `time`.

#### Scenario: Full-body rotation
- **WHEN** workout `A` holds 3 sets of `squat.barbell` and 3 of `bench_press.barbell`, workout `B` holds
  3 sets of `romanian_deadlift.dumbbell` and 3 of `pullup`, and `schedule` is `{per_week: 3}`
- **THEN** a week holds 9 fractional sets for `glutes`, 4.5 for `chest`, `back`, `quads` and
  `hamstrings`, 2.25 for `front_delts`, `rear_delts`, `biceps` and `triceps`, and 0 for `side_delts`,
  `calves` and `abs`

#### Scenario: Timed sets
- **WHEN** a block is `{exercise: plank, sets: 3, time: 30s}`
- **THEN** it counts 3 sets for `abs`

### Requirement: Fractional sessions a week
In `fractional_sessions_per_week`, a workout's value for a target SHALL be the largest weight for the
target among the exercises of its blocks: 1, 0.5 or 0. A workout SHALL need no number of sets to count.

#### Scenario: Full-body rotation
- **WHEN** the program of the full-body rotation above is counted
- **THEN** `chest` is trained 1.5 fractional sessions a week, and `biceps` and `triceps` 0.75 each

### Requirement: Days involved a week
In `days_involved_per_week`, a workout's value for a major group SHALL be 1 when one of its exercises
has a weight above 0 for one of the group's targets, and 0 otherwise. A workout SHALL count as one day.

#### Scenario: Arms trained indirectly
- **WHEN** the program of the full-body rotation above is counted
- **THEN** `arms` is involved 3 days a week, `chest` and `back` 1.5 days each, and `abdomen` 0 days,
  whereas counting `primary` muscles only would give `arms` 0 days

### Requirement: Values per block
`reps_per_set` SHALL be the block's `reps`: the number, both ends of a range, or the number of `N+`. A
block with `reps: max` or with `time` SHALL have no such value. `rest_seconds` SHALL be the block's
`rest` in seconds, at both ends of a range; a block without `rest` SHALL have none. A missing value
SHALL NOT be checked.

#### Scenario: Range of repetitions
- **WHEN** a block has `reps: 8-12`
- **THEN** its repetitions per set are 8 at one end and 12 at the other

#### Scenario: Minimum then as many as possible
- **WHEN** a block has `reps: 5+`
- **THEN** its repetitions per set are 5

#### Scenario: As many as possible
- **WHEN** a block has `reps: max`
- **THEN** it has no repetitions per set, and its sets still count for the weekly values

#### Scenario: Rest
- **WHEN** blocks have `rest: 1:30` and `rest: 2-3m`
- **THEN** their rest is 90 seconds, and 120 and 180 seconds

### Requirement: Sets of an exercise in a workout
In `exercise_sets_per_workout`, each exercise that a workout's blocks name SHALL have one value in that
workout: the sum of the `sets` of the workout's blocks that name it, at both ends of a range. A block
SHALL count its sets whether it gives `reps`, `reps: max` or `time`, and whether or not its exercise
reaches a target.

#### Scenario: One block
- **WHEN** workout `A` has the block `{exercise: deadlift.barbell, sets: 1, reps: 5}` and no other block
  of `deadlift.barbell`
- **THEN** `deadlift.barbell` has 1 set in `A`

#### Scenario: Top set and back-off sets
- **WHEN** workout `A` has the blocks `{exercise: deadlift.barbell, sets: 1, reps: 3}` and
  `{exercise: deadlift.barbell, sets: 2, reps: 5}`
- **THEN** `deadlift.barbell` has 3 sets in `A`

#### Scenario: One exercise in two workouts
- **WHEN** workouts `A` and `B` each have the block `{exercise: squat.barbell, sets: 3, reps: 5}`
- **THEN** `squat.barbell` has 3 sets in `A` and 3 sets in `B`, not 6 in either

#### Scenario: Range of sets
- **WHEN** workout `A` has the blocks `{exercise: row.dumbbell, sets: 1-3, reps: 8}` and
  `{exercise: row.dumbbell, sets: 2, reps: 12}`
- **THEN** `row.dumbbell` has 3 sets in `A` at the lower end and 5 at the upper end

#### Scenario: Timed sets and sets to failure
- **WHEN** workout `A` has the blocks `{exercise: plank, sets: 1, time: 30s}` and
  `{exercise: pullup, sets: 3, reps: max}`
- **THEN** `plank` has 1 set in `A`, and `pullup` 3 sets

#### Scenario: Exercise without muscles
- **WHEN** workout `A` has the block `{exercise: my.towel_row, sets: 1, reps: 10}`, an own exercise with
  names only
- **THEN** `my.towel_row` has 1 set in `A`

### Requirement: Corridors
`catalog/corridors.yaml` SHALL be a list of corridors. A corridor SHALL have an `id` in the exercise id
form, unique; a `unit`; `targets` for a unit per target, or `groups` for a unit per group, a list of at
least one id, and neither for a unit per block or per exercise of a workout; optionally a `goal`; and
`bands`.

#### Scenario: Unknown target
- **WHEN** a corridor has `targets: [delts]` and no target has the id `delts`
- **THEN** the guideline checks report the corridor

#### Scenario: Groups for a unit per target
- **WHEN** a corridor in `fractional_sets_per_week` has `groups: [arms]`
- **THEN** the guideline checks report the corridor

#### Scenario: Targets for a unit per block
- **WHEN** a corridor in `reps_per_set` has `targets: [chest]`
- **THEN** the guideline checks report the corridor

#### Scenario: Targets for a unit per exercise of a workout
- **WHEN** a corridor in `exercise_sets_per_workout` has `targets: [chest]`
- **THEN** the guideline checks report the corridor

### Requirement: Corridor goal
A corridor with a `goal`, one of the program goal values, SHALL apply only to programs with that goal; a
corridor without `goal` SHALL apply to every program. The id of a corridor with a `goal` SHALL start with
the goal and a dot, and the id of a corridor without `goal` SHALL NOT start with any goal value and a
dot. No two corridors that apply to one program SHALL measure one unit for a common target or group, or
one unit per block or per exercise of a workout.

#### Scenario: Goal outside the list
- **WHEN** a corridor has `goal: fat_loss`
- **THEN** the guideline checks report the corridor

#### Scenario: Two corridors for one value
- **WHEN** two corridors with `goal: hypertrophy` both measure `fractional_sets_per_week` for `chest`
- **THEN** the guideline checks report the second one

#### Scenario: Two corridors per exercise of a workout
- **WHEN** two corridors with `goal: strength` both measure `exercise_sets_per_workout`
- **THEN** the guideline checks report the second one

#### Scenario: Goal-independent corridor
- **WHEN** a program has `goal: power`
- **THEN** the corridors without `goal` apply to it, and those with another goal do not

#### Scenario: Id of another goal
- **WHEN** a corridor has `goal: strength` and `id: hypertrophy.reps`
- **THEN** the guideline checks report the corridor

#### Scenario: Goal named only in the id
- **WHEN** a corridor has `id: strength.reps` and no `goal`
- **THEN** the guideline checks report the corridor

### Requirement: Bands
`bands` SHALL be an ordered list of at least two bands. A band SHALL have `from` and, except the last,
`to`, numbers with `from` below `to`; a `label`; a `description` in our words; `finding`, a boolean; and
`cites`, a list of at least one citation. The first band SHALL start at 0, each other where the one
before ends; a value `v` falls in the band where `from` ≤ `v` < `to`.

#### Scenario: Gap between bands
- **WHEN** a band ends at 4 and the next one starts at 5
- **THEN** the guideline checks report the next band

#### Scenario: Last band with an end
- **WHEN** the last band of a corridor has `to`
- **THEN** the guideline checks report the band

#### Scenario: Band without citations
- **WHEN** a band has no `cites`, or `cites: []`
- **THEN** the guideline checks report the band

#### Scenario: Value on a boundary
- **WHEN** a band ends at 4, the next starts at 4, and a value is 4
- **THEN** the value falls in the next band

### Requirement: Findings
A band SHALL have `finding: true` only when its range lies outside what its sources support or recommend
for the goal: below a minimum, beyond the range studied, or outside a recommended range. Diminishing
returns SHALL NOT make a finding. A corridor SHALL have at least one band with a finding and one
without.

#### Scenario: Diminishing returns
- **WHEN** a band covers a range where more weekly sets still add growth, but less for each set
- **THEN** the band has `finding: false`

#### Scenario: Corridor that accepts nothing
- **WHEN** every band of a corridor has `finding: true`
- **THEN** the guideline checks report the corridor

### Requirement: Extrapolation
A corridor that applies a source's numbers to a target or group the source did not measure SHALL list
it in `extrapolated`, and SHALL say why in `extrapolation`, in our words. `extrapolated` SHALL hold only
targets or groups of the corridor, and `extrapolation` SHALL be present exactly when `extrapolated` is.

#### Scenario: Target the source did not measure
- **WHEN** a corridor applies a meta-analysis that measured no calf muscle to `calves`
- **THEN** the corridor lists `calves` in `extrapolated` and says why in `extrapolation`

#### Scenario: Extrapolated target outside the corridor
- **WHEN** a corridor has `targets: [chest]` and `extrapolated: [calves]`
- **THEN** the guideline checks report the corridor

#### Scenario: Extrapolation without a reason
- **WHEN** a corridor has `extrapolated` and no `extrapolation`
- **THEN** the guideline checks report the corridor

### Requirement: Numbers in another unit
A number that a source gives in another unit SHALL enter a corridor only through a conversion that the
band's description states and the band's citations cover. Without such a conversion the source SHALL
give no corridor in that unit.

#### Scenario: Load as a share of 1RM
- **WHEN** a source recommends a load as a share of 1RM for a goal
- **THEN** a corridor in `reps_per_set` uses it only through a conversion between load and repetitions,
  stated in the band and cited there

#### Scenario: Sets counted per tested exercise
- **WHEN** a source counts weekly sets per tested exercise rather than per muscle
- **THEN** it gives no corridor in `fractional_sets_per_week`

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

### Requirement: Guideline checks
Running `node --test` with Node 22 or later and nothing installed SHALL check the guideline files
against these requirements, and SHALL report each problem as a line that names the file, the item and
the problem.

#### Scenario: Problem in a corridor
- **WHEN** a band of `hypertrophy.weekly_sets` does not start where the one before it ends
- **THEN** the test fails with a line naming `catalog/corridors.yaml`, the corridor, the band and the
  problem
