# Spec Delta

## Purpose

Defines the shared exercise catalog that programs reference by id: its files, the exercise entry
format, the muscle and equipment dictionaries, how one exercise replaces another, and the generated index
that chats read.

## ADDED Requirements

### Requirement: Catalog files
The catalog SHALL be the project's `catalog/` directory, holding one file per exercise at
`catalog/exercises/<id>.yaml`, the muscle dictionary `catalog/muscles.yaml`, the equipment dictionary
`catalog/equipment.yaml`, and the generated index `catalog/index.yaml`. Each SHALL be UTF-8 text
holding one YAML 1.2 document read with the core schema, as a program file is.

#### Scenario: Entry file
- **WHEN** the catalog has an exercise with the id `pullup.wide`
- **THEN** its entry is the file `catalog/exercises/pullup.wide.yaml`

#### Scenario: File not in UTF-8
- **WHEN** a catalog file is saved as Windows-1251
- **THEN** the catalog cannot be loaded, and the error names the file

#### Scenario: Other file among the entries
- **WHEN** `catalog/exercises/` holds a file `hang.yml`
- **THEN** the catalog cannot be loaded, and the error names the file

### Requirement: Catalog license
The catalog files SHALL be licensed under CC BY-SA 4.0, separately from the MIT-licensed code.
`catalog/LICENSE` SHALL state this and link to the license text.

#### Scenario: License notice
- **WHEN** someone copies `catalog/`
- **THEN** `catalog/LICENSE` tells them the files are under CC BY-SA 4.0 and where its text is

### Requirement: Exercise ids
An exercise id SHALL be a string of lowercase Latin letters, digits, `_` and dots that starts with a
letter, with no dot at either end and no two dots in a row. Ids starting with `my.` SHALL be reserved
for own exercises in programs. A dot SHALL be only part of the name: `pullup.wide` does not need an
exercise `pullup`.

#### Scenario: Valid ids
- **WHEN** an entry has the id `pullup.wide`, `split_squat.bulgarian` or `my.towel_pullup`
- **THEN** the id has a valid form

#### Scenario: Invalid ids
- **WHEN** an entry has the id `Pull-Up`, `pull-up`, `1pullup` or `pullup.`
- **THEN** the id does not have a valid form

#### Scenario: Variant without a base exercise
- **WHEN** the catalog has `pullup.wide` and no `pullup`
- **THEN** `pullup.wide` is still a valid catalog id

### Requirement: Catalog id convention
A catalog id SHALL name the movement first, then a variant after a dot when the technique or the
working muscles change: grip, stance or implement, as in `row.dumbbell`. Weight and added load SHALL
NOT be part of an id, since `load` gives them. Review of each new entry checks this convention.

#### Scenario: Added load is not a variant
- **WHEN** a contributor proposes `pullup.weighted`
- **THEN** review rejects it: weighted pull-ups are `pullup` with `load: {bw: true, add_kg: 10}`

### Requirement: Exercise entry
An exercise entry SHALL be a mapping with the required fields `id` and `names`, and the optional fields
`aliases`, `equipment`, `muscles`, `deprecated` and `replaced_by`. It SHALL hold no other fields
except extension fields starting with `x-`. Catalog files and a program's own exercises SHALL use this
same format.

#### Scenario: Smallest entry
- **WHEN** an entry is `{id: my.towel_pullup, names: {en: Towel pull-up}}`
- **THEN** it is a valid exercise entry

#### Scenario: Unknown field
- **WHEN** an entry has a field `cues`
- **THEN** the entry is invalid, because `cues` is not defined yet

### Requirement: Exercise names
`names` SHALL be a mapping from a two-letter lowercase language code to the exercise's name in that
language, with at least one name. Its fields starting with `x-` SHALL be extension fields, not names.
`aliases` SHALL be a list of other names of the exercise, in any language.

#### Scenario: Names in two languages
- **WHEN** an entry has `names: {en: Wide-grip pull-up, ru: Подтягивания широким хватом}`
- **THEN** the names are accepted

#### Scenario: No names
- **WHEN** an entry has `names: {}`
- **THEN** the entry is invalid

#### Scenario: Language name instead of a code
- **WHEN** an entry has `names: {english: Pull-up}`
- **THEN** the entry is invalid

#### Scenario: Extension field under names
- **WHEN** an entry has `names: {en: Dead hang, x-note: Pull-up}`
- **THEN** the entry's only name is `Dead hang`

### Requirement: Exercise equipment
`equipment` SHALL be a list of keys of the equipment dictionary: everything the exercise needs. An
empty list SHALL mean that the exercise needs no equipment. A missing `equipment` SHALL mean that the
equipment is unknown.

#### Scenario: No equipment needed
- **WHEN** the entry for push-ups has `equipment: []`
- **THEN** the exercise needs no equipment

#### Scenario: Equipment unknown
- **WHEN** an own exercise has no `equipment` field
- **THEN** the entry is valid and its equipment is unknown

### Requirement: Exercise muscles
`muscles` SHALL be a mapping with `primary`, a list of at least one key of the muscle dictionary for
the muscles that do the work, and optionally `secondary`, a list of such keys for the muscles that
help.

#### Scenario: Primary and secondary muscles
- **WHEN** an entry has `muscles: {primary: [quads, glute_max], secondary: [adductors]}`
- **THEN** the muscles are accepted

#### Scenario: No primary muscles
- **WHEN** an entry has `muscles: {secondary: [biceps]}`
- **THEN** the entry is invalid

### Requirement: Muscle dictionary
`catalog/muscles.yaml` SHALL be a list of muscle groups. Each group, muscle and bundle SHALL be a
mapping with a key `id`, `names` in `en` and `ru`, and optionally `children`: a group's muscles, or a
muscle's bundles. Keys SHALL be lowercase Latin letters, digits and `_`, starting with a letter, and
unique across all levels.

#### Scenario: Group, muscle and bundle
- **WHEN** the group `shoulders` has the muscle `deltoids`, which has the bundle `delt_front`
- **THEN** `shoulders`, `deltoids` and `delt_front` are all muscle keys

#### Scenario: Fourth level
- **WHEN** a bundle has `children`
- **THEN** the dictionary is invalid

### Requirement: Equipment dictionary
`catalog/equipment.yaml` SHALL be a list of mappings, each with a key `id` in the exercise id form and
`names` in `en` and `ru`. Keys SHALL be unique. A key `X.Y` SHALL be a variant of `X` that satisfies
any need for `X`, and `X` SHALL then be in the dictionary.

#### Scenario: Variant
- **WHEN** an exercise needs `bench` and the user has `bench.adjustable`
- **THEN** the need is satisfied

#### Scenario: Variant without its base
- **WHEN** the dictionary has `bench.adjustable` and no `bench`
- **THEN** the dictionary is invalid

### Requirement: Catalog entry requirements
A catalog entry SHALL have `names` in `en` and in `ru`, `muscles`, and `equipment`. Its muscle keys
SHALL name muscles or bundles, not groups. Its id SHALL NOT start with `my.`, and its file SHALL be
named after its id.

#### Scenario: Missing Russian name
- **WHEN** a catalog entry has `names: {en: Push-up}`
- **THEN** the catalog check reports a missing name in `ru`

#### Scenario: Group key in a catalog entry
- **WHEN** a catalog entry has `muscles: {primary: [shoulders]}`
- **THEN** the catalog check reports that a group is not allowed and lists the group's muscles

#### Scenario: Missing equipment
- **WHEN** a catalog entry has no `equipment` field
- **THEN** the catalog check reports it, and says to write `equipment: []` when none is needed

#### Scenario: File named differently
- **WHEN** the file `catalog/exercises/pullup.yaml` holds `id: pullup.wide`
- **THEN** the catalog check reports that the file name and the id differ

### Requirement: Name matching
Two exercise names SHALL match when they are equal after normalization. Normalization SHALL apply
Unicode NFKC, lower the case, write `ё` as `е`, split the text into words at every character that is
not a letter or a digit, fold the English plural ending of each word, and join the words with nothing
between them. A name that normalizes to nothing SHALL match no name.

#### Scenario: Case, separators and plural
- **WHEN** a name `Wide-grip pull-ups` is compared with `Wide grip pullup`
- **THEN** they match

#### Scenario: Letter ё
- **WHEN** a name `Жим лёжа` is compared with `жим лежа`
- **THEN** they match

#### Scenario: Different words
- **WHEN** a name `Подтягивания широким хватом` is compared with `Широкие подтягивания`
- **THEN** they do not match

#### Scenario: Only punctuation
- **WHEN** a name `-` is compared with `?`
- **THEN** they do not match

### Requirement: English plural folding
In a word of Latin letters, normalization SHALL replace a final `ies` with `y`, drop the `es` of a final
`ches`, `shes`, `sses` or `xes`, and otherwise drop a final `s` when the word has more than two letters
and does not end in `ss`. Both sides of a comparison are folded alike, so a word that is not a plural,
such as `abs`, may lose its `s` without harm.

#### Scenario: Plural forms
- **WHEN** the words `flies`, `crunches`, `presses`, `raises`, `squats` and `ups` are normalized
- **THEN** they become `fly`, `crunch`, `press`, `raise`, `squat` and `up`

#### Scenario: Words kept as they are
- **WHEN** the words `press`, `glass` and `us` are normalized
- **THEN** they stay `press`, `glass` and `us`

### Requirement: Unique catalog names
No two catalog entries that are not deprecated SHALL have matching names, aliases, or a name of one that
matches an alias of the other. Deprecated entries SHALL be neither checked nor counted. Of two entries,
the one later in id order SHALL be reported.

#### Scenario: Shared alias
- **WHEN** two catalog entries both have the alias `подтягивания`
- **THEN** the catalog check reports the one later in id order and names the other

#### Scenario: Deprecated entry keeps its names
- **WHEN** the deprecated `pullup.wide_grip` has the same names as its replacement `pullup.wide`
- **THEN** the catalog check reports nothing

### Requirement: Replacements
`deprecated: true` and `replaced_by` SHALL appear together. `replaced_by` SHALL hold the id of an
existing exercise that replaces this one. Following `replaced_by` from any entry SHALL end at an entry
that is not deprecated. In the catalog, `replaced_by` SHALL name a catalog exercise.

#### Scenario: Renamed exercise
- **WHEN** `pullup.wide_grip` is replaced by `pullup.wide`
- **THEN** the old entry stays with `deprecated: true` and `replaced_by: pullup.wide`

#### Scenario: Deprecated without a replacement
- **WHEN** an entry has `deprecated: true` and no `replaced_by`
- **THEN** the entry is invalid

#### Scenario: Cycle
- **WHEN** `a` is replaced by `b` and `b` by `a`
- **THEN** the entries are invalid

### Requirement: Exercise index
`catalog/index.yaml` SHALL list, in id order (ids compared by code unit, so `pullup` comes before
`pullup.wide`), the `id`, `names`, `aliases` and `equipment` of each catalog entry that is not deprecated, after a comment saying that it is generated and how to rebuild
it. The project's tests SHALL fail when the index differs from what the generator writes. The validator
SHALL NOT read the index.

#### Scenario: Index out of date
- **WHEN** an entry is added to `catalog/exercises/` and the index is not rebuilt
- **THEN** the tests fail and say which command rebuilds the index

#### Scenario: Deprecated entry
- **WHEN** a catalog entry is deprecated
- **THEN** the index does not list it

### Requirement: Catalog checks
Running `node --test` with Node 22 or later and nothing installed SHALL check every catalog entry and
both dictionaries against these requirements. A problem in an entry SHALL be reported in the
validator's issue format, with the entry file's path and the problem's path, line and hint.

#### Scenario: Problem in an entry
- **WHEN** `catalog/exercises/pushup.yaml` has `muscles: {primary: [chest_mid]}` and `chest_mid` is
  not a muscle key
- **THEN** the test fails with an error at `muscles.primary[0]` and its line, in the validator's format
