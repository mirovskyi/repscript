# Design

## Context

`validator-foundation` left a working pipeline:
- `core/validate.mjs` parses with source positions, runs `check()` from `core/schema.mjs` on the plain
  data and maps issue paths to lines.
- `check()` interprets a small JSON Schema subset (`KEYWORDS`), and a lint test in
  `schema/schema.test.mjs` rejects any other keyword.
- Hints come from `description`.
- The only check outside the schema is the draft-version warning, appended in `validate()`.
- Fixtures in `schema/tests/` pin the exact report text.

The `SPEC.md` draft (§4.1) planned the value notation as regular expressions in the schema. This
change does not follow that plan; see the first decision. Requirements are in
`specs/program-format` and `specs/program-validation`, and motivation is in `proposal.md`.

## Goals / Non-Goals

**Goals:**
- Each notation is defined once, in code the player can import unchanged.
- The schema stays the description of structure: which fields exist, their types, which are required.
  Code adds only what the schema cannot express: the notations and the rules that span several fields.
- The wording of every new message is fixed here and pinned by fixtures, as in 1a.

**Non-Goals:**
- Upper limits and plausibility checks (`sets: 100` is valid).
- Guessing a missing duration unit.
- Treating `load: 18kg` or `sets: 3x10` as slips. They get the plain type or notation error.
- Checking `exercise` against a catalog (`exercise-catalog`).
- Using the parsed values anywhere but tests. The player starts using them in `workout-session`.
- Unit conversion and rounding to equipment steps.

## Decisions

### Notations: the `format` keyword names a parser in `core/formats.mjs`

A field with a notation is written in the schema as `{ "format": "reps", "description": "..." }`,
without `type`. `core/formats.mjs` exports `FORMATS`, which maps each name to
`{ expected, parse }`:
- `expected` is the notation as a noun phrase with examples;
- `parse(value)` takes a number or a string and returns either the parsed value or
  `{ message, hint? }`.

In `check()`:
- a number or a string goes to `parse`;
- any other type gets `Expected <expected>, found <a type>.`;
- a problem without its own hint gets the field's description as the hint.

A number is checked by its value and a string by its text, so `sets: 3` and `sets: "3"` both give 3,
and `kg: -5` gets the minimum message rather than the generic one.

The 1b notations:

| Name | Fields | Accepted text | Parsed value |
|---|---|---|---|
| `count` | `sets` | `N` or `A-B`: whole numbers, at least 1, `A < B` | `{ min, max }` |
| `reps` | `reps` | as `count`, or `N+` (N at least 1), or `max` | `{ min, max }`; `5+` gives `{ min: 5, max: Infinity }`, `max` gives `{ min: 0, max: Infinity }` |
| `duration` | `time`, `rest` | `Nu` or `A-Bu` with `u` one of `s`, `m`, `h`, whole numbers, greater than 0, `A < B`; or `M:SS` with `SS` from `00` to `59`, greater than 0 | `{ min, max }` in seconds |
| `weight` | `kg`, `lb`, `add_kg`, `add_lb` | `X` or `X-Y`: numbers with a dot for decimals, greater than 0, `X < Y` | `{ min, max }` |

A single value parses to `min` equal to `max`.

Why parsers instead of `pattern`:
- **One definition for two users.** The player needs the numbers anyway: rest from 120 to 180 seconds
  for `2-3m`, a range from 8 to 12 for `8-12`. With a regular expression in the schema, the player would
  need a second parser that has to accept exactly the same strings. If the two drift, the validator
  passes a program the player cannot run, which breaks ROADMAP invariant 1.
- **Precise messages.** A regular expression can only say "does not match". A parser knows that
  `8–12` has an en dash and can propose `8-12`.

The parsers return values now because they compute them anyway to check that a range is in order.
`schema/formats.test.mjs` pins those values, so the player gets a tested API instead of rewriting each
parser.

`format` is an annotation in JSON Schema 2020-12. An editor using this schema still checks field names,
required fields and the types of other fields. It does not check notation fields at all: they have no
`type`, so it accepts any value there, even `sets: [1]`. A validator in strict mode, such as Ajv 8 by
default, rejects unknown format names when it compiles the schema. Anyone reusing the schema must
register the names or turn strict format checking off.

Alternatives:
- `pattern` regular expressions, as in the `SPEC.md` draft. They are standard and editors check them.
  But the messages are unreadable for an AI, a separate slip table is needed anyway, and the player
  still needs its own parser.
- Structured values (`reps: {min: 8, max: 12}`). No parser is needed, but files get longer, and this
  goes against the short forms chosen in `SPEC.md` §4.1 because LLMs make fewer mistakes with them.
- `type: [integer, string]` together with `format`. Rejected: a wrong type would then produce the
  generic type message instead of one that names the notation.

### Check order and slip corrections

`parse` checks a value in this order and reports only the first problem it finds:

1. **Shape.** The text has the notation's form. For `duration`, a number, or a range of numbers without
   a unit, also has the shape: step 3 deals with it. A number value has the shape when the notation
   allows it, and a whole number is required except for `weight`. A string without the shape goes
   through the text corrections below.
2. **Minimum.** For `count` and `reps` every number must be at least 1 (`0`, `-1`, `0-3`, `3-0` and `0+`
   fail). For `duration` and `weight` every number must be more than 0 (`0s`, `0:00`, `0`, `-5`, `0-5`
   fail).
3. **No unit** (`duration` only): a number or a range of numbers without a unit (`90`, `2-3`, `1.5`).
4. **Range order**: a reversed range, or equal ends.

The fix proposed for a range-order problem passes steps 1 to 3 by construction. A `Write X.` hint is
only ever offered for an X that parses with no problem.

| Problem | Message | Hint |
|---|---|---|
| Reversed range (`4-3`, `3-2m`) | `The range starts with the larger number.` | `Write 3-4.` (the two numbers swapped, the unit kept) |
| Equal ends (`3-3`, `2-2m`) | `The range has the same number at both ends.` | `Write 3.` (one number, the unit kept) |
| No unit (`90`, `2-3`, `1.5`) | `The duration has no unit.` | `Write a whole number with a unit: s for seconds, m for minutes, h for hours. Example: rest: 90s` |

A missing unit is not guessed. `rest: 2` probably means minutes and `rest: 90` seconds, so the hint
names the units and leaves the choice to the agent.

**Text corrections.** When a string lacks the shape, `parse` applies these corrections in table order,
keeping the message of each one that changes the text:

| Slip | Applies to | Detected | Replaced by | Message |
|---|---|---|---|---|
| Failure word | `reps` | the whole value is `failure`, `to failure`, `until failure` or `amrap`, in any letter case | `max` | `A set to failure is written as max.` |
| Dash or minus | all | U+2010 to U+2015, U+2212 | `-` | `The range is joined with U+XXXX instead of a hyphen (-).` (the first such character found) |
| Decimal comma | all | `,` directly between two digits, before spaces are removed (so `16, 20` is not touched) | `.` | `The number has a decimal comma instead of a dot.` |
| Spaces | all | any whitespace, including U+00A0, when none of it stands between two digits | removed | `The value has spaces in it.` |
| Unit word | `duration` | the whole run of letters after a number equals one of these words, in any letter case: `sec`, `secs`, `second`, `seconds`, `с`, `сек` / `min`, `mins`, `minute`, `minutes`, `мин` / `hr`, `hrs`, `hour`, `hours`, `ч` | `s` / `m` / `h` | `Duration units are written as s, m or h.` |
| Unit on both ends | `duration` | `A<u>-B<u>` with the same unit | `A-B<u>` | `A range has its unit once, at the end.` |

What gets reported depends on the corrected text:

| Corrected text | Message | Hint |
|---|---|---|
| has the shape and no problem | the kept messages, joined by spaces | `Write <corrected text>.` |
| has the shape and a range-order problem | the kept messages, then that problem's message | that problem's `Write X.` |
| has the shape and the no-unit problem | the kept messages, then the no-unit message | the no-unit hint |
| has the shape and fails the minimum | the minimum message; corrections are not mentioned | description |
| still lacks the shape | the generic message; corrections are not mentioned | description |

Corrections combine. `reps: 12 – 8` gets the dash, spaces and reversed-range messages in one error,
with `Write 8-12.`

Spaces between two digits stay, so `reps: 8 12` or `kg: 16 20` still lacks the shape and gets the
generic message. Removing them would offer `Write 812.`: a different, valid number that an agent would
apply as it is.

Messages name a non-ASCII character by its code point. As noted in 1a, agents on Windows often read
tool output through a non-UTF-8 code page. There `= "8–12"` in the header can arrive garbled, and even
intact it looks like `8-12`. `U+2013` survives any code page. Cyrillic unit words are recognized, but
every message stays ASCII.

### Generic notation messages

| Problem | Message | Hint |
|---|---|---|
| Text that is not the notation | `Expected <expected>.` | description |
| Not a number or a string | `Expected <expected>, found <a type>.` | description |
| `count` or `reps` below 1 (`0`, `-1`, `0-3`, `3-0`, `0+`) | `Expected at least 1.` | description |
| `duration` or `weight` not above 0 (`0s`, `0:00`, `0`, `-5`, `0-5`) | `Expected more than 0.` | description |

`expected` for each notation:

| Name | `expected` |
|---|---|
| `count` | `a whole number such as 3, or a range such as 3-4` |
| `reps` | `a whole number such as 10, a range such as 8-12, a minimum such as 5+, or max` |
| `duration` | `a duration such as 30s, 2m, 1h or 1:30, or a range such as 2-3m` |
| `weight` | `a number such as 18 or 2.5, or a range such as 2-5` |

### Rules that span several fields: `core/rules.mjs`

`checkRules(data)` returns issues in the same shape as `check()` plus a severity: a path array, an
optional value, a message and a hint. `validate()` calls it after `check()` on the same plain data,
whether or not the schema check found errors, and locates the lines the same way. The rules look only
at values of the expected shape: a plain mapping for the program, a workout, a block or a load, and a
list for `workouts` and `blocks`. A value of the wrong type therefore causes only its type error.

The draft-version warning moves here from `validate()`, so all checks outside the schema live in one
place. Schema issues come before rule issues, and the stable sort by line keeps that order on a shared
line. Existing reports keep their order.

Rules in 1b:

| Rule | Severity | Path | Message | Hint |
|---|---|---|---|---|
| Block with `reps` and `time` | error | the block | `The block has reps and time together.` | `Keep reps for sets counted in repetitions, or time for timed sets such as a plank.` |
| Block with neither | error | the block | `The block has neither reps nor time.` | `Add reps for sets counted in repetitions (reps: 8-12), or time for timed sets such as a plank (time: 30s).` |
| Load without `kg`, `lb` or `bw` | error | the load | `The load has no kg, lb or bw.` | `Write load: {kg: 18} or load: {lb: 40} for an external weight, or load: {bw: true} for body weight, with add_kg or add_lb for extra weight.` |
| Load with more than one of them | error | the load | `The load has kg and bw together.` (the fields present, joined as `a and b` or `a, b and c`) | `Keep one: kg or lb for an external weight, or bw: true for body weight with add_kg or add_lb for extra weight.` |
| Extra weight next to `kg` or `lb` | error | the first of `add_kg`, `add_lb` | `add_kg is extra weight on top of body weight and needs bw: true.` | `Write the whole weight in kg, or use load: {bw: true, add_kg: 5}.` (the unit follows the field) |
| `add_kg` and `add_lb` together | error | the load | `The load has add_kg and add_lb together.` | `Keep one unit.` |
| Repeated workout id | error | `workouts[i].id`, with its value | `workouts[j] already has this id.` | `Give each workout its own id.` |
| Mixed units | warning | the first load in the other unit | `The program mixes kg and lb: this load is in lb, earlier loads are in kg.` (the units follow the program) | `Use one unit throughout, unless the equipment really is marked in both.` |
| Draft version | warning | `repscript` | unchanged from 1a | none |

How the rules apply:
- **A field counts as present when its key is in the mapping**, whatever its value. `{bw: false}` has
  `bw`, so it gets only its enum error. An empty `reps:` next to `time` is "reps and time together",
  plus the notation error for the empty value.
- **One problem per load.** The four load rules are checked in table order, and only the first that
  applies is reported. Fixing it and running the validator again shows the next one, if any.
- **Repeated ids.** Only string ids are compared.
- **Mixed units.** A load is in kg when it has `kg` or `add_kg`, and in lb when it has `lb` or `add_lb`.
  A load in both, or in neither (`bw: true` alone), is not counted. The first counted load sets the
  program's unit, and at most one warning is reported.

Alternatives:
- JSON Schema `oneOf`, `dependentRequired` and `not`. `oneOf` cannot tell which form the author meant,
  so its error says only "matches none".
- Custom schema keywords. Each would grow the interpreter for a single use.

### Interpreter keywords

`KEYWORDS` gains `format`, `minimum` and `minItems`. `minimum` and `minItems` are standard, and editors
honour them as well.

| Keyword | Used by | Message | Hint |
|---|---|---|---|
| `minimum` | `revision` | `Expected at least <minimum>.` | description |
| `minItems` | `workouts`, `blocks` | `Expected at least <n> item.` (`items` when n > 1) | description |

The order inside `check()`:
1. `type`, which stops the check on a mismatch;
2. `enum`;
3. `minimum`;
4. `format`, after which the check stops;
5. object keywords;
6. `minItems`, then `items`.

The schema lint gains two rules:
- a `format` must be a key of `FORMATS`;
- a schema with `format` may hold only `description` and `title` besides it. `check()` stops after
  `format`, so any other keyword next to it would be silently ignored.

### Decimal comma inside `{ }`

YAML reads `load: {kg: 2,5}` as `{kg: 2, "5": null}`, because a comma separates fields in a flow
mapping. A block-style `kg: 2,5` stays the string `2,5`, which the decimal comma correction handles.
Every `load` example in the descriptions is in flow style, so an agent is likely to write this.

In the flow case, `kg: 2` passes, and the only trace is an unknown field `5`. The generic
allowed-fields hint would invite the agent to delete it and keep the wrong weight. So in
`core/schema.mjs` an unknown field whose name is made only of digits, and whose value is `null`, gets
its own hint. The message stays `Unknown field.`:

`A comma inside { } separates fields, so a value such as 2,5 is read as 2 plus a field 5. Write decimals with a dot (kg: 2.5) and ranges with a hyphen (reps: 8-12).`

The flow-style `{reps: 8,12}` is covered by the same hint. A numeric field with a value, such as
`1: one` in the `unknown-field` fixture, keeps the usual hint.

### Schema fields and descriptions

| Mapping | Fields in schema order (required ones in bold) |
|---|---|
| program | **`repscript`**, **`id`**, **`revision`**, **`title`**, `notes`, `source`, `author`, `language`, **`workouts`** |
| workout | **`id`**, `title`, `notes`, **`blocks`** |
| block | **`exercise`**, **`sets`**, `reps`, `time`, `rest`, `load` |
| load | `kg`, `lb`, `bw`, `add_kg`, `add_lb` |

Every mapping keeps `additionalProperties: false` plus `patternProperties: {"^x-": {}}`. `bw` is a
boolean with `enum: [true]`. Descriptions are the hints an AI reads, so their wording is fixed here.
The descriptions of the top level, of `workouts` and of a workout replace the 1a texts: their
examples would otherwise show programs that are no longer valid.

| Field | Description |
|---|---|
| top level | `A Repscript training program: a mapping with the fields repscript, id, revision, title and workouts. Example: repscript: 0, id: home-strength, revision: 1, title: Home strength, workouts: [{id: A, blocks: [{exercise: pushup, sets: 3, reps: 10}]}].` |
| `revision` | `The program's version number, a whole number starting at 1. Example: revision: 1` |
| `notes` | `Notes on the program for the person training, a string. Example: notes: Add weight when every set reaches the top of the range.` |
| `source` | `Where the program comes from, a string. Example: source: Coach's sheet, October 2026` |
| `author` | `Who wrote the program, a string. Example: author: Alex` |
| `language` | `The language of the program's texts, a code such as en or ru. Example: language: en` |
| `workouts` | `The program's workouts, a list of at least one mapping, each with an id and blocks. Example: workouts: [{id: A, blocks: [{exercise: pushup, sets: 3, reps: 10}]}]` |
| workout | `A workout, a mapping with an id and a list of blocks. Example: {id: A, blocks: [{exercise: pushup, sets: 3, reps: 10}]}` |
| workout `title` | `The workout's title shown to the user, a string. Example: title: Heavy upper body` |
| workout `notes` | `Notes on the workout, a string. Example: notes: Warm up the shoulders first.` |
| `blocks` | `The workout's exercises in order, a list of at least one block. Example: blocks: [{exercise: pushup, sets: 3, reps: 10}]` |
| block | `A block, all sets of one exercise: a mapping with exercise, sets, and reps or time. Example: {exercise: pushup, sets: 3, reps: 8-12, rest: 90s}` |
| `exercise` | `The exercise's id, a string. Example: exercise: pullup.wide` |
| `sets` | `The number of sets, a whole number or a range. Examples: sets: 3, sets: 3-4` |
| `reps` | `The repetitions in each set: a whole number, a range, a minimum followed by + (then as many as possible), or max (as many as possible). Examples: reps: 10, reps: 8-12, reps: 5+, reps: max` |
| `time` | `The duration of each set, for timed exercises such as a plank: a whole number with the unit s, m or h, minutes:seconds, or a range. Examples: time: 30s, time: 1:30, time: 30-45s` |
| `rest` | `The rest after each set: a whole number with the unit s, m or h, minutes:seconds, or a range. Examples: rest: 90s, rest: 1:30, rest: 2-3m` |
| `load` | `The weight of each set: kg or lb for an external weight, or bw: true for body weight, with add_kg or add_lb for extra weight. Examples: load: {kg: 18}, load: {bw: true, add_kg: 5}` |
| `kg` | `An external weight in kilograms: a number with a dot for decimals, or a range. Examples: kg: 18, kg: 2.5, kg: 16-20` |
| `lb` | `An external weight in pounds: a number with a dot for decimals, or a range. Examples: lb: 40, lb: 35-45` |
| `bw` | `Body weight: bw: true means the exercise is done with body weight. Example: bw: true` |
| `add_kg` | `Extra weight in kilograms on top of body weight (a vest, a belt): a number or a range, together with bw: true. Example: add_kg: 2-5` |
| `add_lb` | `Extra weight in pounds on top of body weight (a vest, a belt): a number or a range, together with bw: true. Example: add_lb: 10` |

### Weight ranges in `kg` and `lb` too

The `SPEC.md` draft lists ranges only for `add_kg` and `add_lb`. In this design all four weight fields
share the `weight` notation. One parser covers them, and "16-20 kg dumbbells" is as natural as
"+2-5 kg". The player (`workout-session`) starts at the lower end, and `progression` defines how the
weight moves within the range.

Alternative: plain numbers for `kg` and `lb`. That would need a second notation for one difference.

### Fixtures

**Fixtures that reach the format check get two additions:** `revision: 1` after `id`, and
`blocks: [{exercise: pushup, sets: 3, reps: 10}]` in every workout. Each report then keeps the same
issues as before. The expected reports change only in three ways:
- lines shift;
- the allowed-fields hint lists the new top-level fields;
- hints that quote the top-level, `workouts` or workout description show the new text.

Those fixtures are `minimal`, `json`, `yaml-core`, `yaml-1.1-tags`, `missing-required`,
`unknown-field`, `several-issues`, `wrong-type`, `wrong-item-type`, `unsupported-version` and
`not-finite`.

`empty` and `top-level-list` keep their input, and their expected reports take the new top-level
description. Syntax and alias fixtures stop before the format check and stay unchanged.

Four of them get more than that:
- `yaml-core` adds `rest: 1:30` to its block. Under its `%YAML 1.1` directive this proves the value is
  read as the string `1:30`, not the YAML 1.1 sexagesimal integer 90.
- `missing-required` also drops `revision`, and adds a workout `C` without `blocks` and a block
  `{reps: 10}` without `exercise` and `sets`. Workout ids stay unique, so the rules add nothing.
- `unknown-field` adds a complete block with `type: superset`. That pins the "block type" scenario and
  the block's allowed-fields hint. `tools/validate.test.mjs` asserts this fixture's `errors:` count, so
  that assertion changes with it.
- `wrong-type` adds `notes: [warm up, stretch]`.

A fixture added before the rules (group 3 of the tasks) uses unique workout ids, gives every block an
`exercise`, `sets`, and `reps` or `time`, and does not mix kilograms and pounds. The rules then add
nothing to its report when they land.

New fixtures:

| Case | Content | Expected |
|---|---|---|
| `straight-blocks` | a valid program using every accepted form of each notation (including `sets: "3"`), counted and timed blocks, `{kg: 18}`, `{kg: 2.5}`, `{kg: 16-20}`, `{bw: true}`, `{bw: true, add_kg: 2-5}`, every descriptive field, a workout `title` and `notes` | only the draft warning |
| `pounds` | a valid program whose loads are `{lb: 40}`, `{lb: 35-45}` and `{bw: true, add_lb: 10}` | only the draft warning |
| `notation-slips` | one block per slip in the slip correction requirement, including `12 – 8`, and a block with `load: {kg: 2,5}` in flow style | one error per value, each with a `Write ...` hint; for the flow comma, an unknown field `load.5` with the comma hint |
| `notation-errors` | `reps: lots`, `sets: 0`, `sets: 3-0`, `sets: 2.5`, `time: [30s]`, `rest:` (empty), `rest: 1:75`, `kg: 0`, `kg: -5`, `rest: 90`, `rest: 2-3`, `rest: 1.5`, `kg: 16, 20` | generic messages with description hints, the minimum messages, the no-unit message and hint |
| `block-rules` | reps and time together, neither, and the loads `{kg, lb}`, `{kg, bw}`, `{kg, add_kg}`, `{add_kg}`, `{bw, add_kg, add_lb}`, `load: 18`, `{bw: false}` | one error each; `load: 18` has only its type error |
| `minimums` | `revision: 0`; a workout with `blocks: []` | `Expected at least 1.` and `Expected at least 1 item.` |
| `no-workouts` | `workouts: []` | `Expected at least 1 item.` at `workouts` |
| `duplicate-workout-id` | two workouts with `id: A` | an error at `workouts[1].id` naming `workouts[0]` |
| `mixed-units` | `{bw: true}` and then `kg` in workout A; `lb` in two blocks of workout B | one mixed-units warning, at B's first load; `errors: 0` |

Two more tests outside the fixtures:
- `schema/formats.test.mjs` calls the parsers directly. It checks:
  - the parsed values: `2-3m` gives 120 to 180, `1:30` gives 90, `5+` gives 5 to `Infinity`;
  - the message and hint of each correction and problem;
  - the check order: `3-0`, `rest: 3-2`, `rest: 0`, `-5`, `1.5`, `16, 20` and `8 12`.
- `schema/schema.test.mjs` gets three more tests:
  - `check()` on inline schemas for the new keywords and the flow-comma hint;
  - the lint test for the two new `format` rules.

## Risks / Trade-offs

- [The schema alone no longer says which values are valid] → Descriptions carry examples, and
  `spec/FORMAT.md` (`agent-workflow`) documents each notation. The CI check from ROADMAP invariant 2
  must cover `format` names as well as fields.
- [Editors accept any value in a notation field, and strict-mode validators such as Ajv reject the
  unknown format names] → The validator is the authority. Reusing the schema elsewhere means
  registering the four names or turning strict format checking off.
- [In flow style, a decimal comma splits a number, and the first part passes as a valid weight
  (`{kg: 2,5}` reads as 2 kg)] → The unknown digit-only field carries a hint that names the cause.
  The agent sees it on the same line.
- [The slip list misses slips that real agents make] → Adding one is a table row and a fixture.
  `ai-evals` will show which ones are missing.
- [The required `revision`, `blocks` and `sets` give an agent more errors on a first draft] → Each
  missing-field hint carries an example, so the agent fixes them in one round.
- [Every 1a fixture that reaches the format check changes] → The change is mechanical, and the diffs
  show that the reported issues stay the same.
- [`Infinity` in parsed `reps` values is not JSON] → Nothing serializes parsed values yet. The log
  format in `workout-session` chooses its own encoding.
- [Unit words cover English and a few Russian words] → Other words get the generic message, whose
  examples show the right form.

## Migration Plan

None. The format is still version `0` (draft), and no program files exist outside the fixtures.

## Open Questions

- Whether to treat `sets: 3x10` and `load: 18kg` as slips with a computed fix. Add them if `ai-evals`
  shows agents writing them.
