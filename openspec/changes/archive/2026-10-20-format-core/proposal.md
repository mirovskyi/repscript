# Proposal

## Why

`validator-foundation` built the path from a program file to an error an AI can act on, but the format
behind it holds only ids and titles: an agent still cannot write anything a person can train with.
This change adds the smallest format in which an agent can write a real straight-set program (exercises,
sets, reps or time, rest, weight) that the M2 player will run. Every slip an AI commonly makes in it gets
an error that names the exact fix.

## What Changes

- **Program fields.** `revision` is required: a whole number starting at 1. `notes`, `source`, `author`
  and `language` are optional strings.
- **Workouts.** A program needs at least one workout. Each workout needs `blocks`, a list of at least one
  block, and may have `title` and `notes`. Workout ids must be unique.
- **Straight blocks.** A block holds all sets of one exercise: `exercise` (an id string), `sets`, exactly
  one of `reps` or `time`, and optionally `rest` and `load`. Block types (`superset`, `amrap`…) are not
  part of this change.
- **Value notation**, short forms as written on a paper sheet:
  - set counts: `3`, `3-4`;
  - repetitions: `10`, `8-12`, `5+`, `max`;
  - durations: `30s`, `2m`, `1h`, `1:30`, `2-3m`;
  - weights: `18`, `2.5`, `2-5`.
- **Load.** The weight is given in exactly one way: `kg`, `lb`, or `bw: true` (body weight). With
  `bw: true`, `add_kg` or `add_lb` gives extra weight. A warning is reported when one program mixes
  kilograms and pounds.
- **Notation is parsed by code, not by regular expressions in the schema.** This differs from the
  `SPEC.md` draft. The schema names a notation with the standard `format` keyword. `core/` holds one
  parser per notation, which the player will reuse. Known slips get a hint with the corrected value,
  for example `Write 8-12.`:
  - an en dash instead of a hyphen;
  - spaces inside the value, except between two digits, where removing them would join two numbers;
  - a decimal comma;
  - `failure` instead of `max`;
  - unit words such as `min`;
  - a unit on both ends of a range;
  - a reversed range;
  - a range with equal ends.

  Inside `{ }` YAML splits `{kg: 2,5}` into `kg: 2` and a field `5`. That unknown field gets its own
  hint naming the cause.
- **Rules that span several fields are checked by code in `core/`**: reps or time, the load's single
  form, unique workout ids, mixed units. The draft-version warning moves there too.
- **Interpreter keywords.** The schema interpreter learns `format`, `minimum` and `minItems`.
- **Fixtures.** Existing fixtures that reach the format check get `revision` and blocks. New fixtures
  cover blocks, each notation, slips and the field rules.
- **BREAKING** for draft files: a 1a-style program (`workouts: [{id: A}]`, no `revision`) is no longer
  valid. The format version stays `0` (draft), and no programs exist outside the fixtures yet.

Out of scope, placed in `ROADMAP.md`:
- `implement` (`exercise-catalog`);
- `per_side`, `steps`, `band`, `warmup`, `rir` / `rpe`, `tempo`, `cues` (`set-details`);
- block types (`timed-blocks`, `grouped-blocks`);
- progression within a weight range (`progression`);
- `distance` (deferred).

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `program-format`:
  - workouts become non-empty, with blocks and unique ids;
  - new requirements for the revision, descriptive fields, straight blocks, the value notations and
    the load.
- `program-validation`:
  - type and value errors also state minimums;
  - an unknown field named only by digits and holding nothing gets the decimal comma hint;
  - new requirements for notation errors, slip hints, a duration without a unit, the decimal comma
    inside `{ }`, field combination errors, repeated workout ids and the mixed-units warning.

## Impact

- `core/schema.mjs`: `format`, `minimum`, `minItems`.
- New `core/formats.mjs` with the notation parsers, and new `core/rules.mjs` with the cross-field rules
  and the draft warning.
- `core/validate.mjs`: runs the rules after the schema check.
- `schema/repscript.schema.json`: the new fields and their descriptions, which double as hints.
- `schema/schema.test.mjs`: lint for `format`. New `schema/formats.test.mjs` tests the parsers'
  values and corrections.
- `schema/tests/`: updated and new fixtures.
- `tools/validate.test.mjs`: the asserted `errors:` count of the `unknown-field` fixture.
- `tools/validate.mjs` is unchanged. No new dependencies.
