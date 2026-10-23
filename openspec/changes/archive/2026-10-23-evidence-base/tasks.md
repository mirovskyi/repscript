# Tasks

## 1. What `secondary` means

- [x] 1.1 Change the `muscles` and `secondary` descriptions in `schema/repscript.schema.json`, and
  `DESCRIPTIONS.muscles` in `core/exercises.mjs`, to the texts of the design's Hint wording table. In
  `schema/tests/exercise-wrong-types.expected.txt`, update the two hint lines that print them and change
  nothing else. Verify that `npm test` passes, including `hints taken from the schema match it`.
- [x] 1.2 Revise the `secondary` lists of the 18 entries in the design's table of changed entries
  (decision 7), and change nothing else in them.
  - Check all 30 entries by hand against the rule of decision 7 and against Table 1 of `pelland2026`.
    Where the design's table seems wrong, stop and report it instead of changing it.
  - Verify that `npm test` passes, and that `node scripts/build-catalog-index.mjs` leaves
    `catalog/index.yaml` unchanged.
- [x] 1.3 Update `CONTRIBUTING.md` as decision 7 says:
  - the `muscles` bullet of step 2 states the new meaning of `secondary`;
  - the `pullup.wide` example of step 2 shows its new `secondary` list;
  - step 3 explains which muscles go in `secondary`, which stay out, and why the program report needs
    this.

  Verify that the example equals `catalog/exercises/pullup.wide.yaml`, that no sentence still says that
  `secondary` lists the muscles that help, and that step 3 no longer says to copy ExRx's synergists.

## 2. Reading the guideline files

- [x] 2.1 Add `readGuidelineFiles(dir)` to `tools/catalog.mjs` (design decision 2), sharing one reading
  helper with `readCatalogFiles`. In a new `schema/guidelines.test.mjs`, test on a temporary directory
  that:
  - it returns `references`, `targets` and `corridors`, each with its text and its path from the project
    root written with `/`;
  - it names a file that is not UTF-8, both for Windows-1251 bytes and for UTF-16 without a byte order
    mark, as the catalog test does;
  - `loadCatalog` on a catalog directory whose `corridors.yaml` is not valid YAML still returns the
    catalog.

  Verify that `npm test` passes and that `npm run coverage` stays at 100% of lines and functions.

## 3. The checks

- [x] 3.1 In `schema/guidelines.test.mjs`, write `guidelineProblems(files, catalog, goals)` with every
  check of design decision 9. It returns lines of the form `<file>: <item>: <problem>`, and takes
  `goals` from the `goal` enum of `schema/repscript.schema.json`. Test it on small inline data:
  - a minimal valid set of the three files gives no problem;
  - inline data with each kind of problem gives exactly the expected list of lines, as
    `the dictionary check finds each kind of problem` does for the dictionaries.

  Verify that `npm test` and `npm run typecheck` pass.

## 4. The data

- [x] 4.1 Read each of the six sources of design decision 3 in full, or the listed chapters of `who2020`
  and `paga2018`. Check every number and locator of decisions 3, 4 and 8 against the page, table or
  section of the copy read.
  - Confirm each citation of decision 3 against its version of record, through its identifier. The
    copy of `pelland2026` read is the Online First version, which does not show the issue's volume,
    number and pages.
  - On the guideline's own page (`https://odphp.health.gov/paguidelines/`), check for a newer supplement that
    changes the adult advice on muscle-strengthening activity or the list of major muscle groups.
  - If a number, a locator or the PAGA check differs from the design, stop and report it instead of
    changing the design.

  Verify that every row of decision 8 was confirmed against its source.
- [x] 4.2 Write `catalog/targets.yaml` as decision 4 gives it: a header comment, `counting` with its
  description and citations, the twelve targets, and `major_groups` with its description, citations and
  the seven groups. Add tests that read `catalog/targets.yaml` alone, since the other two files come in
  task 4.3, and check that:
  - the target ids and nodes, and the group ids and targets, equal the spec's lists in the spec's order,
    and the names are those of decision 4;
  - `pushup`, `dip`, `overhead_press.barbell` and `overhead_press.dumbbell` reach no node of `back`;
  - `chinup`, `pullup`, `pullup.wide` and `row.dumbbell` reach no node of `chest`.

  Verify that these tests pass.
- [x] 4.3 Write `catalog/references.yaml` (decision 3) and `catalog/corridors.yaml` (decisions 5 and 8),
  each with a header comment:
  - the six corridors with the bands, labels, findings and citations of decision 8;
  - for each band, a description in our words, with no sentence copied from a source, and citations
    that cover both its range and its description (decision 5);
  - the extrapolation of `hypertrophy.weekly_sets` and the conversion in the repetition bands stated as
    decision 8 says.

  Add a test that `guidelineProblems` finds no problem in the project's three files with the project's
  catalog. Verify that `npm test` passes.
- [x] 4.4 In `catalog/LICENSE`, name the bibliography, the targets and the corridors among the files
  under CC BY-SA 4.0 (decision 10). Verify that the text names every kind of file in `catalog/`.

## 5. Integration

- [x] 5.1 Run `npm run check`: lint, typecheck, coverage at the floors of 100% lines, 100% functions and
  95% branches, and the vendor check. Verify that it passes. Run `openspec validate evidence-base --strict`
  and verify that it passes. Verify that no file changed by this change names a local source copy or a
  file that is not committed.

## Workflow follow-up

- Archive the change once it is reviewed (`/opsx:archive`): this creates
  `openspec/specs/training-guidelines` and merges the delta into `openspec/specs/exercise-catalog`.
- Next: `program-stats`, which loads the files with `readGuidelineFiles`, implements the units, and shows
  that a pushing-only program gets no back volume and a finding for the back.
