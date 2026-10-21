# Design

## Context

After `format-core`:
- `validate(source, schema)` in `core/validate.mjs` parses the file, runs the schema interpreter, then
  `checkRules(data)` from `core/rules.mjs`, and maps every issue path to a line.
- `core/` does no I/O, and a test enforces that.
- The schema interpreter knows a fixed keyword list. The lint in `schema/schema.test.mjs` rejects any
  other keyword and any field without a description.
- `exercise` is checked only as a string.
- Fixtures in `schema/tests/` pin the exact report text. Some use ids that break the convention this
  change sets (`dumbbell.press`, `goblet.squat`).

The `SPEC.md` draft (§5, §8.6) describes the catalog. This design differs from it in three places:
- name matching is exact after normalization, not fuzzy;
- the shoulder bundles sit under a muscle `deltoids`, not directly under the group;
- `joints`, `cues`, `mistakes`, `references`, `status`, `pattern`, `unilateral`, `progressions` and
  `motion` are left for later changes (see `proposal.md`).

Requirements are in `specs/exercise-catalog`, `specs/program-format` and `specs/program-validation`.

## Goals / Non-Goals

**Goals:**
- The catalog reaches `core/` as data. The tools, the tests and later the player load it their own way
  and pass the same object.
- One check of an exercise entry serves a program's own exercises and the catalog's files. The catalog
  adds its stricter rules on top.
- Every new message is fixed here and pinned by fixtures or tests, as in `format-core`.
- A contributor's mistake in a catalog entry gets the same kind of report as a mistake in a program.

**Non-Goals:**
- Fuzzy matching of names, or matching names in the player.
- Aliases in the muscle and equipment dictionaries.
- Checking that `implement` agrees with the exercise's `equipment`, or that the user has the
  equipment.
- Equipment alternatives ("dumbbells or a kettlebell").
- A validator mode for catalog files in `tools/validate.mjs`. The catalog is checked by `node --test`.
- Rebuilding the index from the Claude Code format hook.
- The CI check that catalog ids and dictionary keys are never removed or renamed. It is deferred to the
  first public release (`repscript: 1`, see `ROADMAP.md`), because a review of the catalog against
  professional sources may still rename ids. `deprecated` and `replaced_by` stay in the format.

## Decisions

### The catalog is a third argument of `validate()`

`core/catalog.mjs` exports `buildCatalog(files)`:
- `files` is `{ exercises: [{ file, source }], muscles: { file, source }, equipment: { file, source } }`;
- `file` is a path relative to the project root, always with `/`, such as
  `catalog/exercises/pullup.wide.yaml`. Messages show it, and `validateEntry` takes the expected id from
  the part after the last `/`. Building it with `/` in `tools/catalog.mjs` keeps reports and asserted
  messages the same on Windows.

It parses each source with the same YAML options as `validate()`, sorts the entries by id, comparing
code units rather than with `localeCompare`, and returns the fields below. Sorting here matters because
file order is not id order: `pullup.wide.yaml` sorts before `pullup.yaml`, while the id `pullup` comes
before `pullup.wide`. The index order, "first in id order wins" and the tie-breaks of suggestions all
use this order.

| Field | Content |
|---|---|
| `exercises` | `Map` from id to the entry's plain data, deprecated entries included |
| `names` | `Map` from a normalized name or alias to an id, for entries that are not deprecated; the first entry in id order wins. Only fields of `names` under a language code hold names: `x-` fields do not. A name that normalizes to nothing is left out |
| `muscles` | `Map` from key to `{ group, children }`: `group` is true for a top-level key, `children` lists its direct children's keys |
| `equipment` | `Set` of equipment keys |

`buildCatalog` throws an `Error` naming the file in two cases:
- a file is not valid YAML;
- a file lacks the shape the validator relies on: an entry that is not a mapping with a string `id`, or
  a dictionary that is not a list of mappings with string `id`s.

Anything deeper is the catalog checks' job. `main` always passes them, so the validator can trust the
catalog.

`validate(source, schema, catalog)` passes the catalog to `checkRules(data, catalog)`. The argument is
required: a missing catalog must not quietly skip the exercise checks.

`tools/catalog.mjs` is a Node module, not a command. It exports two functions:
- `readCatalogFiles(dir)` reads `exercises/*.yaml`, `muscles.yaml` and `equipment.yaml` from a
  directory URL and returns the `files` object. It throws an `Error` naming the file when a file is not
  UTF-8 text (decoded with `fatal`, and no NUL, as `tools/validate.mjs` does), or when `exercises/`
  holds a file that does not end in `.yaml`, which the checks would otherwise skip;
- `loadCatalog(dir)` calls `readCatalogFiles` and `buildCatalog`. It returns `{ catalog }`, or
  `{ error }` with the two lines `tools/validate.mjs` prints (see below), so the error text is tested
  in-process.

Their users:
- `tools/validate.mjs`, with the project's `catalog/`, found relative to the tool;
- the fixture runner, with `schema/tests/catalog/`;
- the catalog test, with both;
- the index script.

The player (`player-shell`) will build the same object from texts its server sends.

Alternatives:
- **Load the catalog inside `core/`.** That breaks the no-I/O rule, and the browser cannot read a
  directory.
- **A global catalog set once.** Tests then depend on import order, and the fixture catalog and the
  real one could not be used side by side.
- **Pass parsed data instead of sources.** Then every caller has to parse YAML with the right options.
  `buildCatalog` owns that, as `validate()` does.

### Exercise checks live in `core/exercises.mjs`

`checkRules(data, catalog)` keeps the format rules and calls `checkExercises(data, catalog)`. That
function checks the program's `exercises` entries, the blocks' `exercise` values and each load's
`implement`.

The shared entry check is `checkEntry(entry, path, context)`. `context` holds:
- the catalog;
- the scope: `program` or `catalog`;
- for a program, its own exercises by id;
- for a catalog file, the id its file name implies.

| Check | `program` | `catalog` |
|---|---|---|
| Muscle and equipment keys exist | yes | yes |
| Group muscle keys | allowed | error |
| `deprecated` with `replaced_by` | yes | yes |
| `replaced_by` target | catalog or own exercise | catalog only |
| Replacement cycle | yes | yes |
| Id form | own-id rules (below) | id form; no `my.`; matches the file name |
| `names.en`, `names.ru`, `muscles`, `equipment` present | no | yes |
| Names and aliases unique | no (the like-catalog warning instead) | against earlier entries in id order; deprecated entries are neither checked nor counted |
| Muscle key suggestions and list | all keys | muscles and bundles only, since a group is an error there |

Values of the wrong type are skipped, as in the other rules: the schema check already reports them.
The `exercise-wrong-types` fixture pins this for every new field. `replaced_by` counts as present when
its key is there, whatever its value. `deprecated` with a value other than `true` (`false`, a string)
is left to the schema: the pairing is checked only when `deprecated` is absent or `true`, so
`deprecated: false` gets the enum error alone.

A repeated own id names its first entry, so the later entries with that id get the repeated-id error and
no cycle check.

**Issue order on a shared line.** `validate()` sorts by line with a stable sort, so issues on one line
keep their emission order:
1. schema issues;
2. the existing format rules;
3. the exercise checks: first every `exercises` entry in list order, then every block in order.

Within an entry the order is:
1. the one id problem;
2. the like-catalog warning;
3. muscle keys;
4. equipment keys;
5. the `deprecated` and `replaced_by` pairing;
6. `replaced_by` resolution;
7. the cycle.

Within a block, `exercise` comes before `implement`. The hand-written expected reports follow this
order.

**Two helpers for later readers.** `programEquipment(data, catalog)` in `core/exercises.mjs` returns the
sorted equipment keys a program needs: the `equipment` of each referenced exercise that is known, own
ones included, plus every string `implement`. `equipmentSatisfies(have, need)` in `core/catalog.mjs` is
true when `have` equals `need` or starts with `need.`. Nothing in this change calls them. They make the
"Program equipment" and equipment variant requirements testable now, and give `player-shell` and the
agent a tested API, as the `format-core` parsers did with their values.

`core/validate.mjs` gets a second entry point, `validateEntry(source, schema, catalog, file)`. It
checks one catalog file:
- the schema is the entry schema, `schema.properties.exercises.items`;
- the rules are `checkEntry` in the catalog scope.

It shares the parsing, the alias check and the line lookup with `validate()` through one internal
function. A report path is relative to the entry, for example `muscles.primary[0]`.

Alternative: separate entry schemas for the program and the catalog. Rejected: the format is one, and
the interpreter has no `$ref`, so the two copies would drift.

### Ids and keys

- **Exercise id form:** `^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$`. Own ids are the same form starting with
  `my.`.
- **Muscle key form:** `^[a-z][a-z0-9_]*$`.
- **Equipment key form:** the exercise id form.
- **Ids are checked by rules, not by the schema.** The schema says `type: string`. A value that is not
  in the id form is not always an error of form: in a block it is a name, which needs the catalog to
  answer. Keeping all id checks in one place keeps their messages consistent.

**Closeness** is the rule used for field names: ignoring case, within two edits, or one when the
candidate has four characters or fewer. `core/schema.mjs` exports it as `closest(value, candidates)`,
which returns the candidate at the smallest distance within reach, or `undefined`. Ties go to the first
candidate in the list's order, and candidate lists are sorted.

**Candidates for each suggestion:**

| Suggestion for | Candidates |
|---|---|
| a block's unknown id | catalog ids that are not deprecated and share the value's first dot-separated part; all catalog ids that are not deprecated when none does |
| a block's undescribed `my.*` | the program's own ids in the id form, starting with `my.` |
| `replaced_by` | catalog ids, plus own ids in the id form starting with `my.` in a program |
| a muscle key | all muscle keys in a program; muscles and bundles only in a catalog entry |
| an equipment key | all equipment keys |

A hint never suggests an own id that is not valid: such an entry already gets its own id error, and
suggesting its id would only pass the mistake on. For the same reason the names of such entries do not
take part in name matching.

**Same movement first.** Without that restriction, `pushup.wide` is two edits from `pullup.wide` and
would get `Did you mean pullup.wide?`. That is a confident wrong answer, the case exact name matching
avoids. Limited to ids starting with `pushup`, nothing is close, and the prefix fallback gives `pushup`.
`pullup.wdie` still gets `pullup.wide`, and `squat.goblett` gets `squat.goblet`.

**Prefix fallback** (unknown block ids only): drop the last dot-separated part while more than one
remains. The first catalog id met that is not deprecated is suggested: `pullup.wide.weighted`, then
`pullup.wide`.

### Order of reference checks

`checkExercises` handles each block's `exercise` that is a string, in this order:

1. **Known id** (a catalog id, deprecated included, or an own id): no error. A deprecated one gets the
   warning.
2. **A name match** in the catalog's or the program's names, catalog first: the name error. This comes
   before any id-form test because agents write one-word names in the id form: `pushups`, `deadlift`,
   `swings`. With the name test first, `pushups` gets `Write exercise: pushup.` instead of a "did you
   mean" over ids.
3. **The lowercase form is a known id** (`Pullup.Wide`): the capitals error.
4. **Starts with `my.`**: the undescribed own exercise error.
5. **Has the id form**: the unknown id error. Its hint is the first that applies:
   - `my.<value>` is an own id: `Did you mean my.towel_pullup?`;
   - the closest catalog id, same movement first;
   - the prefix fallback;
   - `INDEX`.
6. **Otherwise**: the unknown name error.

Each block gets at most one error at `exercise`.

### Name matching

`normalizeName(text)` in `core/catalog.mjs`:
1. Unicode NFKC, then lowercase, then `ё` to `е`.
2. Split at every character that is not `\p{L}` or `\p{N}`, dropping empty parts.
3. In each word of Latin letters only, fold the English plural:
   - a final `ies` becomes `y`;
   - else a final `ches`, `shes`, `sses` or `xes` loses `es`;
   - else a final `s` is dropped when the word has more than two letters and does not end in `ss`.
4. Join the words with nothing between them.

So `Wide-grip pull-ups`, `wide grip pullup` and `WIDE GRIP PULL UPS` all become `widegrippullup`. The
limit is two letters, not three, because words are split before folding: `pull-ups` gives the word
`ups`, which must lose its `s`. `abs` becomes `ab` too, which does no harm: both sides of every
comparison are folded alike.

A block's name is looked up in two places:
- `catalog.names`;
- the names and aliases of the program's own exercises that are not deprecated and have a valid own id.

Only fields of `names` under a language code (`^[a-z]{2}$`) hold names, everywhere: in matching, in the
like-catalog warning, in catalog uniqueness and in the index. An `x-` field under `names` is a note, and
an unknown field such as `english` is already a schema error. A name that normalizes to nothing, such as
`-`, matches nothing: otherwise `exercise: "?"` would match it.

The catalog wins on a clash, since the like-catalog warning already reports such an own exercise.

Why exact matching:
- **The suggestion is a statement.** "Write `exercise: pullup.wide`" claims that this is the exercise.
  A fuzzy match would make that claim for "wide pull-ups" and "wide push-ups" alike, and an agent
  applies the hint without asking.
- **Aliases are data, matching is code.** A missing form is one alias in one entry. Fuzzy thresholds
  need tuning that no test pins.

The plural folding is the one exception: English names come in both numbers ("pull-up" and
"pull-ups"), and the rules are regular. Russian names already use the plural ("Подтягивания"). Case
forms are left to aliases.

Alternative: edit distance over normalized names. Rejected for the first reason above.

### Messages

`INDEX` stands for this hint text: `Find the exercise's id in catalog/index.yaml. If it is not there,
describe the exercise in exercises with an id starting with my., e.g. my.towel_pullup.`

Every block issue is at `workouts[i].blocks[j].exercise`, with the value in the header.

| Case | Severity | Message | Hint |
|---|---|---|---|
| Name with a match | error | `The exercise needs an id, not a name.` | `Write exercise: pullup.wide.` |
| Lowercase form is an id | error | `Exercise ids are lowercase.` | `Write exercise: pullup.wide.` |
| Undescribed own id | error | `This own exercise is not described in exercises.` | `Did you mean my.towel_pullup?`, or `Add an entry with this id and the exercise's name to exercises, e.g. {id: my.box_jump, names: {en: <the exercise's name>}}` with the value as the id, or, when the value is not in the id form, `ADD_ENTRY` |
| Unknown id | error | `No exercise in the catalog has this id.` | `Did you mean my.towel_pullup?`, `Did you mean pullup.wide?`, or `INDEX`, in the order of the previous section |
| Name without a match | error | `The exercise needs an id, not a name, and no exercise has this name.` | `INDEX` |
| Deprecated id | warning | `This exercise is deprecated and replaced by pullup.wide.` | `Write exercise: pullup.wide.` |
| Deprecated id whose first `replaced_by` names nothing | warning | `This exercise is deprecated.` | `Choose another exercise: its replaced_by names no exercise.` |
| Deprecated id whose `replaced_by` is missing or not a string | warning | `This exercise is deprecated.` | `Choose another exercise: it has no replaced_by naming the one that replaces it.` |
| Deprecated id whose `replaced_by` names itself | warning | `This exercise is deprecated.` | `Choose another exercise: its replaced_by names the exercise itself.` |

The undescribed-own hint says "add an entry" rather than showing a whole `exercises:` line. A program
that already has `exercises` would otherwise get a second `exercises:` key, which is a YAML error. The
angle brackets mark the name as a placeholder that an agent replaces.

The value goes into the example only when it is in the id form. Copying `my.Box-Jump` or
`my.подтягивания` into the example would give the new entry an id error in the next round, and the block
another error once the entry's id is fixed. For such a value the hint is `ADD_ENTRY`: `Add an entry to
exercises with an id of lowercase Latin letters, digits, _ and dots, starting with my., and the
exercise's name, and write the same id here, e.g. {id: my.towel_pullup, names: {en: <the exercise's
name>}}`.

An own exercise entry at `exercises[i]` can get these:

| Case | Path | Severity | Message | Hint |
|---|---|---|---|---|
| Not in the id form | `.id` | error | `An exercise id is lowercase Latin letters, digits, _ and dots, starting with a letter.` | `Own exercise ids start with my., e.g. id: my.towel_pullup` |
| No `my.`, not a catalog id | `.id` | error | `An own exercise's id starts with my.` | `Write id: my.towel_pullup, and use that id in the blocks.` |
| A catalog id | `.id` | error | `This is a catalog exercise: changing catalog entries in a program is not supported yet.` | `Remove this entry and write exercise: pullup.wide in the blocks, or give your own variant an id starting with my.` |
| Repeated id | `.id` | error | `exercises[0] already has this id.` | `Give each exercise its own id.` |
| Name like a catalog exercise | `.names.<code>` or `.aliases[k]` | warning | `The catalog has this exercise: pullup.wide.` | `If it is the same exercise, remove this entry and write exercise: pullup.wide. Otherwise give it a name that tells it apart.` |

The like-catalog warning goes at the entry's first match. Names are checked in key order, then aliases.

Key and replacement problems, in either scope:

| Case | Path | Severity | Message | Hint |
|---|---|---|---|---|
| Unknown muscle key | `.muscles.primary[k]` or `.secondary[k]` | error | `Unknown muscle key.` | `Did you mean lats?`, or `Muscle keys (catalog/muscles.yaml): ` and every key in dictionary order, then `.` |
| Unknown equipment key | `.equipment[k]` or `load.implement` | error | `Unknown equipment key.` | `Did you mean dumbbells?`, or `Equipment keys (catalog/equipment.yaml): ` and every key, then `.` |
| `deprecated` without `replaced_by` | the entry | error | `The entry has deprecated without replaced_by.` | `Add replaced_by with the id of the exercise that replaces this one.` |
| `replaced_by` without `deprecated` | the entry | error | `The entry has replaced_by without deprecated: true.` | `Add deprecated: true, or remove replaced_by.` |
| `replaced_by` names nothing | `.replaced_by` | error | `No exercise has this id.` (catalog scope: `No catalog exercise has this id.`) | `Did you mean pullup.wide?`, or the `replaced_by` description |
| Cycle | the entry | error | `The replacements form a cycle: my.a, my.b, my.a.` | `End the chain at an exercise that is not deprecated.` |

A cycle is reported at each entry on it. An entry whose chain only leads into a cycle gets no error of
its own.

The deprecated warning follows `replaced_by` while it names an existing exercise, and stops at:
- the first exercise that is not deprecated;
- the last existing one;
- on a cycle, the last id before one repeats, since the cycle error is already in the report: a block
  using `my.a`, with `my.a` and `my.b` replacing each other, gets `my.b`.

It never names a missing id, nor the block's own id. When the chain gives no other exercise, it uses one
of the rows above without an id.

Catalog scope only, with the file's path in the report header:

| Case | Path | Message | Hint |
|---|---|---|---|
| Not in the id form | `id` | `An exercise id is lowercase Latin letters, digits, _ and dots, starting with a letter.` | `Catalog ids name the movement, then a variant after a dot, e.g. id: row.dumbbell` |
| Id starts with `my.` | `id` | `my. ids are for own exercises in programs, not for the catalog.` | `Remove my. from the id and from the file name.` |
| File name differs | `id` | `The file is named pullup.yaml, but the id is pullup.wide.` | `Name the file pullup.wide.yaml, or change the id.` |
| Missing name | `names.en` or `names.ru` | `A catalog entry needs a name in ru.` | the `names` description |
| Missing muscles | `muscles` | `A catalog entry needs muscles.` | the `muscles` description |
| Missing equipment | `equipment` | `A catalog entry needs equipment.` | `List what the exercise needs, or write equipment: [] when it needs nothing.` |
| Group key | `muscles.primary[k]` | `This is a muscle group: a catalog entry names the muscles themselves.` | `Write one of its muscles: deltoids, rotator_cuff.` |
| Unknown muscle key | `muscles.primary[k]` | `Unknown muscle key.` | as in a program, but the closest match and the key list leave out groups |
| Name or alias taken | `names.<code>` or `aliases[k]` | `The catalog entry pullup already has a matching name.` | `Give each catalog exercise its own names. Keep a shared name as an alias of one entry only.` |

### Interpreter changes

- **`minProperties`** joins `KEYWORDS`. A mapping with fewer fields than the minimum gets `Expected at
  least 1 field.`, or `fields` above 1, with the description as the hint. It counts every key, `x-`
  fields included, as JSON Schema does. So `names: {x-note: draft}` passes with no name in it, which no
  one writes on purpose.
- **Hint for an unknown field.** In a mapping with no `properties`, the hint for an unknown field is
  the mapping's description instead of an empty "Allowed fields here" list. `names` is such a mapping:
  its fields are language codes matched by `patternProperties`.

### Schema fields

Top level, between `language` and `workouts`: `exercises`, a list of entries, with no `minItems`. An
empty list is harmless.

Entry (`exercises.items`): `required: [id, names]`, closed with `x-`. Its fields:
- `names`: `minProperties: 1`, `patternProperties` `^[a-z]{2}$` (string) and `^x-`, closed;
- `aliases`: a list of strings;
- `equipment`: a list of strings;
- `muscles`: a closed mapping with `required: [primary]`. `primary` is a list of strings with
  `minItems: 1`, and `secondary` is a list of strings;
- `deprecated`: a boolean with `enum: [true]`;
- `replaced_by`: a string.

Load: `implement`, a string.

Descriptions, new or changed. Like every message, they stay ASCII: as `format-core` notes, agents on
Windows often read tool output through a non-UTF-8 code page. That is why the `names` example uses
German rather than Russian.

| Field | Description |
|---|---|
| `exercises` | `The program's own exercises, for those the catalog does not have: a list of entries, each with an id starting with my. and names. Example: exercises: [{id: my.towel_pullup, names: {en: Towel pull-up}}]` |
| entry | `An exercise entry: a mapping with id and names, and optionally aliases, equipment, muscles, deprecated and replaced_by. Example: {id: my.towel_pullup, names: {en: Towel pull-up}, equipment: [pullup_bar], muscles: {primary: [lats], secondary: [forearms]}}` |
| `id` | `The exercise's id: lowercase Latin letters, digits, _ and dots. An own exercise's id starts with my. Example: id: my.towel_pullup` |
| `names` | `The exercise's names by language: a mapping from a two-letter language code to the name, with at least one name. Example: names: {en: Towel pull-up, de: Handtuch-Klimmzug}` |
| name in a language | `The exercise's name in this language, a string. Example: en: Towel pull-up` |
| `aliases` | `Other names of the exercise, a list of strings in any language. Example: aliases: [towel pull-ups]` |
| alias | `Another name of the exercise, a string. Example: towel pull-ups` |
| `equipment` | `What the exercise needs: a list of keys from catalog/equipment.yaml, or [] when it needs nothing. Example: equipment: [pullup_bar]` |
| equipment item | `An equipment key from catalog/equipment.yaml, a string. Example: pullup_bar` |
| `muscles` | `The muscles the exercise works: primary for those that do the work, secondary for those that help, each a list of keys from catalog/muscles.yaml. Example: muscles: {primary: [lats], secondary: [biceps]}` |
| `primary` | `The muscles that do the work: a list of at least one key from catalog/muscles.yaml. Example: primary: [lats]` |
| `secondary` | `The muscles that help: a list of keys from catalog/muscles.yaml. Example: secondary: [biceps]` |
| muscle item | `A muscle key from catalog/muscles.yaml, a string. Example: lats` |
| `deprecated` | `deprecated: true marks an exercise that another one replaces, named in replaced_by. Example: deprecated: true` |
| `replaced_by` | `The id of the exercise that replaces this one, together with deprecated: true. Example: replaced_by: pullup.wide` |
| `exercise` | `The exercise's id: a catalog id from catalog/index.yaml, or the id of an own exercise described in exercises, starting with my. Example: exercise: pullup.wide` |
| `load` | `The weight of each set: kg or lb for an external weight, or bw: true for body weight, with add_kg or add_lb for extra weight, and optionally implement for what carries it. Examples: load: {kg: 18}, load: {bw: true, add_kg: 5}` |
| `implement` | `What carries the weight: a key from catalog/equipment.yaml, such as dumbbells or backpack. The weight is that of one implement. Example: implement: dumbbells` |

### Catalog files

**Exercise file** (`catalog/exercises/pullup.wide.yaml`): the entry's fields at the top level, in the
order `id`, `names`, `aliases`, `equipment`, `muscles`, with `names` and the lists in flow style.

**`muscles.yaml`**: the group, muscle and bundle mappings with `id`, `names` and `children`. The eight
groups come from `SPEC.md` §8.6. The muscles cover what the 30 entries need; a few, such as
`transverse_abs`, no entry uses yet and stay for later entries:

| Group | Muscles (bundles in parentheses) |
|---|---|
| `back` | `lats`, `traps`, `rhomboids`, `erector_spinae` |
| `chest` | `pecs`, `serratus` |
| `shoulders` | `deltoids` (`delt_front`, `delt_side`, `delt_rear`), `rotator_cuff` |
| `arms` | `biceps`, `triceps`, `brachialis`, `forearms` |
| `core` | `abs`, `obliques`, `transverse_abs` |
| `glutes` | `glute_max`, `glute_med` |
| `legs` | `quads`, `hamstrings`, `adductors`, `hip_flexors` |
| `calves` | `gastrocnemius`, `soleus` |

**`equipment.yaml`**: `dumbbells`, `kettlebell`, `barbell`, `bench`, `bench.adjustable`, `squat_rack`,
`pullup_bar`, `dip_bars`, `box`, `backpack`, `vest`, `dip_belt`.

**The 30 exercises.** Equipment and primary muscles are listed below; the rest is written during
implementation:

| Id | `en` | `ru` | `equipment` | `primary` |
|---|---|---|---|---|
| `pushup` | Push-up | Отжимания | `[]` | `pecs`, `triceps` |
| `pullup` | Pull-up | Подтягивания | `[pullup_bar]` | `lats` |
| `pullup.wide` | Wide-grip pull-up | Подтягивания широким хватом | `[pullup_bar]` | `lats` |
| `chinup` | Chin-up | Подтягивания обратным хватом | `[pullup_bar]` | `lats`, `biceps` |
| `dip` | Dip | Отжимания на брусьях | `[dip_bars]` | `pecs`, `triceps` |
| `squat.air` | Air squat | Приседания | `[]` | `quads`, `glute_max` |
| `lunge` | Lunge | Выпады | `[]` | `quads`, `glute_max` |
| `split_squat.bulgarian` | Bulgarian split squat | Болгарские сплит-приседания | `[bench]` | `quads`, `glute_max` |
| `glute_bridge` | Glute bridge | Ягодичный мост | `[]` | `glute_max` |
| `plank` | Plank | Планка | `[]` | `abs`, `transverse_abs` |
| `plank.side` | Side plank | Боковая планка | `[]` | `obliques` |
| `hanging_leg_raise` | Hanging leg raise | Подъём ног в висе | `[pullup_bar]` | `abs`, `hip_flexors` |
| `crunch` | Crunch | Скручивания | `[]` | `abs` |
| `burpee` | Burpee | Бёрпи | `[]` | `quads`, `pecs` |
| `calf_raise` | Calf raise | Подъём на носки | `[]` | `gastrocnemius` |
| `step_up` | Step-up | Зашагивания на тумбу | `[box]` | `quads`, `glute_max` |
| `row.dumbbell` | Dumbbell row | Тяга гантели в наклоне | `[dumbbells, bench]` | `lats`, `rhomboids` |
| `bench_press.dumbbell` | Dumbbell bench press | Жим гантелей лёжа | `[dumbbells, bench]` | `pecs`, `triceps` |
| `overhead_press.dumbbell` | Dumbbell overhead press | Жим гантелей стоя | `[dumbbells]` | `delt_front`, `triceps` |
| `lateral_raise.dumbbell` | Dumbbell lateral raise | Махи гантелями в стороны | `[dumbbells]` | `delt_side` |
| `curl.dumbbell` | Dumbbell curl | Сгибания рук с гантелями | `[dumbbells]` | `biceps` |
| `triceps_extension.dumbbell` | Overhead dumbbell triceps extension | Французский жим гантели из-за головы | `[dumbbells]` | `triceps` |
| `squat.goblet` | Goblet squat | Гоблет-приседания | `[dumbbells]` | `quads`, `glute_max` |
| `romanian_deadlift.dumbbell` | Dumbbell Romanian deadlift | Румынская тяга с гантелями | `[dumbbells]` | `hamstrings`, `glute_max` |
| `carry.suitcase` | Suitcase carry | Прогулка с гантелью в одной руке | `[dumbbells]` | `obliques`, `forearms` |
| `kettlebell_swing` | Kettlebell swing | Махи гирей | `[kettlebell]` | `glute_max`, `hamstrings` |
| `squat.barbell` | Barbell back squat | Приседания со штангой | `[barbell, squat_rack]` | `quads`, `glute_max` |
| `bench_press.barbell` | Barbell bench press | Жим штанги лёжа | `[barbell, bench, squat_rack]` | `pecs`, `triceps` |
| `deadlift.barbell` | Barbell deadlift | Становая тяга | `[barbell]` | `glute_max`, `hamstrings`, `erector_spinae` |
| `overhead_press.barbell` | Barbell overhead press | Жим штанги стоя | `[barbell, squat_rack]` | `delt_front`, `triceps` |

The list covers:
- the exercises of the `SPEC.md` §4.3 program: `pullup.wide`, `dip`, `split_squat.bulgarian` and
  `carry.suitcase`. The carry's `steps` comes with `set-details`, but its entry is needed now;
- Cindy;
- the main 5/3/1 lifts;
- common home exercises with dumbbells.

Aliases cover the forms a user is likely to write, such as `Отжимания от пола` and `Push-ups`.
Plurals do not need aliases.

**Cross-check against ExRx.** The entries take ExRx's Target muscles as `primary` and its Synergists
as `secondary`. Where ExRx lists an exercise under several targets (squats, lunges, the step-up, dips,
the deadlift, the Romanian deadlift), `primary` holds them all. This departs from the table above in
eight entries:
- `pushup`, `bench_press.dumbbell`, `bench_press.barbell`: `primary` is `pecs`; `triceps` is
  secondary;
- `overhead_press.dumbbell`, `overhead_press.barbell`: `primary` is `delt_front`; `triceps` is
  secondary;
- `deadlift.barbell`: `primary` is `glute_max` and `erector_spinae`; `hamstrings` is secondary;
- `chinup`: `primary` is `lats`; `biceps` stays secondary, although ExRx lists it as a dynamic
  stabilizer;
- `plank`: `primary` is `abs`, which ExRx lists alone.

`squat.goblet` and `glute_bridge` were checked against the closest ExRx entries (the dumbbell front
squat; the suspended hip bridge and the barbell hip thrust). ExRx gives no muscles for `burpee`,
`carry.suitcase` and `kettlebell_swing`.

**`catalog/LICENSE`**: a short notice. It says the files under `catalog/` are licensed under CC BY-SA
4.0, gives the legal code URL, and says the code elsewhere is MIT. Section 3(a)(1)(C) of the license
allows a URI in place of the full text.

### Index

`buildIndex(catalog)` in `core/catalog.mjs` returns the text of `catalog/index.yaml`:
- two comment lines: `# Generated from catalog/exercises/ by node scripts/build-catalog-index.mjs.`
  and `# Do not edit: change the entries and rebuild.`;
- then one list item per entry that is not deprecated, in id order, with `id`, `names` (only the
  fields under language codes), `aliases` (only when the list is not empty) and `equipment`. `names`
  and the lists are in flow style;
- the text is built as a `vendor/yaml` `Document` whose `names` and lists are flow collections, and
  written with `lineWidth: 0` and `flowCollectionPadding: false`. The library's defaults would break a
  long line at 80 characters and write `{ en: ... }`. Quoting is left to the library.

`scripts/build-catalog-index.mjs` writes the file (`npm run catalog:index`). It needs no `npm ci`: it
uses only `tools/catalog.mjs` and `core/`.

The catalog test compares `buildIndex` with the file, ignoring `\r`. On a mismatch it fails with
`catalog/index.yaml is out of date: run node scripts/build-catalog-index.mjs.`

The validator does not read the index. A stale index only misleads a chat for one round, and the error
it gets back still comes from the real entries.

### Id stability: deferred

Until the first public release, ids and dictionary keys may change, for example when the catalog is
reviewed against professional sources. Only the author has programs and logs that use them, and a
renamed id there is fixed by hand. When an old id is worth keeping, `deprecated` and `replaced_by`
already work.

The check itself was designed in exploration and is kept in `ROADMAP.md`:
- CI compares the ids with the base commit, with no ledger file;
- the step runs before the first release.

### `tools/validate.mjs`

It calls `loadCatalog` once, before the first file. On `{ error }` it prints the error to standard error
and exits with code 1 without checking any file. The error is two lines:
- `Cannot read the catalog: <message>`;
- `The catalog comes with the project: restore catalog/ with git checkout -- catalog, or download the
  project again.`

**Testing it.**
- **In-process.** `schema/catalog.test.mjs` tests `loadCatalog` on a broken catalog written to a
  temporary directory, including the exact two lines.
- **End to end.** `tools/validate.test.mjs` copies `tools/`, `core/`, `vendor/`,
  `schema/repscript.schema.json` and `catalog/` into a temporary directory, breaks one entry there and
  runs the copied tool.
- **Coverage.** Node's coverage drops files it can no longer read once the temporary copy is deleted,
  so the real `tools/validate.mjs` never shows its print-and-exit lines as run. Those few lines carry
  `/* node:coverage ignore next N */` with a comment that points to the end-to-end test. This is the
  only coverage exception, and it is outside `core/`.

The product code gets no test hook.

### Fixtures

**The fixture runner** loads `schema/tests/catalog/` once and passes it to every `validate()` call. The
real catalog grows, and its growth would change suggestions and key lists in pinned reports. The test
catalog changes only with the fixtures.

`schema/tests/catalog/` holds:
- **exercises:** `pushup`, `plank`, `dip`, `pullup`, `pullup.wide`, `row.dumbbell`,
  `bench_press.dumbbell`, `squat.goblet`, `lateral_raise.dumbbell`, `kettlebell_swing`, `walk`;
- **a deprecated entry:** `pullup.wide_grip`, replaced by `pullup.wide`. It has the same names as
  `pullup.wide`, which pins that uniqueness skips deprecated entries;
- **muscles:** `back` (`lats`), `chest` (`pecs`), `shoulders` (`deltoids` with `delt_front` and
  `delt_side`), `arms` (`biceps`, `triceps`), `core` (`abs`), `legs` (`quads`);
- **equipment:** `dumbbells`, `kettlebell`, `bench`, `bench.adjustable`, `pullup_bar`, `dip_bars`,
  `backpack`.

The catalog test checks both catalogs, so the test catalog follows the same rules.

**Renames in existing fixtures.** These do not follow the id convention:
- `dumbbell.press` becomes `bench_press.dumbbell`;
- `dumbbell.row` and `row` become `row.dumbbell`;
- `goblet.squat` becomes `squat.goblet`;
- `lateral.raise` becomes `lateral_raise.dumbbell`;
- `kettlebell.swing` becomes `kettlebell_swing`.

No expected report prints these values. Lines do not move, since each rename stays on its line.

**Existing reports that change:**
- `missing-required`: the hint with the `exercise` description;
- `block-rules`: the hint with the `load` description;
- `unknown-field` and `several-issues`: the top-level allowed fields gain `exercises`.

The other reports stay as they are. `tools/validate.test.mjs` runs `minimal` and `unknown-field`
against the real catalog. Both use only `pushup` and `pullup`, which both catalogs have, so their
`errors:` counts stay.

**New fixtures:**

| Case | Content | Expected |
|---|---|---|
| `own-exercises` | a valid program: an own exercise with names only, one with a group key (`back`), one with `equipment`, `muscles` and `aliases`, all used in blocks; `load: {bw: true, add_kg: 5, implement: backpack}`; `load: {kg: 18, implement: dumbbells}` | only the draft warning |
| `exercise-names` | own `my.ring_row` named `Ring row`; blocks with `Wide-grip pull-ups`, `подтягивания широким хватом`, `PUSH UPS`, `pushups`, `Ring row`, `Pullup.Wide`, `Towel pull-ups` | seven errors: five name errors with `Write exercise: ...` (`pullup.wide` twice, `pushup` twice, `my.ring_row`), the capitals error with `Write exercise: pullup.wide.`, one `INDEX` hint |
| `exercise-ids` | own `my.towel_pullup` named `Pull-up on a towel`; blocks with `pullup.wdie`, `pullup.wide.weighted`, `pushup.wide`, `zercher_squat`, `towel_pullup`, `my.towel_pulup`, `my.box_jump`, `pullup.wide_grip` | seven errors: `Did you mean pullup.wide?` twice, `Did you mean pushup?`, `INDEX`, `Did you mean my.towel_pullup?` twice, the add-an-entry hint for `my.box_jump`; one deprecated warning naming `pullup.wide` |
| `own-exercise-ids` | own ids `My.Towel-Pullup`, `ring_row`, `pullup.wide` (named `My wide pull-up`, not a catalog name), and `my.towel_pullup` twice; blocks use only `pushup` | one error each, at each `id`, and no warning; `ring_row` gets `Write id: my.ring_row, and use that id in the blocks.` |
| `own-exercise-fields` | `names: {}`, `names: {english: ...}`, muscles `lat` and `wings`, equipment `dumbells`, `implement: dumbells`, and an own exercise named `Wide-grip pull-up` | minimum and pattern-hint errors, `Did you mean lats?`, the muscle key list, two `Did you mean dumbbells?`, one like-catalog warning |
| `own-exercise-replacements` | `my.pullup_towel` replaced by `my.towel_pullup` and used in a block; `deprecated` alone; `replaced_by` alone; `my.old` with `deprecated: true, replaced_by: my.nothing`, used in a block; `my.a` and `my.b` replacing each other | two deprecated warnings, naming `my.towel_pullup` and naming no id for `my.old`; three errors at the entries or at `replaced_by`; one cycle error at each of `my.a` and `my.b` |
| `exercise-wrong-types` | `exercises: [my.x]` as a string item; entries with `names: [Pull-up]`, `aliases: x`, `equipment: pullup_bar`, `muscles: {primary: lats}`, `deprecated: true, replaced_by: 5`, `id: 5`, `names: {en: 5}`, `aliases: [5]`, `equipment: [5]`, `muscles: [lats]`, `secondary: lats`, `deprecated: yes`, `deprecated: false`; blocks with `exercise: 5` and `load: {kg: 18, implement: 5}` | one schema error per value and nothing else: no rule error comes from a value of the wrong type, and `deprecated: false` needs no `replaced_by` |
| `exercise-edge-cases` | an `x-` field and an `english` field under `names`; a name `-`; own ids `My.Plank_Row` and `Ring_Row`; `my.a` and `my.b` replacing each other, `my.c` replacing itself, `my.d` deprecated alone; `my.e` repeated after `my.f` replaced by it; blocks with `Ring rows`, `"?"`, `""`, `my.plank_row`, `my.Box-Jump`, `my.a`, `my.c`, `my.d` | no name from the `x-` field, no like-catalog warning from `english`, the index hint for `"?"` and `""`, no invalid own id in any hint, `ADD_ENTRY` for `my.Box-Jump`, a cycle error at `my.a`, `my.b` and `my.c` but not at the repeated `my.e`, and the three deprecated warnings |

**`schema/catalog.test.mjs`**, outside the fixtures:
- every file of both catalogs passes `validateEntry` with no issues. On failure the test prints the
  formatted report under the file's path;
- both dictionaries of both catalogs follow their requirements;
- the index is up to date;
- `validateEntry` on inline sources pins the catalog-scope messages: `my.` id, file name, missing
  `ru`, missing `muscles`, missing `equipment`, group key, taken alias, `replaced_by` outside the
  catalog;
- `normalizeName` on the spec's examples;
- `buildCatalog` and its errors: broken YAML, an entry without a string `id`, a dictionary that is not a
  list, a dictionary item without a string `id`, `children` that is not a list. One throw helper keeps
  every error line reachable;
- `buildCatalog` sorts by id: `pullup` before `pullup.wide` before `pullup.wide_grip`;
- `readCatalogFiles` returns `/` paths relative to the project root;
- `loadCatalog` on a broken catalog in a temporary directory: the two error lines;
- `equipmentSatisfies` (`bench.adjustable` satisfies `bench`, not the reverse) and `programEquipment`
  on a small program;
- `buildIndex` on a small inline catalog, pinning the layout, with one name longer than 80 characters
  kept on its line, an `x-` field under `names` and an empty `aliases` left out;
- `loadCatalog` on a file in Windows-1251, one in UTF-16 and a `.yml` file in `exercises/`;
- `validateEntry` on an `x-` field under `names`, an unknown field in the entry and in `muscles`,
  `muscles` without `primary` and with `primary: []`, and ids that are not in the id form;
- a catalog of inline entries where two share a name or an alias, and two replace each other.

## Risks / Trade-offs

- [Every program check now needs the catalog, and any caller that builds `validate()` input has to
  load it] → `tools/catalog.mjs` does it in one call. The player gets the same shape from its server.
- [Exact matching misses forms nobody listed: "широкие подтягивания", "pullups wide"] → The
  unknown-name hint sends the agent to the index, which lists aliases. A missing alias is a one-line
  pull request.
- [Plural folding can join two different words] → It is applied to both sides alike, so it can only
  merge names that differ by a final `s` or plural ending. Unique catalog names catch a merge inside the
  catalog.
- [Trying names first means an id-shaped typo that happens to equal a normalized name gets the name
  error] → The hint is the same `Write exercise: <id>.`, so the agent's fix is right either way.
- [One coverage exception in `tools/validate.mjs`] → It covers only the print-and-exit lines. The text
  they print is tested in-process, and the behavior end to end on a copy.
- [A stale index] → The test fails with the command that fixes it, and the validator never depends on
  the index.
- [Nothing stops an id from being removed or renamed before the release] → Only the author's own
  programs and logs depend on ids until then. The validator reports a stale id in a program with a
  suggestion. The CI check is a release task in `ROADMAP.md`.
- [The 30 entries are drafts: their muscles and equipment are not checked against professional
  sources] → Each is cross-checked against ExRx while it is written. The review against professional
  sources is `evidence-base`, and editing an entry's data never needs a history.
- [The muscle and equipment key lists in hints grow with the dictionaries] → Around 35 and 12 keys
  today. Aliases and shorter hints can come later if the lists get long.
- [Muscle assignments in 30 entries are judgment calls] → They go through review like any other entry.
  `references` and `status: reviewed` come with `evidence-base`.

## Migration Plan

None. The format is still version `0`. The only program files are the fixtures, which this change
updates.

## Open Questions

- The exact 30 exercises. The table above is a starting set. Swapping entries for the ones the author
  trains with changes no spec, as long as `pushup` and `pullup` stay for the CLI tests.
