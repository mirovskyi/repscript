# Design

## Context

- A `strength` program is checked by `major_groups` (each group on at least two days a week) and
  `strength.reps` (at most 8 repetitions per set). The design of `program-stats`
  (`openspec/changes/archive/2026-10-26-program-stats/design.md`, Risks) left the rest to this change.
- `training-guidelines` already forbids one of the options. Under "Numbers in another unit", a source
  that counts weekly sets per tested exercise gives no corridor in `fractional_sets_per_week`.
- `core/guidelines.mjs` has `UNITS` with three kinds of subject: `target`, `group` and `block`. In
  `core/stats.mjs`, `programStats` builds the values of each unit, and `blockValues` builds those per
  block. The findings loop treats a `block` subject as one that no corridor lists. `formatStats`
  prints one line per block subject.
- A block's `sets` is a whole number or a range, at least 1 (`count` in `core/formats.mjs`). Nothing in
  the format stops a workout from naming one exercise in two blocks.
- Sources read in full: `acsm2026`, `pelland2026`, and chapters 2 and 4 of `paga2018`. Their keys are
  already in `catalog/references.yaml`.
- Requirements: `specs/training-guidelines/spec.md` and `specs/program-stats/spec.md`. Motivation:
  `proposal.md`.

## Goals / Non-Goals

**Goals:**
- A strength check in a unit that a source states itself, so no conversion is needed.
- A recorded reason for each option, adopted or rejected, so that a later change can reverse one
  knowingly.

**Non-Goals:**
- Telling warm-up sets from work sets. The format cannot state them yet.
- Any change to the catalog entries, the validator or the program format.
- Corridors for `power` or `muscular_endurance` (decisions 6 and 7).

## Decisions

### 1. What the sources say about strength volume

| Source | Statement | Unit |
|---|---|---|
| `pelland2026` §2.5, Tables 2 and 4 | Strength gains: a minimum effective dose of 1 fractional set a week; tiers at 2 and 3–4; from 5 on, more sets do not reliably add a detectable gain | Weekly sets **per tested exercise**: a direct set is the exercise of the strength test, and an indirect set is one of the exercises that Table 2 lists for that test, weighted 0.5 |
| `acsm2026` p. 865 | More sets per exercise raised strength. Two sets beat one, citing reviews of strength and of hypertrophy. Healthy adults are advised at least two sets per exercise; more may add benefit, and ACSM hypothesizes that each further set adds less. Its reading of a plateau beyond about 2–3 sets per exercise comes from `pelland2026` (its reference 187), whose unit is weekly sets per tested exercise | Sets per exercise |
| `acsm2026` Table 6, Strength | "Volume: 2–3 sets/session", in the column of what enhances strength compared with standard training | Sets per session |
| `acsm2026` Table 2 | Volume (sets) is the number of sets completed per exercise | Sets per exercise |
| `paga2018` p. 61 | Each exercise is done to the point where another repetition would be hard. For strength, one set of 8 to 12 repetitions of each exercise works, and 2 or 3 sets may work better | Sets per exercise |

These give three options: (a) Table 4 per target, (b) Table 4 in its own unit, per exercise, and
(c) sets per exercise in a session. Decisions 2–4 take them in turn.

### 2. (a) Table 4 per target: rejected

- **The unit is not Pelland's.** Strength in Pelland et al. is a strength test of one exercise (1RM,
  nRM, isometric or isokinetic; Table 2), and its sets are counted against that exercise, not against a
  muscle. `training-guidelines` forbids exactly this
  use (Numbers in another unit, scenario "Sets counted per tested exercise").
- **The findings would be wrong.** On the `strength` fixture (A and B, three times a week), (a) gives
  findings for `biceps`, `calves`, `abs` and `rear_delts` at 0 sets, "below the minimum for
  strength". But nobody measured the strength of the biceps in a squat, bench and deadlift program.
  It would also give one for `back`, which the coverage finding already names. No other band would
  ever give a finding: from 5 sets on, Table 4 only describes diminishing returns.

### 3. (b) Table 4 per exercise: rejected

- **Its indirect sets need a relation that the catalog does not hold.** For each exercise, (b) needs
  the other exercises that count as indirect for it. Pelland et al. list them in Table 2, but only for
  the lifts that the included studies tested, under the studies' names. For the rest of the catalog,
  and for every new entry, we would have to judge them ourselves. The catalog holds muscles, not
  relations between exercises, and deriving them from shared muscles would make nearly every exercise
  indirect for every other.
- **It would almost never give a finding.** Its only finding band is below 1 fractional set a week.
  An exercise in the program reaches that only when its workout comes round rarely, such as 1 set in
  one of three workouts done once a week. On the fixture, with the indirect exercises of Table 2:
  - squat: 9 direct sets; Table 2 lists no deadlift for the back squat, so 9;
  - bench press: 4.5 + 0.5 × 4.5 from the overhead press = 6.75;
  - overhead press: 4.5 + 0.5 × 4.5 from the bench press = 6.75;
  - deadlift: 3 direct sets; Table 2 lists only the Romanian deadlift for it, so 3, in the tier of 3–4.
  None is below 1. That makes 0 findings, at the cost of a new unit and a relation table.

### 4. (c) Sets of an exercise in a workout: adopted

- **The unit is ACSM's own.** Table 2 of the position stand defines volume (sets) as the number of
  sets completed per exercise, and Table 6 lists, under strength, a volume of 2–3 sets per session.
  Read together, these are the sets of one exercise in one session, and a workout is a session. The
  text of p. 865 and PAGA speak of sets per exercise too. The corridor cites ACSM's recommendation in
  the unit that ACSM states, so "Numbers in another unit" does not apply.
- **ACSM does not count sets per exercise everywhere.** For hypertrophy, Table 6 gives a weekly
  volume, and the text counts sets per muscle group a week (p. 856). The definition of Table 2 is read
  here into the strength line of Table 6 only, whose volume is per session.
- **What ACSM drew the number from is mixed.** For two sets over one it cites reviews of strength and
  of hypertrophy. Its advice of at least two sets per exercise follows, with "thus", from its own
  reading of `pelland2026` (reference 187): a plateau beyond about 2–3 sets per exercise, in a
  meta-regression whose unit is weekly sets per tested exercise. So the bounds rest on Table 6, read
  with Table 2, alone. p. 865 is cited for what it states: two sets beat one, the advice of at least
  two, and the hypothesis that further sets add less. The description keeps the advice, since it is
  what ACSM tells healthy adults, but no bound depends on it, and the plateau is not used.
- **Summed over the workout's blocks that name the exercise.** A top set and back-off sets (deadlift
  1 × 3, then 2 × 5) are 3 sets of the exercise, and ACSM counts sets per exercise, not per line of a
  program. The alternative of a value per block would give a finding for the top set alone.
- **Same exercise means same id.** `squat.barbell` and `squat.goblet` count apart. The source says per
  exercise, and the catalog decides what one exercise is. An own exercise without muscles counts too:
  the value needs no muscles.
- **Every block counts its sets, with `time` or `reps: max` too.** Table 2 defines sets for any
  exercise, and p. 865 advises sets per exercise with no exception. Every block states its sets,
  unlike the repetitions that `strength.reps` needs, which a timed block or `reps: max` does not give.
  Strength in `pelland2026` includes isometric tests (Table 2), so a held position is not outside
  strength either. A single timed set, such as a 60 s plank, gets the finding like any single set
  (Risks).
- **Consequence of `sets` ≥ 1:** two blocks of one exercise always sum to 2 or more. So in the one
  finding band, below 2, a subject always has exactly one block. The text shows every block's path
  anyway, because the unit's value is per exercise. That case is tested with a corridor written for the
  test (`schema/stats.test.mjs` already builds such corridors).

### 5. The corridor data

It goes after `strength.reps` in `catalog/corridors.yaml`, so the header reads `major_groups,
strength.reps, strength.exercise_sets`.

```yaml
- id: strength.exercise_sets
  goal: strength
  unit: exercise_sets_per_workout
  bands:
    - from: 0
      to: 2
      label: fewer than two sets
      finding: true
      description: >-
        Fewer than two sets of the exercise in this workout. The ACSM position stand lists 2 to 3 sets
        in a session among what enhances strength, finds two sets better than one, and advises healthy
        adults to do at least two sets of each exercise. A single set is not wasted: the US guidelines
        find that one set of 8 to 12 repetitions of each exercise already builds strength, and that 2
        or 3 sets may build more, with each exercise taken to the point where another repetition would
        be hard, which a program cannot state yet. They do not speak of a single heavier set.
      cites:
        - {key: acsm2026, at: Table 6}
        - {key: acsm2026, at: Table 2}
        - {key: acsm2026, at: p. 865}
        - {key: paga2018, at: p. 61}
    - from: 2
      to: 4
      label: two or three sets
      finding: false
      description: >-
        Two or three sets of the exercise in this workout: the number in a session that the ACSM
        position stand lists among what enhances strength.
      cites:
        - {key: acsm2026, at: Table 6}
        - {key: acsm2026, at: Table 2}
    - from: 4
      label: four sets or more
      finding: false
      description: >-
        More sets of the exercise in this workout than the 2 to 3 in a session that the ACSM position
        stand lists for strength. More sets may still add benefit, but the position stand hypothesizes
        that each set past the second adds less.
      cites:
        - {key: acsm2026, at: Table 6}
        - {key: acsm2026, at: Table 2}
        - {key: acsm2026, at: p. 865}
```

- The bounds come from Table 6, read with the definition of Table 2 (decision 4). "Enhances", as in
  `strength.reps`: that column of Table 6 compares with standard training, not with no training.
- The finding of the first band rests on that recommended range, and one set lies outside it. PAGA is
  cited beside it as the counterpoint, as `hypertrophy.rest` cites the shortened-rest studies and
  `acsm2026` in its band with a finding. PAGA's one set of 8 to 12 repetitions meets a strength
  program at one number only: `strength.reps` gives a finding to a set of more than 8, so a single
  set of exactly 8, taken to the point where another repetition would be hard, is one that PAGA
  calls effective and that still gets this finding. The finding rests on ACSM's range, not on a claim
  that such a set does nothing, and its description says so: a single set is not wasted, and PAGA
  does not speak of a single set heavier than 8 repetitions. That is within the requirement on
  findings, so it needs no change.
- PAGA's one set holds for exercises done to the point where another repetition would be hard. The
  description states that condition, so the agent cannot defend an easy single set with it. A program
  cannot state effort yet, as `major_groups` already says, so the report cannot check it.
- The bounds are whole numbers, and the only band with a finding is the first. The project-data tests
  for exact band placement and for finding bands at the ends of a corridor hold without change.
- The band of four or more is information: diminishing returns are never a finding.
- No new reference key. `paga2018` p. 61 lies in the chapters read, and `major_groups` already cites
  that page.

### 6. Only for `strength`

| Goal | Corridor in this unit | Reason |
|---|---|---|
| `strength` | yes | Table 6 lists 2–3 sets per session under strength |
| `hypertrophy` | no | Table 6 gives hypertrophy a weekly volume (≥ 10 sets a week), and `hypertrophy.weekly_sets` already measures it per muscle. With volume equated, frequency does not change growth (`acsm2026` p. 856), so one set of an exercise on each of five days is a sound program, and a per-exercise finding would contradict the weekly corridor |
| `health`, no goal | no | PAGA calls one set of each exercise effective |
| `muscular_endurance` | no | Table 6: insufficient data |
| `power` | no, for now | Table 6 gives power a volume in repetitions × sets, not sets per session (decision 7) |

The p. 865 sentence is general, but its table places the number under strength only. The corridor
follows the table.

### 7. The volume of `power`: rejected for now

Table 6 lists "Volume: Low-moderate (repetitions ⋅ sets ≤24)" for power, and the text says "< 24".
- It rests on one review: `acsm2026` reference 148, Straight et al. 2016 (*Sports Med* 46(3):353–364).
  By its abstract, the review pooled 12 RCTs of adults aged 50 or more, and measured leg press and knee
  extension power only.
- The abstract says only that volume moderated the effect. It gives neither the threshold nor the unit
  (per exercise or per session). The full text is paywalled and was not read.
- So a corridor would apply a number of uncertain unit, from older adults on two machines, to every
  power program. A source enters the bibliography only with what cites it, so Straight et al. stay out
  of `references.yaml`.

### 8. The other items of Table 6 for strength

| Item | Decision |
|---|---|
| Frequency ≥ 2 sessions a week | Already checked per major group by `major_groups`. Pelland et al. give no tiers for strength frequency, so no corridor per target |
| Intensity ≥ 80% 1RM | Already `strength.reps` |
| Exercise order: main lift at the start of the session | Not checkable: a program does not say which exercise is the main lift |
| Eccentric flywheel, full range of motion | The format cannot state them |

### 9. Code

- **`core/guidelines.mjs`.** `UNITS` gains `exercise_sets_per_workout` with a fourth kind,
  `exercise`. Like `block`, it takes neither `targets` nor `groups`.
  - `readCorridors` must read a subject list only for `target` and `group`. Today it asks for a field
    for every kind but `block` (`if (kind !== 'block')`), which would ask for `exercises` and throw.
  - The JSDoc of `UNITS` and of `Corridor.subjects` names the new kind.
- **`core/stats.mjs`.** A new subject kind:
  `{ kind: 'exercise', workout, exercise, blocks: { path, line }[] }`, where `path` is the block's
  `sets` path as a validator issue writes it.
  - The values come from one more pass beside `blockValues`. In each workout, in list order, the
    exercises are taken in order of first block, each with its summed range and its blocks.
  - The findings loop treats both kinds without corridor subjects, `block` and `exercise`, alike. That
    covers the subject filter, and the extrapolation check, which reads `subject.id`. Only target and
    group subjects have an `id`, so strict `tsc` rejects the read on the new variant.
  - `formatStats` prints one line per subject for `block` and `exercise`. Today every kind but `block`
    goes on one `<kind>s: ...` line, which would print `exercises: A ..., B ...`.
  - `formatSubject` writes `<workout> <exercise> <value><marks>: <path> (line N), ...`, with the
    workout through `formatWorkout`, the paths in program order, and ` (line N)` left out when the line
    is unknown, as for a block. Until it handles the new kind, its read of `subject.id` fails `tsc` too,
    so the count and the text are one task (task 2.1).
  - `UNIT_WORDS` gets the unit's words.
- **The report data stays atomic**: one finding per corridor, band and subject, as now.
- **`schema/guidelines.test.mjs`.** The test's `UNITS` must tell the two kinds without subjects apart,
  so that a misplaced `targets` is reported as "for a unit per block" or "for a unit per exercise of a
  workout". Its overlap check (`if (kind === null)`) reports two corridors of a kind without subjects
  as soon as they apply to one program, and must do so for both kinds. "one of the five units" becomes
  "six", in the check and in the expected messages of its tests.
- **`schema/stats.test.mjs`.** Its reads of `subject.id` behind `subject.kind !== 'block'` narrow to
  target and group subjects, for the same `tsc` reason.

### 10. Expected `strength` report, by hand

The header gains the corridor, and a second finding follows the coverage finding:

```
corridors: major_groups, strength.reps, strength.exercise_sets
...
finding: strength.exercise_sets: fewer than two sets, 0 to under 2 sets of an exercise in a workout
  A deadlift.barbell 1: workouts[0].blocks[2].sets (line 14)
  B deadlift.barbell 1: workouts[1].blocks[2].sets (line 19)
  Fewer than two sets of the exercise in this workout. ...
  Sources: acsm2026 Table 6; acsm2026 Table 2; acsm2026 p. 865; paga2018 p. 61
numbers (information, no action needed)
...
findings: 2
```

- The squat, bench press and overhead press, 3 sets each, fall in the band of two or three sets.
- The numbers part does not change: values per exercise, like values per block, appear only in
  findings.
- The fixture's comment stays on two lines, so the deadlift blocks stay on lines 14 and 19.
- No other fixture has `goal: strength`, so no other report changes.

## Risks / Trade-offs

- [Single heavy sets are common in strength programs, so the finding will often fire] → It is advice,
  not an error. The band cites PAGA beside ACSM, so the agent can honestly explain a deliberate single
  set, or add one.
- [Warm-up sets written as their own block of the same exercise hide a single work set] → The report
  counts what the program states. When `set-details` brings `warmup`, warm-up sets must not count in
  this unit. That change has to say so.
- [Accessory or core exercises with one set in a strength program get findings too, timed ones such as
  a 60 s plank included] → ACSM advises per exercise, with no exception, and the ACSM reviews measured
  mostly dynamic strength. An exception would be a judgment without a source. If it proves noisy in
  practice, the change that narrows it records its reason.
- [A block that is not strength work gets the finding too: a warm-up written as an exercise of its own,
  such as `my.bike` 1 × 10m, which the report also lists under `not counted`, or a conditioning
  finisher such as `burpee` 1 × 60s] → Every block counts (decision 4): the format cannot tell a
  warm-up or a finisher from strength work, and skipping the exercises that reach no target would
  also skip an own strength exercise written without muscles. The agent explains such a block. If it
  proves noisy in practice, the change that narrows the corridor records its reason, as for accessory
  exercises above.
- [ACSM's advice of at least two sets per exercise follows from its reading of a weekly analysis,
  `pelland2026`] → No bound depends on that advice: the bounds come from Table 6, which states sets
  per session, read with Table 2, which counts sets per exercise. The description repeats the advice as
  ACSM's, beside the facts it rests on (decision 4).
- [Counted by the week, a lift done for one set in each of several workouts may be well dosed] → The
  corridor checks the session, as Table 6 does, and gives the finding in each such workout. The agent
  explains a deliberate single set or adds one.
- [A two-block subject cannot occur in a finding of the project data today] → Its text is specified
  and tested with a test corridor, so a later band with a finding at the top end needs no change to
  the report.

## Migration Plan

None. The data, the code and the expected report change in one commit. The diff of
`schema/stats/strength.stats.txt` is the review of the new corridor's effect.

## Open Questions

- Whether `power` gets a volume corridor once Straight et al. 2016 is read in full. That would be a
  change of its own, and nothing here depends on it.
