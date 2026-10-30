# Proposal

## Why

The program report checks a `strength` program for two things only: the repetitions per set
(`strength.reps`) and coverage of the major groups (`major_groups`). `program-stats` left the rest of
the strength corridors to this change, because the options needed the sources read again. Whatever is
adopted has to exist before `training-defaults`, where a default must lie inside its corridor.

## What Changes

- A new unit, `exercise_sets_per_workout`: the sets of one exercise in one workout, summed over the
  workout's blocks that name that exercise, at both ends of a range. Blocks with `time` or `reps: max`
  count like any other block.
- A new corridor, `strength.exercise_sets`, for `goal: strength` only. It has three bands:
  - fewer than two sets, with a finding;
  - two or three sets, without a finding;
  - four sets or more, without a finding.
  Its bounds come from Table 6 of the ACSM position stand: 2–3 sets per session for strength, where
  sets are counted per exercise (Table 2). Its advice of at least two sets of each exercise (p. 865) is
  cited beside them, and so are the US physical activity guidelines (p. 61): one set of 8–12
  repetitions, taken to the point where another repetition would be hard, already builds strength,
  and more sets may build more.
- The report lists a finding on an exercise as one line per exercise of a workout. Each line gives the
  workout, the exercise, its sets, and the path and line of each of its blocks' `sets`. The unit is
  named `sets of an exercise in a workout`.
- On the `strength` stats fixture, `deadlift.barbell 1 × 5` in each workout now gets a finding, and
  the report ends with `findings: 2`. No other fixture's report changes.
- Recorded in the design, not adopted:
  - the strength tiers of Pelland et al. (Table 4) per target;
  - a weekly unit per tested exercise, as Pelland et al. count strength;
  - a corridor for the volume of `power` (repetitions × sets);
  - the other items of the ACSM strength prescription.
  The design gives the reason for each.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `training-guidelines`: changes in the units and corridors.
  - A sixth unit, measured per exercise of a workout.
  - How that unit's value is counted.
  - The corridor rules extended to a unit without targets or groups.
  - The strength corridor in that unit, for `strength` programs only.
- `program-stats`: changes in the report.
  - The header of a strength program names the new corridor.
  - A finding can list exercises of a workout.
  - The format and order of those subjects.
  - The words for the new unit.

## Impact

- `catalog/corridors.yaml`: the new corridor, after `strength.reps`.
- `core/guidelines.mjs`: the unit in `UNITS`, with a fourth kind of subject.
- `core/stats.mjs`: the count per exercise of a workout, the new kind of subject in findings, and its
  text.
- `schema/guidelines.test.mjs`, `schema/stats.test.mjs`: the unit list, the project corridors, and
  tests for the new count and text.
- `schema/stats/strength.repscript.yaml` (its comment) and `strength.stats.txt`.
- `CLAUDE.md`: the line on what the report counts.
- No change to the validator, the program format or the catalog entries. No new dependency.
