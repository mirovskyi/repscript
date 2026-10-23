# Design

## Context

What exists now:
- `catalog/` holds 30 exercise entries, the muscle dictionary (group → muscle → bundle), the equipment
  dictionary, the generated `index.yaml` (ids, names, aliases, equipment; no muscles) and `LICENSE`,
  which puts the files it names under CC BY-SA 4.0.
- `readCatalogFiles(dir)` in `tools/catalog.mjs` reads the catalog's texts and rejects a file that is
  not UTF-8 (a fatal decoder, and no NUL). `buildCatalog` in `core/catalog.mjs` builds the catalog.
  `schema/catalog.test.mjs` checks the entries in the validator's issue format and the dictionaries as
  plain lines (`dictionaryProblems`).
- The format has `goal` and `schedule.per_week`, and the rotation of workouts is specified
  (`program-format`: Workout rotation). Nothing counts sets yet.
- `secondary` follows ExRx's synergists, "the muscles that help", and `CONTRIBUTING.md` tells
  contributors to copy them. The schema's descriptions of `muscles` and `secondary` are the validator's
  hints for a program's own exercises; `DESCRIPTIONS.muscles` in `core/exercises.mjs` repeats one of
  them, and a test keeps the two equal.

Decided before this change, and applied here:
- the data lives in `catalog/` under the catalog's license, and the validator never reads it;
- the bibliography holds only cited sources, and a citation is `{key, at}`;
- twelve targets, each a set of dictionary nodes, where a target takes the maximum over its nodes;
- the seven major groups of PAGA for coverage, counted by involvement (`primary` or `secondary`), while
  per-target corridors use fractional counts;
- a corridor is an ordered list of bands, and only bands outside what the sources support give
  findings;
- a closed list of five units, and a number in another unit only through a stated, cited conversion;
- corridors without training status.

Where reading the sources showed that a decided corridor has no number in a decided unit, this design
leaves the corridor out and says why (decision 8).

The copies read, and what `at` may name for each (see `specs/training-guidelines`: Citations):

| Key | Copy read | `at` |
|---|---|---|
| `pelland2026` | The journal version, Online First, without the issue's page numbers (pp. 481-505) | Tables, figures, sections |
| `acsm2026` | The journal's PDF with the issue's pages 851-872 | Pages, tables |
| `currier2023` | The journal's PDF, numbered "1 of 12" to "12 of 12", not the issue's pages 1211-1220 | Sections, tables |
| `iusca2021` | The journal's PDF; the journal numbers each article from 1 | Pages |
| `who2020` | The guideline, front matter in roman numerals | Pages |
| `paga2018` | The guideline | Pages |

## Goals / Non-Goals

**Goals:**
- The data that `program-stats` checks programs against exists and passes its checks before any code
  counts with it.
- The counting rule and the catalog agree from their first commit.
- Every number leads a reviewer, such as a coach, to a key and a locator they can open, and every
  extrapolation is marked in the data.
- `defaults.yaml` (`training-defaults`) and corridors for more goals fit these files without changing
  their format.

**Non-Goals:**
- Code that counts, and the wording of the report and its findings (`program-stats`).
- A loader in `core/` that parses and checks the data at run time (`program-stats`). This change adds
  only the reader of the texts.
- Corridors for effort, load as a share of 1RM, or anything else the format cannot state yet.
- Changes to `primary` lists, new muscle keys, or `references` and `status` per entry
  (`catalog-review`).
- The test catalog in `schema/tests/catalog/`: it is a fixture for validator tests, and its muscles
  need not follow the definition.

## Decisions

### 1. `training-guidelines` owns the three files; `exercise-catalog` owns what the muscle lists mean

- `training-guidelines` owns the format, the content rules and the checks of `references.yaml`,
  `targets.yaml` and `corridors.yaml`, the counting rule and the units.
- `exercise-catalog` keeps the entries and the meaning of `primary` and `secondary`.
- **Why:**
  - The consumers are `program-stats` and, later, the agent's defaults, not the validator.
  - The new files depend on the catalog (muscle keys); the catalog does not depend on them.
  - `training-defaults` adds `defaults.yaml` to the same capability. `catalog-review` adds `references`
    per entry to `exercise-catalog`, pointing into the bibliography.
- The files live in `catalog/` and share its license, so `catalog/LICENSE` names them. The
  `exercise-catalog` requirements "Catalog files" and "Catalog license" do not change: neither says that
  the directory holds only its files.
- **Alternative:** `exercise-catalog` owns all of `catalog/`. Rejected: training evidence would sit in a
  spec written for the validator, which never reads it.

### 2. Reading and checking the files

- `tools/catalog.mjs` gets `readGuidelineFiles(dir)`. It reads `references.yaml`, `targets.yaml` and
  `corridors.yaml` from a directory URL, with the UTF-8 check of `readCatalogFiles`, and returns
  `{ references, targets, corridors }`, each `{ file, source }` with the path from the project root
  written with `/`. The two readers share one helper for reading a file.
- `loadCatalog` does not call it, so a broken guideline file never stops `tools/validate.mjs`.
- The checks live in `schema/guidelines.test.mjs`, as the dictionary checks live in
  `schema/catalog.test.mjs`:
  - `guidelineProblems(files, catalog, goals)` parses the three texts with the YAML core schema and
    returns lines of the form `<file>: <item>: <problem>`; the project's files must give none;
  - `goals` comes from the `goal` enum of `schema/repscript.schema.json`, so corridors follow the
    format's goal values without a second list.
- `program-stats` builds its loader for `tools/stats` on `readGuidelineFiles`. As the validator trusts
  the catalog, it can trust the shape that the tests guarantee.
- **Alternative:** a pure `core/guidelines.mjs` holding the checks now. Rejected for this change:
  nothing reads the data at run time yet, and the module's form is better settled together with
  `core/stats`.

### 3. `references.yaml`

- The format is in the spec (Reference entries). The fields come in the order `key`, `citation`, the
  identifier, `read`, and the entries in key order.
- The file starts with the six sources that this change cites:

| Key | Citation (the version of record) | Identifier | `read` |
|---|---|---|---|
| `acsm2026` | Currier BS, D'Souza AC, Fiatarone Singh MA, et al. American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews. Med Sci Sports Exerc. 2026;58(4):851-872. | `doi: 10.1249/MSS.0000000000003897` | `full` |
| `currier2023` | Currier BS, Mcleod JC, Banfield L, et al. Resistance training prescription for muscle strength and hypertrophy in healthy adults: a systematic review and Bayesian network meta-analysis. Br J Sports Med. 2023;57(18):1211-1220. | `doi: 10.1136/bjsports-2023-106807` | `full` |
| `iusca2021` | Schoenfeld BJ, Fisher JP, Grgic J, et al. Resistance Training Recommendations to Maximize Muscle Hypertrophy in an Athletic Population: Position Stand of the IUSCA. Int J Strength Cond. 2021;1(1). | `doi: 10.47206/ijsc.v1i1.81` | `full` |
| `paga2018` | U.S. Department of Health and Human Services. Physical Activity Guidelines for Americans, 2nd edition. Washington, DC: U.S. Department of Health and Human Services; 2018. | `url: https://odphp.health.gov/paguidelines/` | `chapters 2, 4` |
| `pelland2026` | Pelland JC, Remmert JF, Robinson ZP, Hinson SR, Zourdos MC. The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains. Sports Med. 2026;56(2):481-505. | `doi: 10.1007/s40279-025-02344-w` | `full` |
| `who2020` | World Health Organization. WHO guidelines on physical activity and sedentary behaviour. Geneva: World Health Organization; 2020. | `isbn: 978-92-4-001512-8` | `glossary of terms; recommendations` |

- `read` states what was read in full when the file is written: each article whole; of PAGA its
  chapter 2 (Physical Activity and Health) and chapter 4 (Active Adults); of WHO 2020 its glossary and
  its recommendations. The URL of `paga2018` is the address the guideline prints for itself.
- Left out: `schoenfeld2017`, whose counting of synergist sets is unclear, so it gives no corridor; the
  screening, effort and book sources, until `training-defaults` or a later change cites them.

### 4. `targets.yaml`

A mapping with three fields (spec: Targets file):

```yaml
counting:
  primary: 1
  secondary: 0.5
  description: >-
    ...
  cites:
    - {key: pelland2026, at: Section 2.5}
    - {key: pelland2026, at: Section 3.4}
    - {key: pelland2026, at: Section 4.1}
targets:
  - id: chest
    names: {en: Chest, ru: Грудь}
    nodes: [pecs]
  # ...
major_groups:
  description: >-
    ...
  cites:
    - {key: paga2018, at: p. 30}
    - {key: who2020, at: p. vii}
  groups:
    - id: legs
      names: {en: Legs, ru: Ноги}
      targets: [quads, hamstrings, calves]
    # ...
```

**The counting rule.** `pelland2026` defines a direct set as one where the measured muscle is likely
the primary force generator, an indirect set as one where it is likely meaningfully trained without
being so, and the fractional count as an indirect set counting half (Section 2.5). Of the three counts
compared, the fractional one fit best for both outcomes (Section 3.4), for strength with sets counted
per tested exercise rather than per muscle. The authors call the half weight an assumption whose best
value may differ by exercise, repetition range and trainee (Section 4.1). The rule's description says
both. They count each set once for the measured muscle, so a
target takes the largest weight, never a sum: summed over `biceps` and `brachialis`, one set of
chin-ups would count as a whole set for the elbow flexors, twice what the source counts.

**The targets**, in this order. "Measured" says whether `pelland2026` measured the target's muscles
for hypertrophy (Table 1); decision 8 marks the others as extrapolated:

| Id | en | ru | Nodes | Measured |
|---|---|---|---|---|
| `chest` | Chest | Грудь | `pecs` | yes |
| `back` | Back | Спина | `lats`, `rhomboids`, `traps` | the trapezius only |
| `front_delts` | Front delts | Передние дельты | `delt_front` | yes |
| `side_delts` | Side delts | Средние дельты | `delt_side` | no |
| `rear_delts` | Rear delts | Задние дельты | `delt_rear` | no |
| `biceps` | Biceps | Бицепс | `biceps`, `brachialis` | yes, as the elbow flexors |
| `triceps` | Triceps | Трицепс | `triceps` | yes |
| `quads` | Quads | Квадрицепсы | `quads` | yes |
| `hamstrings` | Hamstrings | Задняя поверхность бедра | `hamstrings` | yes |
| `glutes` | Glutes | Ягодицы | `glute_max`, `glute_med` | no |
| `calves` | Calves | Икры | `gastrocnemius`, `soleus` | no |
| `abs` | Abs | Пресс | `abs`, `obliques`, `transverse_abs` | no |

- The delts are three targets because presses train mostly the front delts: one target would hide
  missing side and rear delt work.
- `erector_spinae`, `serratus`, `rotator_cuff`, `forearms`, `adductors` and `hip_flexors` are in no
  target: no corridor speaks of them, and the report will have no line for them. The lower back is no
  target, since no source gives it a volume corridor and in `back` a deadlift would count as lat work.
- The coverage corridor (`major_groups`) therefore counts no lower-back work for the group `back`: a
  program whose only back exercise is a deadlift, such as squat, bench press, deadlift and overhead
  press, gets a coverage finding for the back. The descriptions of `major_groups` say that the back
  here is the lats, the rhomboids and the trapezius.
  - **Alternative:** a thirteenth target `lower_back` (`erector_spinae`) in the group `back`, left out
    of the volume corridor. Rejected in review: the group `back` stays the upper back, so the finding
    points to a program without any pulling exercise.

**Keys above or below a node** (spec: Keys that reach a target). A program's own exercise may name a
group, such as `back`, or a muscle with bundles, such as `deltoids`. Such a key reaches every target that
has a node under it.
- **Alternative:** only a key equal to a node counts. Rejected: an own exercise with
  `primary: [back]` would count for nothing, and the report would claim that the back is untrained.
- **Trade-off:** a group key counts for the whole group, also when the exercise trains only part of it.
  Catalog entries name muscles and bundles, so this touches own exercises only.

**The major groups** are the seven of `paga2018` (p. 30: the legs, hips, back, abdomen, chest,
shoulders and arms). `who2020` lists six, without the hips (p. vii). Both are cited on the list:

| Id | en | ru | Targets |
|---|---|---|---|
| `legs` | Legs | Ноги | `quads`, `hamstrings`, `calves` |
| `hips` | Hips | Бёдра | `glutes` |
| `back` | Back | Спина | `back` |
| `abdomen` | Abdomen | Живот | `abs` |
| `chest` | Chest | Грудь | `chest` |
| `shoulders` | Shoulders | Плечи | `front_delts`, `side_delts`, `rear_delts` |
| `arms` | Arms | Руки | `biceps`, `triceps` |

**Ids.** Target and group ids are plain words, and some equal a muscle key (`chest`, `back`, `biceps`,
`quads`) or a dictionary group (`legs`, `arms`). They live in their own lists: a program never names a
target or a group, and the report says which kind it names.

### 5. `corridors.yaml`

A list of corridors, each like this:

```yaml
- id: hypertrophy.weekly_sets
  goal: hypertrophy
  unit: fractional_sets_per_week
  targets: [chest, back, front_delts, side_delts, rear_delts, biceps, triceps, quads, hamstrings, glutes, calves, abs]
  extrapolated: [back, side_delts, rear_delts, glutes, calves, abs]
  extrapolation: >-
    ...
  bands:
    - from: 0
      to: 4
      label: below the minimum effective dose
      finding: true
      description: >-
        ...
      cites:
        - {key: pelland2026, at: Table 3}
        - {key: pelland2026, at: Section 4.6}
    # ...
```

- **Ranges are half-open**, `from` ≤ value < `to`: weekly values are fractional, so closed ranges would
  leave gaps between 10 and 11. The first band starts at 0 and the last has no `to`, so every value
  falls in exactly one band. Repetitions and seconds follow the same rule.
- **A tier written as whole numbers**, such as 5-10, becomes `[5, 11)`: it runs up to the first number
  of the next tier, so 10.5 sets fall in 5-10. A single number, such as a minimum effective dose of 4,
  becomes `[4, 5)`.
- **Ids** are `<goal>.<value>` for a goal's corridor and `major_groups` for the corridor of every
  program. `defaults.yaml` will name a corridor by its id.
- **Labels** are short phrases that a finding can quote. **Descriptions** are one or two sentences in
  our words; no sentence is copied from a source.
- **Citations** on a band cover both its range and its description. A band that uses a conversion cites
  the source of the number and the source of the conversion.
- **Closed fields.** Every mapping in the three files holds only the fields that the spec defines for it
  (spec: Closed fields), so a misspelled field fails the checks instead of being ignored.

### 6. Units

The spec defines the five units (Units, Weekly values and the requirements after it). Notes on the
choices:
- **The mean week.** For `n` workouts and `per_week: p`, a weekly value is `p / n` times the sum over
  the list. This equals the mean over the weeks of a full rotation, so a target trained only in `A`
  does not read 2 one week and 1 the next.
- **Ranges.** Weekly values grow with `sets` and `per_week`, so the lower end takes every range at its
  lower end and the upper end every range at its upper end.
- **Without `per_week`**, a weekly value is unknown, but one that no workout adds to is 0 whatever the
  schedule. So the goal-independent corridor still reports a group that no workout trains.
- **A workout is one day** in `days_involved_per_week`: the format has no calendar days until the
  `schedule` change adds them.
- **`N+`** is checked at `N`: the prescription sets that floor, and the set's top depends on the day.
  **`max` and `time`** give no repetitions: their number is unknown, and a repetition corridor stands
  for the load, which they do not state. Their sets still count for the weekly values.
- **`fractional_sessions_per_week`** has no corridor in this change (decision 8). It stays in the list
  because the report shows it, and corridors or defaults may use it later.

### 7. What `secondary` means, and the revision of the 30 entries

**The rule we apply** (spec `exercise-catalog`: Exercise muscles):
1. Where `pelland2026` coded an exercise for a muscle (Table 1), their coding decides: bench presses
   are indirect for the front delts, while the barbell shoulder press is direct for them; presses of
   every kind are indirect for the triceps; and pulldowns and rows are indirect for the elbow flexors
   and the trapezius. Their "N/A" says only that their studies had no indirect exercise for a muscle;
   it codes none of the exercises those studies did not use.
2. Otherwise, a muscle is `secondary` when it works against the load through the movement beside the
   primary force generators. A muscle that steadies a joint or balances the body while others move the
   load is not, and neither is one that helps at an effort too low to train it. Where holding the load
   is the exercise, as in a carry, the muscles that hold it work against the load. This is our
   application of their definition, stated as such.

**Changed entries** (18):

| Entry | `secondary` before | After | Why |
|---|---|---|---|
| `burpee` | glute_max, triceps, delt_front, abs | glute_max, triceps, delt_front | abs hold the plank; bringing the feet in is hip flexion, as in the hanging leg raise |
| `chinup` | biceps, brachialis, forearms, delt_rear, rhomboids, traps, pecs | biceps, brachialis, forearms, delt_rear, rhomboids, traps | pecs help at a low effort, and would make a pulling program count as chest work |
| `deadlift.barbell` | quads, adductors, hamstrings, soleus | quads, adductors, hamstrings | soleus steadies the ankle; quads and hamstrings extend the knee and the hip against the load |
| `dip` | delt_front, rhomboids, lats | delt_front | lats, rhomboids: steady the shoulder girdle |
| `hanging_leg_raise` | quads, adductors, obliques | obliques | the rectus femoris works here as a hip flexor, which `hip_flexors` covers, and the rest of the quads only hold the knees straight; adductors help little |
| `kettlebell_swing` | adductors, erector_spinae | adductors | the back extensors keep the spine still while the hips move the bell |
| `lateral_raise.dumbbell` | delt_front, rotator_cuff, traps, serratus | delt_front | rotator cuff steadies the shoulder; trapezius and serratus turn the shoulder blade at a low effort |
| `lunge` | adductors, soleus | adductors | soleus steadies the ankle |
| `overhead_press.barbell` | delt_side, triceps, traps, serratus, pecs | delt_side, triceps | trapezius and serratus as in the raise; pecs as in the chin-up, or a press would count as chest work |
| `overhead_press.dumbbell` | delt_side, rotator_cuff, triceps, traps, serratus, pecs | delt_side, triceps | as the barbell press, plus the rotator cuff |
| `pullup` | biceps, brachialis, forearms, delt_rear, rotator_cuff, rhomboids, traps | biceps, brachialis, forearms, delt_rear, rhomboids, traps | rotator cuff steadies the shoulder |
| `pullup.wide` | the same as `pullup` | the same as `pullup` | the same |
| `row.dumbbell` | traps, delt_rear, rotator_cuff, brachialis, forearms, pecs | traps, delt_rear, biceps, brachialis, forearms | biceps added: rows are indirect for the elbow flexors (Table 1); rotator cuff as above; pecs as in the chin-up |
| `split_squat.bulgarian` | adductors, soleus | adductors | soleus steadies the ankle |
| `squat.air` | adductors, soleus | adductors | the same |
| `squat.barbell` | adductors, soleus | adductors | the same |
| `squat.goblet` | adductors, soleus | adductors | the same |
| `step_up` | adductors, soleus, gastrocnemius | adductors | both calf muscles steady the ankle |

The forearms stay in the pulls, as in the curl: the forearm's elbow flexors bend the elbow against the
load.

**Unchanged entries** (12), checked against the same rule:
- Fit the coding of `pelland2026`: `bench_press.barbell`, `bench_press.dumbbell` and `pushup` (front
  delts and triceps from bench presses).
- Our application:
  - `calf_raise`: the soleus lifts the heel with the gastrocnemius;
  - `carry.suitcase`: holding the load is the exercise, so the trapezius and the gluteus medius work
    against the load;
  - `crunch`: the obliques flex the trunk;
  - `curl.dumbbell`: the brachialis and the forearm's elbow flexors bend the elbow;
  - `romanian_deadlift.dumbbell`: the adductors extend the hip.
- No `secondary`: `glute_bridge`, `plank`, `plank.side`, `triceps_extension.dumbbell`.

**After the revision**, push-ups, dips and an overhead press reach no node of `back`, and chin-ups,
pull-ups and rows reach no node of `chest`. Tests pin both (decision 9).

**The most debatable calls** are the trapezius in presses and raises and the pecs in pulls and
overhead presses. Each helps the movement under load, and no source in the bibliography measured it
there. Counting it would make a pushing program count as back work, or a pulling program as chest
work. Our reading of "meaningfully trained" leaves them out, and the `catalog-review` change or a
coach's review may revisit them.

**Hint wording.** The validator shows these descriptions for a program's own exercises:

| Where | Text |
|---|---|
| `muscles` description and `DESCRIPTIONS.muscles` | `The muscles the exercise works: primary for those that do the work, secondary for others it is likely to train meaningfully, each a list of keys from catalog/muscles.yaml. Leave out a muscle that only steadies a joint while others do the work. Example: muscles: {primary: [lats], secondary: [biceps]}` |
| `secondary` description | `Other muscles the exercise is likely to train meaningfully, such as the triceps in a bench press, but not one that only steadies a joint while others do the work: a list of keys from catalog/muscles.yaml. Example: secondary: [biceps]` |

- The `primary` description does not change.
- The example in the description of an own exercise (`exercises.items`), a towel pull-up with
  `secondary: [forearms]`, stays: on a towel the grip is the hard part of the exercise, so the forearms
  are trained meaningfully.

**`CONTRIBUTING.md`**:
- Step 2's `muscles` bullet states the new meaning of `secondary`, and its example (`pullup.wide`)
  shows the new list.
- Step 3 explains the rule above in a few lines:
  - which muscles go in `secondary`, with the bench press as an example;
  - which stay out (the rotator cuff in a pull-up, the soleus in a squat, the lats in a dip);
  - why it matters: the program report counts each set as half a set for a `secondary` muscle;
  - ExRx lists which muscles work, but its synergists are not copied as they are.

### 8. The corridors of this change

Every number below was checked against the page or table of the copy read.

**When a recommendation gives a finding.** A value below what a source recommends for the goal gives a
finding, unless another source of the corridor shows with numbers that values below the
recommendation still work. So the weekly sets for hypertrophy give no finding below the 10 or more that
position stands advise, since `pelland2026` measures growth from 4 sets on, while the load for strength
gives a finding below the 80% of 1RM that `acsm2026` advises, since no cited source gives a threshold
below it: `currier2023` splits loads only at 80% of 1RM, and `acsm2026` names load as the variable that
moves strength most (p. 864). The rule is a judgment, stated so that a review can test each corridor
against it.

**`major_groups`**: every program; `days_involved_per_week`; all seven groups.

| Band | Label | Finding | Cites |
|---|---|---|---|
| [0, 2) | less than twice a week | yes | `who2020` p. 32; `paga2018` p. 56 and p. 61; `acsm2026` p. 862 |
| [2, ∞) | twice a week or more | no | the same |

Both guidelines ask adults to work every major muscle group with muscle-strengthening activity of
moderate or greater effort on at least two days a week (`who2020` p. 32, `paga2018` p. 56), and
`paga2018` states the two days for each group (p. 61). The primary recommendation of `acsm2026` is
hard training at least twice a week that engages every major group (p. 862). A program cannot state
effort yet, so the band counts every day that trains the group, and the descriptions say so. A group
that no workout trains falls in the first band at 0, with or without `per_week`.

**`hypertrophy.weekly_sets`**: `goal: hypertrophy`; `fractional_sets_per_week`; all twelve targets;
extrapolated for `back`, `side_delts`, `rear_delts`, `glutes`, `calves` and `abs`, because
`pelland2026` measured the quadriceps, hamstrings, pecs, front delts, trapezius, triceps and elbow
flexors (Table 1). All bands cite `pelland2026` Table 3 and Section 4.6; the bands from 19 sets up also
cite Section 4.4, and the bands from 4 to 11 sets also cite `acsm2026` Table 6 and `iusca2021` p. 9:

| Band | Label | Finding |
|---|---|---|
| [0, 4) | below the minimum effective dose | yes |
| [4, 5) | minimum effective dose | no |
| [5, 11) | higher efficiency | no |
| [11, 19) | intermediate efficiency | no |
| [19, 30) | lower efficiency | no |
| [30, 43) | lowest efficiency | no |
| [43, ∞) | too little data | yes |

- Each tier above the dose needs more sets than the one before for the next detectable gain, which is
  information, not a finding.
- From 43 on, the authors have too little data to tell, and growth may be lower: a finding.
- The descriptions say that most of the pooled effects came from sets taken to some form of failure, so
  the tiers may overstate what easier sets give (Section 4.6). From 19 sets up they also say that few
  studies went above about 25 sets (Section 4.4).
- Below 10 weekly sets lies under the 10 or more that `acsm2026` lists among what enhances hypertrophy
  (Table 6), and under the about 10 sets per muscle that `iusca2021` takes as a general minimum for
  optimizing it (p. 9). Both count whole sets, not fractional ones, and the descriptions say that the
  comparison is rough. The bands from 4 to 11 sets name that advice but give no finding:
  `pelland2026` detects growth from 4 sets, the advice is about the most growth rather than about any
  growth, and `iusca2021` notes that some people grow on less. The Findings requirement allows this: a
  finding needs a range outside what the sources support or recommend, but such a range need not give
  one.

**`hypertrophy.reps`**: `goal: hypertrophy`; `reps_per_set`.

| Band | Label | Finding | Cites |
|---|---|---|---|
| [0, 29) | 28 repetitions or fewer | no | `acsm2026` p. 856; `currier2023` Methods: Study selection and data extraction; `iusca2021` p. 7 |
| [29, ∞) | lighter than the loads studied | yes | the same |

- `acsm2026` found that loads from 30% to 100% of 1RM made no difference to hypertrophy (p. 856).
- `currier2023` converted repetition maximums to loads with %1RM = 100 − 2.5 × RM.
- By that conversion, a set of 28 repetitions taken to failure uses 30% of 1RM. A set of more than 28
  repetitions uses less, whatever the reps left in reserve: so the finding holds at any effort.
- The descriptions say that the number of repetitions at a given load varies with the exercise, the
  body region and the person (`iusca2021` p. 7), so the bound is approximate.
- The finding band adds that in one study a load of 20% of 1RM gave less growth than 40% or more
  (`iusca2021` p. 7).

**`hypertrophy.rest`**: `goal: hypertrophy`; `rest_seconds`. All bands cite `iusca2021` p. 11, and
p. 1, whose title names the athletic population the position stand addresses; the first band also
cites p. 10 and `acsm2026` p. 856:

| Band | Label | Finding |
|---|---|---|
| [0, 60) | shorter than recommended | yes |
| [60, 120) | enough for single-joint exercises | no |
| [120, ∞) | enough for any exercise | no |

- `iusca2021` recommends at least 2 minutes of rest for multi-joint exercises and 60-90 seconds for
  single-joint and some machine exercises (p. 11).
- The catalog does not say which exercises are multi-joint, so only rest below the single-joint advice
  gives a finding. The middle band names the multi-joint advice, and that sets taken to failure likely
  need longer rest (p. 11).
- The first band says that short rest may cost growth, likely through less work in the later sets: the
  difference disappeared when volume load was equated (p. 10), and rest shortened step by step over 6
  to 8 weeks gave similar growth (p. 11). It also says that `acsm2026` found too
  little data to tell how inter-set rest affects hypertrophy (p. 856), so the finding rests on the
  advice of `iusca2021` alone.
- The descriptions say that the position stand addresses athletes.

**`strength.reps`**: `goal: strength`; `reps_per_set`.

| Band | Label | Finding | Cites |
|---|---|---|---|
| [0, 9) | 8 repetitions or fewer | no | `acsm2026` Table 6; `currier2023` Methods: Study selection and data extraction |
| [9, ∞) | lighter than recommended for strength | yes | the same |

- `acsm2026` lists loads of at least 80% of 1RM, with a dose-response, among what enhances strength
  (Table 6).
- By the conversion of `currier2023`, 80% of 1RM is the 8-repetition maximum. A set of more than 8
  repetitions uses less than 80% at any effort.
- Lighter loads still build strength, as every prescription that `currier2023` compared beat no
  training, but no cited source gives a load below 80% that still works for the most strength; by the
  rule at the start of this decision, the band from 9 repetitions gives a finding.

**`power.reps`**: `goal: power`; `reps_per_set`.

| Band | Label | Finding | Cites |
|---|---|---|---|
| [0, 29) | 28 repetitions or fewer | no | `acsm2026` Table 6 and p. 865; `currier2023` Methods: Study selection and data extraction; `iusca2021` p. 7 |
| [29, ∞) | lighter than the power range | yes | the same |

- `acsm2026` lists loads of 30-70% of 1RM among what enhances power (Table 6).
- By the conversion of `currier2023`, a set of more than 28 repetitions uses less than 30% of 1RM at any
  effort, below that range. The bound is approximate, as in `hypertrophy.reps`.
- The upper end of the range gives no band. `acsm2026` does not count sets to failure among what
  enhances power (p. 865), so a power set may stop far from failure, and few repetitions do not show a
  heavy load.

**No corridor in this change, and why:**
- **`strength`, weekly sets and frequency per target.**
  - `pelland2026` counted strength per tested exercise: a direct set is the tested exercise itself,
    and an indirect set any other exercise that trains its muscles (Section 2.5). Figures 6 and 8 plot
    sets and sessions "for assessed exercise".
  - A target's fractional sets are another value: a set of flyes counts 1 for `chest`, but half a set
    toward a bench press test.
  - With no stated conversion, the rule on other units (spec: Numbers in another unit) leaves Table 4
    and Section 4.3 out.
  - The frequency that `acsm2026` recommends for strength, at least 2 sessions a week (Table 6), is the
    threshold of `major_groups`, which applies to strength programs too.
  - Its sets, 2-3 per session (Table 6) and at least two per exercise (p. 865), are values per session
    and per block, which the closed list of units lacks.
- **`strength`, rest.** Rest shorter or longer than 1 minute made no difference to strength (`acsm2026`
  p. 855), so no band would lie outside.
- **`hypertrophy`, frequency per target.** Once volume is equal, any effect of frequency is small and
  not consistently found (`pelland2026` Section 4.2), negligible in the authors' conclusions (Section
  5), and `acsm2026` found none (p. 856). A corridor without a finding band would only label values.
- **`power`, beyond repetitions.** The upper end of its load range gives no band (see `power.reps`).
  Its volume, repetitions × sets of at most 24 (`acsm2026` Table 6), comes without saying over what:
  read per exercise, it is a value per block, which the closed list of units lacks.
  - Whatever the volume is counted over, one set of more than 24 repetitions would exceed it, so a band
    from 25 repetitions could be derived in `reps_per_set`. It is left out: the source does not say
    what the volume covers, and its table and its text disagree on the bound (≤ 24 in Table 6, < 24 on
    p. 858), so `power.reps` keeps to the load. A unit per block would let a later change check the
    volume itself.
- **`muscular_endurance`.** `acsm2026` found too little data to name a prescription (Table 6).
- **`health`.**
  - The guidelines' advice on muscle-strengthening activity is `major_groups`.
  - `paga2018` calls one set of 8 to 12 repetitions of each exercise effective, and 2 or 3 sets
    possibly more effective (p. 61). That names a dose that works, not a bound, so it belongs in
    `training-defaults`.

### 9. The checks

`guidelineProblems` reports, per file:
- **Every mapping**: a field that the spec does not define for it (spec: Closed fields); in `names`, a
  field that is not a two-letter lowercase language code, or a name that is not a string; `names` that is
  not a mapping.
- **`references.yaml`**: an entry that is not a mapping; a missing or non-string `key`, `citation` or
  `read`; an empty `read`; not exactly one of `doi`, `isbn` and `url`, or an empty one; a key not in the
  key form; an entry out of key order; a repeated key; a key that nothing cites.
- **`targets.yaml`**:
  - a top level that is not a mapping, or that lacks `counting`, `targets` or `major_groups`; an empty
    `targets`;
  - `counting`: `primary` not 1, `secondary` not 0.5, a missing `description`, or no citations;
  - a target: a missing or repeated id, an id not in the key form, a missing name in `en` or `ru`, an
    empty `nodes`, a node listed twice, a node that is not a key of `catalog/muscles.yaml`, a node that
    is a group, a node that equals, holds or lies under another target's node;
  - `major_groups`: a missing `description`, no citations, or no `groups`;
  - a group: a missing or repeated id, an id not in the key form, a missing name, an unknown target, a
    target listed twice;
  - a target in no group or in two.
- **`corridors.yaml`**:
  - a missing or repeated id, or one not in the exercise id form;
  - an id that does not start with `<goal>.` when the corridor has a goal, or that names a goal when it
    has none (decision 5);
  - a `goal` outside the schema's values, or a `unit` outside the five;
  - `targets` or `groups` missing, empty, unknown, listed twice, or present where the unit has no
    subject;
  - `extrapolated` that is not a non-empty list, that holds something other than the corridor's
    subjects or one subject twice, or `extrapolation` present without it, missing with it, or not a
    string;
  - fewer than two bands; a `from` or `to` that is not a number; a band that does not start where the
    one before ends; a first band that does not start at 0; a `to` not above `from`; a band other than
    the last without `to`, or the last with one;
  - a missing `label`, `description` or `finding`, or a `finding` that is not a boolean;
  - a band without `cites`, or with an empty one;
  - no band with a finding, or no band without one, when every band says whether it gives one;
  - two corridors that apply to one program and measure one unit for a common subject.
- **Every citation**: not a mapping, a missing `key` or `at`, or a key not in `references.yaml`.
- **A file or a mapping it cannot use** is reported once: a check that needs it, such as an unknown key,
  an unknown target or a key that nothing cites, is skipped while it is broken.

Besides `guidelineProblems` on the project's files, the tests check:
- each kind of problem on small inline data, as the dictionary check is tested;
- that the targets and the groups are those of the spec, in its order, and that every muscle and bundle
  of the dictionary reaches a target except the six that no corridor speaks of;
- that `pushup`, `dip`, `overhead_press.barbell` and `overhead_press.dumbbell` reach no node of
  `back`, that `chinup`, `pullup`, `pullup.wide` and `row.dumbbell` reach no node of `chest`, and that
  the presses reach the front and side delts but not the rear delts;
- that `readGuidelineFiles` names a file that is not UTF-8.

### 10. License and headers

- `catalog/LICENSE` names the bibliography, the targets and the corridors among the files under CC BY-SA
  4.0.
- Each new file starts with a comment saying what it holds, and `Licensed under CC BY-SA 4.0 (LICENSE).`,
  as the dictionaries do.

## Risks / Trade-offs

- [Strength programs get only the repetition corridor and the goal-independent one] → Three ways to
  widen them, each a decision to take before `program-stats`:
  - apply Table 4 per target as a stated extrapolation, which needs an exception to the rule on other
    units;
  - add a unit per exercise of the program, which matches how `pelland2026` counted;
  - add a unit of sets per block for the advice of `acsm2026` to do at least two sets per exercise
    (p. 865); its Table 6 gives 2-3 sets per session.
- [The corridors assume sets close to failure, which a program cannot state until `rir`] → The finding
  bands above a repetition bound hold at any effort. The volume tiers may overstate easy sets; their
  descriptions say that most effects in the studies came from sets taken to failure (`pelland2026`
  Section 4.6).
- [Our application of the definition is a judgment for muscles that `pelland2026` did not code] →
  Every change has its reason in decision 7. A coach's review before the first public release covers
  the catalog and the corridors.
- [A group key in an own exercise counts for its whole group] → Only own exercises can name groups;
  catalog entries name muscles and bundles. The report counts what the program states.
- [The maximum over nodes counts a set once even when it trains two muscles of one target hard] → That
  is how the source counted the elbow flexors. A target that needs separate counts becomes two targets.
- [The half weight is a heuristic: `pelland2026` calls it an assumption whose best value may differ by
  outcome, exercise, repetition range and training status (Section 4.1)] → It is the best of the three
  counts the source compared (Section 3.4), and the counting rule's description says that it is an
  assumption. A later change may weigh indirect sets differently once studies measure them.
- [The repetition corridors rest on a linear conversion, while the repetitions at a given load vary
  with the exercise, the body region and the person (`iusca2021` p. 7; `acsm2026` p. 864)] → A finding
  near the 29-repetition bound may be wrong in either direction. The descriptions say so, and the bound
  sits far above the repetitions that programs usually prescribe for hypertrophy or power.
- [`strength.reps`, `power.reps` and `hypertrophy.rest` check every block, accessory exercises
  included] → A strength program's curls of 10-12 repetitions, or 45 seconds of rest between sets of
  calf raises in a hypertrophy program, give findings. The load advice of `acsm2026` does not set main
  lifts apart from accessory exercises, and the catalog cannot mark them. The agent explains such
  findings, and a later catalog field can narrow the checks.
- [The rest corridor cannot tell multi-joint from single-joint exercises] → It gives a finding only
  below the single-joint advice. A catalog field for joints (`agent-workflow`) can refine it.
- [The units are specified before any code computes them] → `program-stats` implements and tests them.
  The spec's scenarios fix the expected numbers.
- [PAGA may be superseded in part: HHS is preparing the Physical Activity Guidelines for Americans, 2nd
  edition Supplement: 2027 Steps and Muscle-Strengthening Guidance, which the guideline's page announced
  in October 2026] → The apply step checked the page on 2026-10-23: no supplement issued so far changes
  the adult advice on muscle-strengthening activity or the list of major groups, so `paga2018` stands.
  When the supplement is released, a later change reads it and revisits `major_groups`, both the groups
  in `catalog/targets.yaml` and the corridor, and cites the supplement where it changes them.
- [Labels and descriptions are in English only] → Target and group names have `en` and `ru`; the
  player's texts come with `player-shell`.

## Migration Plan

- No program changes validity or meaning. `catalog/index.yaml` does not change, as it holds no muscles.
- One fixture report changes in two hint lines (`exercise-wrong-types`).
- Rollback is reverting the commit; nothing reads the new files yet.

## Open Questions

- How the player shows band labels in other languages: `player-shell`, with its UI strings.
- `erector_spinae` leaves `kettlebell_swing`, where the back extensors keep the spine still, yet stays in
  the `primary` of `deadlift.barbell`, where they arguably do the same. `primary` lists are out of scope
  here, so `catalog-review` decides. No target holds the key, so no count changes either way.
