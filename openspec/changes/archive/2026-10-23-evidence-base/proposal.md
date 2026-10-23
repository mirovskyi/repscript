# Proposal

## Why

The program report (`program-stats`) is to check a program's numbers against corridors taken from cited
sources, while the AI keeps its judgment in the conversation. Before any code counts, the data it counts
against must exist: the sources, the parts of the body that sets are counted for, how one set counts
toward them, and which values give a finding. The catalog must agree with that counting from the start.
Today `secondary` lists every muscle that helps, as ExRx's synergists do. Under a rule that counts a
`secondary` muscle as half a set, dips and overhead presses would count as back work, and the report
would not see that the back is untrained.

## What Changes

- **A new capability, `training-guidelines`**: the data that the program report checks programs
  against, in three new files under `catalog/`, licensed CC BY-SA 4.0 like the rest of the catalog. The
  validator never reads them.
  - `catalog/references.yaml`, the bibliography: one entry per source that something cites, with a key
    such as `pelland2026`, one citation string naming the version of record, one identifier (`doi`,
    `isbn` or `url`), and what of the source was read in full. A source enters with the first statement
    that cites it, so the file starts with six: `acsm2026`, `currier2023`, `iusca2021`, `paga2018`,
    `pelland2026` and `who2020`.
  - A citation from the data is `{key, at}`, where `at` names a table, figure, section or page.
  - `catalog/targets.yaml`:
    - twelve targets that sets are counted for, each a set of muscle-dictionary nodes: chest, back,
      front delts, side delts, rear delts, biceps, triceps, quads, hamstrings, glutes, calves and abs;
    - the counting rule, after `pelland2026`: a set counts 1 for a target that its exercise drives
      (`primary`) and half a set for one that it trains indirectly (`secondary`), and a target takes the
      largest of these over its nodes, not the sum;
    - the seven major muscle groups of `paga2018`, mapped onto the targets.
  - `catalog/corridors.yaml`: corridors, each an ordered list of bands over one value in one unit, for
    one goal or for every program. A band has a range, a label, a description in our words, whether it
    gives a finding, and its citations. A band gives a finding only outside what its sources support or
    recommend; inside, the report names the band.
  - Five units, each defined once: fractional sets a week and fractional sessions a week per target,
    days a week per major group, and repetitions and rest per block. A weekly value is the mean week of
    the workout rotation. Corridors do not depend on training status, which a program does not state.
  - The corridors of this change, as far as the sources give numbers in these units:
    - for every program: on how many days a week each major group is trained (`who2020`, `paga2018`,
      `acsm2026`);
    - `hypertrophy`: weekly sets per target (`pelland2026`), repetitions per set (`acsm2026`, through the
      load conversion of `currier2023`), and rest (`iusca2021`);
    - `strength` and `power`: repetitions per set (`acsm2026`, through the same conversion).
  - What has no corridor yet, and why, is in `design.md`:
    - `muscular_endurance` and `health` get only the checks for every program;
    - there is no weekly frequency per target: for hypertrophy the sources find no effect once volume is
      equal;
    - `strength` has no weekly sets or frequency per target: `pelland2026` counted those per tested
      exercise, not per muscle.
  - `node --test` checks the three files:
    - their fields, keys and ids, and that no mapping holds a field the spec does not define;
    - bands in order without gaps or overlaps, and units from the list;
    - target nodes in `catalog/muscles.yaml`;
    - every citation: every band and the counting rule cite a source, every cited key exists, every key
      is cited, every entry says what was read, and every citation has `at`.
- **`exercise-catalog`: what `secondary` means.**
  - `secondary` takes the definition of an indirect set in `pelland2026`: a muscle that the exercise is
    likely to train meaningfully without being its primary force generator. A muscle that only steadies
    a joint while others do the work is not `secondary`.
  - Eighteen of the thirty catalog entries change their `secondary` list. Stabilizers and muscles the
    exercise loads too little come out, for example the rotator cuff in pulls and presses, the soleus in
    squats and lunges, the lats in dips, the trapezius in presses and raises, and the pecs in pulls and
    overhead presses. The biceps go into the dumbbell row.
  - The schema's descriptions of `muscles` and `secondary`, which the validator gives as hints for a
    program's own exercises, say the same, and so does `CONTRIBUTING.md`.
- Not breaking: no program changes its meaning or validity. Only the hint text of two descriptions
  changes, in one fixture report.

Out of scope, for later changes:
- `spec/TRAINING.md`, the defaults per goal and per training status, the screening questions, and how a
  person's own words map to a `goal` (`training-defaults`);
- the code that counts, and the report with its findings (`program-stats`);
- movement regions in the catalog and a coverage check by region (`agent-workflow`);
- `references` and `status` per catalog entry (`catalog-review`);
- corridors in units that the format cannot give yet, such as effort (`rir`) or load as a share of 1RM.

## Capabilities

### New Capabilities

- `training-guidelines`: the bibliography and its citations, the targets and the counting rule, the
  major muscle groups, the units, the corridors, and the checks of all of these.

### Modified Capabilities

- `exercise-catalog`: `secondary` lists only the muscles that an exercise is likely to train
  meaningfully without driving it, and review of each entry checks this.

## Impact

- New: `catalog/references.yaml`, `catalog/targets.yaml`, `catalog/corridors.yaml`,
  `schema/guidelines.test.mjs`.
- Changed:
  - eighteen entries in `catalog/exercises/`, and `catalog/LICENSE`, which names the new files;
  - `tools/catalog.mjs`, which gets a reader for the three new files;
  - the `muscles` and `secondary` descriptions in `schema/repscript.schema.json`, and
    `DESCRIPTIONS.muscles` in `core/exercises.mjs`;
  - two hint lines in `schema/tests/exercise-wrong-types.expected.txt`;
  - `CONTRIBUTING.md`.
- Not touched: the validator's rules, `tools/validate.mjs`, the program format, and `catalog/index.yaml`,
  which holds no muscles.
