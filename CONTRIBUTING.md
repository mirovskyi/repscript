# Contributing

## Adding an exercise to the catalog

Programs name exercises by id, and the ids come from the catalog in `catalog/`:

- `catalog/exercises/`: one file per exercise;
- `catalog/muscles.yaml`: the muscle keys;
- `catalog/equipment.yaml`: the equipment keys;
- `catalog/index.yaml`: a list of every exercise for chats, generated from the files.

Adding an exercise means adding one file and rebuilding the index. You can do it by hand or with an
agent (see [With an agent](#with-an-agent)).

### 1. Choose the id

Look in `catalog/index.yaml` first: the exercise may already be there under another name.

An id is lowercase Latin letters, digits and `_`, with dots between parts, starting with a letter:
`pullup`, `pullup.wide`, `split_squat.bulgarian`.

- Name the movement first. Add a variant after a dot when the technique or the working muscles change:
  grip, stance or implement, as in `row.dumbbell`.
- A variant does not need its base exercise: `pullup.wide` is valid without `pullup`.
- Never put weight or added load in the id. Weighted pull-ups are `pullup` with
  `load: {bw: true, add_kg: 10}` in the program.
- Ids starting with `my.` are reserved for a program's own exercises and are not allowed in the
  catalog.

### 2. Write the file

Name the file after the id, `catalog/exercises/<id>.yaml`, save it as UTF-8, and write the fields in
this order:

```yaml
id: pullup.wide
names: {en: Wide-grip pull-up, ru: Подтягивания широким хватом}
aliases: [Wide pull-up, Широкие подтягивания]
equipment: [pullup_bar]
muscles:
  primary: [lats]
  secondary: [biceps, brachialis, forearms, delt_rear, rotator_cuff, rhomboids, traps]
```

- **`names`**: required in `en` and `ru`. Other two-letter language codes are welcome.
- **`aliases`**: other names a user is likely to write, in any language. Leave out forms that differ only
  in letter case, separators (`pull-up`, `pull up`, `pullup`), `ё` or an English plural: these already
  match. Russian case forms and other word orders need aliases. No name or alias may match a name or
  alias of another catalog entry that is not deprecated.
- **`equipment`**: keys from `catalog/equipment.yaml` for everything the exercise needs. Write
  `equipment: []` when it needs nothing; the field is required. Added load, such as a backpack or a
  vest, is not the exercise's equipment: a program names it in `load.implement`.
- **`muscles`**: keys from `catalog/muscles.yaml`. `primary` lists the muscles that do the work and
  `secondary` the ones that help. Name muscles or bundles (`lats`, `delt_rear`), never a group
  (`back`, `shoulders`).

If the exercise needs a muscle or an equipment key that the dictionary lacks, add the key in the same
pull request, with names in `en` and `ru`:

- A muscle key is lowercase Latin letters, digits and `_`, unique across the file, at most three levels
  deep (group, muscle, bundle).
- An equipment key has the id form. A key `X.Y` is a variant that satisfies any need for `X`, as
  `bench.adjustable` does for `bench`, so `X` must be in the dictionary too.

### 3. Check the muscles

Catalog entries are drafts until the catalog is reviewed against professional sources. Until then,
check each entry's muscles against [ExRx](https://exrx.net/Lists/Directory): its Target muscles go in
`primary` and its Synergists in `secondary`. Take only which muscles work, and copy no text from ExRx.

### 4. Rebuild the index and run the tests

With Node 22 or later and nothing installed, from the project root:

```sh
node scripts/build-catalog-index.mjs
node --test
```

`npm run catalog:index` does the same as the first command.

The tests check every entry and both dictionaries. They also fail when `catalog/index.yaml` is out of
date, and when a file in `catalog/` is not UTF-8 or a file in `catalog/exercises/` does not end in
`.yaml`. A problem in an entry is reported in the validator's format: the entry's file, the field's
path, its line and a hint. For example:

```text
catalog/exercises/pushup.yaml
error: muscles.primary[0] (line 6) = "chest_mid"
  Unknown muscle key.
  Hint: Muscle keys (catalog/muscles.yaml): lats, traps, ...
```

Commit the entry and `catalog/index.yaml` together.

### With an agent

Point the agent at this file and name the exercise, for example: "Add a catalog entry for the
Copenhagen plank, following CONTRIBUTING.md." The agent writes the file, runs the two commands and
fixes what the tests report. Before you open the pull request, check its muscles against ExRx
yourself.

## Changing or removing an exercise

Until the first public release (`repscript: 1`), catalog ids and dictionary keys may still change, for
example after the catalog is reviewed against professional sources.

From the first release on, programs and logs depend on them, so they are never removed or renamed:

- An exercise that another one replaces keeps its file, with `deprecated: true` and the new id in
  `replaced_by`. Programs that still use it get a warning naming the replacement, and the index leaves
  it out.

  ```yaml
  id: pullup.wide_grip
  names: {en: Wide-grip pull-up, ru: Подтягивания широким хватом}
  equipment: [pullup_bar]
  muscles:
    primary: [lats]
  deprecated: true
  replaced_by: pullup.wide
  ```

- A dictionary key stays in the dictionary.

## License

The files under `catalog/` are licensed under CC BY-SA 4.0 (see `catalog/LICENSE`), and the code under
the MIT License (see `LICENSE`). Your contributions are licensed the same way.
