# Design

## Context

- `strength.reps` is a corridor per block and `strength.exercise_sets` one per exercise of a workout.
  Neither can tell a main lift from assistance work, because the format cannot. The design of
  `strength-corridors` (`openspec/changes/archive/2026-10-30-strength-corridors/design.md`, Risks) saw the
  noise coming: "An exception would be a judgment without a source. If it proves noisy in practice, the
  change that narrows it records its reason." This design is that record.
- In `core/stats.mjs`, `blockValues` and `exerciseValues` build the values, and one loop in `programStats`
  turns them into findings. `formatStats` works from the report alone.
- In `core/guidelines.mjs`, `readCorridors` throws only for a shape the count cannot use. The full checks
  are `guidelineProblems()` in `schema/guidelines.test.mjs`.
- A block's fields are defined in `schema/repscript.schema.json`. `bw` in `load` is the precedent for a
  field whose only value is `true`.
- Requirements: `specs/program-format/spec.md`, `specs/training-guidelines/spec.md` and
  `specs/program-stats/spec.md`. Motivation: `proposal.md`.

## Goals / Non-Goals

**Goals:**
- A program can state which of its blocks are main lifts, and the two strength corridors honor that.
- The limit reads as our reading, not as something the source says.
- A program without marks gets the findings and numbers it gets now.

**Non-Goals:**
- A role for every block. Only `main` has a consequence today.
- Changing a band or a bound of any corridor.
- Checking exercise order (decision 7).
- Defaults for main lifts or assistance work, which belong to `training-defaults`.

## Decisions

### 1. What the evidence does and does not support

| Claim | Status |
|---|---|
| ACSM counts strength, "unless otherwise specified", as a 1RM "in the same mode as that in which the training was performed" (`acsm2026`, p. 853) | Read |
| ACSM's strength items (Table 6): ≥ 80% 1RM, 2–3 sets per session, at the beginning of the session. Table 2 defines volume as the sets done per exercise | Read |
| ACSM advises "at least two sets per exercise", and names no exception (`acsm2026`, p. 865) | Read, and it points against the limit on sets |
| Heavy loads are "clearly requisite for maximizing 1RM", yet the advantage of heavy load training "dissipates" when strength is tested in a modality other than the one trained, and low loads also raise 1RM, though less (`schoenfeld2021`, Section 2) | Read in full (task 3.1) |
| Powerlifters who had tried a minimum-dose approach reported means of 8.8 to 9.3 repetitions per set on accessory exercises, against 3.5 to 4.1 on the powerlifts (`androulakis2021`, Table 12), and the article's conclusions give 6 to 10 on accessory exercises | Read in full (task 3.1). The 6 to 10 is the authors' summary, not a range the respondents reported, and the article has no other data on accessory work. A survey of competitive powerlifters, describing practice in a minimum-dose context: 21 of 58 had tried the approach (the abstract counts 57), and Table 12 prints no n |
| A program used in a trial: main lifts at 4 × 5 and assistance exercises at 3 × 8–15 in its strength phase (Gavanda et al. 2025, Table 3) | Seen only through an agent's reading, and a later fetch of the full text failed, so it is unverified and nothing here rests on it. Not cited in the data: the trial compared forms of coaching, not this split |
| A source that says assistance work may go unchecked, or lighter, in a strength program for healthy adults | Not found, in the sources read or in an open-access search. The ACSM's Guidelines (10th edition) names compound, single-joint and core exercises as kinds a regimen should focus on, not as main and assistance |
| The limit itself | Our reading of the rows above |

How far this goes:
- **"Modality" is not another exercise.** `schoenfeld2021` means a different kind of test, such as an isometric
  device after dynamic training, and it calls how such tests translate to performance speculative. Its support is
  indirect: that the advantage of a heavy load belongs to the exercise trained is our inference, so the reason
  writes "another kind of device" and states the inference as part of our reading.
- **`androulakis2021` describes competitive powerlifters on a minimum dose.** It shows the split in that context
  only, not in their usual training, and not that it suits healthy adults in general, and it recommends nothing for
  accessory exercises beyond reporting what athletes do. Its range of 6 to 10 repetitions crosses the band of
  `strength.reps` that starts at 9, and its means of about 9 sit at that bound, so it shows a difference between the
  two kinds of work, not that accessory work falls outside the corridor.
- **Both speak to load only.** So `strength.exercise_sets` rests on the reading alone, and its reason names the
  advice against it. They enter its citations nowhere.

**NSCA's Essentials is not needed for this change.** No copy of the book was found. Exam-prep material on its
chapter on resistance training, which is secondary and was seen partly through search summaries (pages of PTPioneer
and Simple Solutions Fitness, Brainscape flashcard decks), defines core exercises by two or more primary joints and
large muscle areas, and assistance exercises by one primary joint and smaller muscle areas. An open article, Wong et
al. 2013 (*J Sports Sci Med* 12:38-43), gives the same definition of assistance exercises, citing NSCA's Essentials
of Personal Training. By that definition dips, chin-ups, rows and lunges are core, so the book could not cover
the assistance work this change leaves out. A limit on the load of assistance exercises appears only in such
material, and not in all of it: one flashcard deck gives 8RM as the heaviest load, and the two CSCS study guides
fetched in full give no limit. The book may still matter to `training-defaults`, for defaults on assistance work.

The noise is shown on one program written for this check and not kept in the repository, with a bike warm-up added
on purpose: a four-day program of a main lift at 3 × 5+, and dips, chin-ups, rows, leg raises and lunges at about
5 × 10. Its two strength findings listed ten subjects, and the judgment that all ten are noise is ours, not a
coach's. Task 6.2 shows the same kind of noise on the new fixture with its marks removed, and task 6.3 runs the
report on programs not written for this change.

The hypertrophy corridors gave no such noise in the same check, so they stay as they are (decision 5).

### 2. A field on the block

`main: true` on a block, in the form of `bw: true`: `true` is the only value, and the field is left out
otherwise.

| Alternative | Why not |
|---|---|
| A list per program, `main_lifts: [squat.barbell]` | Cannot say that a lift is main on one day and assistance on another |
| A list per workout | Repeats the ids, and needs a rule that each matches a block |
| `role: main \| assistance \| warmup` | `assistance` is what no mark means, and `warmup` has no consequence yet: warm-up sets come with `set-details`. Each value would need a meaning in the report |
| A property of the catalog entry, such as multi-joint | The role depends on the program: chin-ups are main in one and assistance in another. Wong et al. 2013 define assistance exercises by one primary joint, yet call the lunge and the step-up assistance beside the squat. A definition by joints would keep multi-joint assistance work in the corridors. ACSM also has no data on single-joint against multi-joint exercises for strength |
| A check per workout: at least one heavy exercise | The bound "at least one" has no source, which the citation rule forbids. It needs no format change, but the unit is ours |
| No exercise that reaches no target in `strength.exercise_sets` | Clears the bike only, not assistance work. `strength-corridors` already rejected it: an own strength exercise without muscles would be skipped too |
| Change nothing, and explain it in the agent's instructions | Every sound strength program gets findings to explain, and an agent used to explaining them away does the same with a real one |

The name is `main`, as in main lift. `primary` would be confused with `muscles.primary`. The field is
goal-neutral, so that an agent can write it in any program and the player can show it later. Its meaning is
"an exercise whose own result the program is built to raise". The looser "the exercise a workout is built
around" would not carry the reading in decision 1, which needs a program that aims at that exercise's own
result.

The mark is on a block, and it scopes `strength.reps` per block (decision 3), so the description asks for it on
the block that trains the lift for that result, such as its heavy sets, and not on lighter volume sets of the
same lift. A program that follows its heavy sets of a main lift with lighter sets of the same lift at 10
repetitions gets those findings back if both blocks are marked: nothing is hidden, but the limit no longer helps.
Both blocks still appear on the `main blocks:` line, so a reader can see the mark.

The validator gets no rule for it. It checks form, and whether a main lift is a good choice is a judgment
about the training, so a wrong value is only a schema error and a mark in any program is valid.

### 3. Which values a limited corridor checks

- **Scope is the whole program.** Once a program marks one block, no mark on another block says that block is
  not main. The alternative of a scope per workout would check every block of a workout without marks, which
  brings the noise back on an assistance day.
- **No marks: every value is checked.** A plan for strength written as 3 × 10 throughout, the weak spot that
  this corridor exists for, keeps its findings, and leaving marks out hides nothing.
- **Marks on every block** give the same findings as none.
- **An exercise of a workout is checked when one of its blocks there is marked, and its value sums all its
  blocks there.** So `deadlift 1 × 3, main` and `deadlift 2 × 5` are 3 sets, as decided in `strength-corridors`,
  decision 4. A mark on the top set alone does not turn it into a single set.
- **A block is checked for repetitions only when it is itself marked.** The back-off sets above are not checked
  for load. Unlike the sets, the repetitions are a value per block.
- **A marked block with `time` or `reps: max` gives `strength.reps` no value, as any such block does today.** A
  program whose only marks are timed sets has no check of load. The field marks what the program aims to raise,
  and the report lists the marks, so a reader sees it.

### 4. A corridor's limit is data, with its reason and sources

```yaml
- id: strength.reps
  goal: strength
  unit: reps_per_set
  main_only: true
  main_only_reason: >-
    ...
  main_only_cites:
    - {key: acsm2026, at: p. 853}
    - {key: acsm2026, at: Table 6}
    - {key: schoenfeld2021, at: Section 2}
    - {key: androulakis2021, at: Table 12}
    - {key: androulakis2021, at: Conclusions}
```

- `main_only` and `main_only_reason` follow `extrapolated` and `extrapolation`: a statement, and the reason in
  our words.
- **Citations in a field, not in the text.** `extrapolation` can name its source in the text, because the bands
  cite that source too. `schoenfeld2021` and `androulakis2021` are cited nowhere else, and "Bibliography by
  citation" fails a key that no citation names. A key named in prose is also not checked against the bibliography.
  So the limit has its own list, checked like a band's `cites`, and the reason names no key.
- **Not in the bands.** A band's `cites` say what its range rests on, and the bands do not change.
- A single field holding the reason would make presence mean the limit, which reads badly next to `finding: true`.
- `readCorridors` throws when `main_only` is not `true`, when it comes without a string reason, without a list of
  citations each with a string `key` and `at`, or when the unit is per target or per group: the report prints the
  reason and the citations, and a target has no block to limit to. The other shapes are for `guidelineProblems()`.

The reasons and citations, in the data:

```yaml
# strength.reps
main_only_reason: >-
  The ACSM position stand counts strength, unless a review says otherwise, as a one-repetition maximum in
  the same mode as the training, and lists a load of at least 80% of that maximum among what enhances it.
  Another review, from 2021, finds that heavy loads lose most of their advantage when strength is measured on
  another kind of device, such as an isometric one, a result whose practical meaning it leaves open, and that
  lighter loads also raise a one-repetition maximum, though less. Powerlifters in one survey who had tried a
  minimum-dose approach reported about 9 repetitions per set on accessory exercises and about 3.5 to 4 on the
  powerlifts, and the authors sum up the accessory sets as about 6 to 10 repetitions. No source here says that
  assistance work may go unchecked. Limiting this corridor to main blocks is our reading: that such a load
  describes strength in the exercise trained, and says nothing about an exercise whose own strength the
  program does not aim to raise.
main_only_cites:
  - {key: acsm2026, at: p. 853}
  - {key: acsm2026, at: Table 6}
  - {key: schoenfeld2021, at: Section 2}
  - {key: androulakis2021, at: Table 12}
  - {key: androulakis2021, at: Conclusions}

# strength.exercise_sets
main_only_reason: >-
  The ACSM position stand lists 2 to 3 sets in a session among what enhances strength, with sets counted per
  exercise, and it counts strength, unless a review says otherwise, as a one-repetition maximum in the same mode
  as the training. It also advises at least two sets per exercise and names no exception, and no bound of this
  corridor rests on that advice, since its table of what enhances strength alone sets them. No source here says
  that assistance work may go unchecked. Limiting this corridor to main blocks is our reading: those sets say
  nothing about an exercise whose own strength the program does not aim to raise.
main_only_cites:
  - {key: acsm2026, at: Table 6}
  - {key: acsm2026, at: Table 2}
  - {key: acsm2026, at: p. 853}
  - {key: acsm2026, at: p. 865}
```

The new entries of `catalog/references.yaml`, each with `read: full` once task 3.1 is done:

| Key | Citation | Identifier |
|---|---|---|
| `androulakis2021` | Androulakis-Korakakis P, Michalopoulos N, Fisher JP, et al. The Minimum Effective Training Dose Required for 1RM Strength in Powerlifters. Front Sports Act Living. 2021;3:713655. | `doi: 10.3389/fspor.2021.713655` |
| `schoenfeld2021` | Schoenfeld BJ, Grgic J, Van Every DW, Plotkin DL. Loading Recommendations for Muscle Strength, Hypertrophy, and Local Endurance: A Re-Examination of the Repetition Continuum. Sports (Basel). 2021;9(2):32. | `doi: 10.3390/sports9020032` |

Both are open access under CC BY. The copies at hand have no page numbers of the version of record for
`schoenfeld2021`, so it is cited by section. `androulakis2021` is cited at Table 12 for the means on both kinds of
work, and at Conclusions for the range of 6 to 10, which the table does not print. That range is the authors'
summary, not what the respondents reported: Table 12 gives means of 8.8 to 9.3 (SD 2.0 to 2.9), and the article
has no other data on accessory work, so the reason gives both. `acsm2026` Table 6 is cited for the load that the
reason says the position stand lists, which p. 853 does not hold.

### 5. Only the two strength corridors

| Corridor | Limited | Reason |
|---|---|---|
| `strength.reps` | yes | Decision 1 |
| `strength.exercise_sets` | yes | Decision 1, and its reason says what speaks against it |
| `power.reps` | no | Its finding starts at 29 repetitions, so assistance work rarely reaches it, and no noise was seen. The same reading could apply, and a limit would add a line to every power report for little |
| `hypertrophy.reps`, `hypertrophy.rest` | no | Every set counts toward the weekly volume of `hypertrophy.weekly_sets`, so its load and rest matter whichever exercise it belongs to |
| Corridors per target or group | no | They count every block by definition (`program-stats`, Counting with main blocks) |

### 6. The report

Right after the header, for a program that a limited corridor applies to:

```
main blocks: none marked with main: true, every block checked by strength.reps, strength.exercise_sets
```

or, with marks:

```
main blocks: A squat.barbell, A bench_press.barbell, B deadlift.barbell, B overhead_press.barbell
  only these are checked by strength.reps: The ACSM position stand counts strength, ...
  Sources: acsm2026 p. 853; acsm2026 Table 6; schoenfeld2021 Section 2; androulakis2021 Table 12; androulakis2021 Conclusions
  only these are checked by strength.exercise_sets: The ACSM position stand lists 2 to 3 sets ...
  Sources: acsm2026 Table 6; acsm2026 Table 2; acsm2026 p. 853; acsm2026 p. 865
```

- **Above the findings, not inside them.** The reason explains what was *not* checked, which no finding shows. A
  finding on a marked block needs no such reason, since it would hold without the limit. A program with marks may
  have no finding at all, and the reader still has to learn that assistance work went unchecked. This is the
  reasoning of the `corridors:` line: silence must not read as approval.
- **With its sources, in the form of a finding's `Sources:` line,** so a reader can check the reading, and no key
  has to appear in the reason.
- **Not on the `corridors:` line**, which only names what applies.
- **The line without marks names the field.** A strength report that lists assistance work is where an agent
  learns that it can write `main: true`. Without that line the report would match today's byte for byte, but the
  report would not tell the agent that marks exist.
- **Only where a limited corridor applies.** A mark in a hypertrophy program changes nothing, so its report
  changes in nothing. Of the current stats fixtures, only `strength` gains a line.
- **Blocks, not exercises.** Two marked blocks of one exercise appear twice, since the line lists what the program
  marks.
- **"Only these" is short for decision 3.** A marked timed block is listed though it gives `strength.reps` no value,
  and an unmarked block of a marked exercise still adds to that exercise's sets. A longer line would repeat the rule
  in every report, so the rule stays in the spec, whose scenarios hold both cases.

The report data gains one field, so `formatStats` still works from the report alone:

```js
/**
 * @property {{ corridors: { id: string, reason: string, cites: { key: string, at: string }[] }[],
 *   blocks: { workout: string, exercise: string }[] } | undefined} main the corridors limited to main
 *   blocks that apply, and the marked blocks in program order; undefined when no such corridor applies
 */
```

`blockValues` and `exerciseValues` add `main` to each value, and the findings loop keeps a value of a limited
corridor when the program has no mark or the value's `main` is true. Nothing else in the count reads the field.

### 7. Exercise order: not in this change

The strength line of ACSM's Table 6 includes "Exercise order: Beginning of training session", which its Table 4
rates on 4 reviews with a QoE of 88%. `strength-corridors` called that not checkable, for want of a main lift. `main` makes it possible,
as "no unmarked block before a marked one", but a warm-up block would then give a finding in every workout that
has one. Skipping blocks that reach no target would be a judgment without a source, and a warm-up of burpees
would still count. It waits until the format can say that a block is a warm-up.

### 8. Expected reports, by hand

The new stats fixture, `schema/stats/main-lifts.repscript.yaml`:

```yaml
# A strength program with its main lifts marked: assistance work, a warm-up and a timed set are not
# checked for load or sets per exercise, and the single set of deadlifts gets a finding.
repscript: 0
id: main-lifts
revision: 1
title: Main lifts and assistance
goal: strength
schedule: {per_week: 2}
exercises:
  - id: my.bike
    names: {en: Stationary bike}
workouts:
  - id: A
    blocks:
      - {exercise: my.bike, sets: 1, time: 5m}
      - {exercise: squat.barbell, sets: 3, reps: 5, main: true}
      - {exercise: bench_press.barbell, sets: 3, reps: 5, main: true}
      - {exercise: row.dumbbell, sets: 3, reps: 8-12}
      - {exercise: plank, sets: 1, time: 60s}
  - id: B
    blocks:
      - {exercise: deadlift.barbell, sets: 1, reps: 5, main: true}
      - {exercise: overhead_press.barbell, sets: 3, reps: 5, main: true}
      - {exercise: pullup, sets: 3, reps: 8-10}
      - {exercise: lunge, sets: 3, reps: 10}
```

Its report, with the descriptions and reasons cut:

```
goal: strength
workouts: A, B; 2 a week
corridors: major_groups, strength.reps, strength.exercise_sets
main blocks: A squat.barbell, A bench_press.barbell, B deadlift.barbell, B overhead_press.barbell
  only these are checked by strength.reps: ...
  Sources: acsm2026 p. 853; acsm2026 Table 6; schoenfeld2021 Section 2; androulakis2021 Table 12; androulakis2021 Conclusions
  only these are checked by strength.exercise_sets: ...
  Sources: acsm2026 Table 6; acsm2026 Table 2; acsm2026 p. 853; acsm2026 p. 865
finding: major_groups: less than twice a week, 0 to under 2 days involved a week
  groups: abdomen 1, chest 1
  ...
finding: strength.exercise_sets: fewer than two sets, 0 to under 2 sets of an exercise in a workout
  B deadlift.barbell 1: workouts[1].blocks[0].sets (line 22)
  ...
numbers (information, no action needed)
targets: fractional sets and sessions a week
  chest       3 sets; 1 session; per workout: A 3
  back        6 sets; 2 sessions; per workout: A 3, B 3
  front_delts 4.5 sets; 1.5 sessions; per workout: A 1.5, B 3
  side_delts  1.5 sets; 0.5 sessions; per workout: B 1.5
  rear_delts  3 sets; 1 session; per workout: A 1.5, B 1.5
  biceps      3 sets; 1 session; per workout: A 1.5, B 1.5
  triceps     3 sets; 1 session; per workout: A 1.5, B 1.5
  quads       6.5 sets; 2 sessions; per workout: A 3, B 3.5
  hamstrings  0.5 sets; 0.5 sessions; per workout: B 0.5
  glutes      7 sets; 2 sessions; per workout: A 3, B 4
  calves      0 sets; 0 sessions
  abs         1 set; 1 session; per workout: A 1
major groups: days involved a week
  abdomen 1, chest 1: less than twice a week *
  legs 2, hips 2, back 2, shoulders 2, arms 2: twice a week or more
not counted: my.bike (no muscles)
findings: 2
```

- With two workouts at 2 a week, each workout counts once a week, so a weekly value is the sum over A and B.
- The numbers, checked against the muscles of the entries:
  - back: row 3 and pull-up 3, both primary;
  - front delts: bench press 1.5 and overhead press 3;
  - quads: squat 3, deadlift 0.5 and lunge 3;
  - glutes: squat 3, deadlift 1 and lunge 3.
- Unmarked, the same program also gets `strength.reps` for the row, the pull-up and the lunge, and
  `strength.exercise_sets` for `my.bike` and `plank`. The numbers are the same.
- `strength.stats.txt` gains one line after `corridors:`, the line without marks. Its findings do not change,
  and it stays the check of a program without marks.
- `unknown-field.expected.txt` line 23 reads `Allowed fields here: exercise, sets, reps, time, rest, load, main.`

## Risks / Trade-offs

- [The limit is our reading, and no source states it] → The reason says so in the data and in the report, and
  the reason of `strength.exercise_sets` names the advice against it. A source read later that states it, or
  contradicts it, changes the reason or undoes the limit.
- [The two new sources are indirect: `schoenfeld2021` compares kinds of test, not exercises, and
  `androulakis2021` reports on the 21 of 58 surveyed competitive powerlifters who had tried a minimum-dose approach]
  → The reason says what each one found, in those terms, and still calls the limit our reading. Neither is cited for
  `strength.exercise_sets`.
- [A full reading of a new source may not support its statement] → Task 3.1 comes before the data, and stops there
  if so.
- [The noise was shown on one program written for this check] → Task 6.3 checks programs not written for it, and
  its result goes in the commit or the review. The change is additive, so a program without marks loses nothing
  either way.
- [An agent marks one block and writes the rest at 3 × 15, so a thin strength program passes] → The line lists
  what is marked, and the report counts what the program states. Later evals can look for it.
- [An agent treats `main` as a way to clear findings] → It can only clear them by stating that a block is not a
  main lift, which is the question a reader of the file can judge. The marked blocks are listed in the report.
- [An agent leaves marks out, or marks every block] → The program is checked as it is today, and the line names
  the field.
- [A mark in a program of another goal does nothing, and may read as if it were checked] → The report has no line
  there, and the field's description names `goal: strength`.
- [A workout without marks is entirely outside the two corridors] → Intended (decision 3), and the line shows
  which workouts have marks. Coverage still counts its blocks.
- [Warm-up sets and groups come later] → `set-details` has to say how warm-up sets count, as `strength-corridors`
  noted, and `grouped-blocks` has to allow `main` on an item if a main lift can sit in a superset. `session-controls`
  has to say that a substitute keeps the mark.

## Migration Plan

None for programs: the field is optional, and every valid file stays valid with the same meaning. The data, code,
tests and expected reports change in one commit, and the diff of `schema/stats/strength.stats.txt` shows the one
line a program without marks gains. Rollback is reverting that commit.

## Open Questions

- Whether a source read later states the limit itself. That would change the reasons and citations and nothing
  else.
- Whether `power.reps` gets the same limit, should power programs prove noisy. That would change one corridor's
  data.
