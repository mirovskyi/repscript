# Proposal

## Why

`strength.reps` and `strength.exercise_sets` check every block of a `strength` program, but a program
cannot say which exercises it means to get stronger at. So assistance work at 10 repetitions, a warm-up
on a bike and a single timed plank all get findings, and the agent has to act on or explain each one.
The design of `strength-corridors` foresaw this and left the narrowing to a later change, which has to
record its reason.

No source we have read says that assistance work may go unchecked, so the narrowing is our own reading,
and this change states it as one. Two open-access articles support that reading for load, indirectly: one
on where the advantage of heavy loads shows, and one on what powerlifters report doing on a minimum dose.
Neither speaks to sets per exercise, where the narrowing rests on the reading alone.

## What Changes

- A block MAY have `main: true`: an exercise whose own result the program is built to raise, not
  assistance work. Only `true` is valid, and the field is goal-neutral.
- A corridor MAY be limited to main blocks with `main_only: true`, and then SHALL say why in
  `main_only_reason`, in our words, as `extrapolation` does, and cite its sources in `main_only_cites`.
- Two sources enter `catalog/references.yaml`, read in full and cited by `strength.reps` only:
  `schoenfeld2021` and `androulakis2021`.
- `strength.reps` and `strength.exercise_sets` get `main_only`. When a program marks at least one block,
  they check only the marked blocks, across the whole program. An exercise of a workout is checked when
  one of its blocks there is marked, and all its sets in that workout still count.
- A program without marks is checked as it is today: every block, the same findings and numbers.
- The report of a program to which such a corridor applies gets a line that says which blocks are
  marked, with each limit's reason and sources, or that none is and every block was checked, so that
  silence on assistance work does not read as approval. Programs of other goals get no such line, even
  with marks.
- Counting does not change: weekly sets, sessions, days and coverage still count every block.
- Recorded in the design, not adopted: a marker in the catalog, a check per workout, a list of main
  lifts per program, roles such as `assistance` or `warmup`, the same limit on `power.reps`, and a check
  of exercise order (which `main` makes possible, but a warm-up block would set off in every workout).
  The design also says why this change does not need NSCA's Essentials.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `program-format`: a new optional field of a block, `main`, and its mention in Straight blocks.
- `training-guidelines`: corridors limited to main blocks, with their reason and citations, and which
  project corridors are limited.
- `program-stats`: which values such a corridor checks, a new line in the report, and its place in the
  layout.

`program-validation` needs no delta: a wrong `main` value and an unknown field follow its general
requirements.

## Impact

- **Format:** `schema/repscript.schema.json` gains one optional block property. The change is additive:
  every valid program stays valid and means what it meant.
- **Data:** `catalog/corridors.yaml`, two corridors and the file's header comment;
  `catalog/references.yaml`, two entries.
- **Code:** `core/guidelines.mjs` (reads the new fields), `core/stats.mjs` (filters the values, adds the
  report data and the line).
- **Tests:** `schema/guidelines.test.mjs` (closed fields and the new checks), `schema/stats.test.mjs`, a
  new validator fixture and a new stats fixture. `schema/tests/unknown-field.expected.txt` lists the new
  field. `schema/stats/strength.stats.txt` gains the new line, and no other stats report changes.
- **Docs:** `CLAUDE.md`, the program report section.
- **Later changes:** `training-defaults` can write main lifts and, once a source supports them, assistance
  work. `set-details` and `grouped-blocks` have to say how `main` meets warm-up sets and the items of a
  group.
