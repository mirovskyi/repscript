# Design

## Context

What exists now:
- The schema (`schema/repscript.schema.json`) defines the program's fields.
- `check()` in `core/schema.mjs` interprets it.
- `core/formats.mjs` parses the value notations (`count`, `reps`, `duration`, `weight`) and corrects
  known slips.
- An `enum` error lists the allowed values and takes the field's description as its hint.
- An unknown field gets `Did you mean <field>?` from `closest()`, or the list of fields allowed there.
- No existing `enum` holds strings: they are `repscript: [0]`, `bw: [true]` and `deprecated: [true]`.

The `SPEC.md` draft (§4.2) already places `goal` at the top level of a program and `per_week` inside
`schedule`, next to `order`, `days`, `extras`, `phases` and `repeat`. For the motivation, see
`proposal.md`. The requirements are in `specs/program-format` and `specs/program-validation`.

## Goals / Non-Goals

**Goals:**
- The two fields take the shape the draft gives them, so `schedule` and `periodization` in M3 add
  fields next to `per_week` without moving it.
- Each mistake an AI is likely to make gets a hint that names the fix, with as little new code as
  possible.
- The wording of every new message and description is fixed here and pinned by fixtures.

**Non-Goals:**
- Checks between fields. `goal: strength` with `reps: 20` is valid: judging the training is
  `program-stats`' job (ROADMAP Invariant 4).
- An upper limit for `per_week`. The interpreter has no `maximum`, and `per_week: 30` is valid.
- A targeted hint for `per_week` written at the top level (see Risks).
- A default number of workouts a week.

## Decisions

### `per_week` lives in `schedule`, and `schedule` requires it for now

The program reads `schedule: {per_week: 3}`, not a top-level `per_week: 3`.

- **Why:** the draft's `schedule` will hold `order`, `days`, `extras`, `phases` and `repeat`. With
  `per_week` at the top level, the `schedule` change would either move it, which is a migration, or
  leave two places for one thing.
- **Why it is required:** an empty `schedule: {}` says nothing. When `order` arrives, `per_week` can
  become optional, and relaxing a requirement breaks no file.
- **Alternative:** a top-level `per_week`, which is shorter. It was rejected for the migration it would
  cause.

### `per_week` uses the `count` notation

`per_week` reuses the parser of `sets`: `3`, `3-4` and `"3"` are valid, `0` gets
`Expected at least 1.`, and `3–4` gets `Write 3-4.`

- **Why:** coach sheets say "3-4 times a week", and sheets are translated verbatim. `program-stats` has
  to handle ranges in `sets` anyway.
- **What a range means:** a week holds at least the lower and at most the upper number of workouts. A
  tool that counts by the week counts a week at each end, so `program-stats` gives each weekly number
  for both ends.
- **Phases later:** `periodization` counts weeks to switch phases and needs one number. It will require
  a whole `per_week` in a program that has `phases`. That rule reaches only programs with the new
  `phases` field, so it breaks no file written before it.
- **A departure from the draft:** `SPEC.md` §4.2 shows `per_week` as a plain number, and its notation
  table does not list `per_week` among the number-or-range fields. Ranges are allowed here for verbatim
  sheets.
- **Alternative:** a whole number with `minimum: 1`, like `revision`. It would force the AI to pick a
  number the sheet does not give.

### Rotation, and no default

- **Meaning:** the workouts follow in list order, round and round. A week is the next `per_week`
  workouts, not a calendar week, as in the draft (§4.2: a missed day does not burn a workout).
- **Weeks differ:** with workouts `A` and `B` three times a week, the weeks alternate between `A`, `B`,
  `A` and `B`, `A`, `B`. A muscle group trained only in `A` gets 2 sessions, then 1. `program-stats`
  therefore states weekly numbers over a full rotation: for example, a group's frequency is `per_week`
  times the share of workouts that train it, 1.5 here, rather than the number of one particular week.
  Its design fixes the rule; ROADMAP row 2d records it.
- **Who implements it:** this change only defines the rotation. `program-stats` counts weeks by it, and
  the player follows it once it picks the next workout (`workout-session`; the next-workout hint of
  `schedule`). The rotation scenarios are tested there.
- **No default:** a program without `per_week` states no number. The draft's default, one pass through
  `order`, matters only once phases count weeks, so `periodization` decides it. `program-stats` treats a
  missing `per_week` as unknown and reports per-workout numbers and coverage only (ROADMAP, Program
  quality).
- **Alternative:** each workout once a week. Every program would get weekly numbers, but on an
  assumption the file never made, and a finding would cite a source against a number nobody wrote.

### `goal` is a string `enum` in the schema

- **Why:** the five values are part of the format's meaning. The corridors of `evidence-base` key on
  them, and a new value needs its own corridors and sources. They are not catalog data that contributors
  extend. In the schema they also stay visible to any editor that reads the JSON Schema.
- **Alternatives:**
  - A dictionary such as `catalog/goals.yaml`, with names in two languages, like `equipment.yaml`. It
    is heavier, and nobody needs the names yet: chats write the keys. The player's labels come with
    its UI strings in `player-shell`.
  - `format: goal`. A format is a notation that parses to a range, and the schema lint forbids `enum`
    next to `format`.

### Hints: the description, plus near misses; no table of wishes

- **The description carries the guidance for any wish.** An AI that writes `fat_loss`, `weight_loss`,
  `toning` or `fitness` gets the five values in the message. The hint says that a goal is the training
  adaptation, sends the wish to `notes`, and asks for the adaptation that serves it. It does not say
  which one: which goal serves which wish is a training judgment that `spec/TRAINING.md` makes with
  sources (`evidence-base`), and a validator hint must not make it without them (ROADMAP Invariant 4).
- **Near misses** (`Hypertrophy`, `strenght`, `muscular-endurance`) get `Did you mean <value>?` from
  `closest()`, which already serves unknown fields. In `check()`, a string that misses an `enum` takes
  `closest()` over the enum's strings. When there is a close value, the hint is `Did you mean`;
  otherwise it stays the description. Non-strings are not compared.
- **Alternative:** a table of known wishes with their own messages, in `core/rules.mjs`. It would grow
  with every phrasing an AI invents, and the schema error would still be reported next to it, so the
  report would carry two issues on one value.

### Values

`strength`, `hypertrophy`, `power`, `muscular_endurance`, `health`, as decided in ROADMAP (Program
quality):
- `muscular_endurance`, not `endurance`, which reads as cardio;
- `health` covers general health and physical function;
- `conditioning` comes with `timed-blocks`.

The values are lowercase with `_`, like the equipment and muscle keys.

### Place in the schema

`goal` and `schedule` follow `language` in the top-level `properties`, so the list of allowed fields
reads: repscript, id, revision, title, notes, source, author, language, goal, schedule, exercises,
workouts. Two expected reports print that list (`unknown-field`, `several-issues`) and are updated. No
unknown field in the existing fixtures is a close match for `goal` or `schedule`: `foo` and `1` stay
without a `Did you mean`.

### Wording

| Where | Text |
|---|---|
| `goal` description | `What the program trains for, one of strength, hypertrophy, power, muscular_endurance and health. It is the training adaptation, not the person's own wish such as losing weight: write the wish in notes and choose the adaptation that serves it. Example: goal: hypertrophy` |
| `schedule` description | `How the workouts are spread over time, a mapping. For now it holds only per_week. Example: schedule: {per_week: 3}` |
| `per_week` description | `The number of workouts in a week, a whole number or a range. The workouts follow in list order, then from the first again. Examples: per_week: 3, per_week: 3-4` |
| `goal` outside the list | `Expected one of: "strength", "hypertrophy", "power", "muscular_endurance", "health".`, with the `goal` description as the hint (existing `enum` message) |
| near miss | `Did you mean hypertrophy?` |
| unknown field in `schedule` | `Allowed fields here: per_week. Extension fields start with x-.` (existing) |

## Risks / Trade-offs

- [An AI writes `per_week` at the top level] → The report says only `Unknown field.`, with the list of
  allowed top-level fields. The list names `schedule`, but nothing in the report links `per_week` to
  it. `spec/FORMAT.md` (`agent-workflow`) shows the full form. If evals or real chats keep making this
  slip, add a generic hint: an unknown name that is a field of a child mapping gets
  `per_week is a field of schedule.`
- [A program fits none of the five goals, or two of them, as in powerbuilding] → `goal` is optional:
  the author picks the closest goal or leaves it out. A mixed goal, as a list or per phase, is a later
  change that breaks no file.
- [`health` merges general health and physical function, which may need different corridors, for
  example for older adults] → `evidence-base` splits it if the sources do. Adding a value breaks no
  file; renaming `health` would, so it keeps its name.
- [The rotation is fixed before `order` exists] → `schedule` changes the "Workout rotation" requirement
  to follow `order` when it is present, and makes `per_week` optional (ROADMAP row 11).
- [A `per_week` range makes the weekly numbers ranges] → `program-stats` gives each weekly number for
  both ends of the range.
- [Weekly numbers differ from week to week under the rotation, so a corridor check on "this week" would
  flicker] → `program-stats` states them over a full rotation (see Rotation, and no default).
- [The rotation is specified with no code in this change, so nothing tests its scenarios yet] →
  `program-stats` and `workout-session` test them when they implement the rotation.

## Migration Plan

None. Both fields are optional, so every valid program stays valid. Two expected reports change only in
the list of allowed top-level fields.

## Open Questions

- How the player labels the goal values in each language: `player-shell`, with its UI strings.
