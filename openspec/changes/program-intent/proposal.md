# Proposal

## Why

The training in a program is to be checked by code against corridors from cited sources, in a report
of its own (`tools/stats`, change `program-stats`), while the AI stays free in the interview, the
choice of exercises and the explanation. The corridors with the best evidence are weekly: sets per muscle group per week, and
how many times a week each group is trained. Many depend on what the program trains for. A program file
says neither how many workouts make a week nor what the program aims at. This change adds both to the
format first, so that the corridors of `evidence-base` and the numbers of `program-stats` have something
to work from.

## What Changes

- **`goal`**, an optional top-level field holding one value from a closed list: the training adaptation
  the program aims at. The values are `strength`, `hypertrophy`, `power`, `muscular_endurance` and
  `health`, after the outcomes of the 2026 ACSM position stand on resistance training (`health` also
  after WHO 2020). A goal is not the person's own wish, such as losing weight: the wish goes in `notes`,
  and the goal is the adaptation chosen to serve it. A program has one goal; a mixed goal or a goal per
  phase is out of scope.
- **`schedule.per_week`.** `schedule` is the mapping that later changes extend with the order of the
  workouts and with phases. This change defines only `per_week` in it: the number of workouts in a week, a whole number or a range (`3`, `3-4`) in the
  notation of `sets`. A range keeps a coach's "3-4 times a week" verbatim: a week then holds as few
  workouts as the lower end and as many as the upper end.
- **What a week is.** The workouts follow one another in list order, then from the first again: a
  rotation, not a calendar. A week is the next `per_week` workouts, so weeks may differ in which workouts
  they hold.
- Neither field adds a check beyond its own value. This change has no code that counts weeks or picks
  the next workout: `program-stats` counts weeks by the rotation, and the player follows it once it picks
  the next workout (`workout-session`, `schedule`).
- **Hints.**
  - A `goal` outside the list gets an error that lists the allowed values. Its hint is the field's
    description, which says that a goal is the training adaptation and points to `notes` for the
    person's wish, so `goal: fat_loss` tells the AI what to write instead.
  - A string close to an allowed value (`Hypertrophy`, `strenght`, `muscular-endurance`) gets
    `Did you mean <value>?`, by the closeness rule that unknown fields already use. This holds for every
    string `enum` in the schema. The existing enums hold no strings, so no existing report changes
    because of it.
- **Fixtures.**
  - New fixtures cover a valid program with both fields, a `goal` outside the list, and the errors of
    `schedule`.
  - Two existing expected reports change: the top-level list of allowed fields in `unknown-field` and
    `several-issues` gains `goal` and `schedule`.
- Not breaking: both fields are optional, and every valid program stays valid.

Out of scope, for later changes:
- the corridors and their sources (`evidence-base`), the weekly numbers and the findings
  (`program-stats`), including how weekly numbers are averaged over a rotation and given for both ends
  of a range;
- which goal serves which wish of a person, with sources (`evidence-base`, in `spec/TRAINING.md`), and
  applying it in the interview (`agent-workflow`);
- training status and session time in `my/profile.yaml` (`agent-workflow`);
- documenting both fields in `spec/FORMAT.md`, which `agent-workflow` writes for every field at once;
- `conditioning` (`timed-blocks`), a goal per phase (`periodization`);
- the rest of `schedule`: `order`, `days` and `extras` in `schedule`, which also makes `per_week`
  optional and the rotation follow `order`; `phases` and `repeat` in `periodization`, which also
  requires a whole `per_week` in a program with phases and decides what a missing `per_week` means for
  them;
- showing `goal` and `per_week` in the player (`player-shell`);
- other program-level fields about the person or the program, such as a level or contraindications.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `program-format`: a program may state its goal (`goal`) and its number of workouts a week
  (`schedule.per_week`); the workouts follow in rotation, and a week is the next `per_week` of them.
- `program-validation`: a string that is not an allowed value but is close to one gets a
  `Did you mean <value>?` hint.

## Impact

- `schema/repscript.schema.json`: `goal` (a string `enum`) and `schedule` (a mapping with `per_week` in
  the `count` notation), placed after `language`.
- `core/schema.mjs`: the hint of an `enum` error on a string uses `closest()`.
- `schema/tests/`: three new fixtures, and two expected reports updated.
- `schema/schema.test.mjs`: unit tests for the `enum` hint.
- Not touched: `tools/validate.mjs`, `core/rules.mjs`, `core/formats.mjs`, the catalog.
