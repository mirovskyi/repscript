# Contributing

## Adding an exercise to the catalog

Programs name exercises by id, and the ids come from the catalog in `catalog/`:

- `catalog/exercises/`: one file per exercise;
- `catalog/muscles.yaml`: the muscle keys;
- `catalog/equipment.yaml`: the equipment keys;
- `catalog/index.yaml`: a list of every exercise for chats, generated from the files.

`catalog/` also holds the training guidelines that the program report, `node tools/stats.mjs`, counts
programs by and checks them against: `references.yaml`, `targets.yaml` and `corridors.yaml`. Adding an
exercise does not touch them.

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
  secondary: [biceps, brachialis, forearms, delt_rear, rhomboids, traps]
```

- **`names`**: required in `en` and `ru`. Other two-letter language codes are welcome.
- **`aliases`**: other names a user is likely to write, in any language. Leave out forms that differ only
  in letter case, separators (`pull-up`, `pull up`, `pullup`), `ё` or an English plural: these already
  match. Russian case forms and other word orders need aliases. No name or alias may match a name or
  alias of another catalog entry that is not deprecated.
- **`equipment`**: keys from `catalog/equipment.yaml` for everything the exercise needs. Write
  `equipment: []` when it needs nothing; the field is required. Added load, such as a backpack or a
  vest, is not the exercise's equipment: a program names it in `load.implement`.
- **`muscles`**: keys from `catalog/muscles.yaml`. `primary` lists the muscles that do the work, and
  `secondary` the others that the exercise is likely to train meaningfully, not those that only steady a
  joint (see step 3). Name muscles or bundles (`lats`, `delt_rear`), never a group (`back`, `shoulders`).

If the exercise needs a muscle or an equipment key that the dictionary lacks, add the key in the same
pull request, with names in `en` and `ru`:

- A muscle key is lowercase Latin letters, digits and `_`, unique across the file, at most three levels
  deep (group, muscle, bundle).
- An equipment key has the id form. A key `X.Y` is a variant that satisfies any need for `X`, as
  `bench.adjustable` does for `bench`, so `X` must be in the dictionary too.

### 3. Check the muscles

Catalog entries are drafts until the catalog is reviewed against professional sources. Until then,
check each entry's muscles against these rules, which follow the definition of an indirect set in
`pelland2026` (`catalog/references.yaml`):

- Where Table 1 of `pelland2026` codes the exercise for a muscle, follow its coding: for example,
  bench presses train the front delts and the triceps indirectly, and pulldowns and rows the biceps and
  the trapezius.
- `primary`: the muscles that drive the movement, its primary force generators.
- `secondary`: other muscles that work against the load through the movement and that the exercise is
  likely to train meaningfully, such as the front delts and the triceps in a bench press.
- Not in `secondary`: a muscle that only steadies a joint or balances the body while others move the
  load, or one that helps at an effort too low to train it, such as the rotator cuff in a pull-up, the
  soleus in a squat and the lats in a dip. Where holding the load is the exercise, as in a carry, the
  muscles that hold it work against the load and count.

This matters because the program report counts a set as half a set for a target, such as the back,
that only the exercise's `secondary` muscles reach (`catalog/targets.yaml`). A stabilizer listed there,
such as the lats in a dip, would make dips count as back work, and the report would miss a back that no
exercise trains. The report's own tests count real programs with these entries, so changing the
`muscles` of an entry they use changes their expected reports (step 4).

[ExRx](https://exrx.net/Lists/Directory) helps to find which muscles work, but its Synergists are not
copied as they are: check each one against the rules above. Take only which muscles work, and copy no
text from ExRx.

### 4. Rebuild the index and run the tests

With Node 22 or later and nothing installed, from the project root:

```sh
node scripts/build-catalog-index.mjs
node --test
```

`npm run catalog:index` does the same as the first command.

The tests check every entry, both dictionaries and the guideline files. A muscle key that a target in
`catalog/targets.yaml` names cannot be renamed without changing the target, and a new muscle key fails
the tests until a target takes it or it joins the list of keys that no target needs, in
`schema/guidelines.test.mjs`. They also fail when
`catalog/index.yaml` is out of date, and when a file in `catalog/` is not UTF-8 or a file in `catalog/exercises/` does not end in
`.yaml`. A problem in an entry is reported in the validator's format: the entry's file, the field's
path, its line and a hint. For example:

```text
catalog/exercises/pushup.yaml
error: muscles.primary[0] (line 6) = "chest_mid"
  Unknown muscle key.
  Hint: Muscle keys (catalog/muscles.yaml): lats, traps, ...
```

The programs in `schema/stats/` are counted with the project's catalog, each compared with its expected
report `<name>.stats.txt` in a test named `stats report <name>`. A change to the `muscles` of an entry
they use can move a count and fail that test. Update the expected report in the same commit, and check
each number that changed by hand against the counting rule in `catalog/targets.yaml` rather than
copying the output of `node tools/stats.mjs`: the diff is how the review sees what the change does to
real programs. A new entry changes no report, since no program there uses it.

Commit the entry, `catalog/index.yaml` and any expected report that the entry changes together.

### With an agent

Point the agent at this file and name the exercise, for example: "Add a catalog entry for the
Copenhagen plank, following CONTRIBUTING.md." The agent writes the file, runs the two commands and
fixes what the tests report. Before you open the pull request, check its muscles yourself, as step 3
describes, and every number that changed in an expected report in `schema/stats/`.

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
