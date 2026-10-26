# Proposal

## Why

The data that programs are checked against now exists: the sources, the targets, the counting rule and
the corridors of `training-guidelines`. Nothing counts with it yet. The weak spot of training plans
written by AI is the numbers: weekly volume, frequency, the gap between what a plan states and what it
holds. So the numbers must come from code. This change adds the program report: it counts a valid
program by the rules of `training-guidelines`, places each value in the band of its corridor, and
reports findings with their sources. The agent then acts on each finding or explains it to the person,
and the player shows the same report later. Findings are advice. The validator still checks form only.

## What Changes

- **`node tools/stats.mjs <file>...`**, with Node 22 and nothing installed, prints a report for each
  file. It never modifies a file.
  - A file with validator errors gets the validator's report instead, and the command exits with
    code 1. Warnings do not stop the count and are not printed.
  - A valid file exits with code 0, with findings or without. A finding never changes the exit code.
  - A broken catalog or guideline file is named on standard error, as `tools/validate.mjs` names a
    broken catalog file.
- **The report**, as text for the AI:
  - **A header**: the goal, the workouts in rotation order, the workouts a week, and the corridors that
    apply.
  - **Findings first**, one per corridor and band, listing its subjects with their values:
    - the targets, groups or blocks;
    - which end of a range falls in the band;
    - the band's description, once;
    - the corridor's reason, once, when it applies a source to a target the source did not measure;
    - its sources as key and locator.

    A finding on a block names the block's path, line and value, as a validator issue does.
  - **Then the numbers, marked as information**:
    - per target: the weekly fractional sets with their band, the sets of each workout that adds to
      them, and the weekly fractional sessions;
    - per major group: the days involved a week.

    Every number's unit is named on its line or in the heading above it. Without `per_week` a weekly
    value is `unknown`, except a 0.
  - **Exercises that count for no target**, named with the reason: no `muscles`, or muscles in no
    target.
  - The count of findings.
- **`core/stats.mjs`**, pure, for the tools now and the player later. It builds the report as data, in
  which each finding is atomic: one corridor, band, subject and value. It also formats the text, in
  which findings are grouped.
- **`core/guidelines.mjs`**, pure. It builds the targets and corridors from the guideline texts, and
  throws an error naming the file when one lacks the shape the count relies on. The full checks stay in
  `node --test`.
- **One parse for both tools.** `core/validate.mjs` hands the parsed program and the line of a path to
  the report. The validator's reports do not change.
- **Fixtures**: eight programs with their expected reports, counted with the project's catalog and
  guidelines. A change to the catalog that moves a count shows as a diff, and `CONTRIBUTING.md` says
  to update the reports with it.
- **A missing catalog or guideline file is named by its path from the project root**, with the
  error's code, in both tools. The validator printed the operating system's path for a missing catalog
  file, which its own requirement to name the catalog file did not intend.
- Not breaking: no program changes validity or meaning, and no validator report changes. Only the
  standard error for a missing catalog file reads differently.

Done when:

- A full-body rotation of two workouts, three times a week, prints the sets and sessions of every
  target and the days of every group. Two findings cite their sources:
  - the targets below the minimum effective dose for hypertrophy;
  - the groups trained on fewer than two days a week.
- A program of push-ups, dips and overhead presses, twice a week and without a goal, is checked only
  for coverage. It shows no back volume and a coverage finding for the back.
- A strength program with a single heavy set of deadlifts gets only the coverage and repetition checks,
  and its header says so.
- A program with a validator error gets the validator's report and no numbers.

Out of scope, for later changes:

- `strength-corridors`: corridors for `strength` beyond `strength.reps`, and the volume of `power`. A
  strength program is checked today for load (`strength.reps`) and frequency (`major_groups`). Three
  options wait for a decision there:
  - the strength tiers of the volume meta-analysis per target, as a stated extrapolation, which needs
    data only;
  - a unit per exercise;
  - a unit of sets per block.

  The last one also has to decide what a single heavy set means, so that a deadlift of 1×5 does not
  give a finding.
- `training-defaults`: the agent's defaults per goal and training status, and `spec/TRAINING.md`.
- `agent-workflow`, in `spec/AUTHORING.md`: how the agent uses the report. It acts on each finding or
  explains it to the person, and takes the numbers as information, not as targets.
- `player-shell`: the program preview built from the report data, and band labels in other languages.
- Findings against the person's profile, and the duration of a workout (`agent-workflow`,
  `session-duration`).
- A machine-readable output of `tools/stats`: the player reads the report data from `core/stats`.

## Capabilities

### New Capabilities

- `program-stats`: the `tools/stats` command and the program report. It covers:
  - which programs get one;
  - the header;
  - the findings and their grouping;
  - findings on blocks;
  - the numbers and how they are shown;
  - exercises that count for nothing;
  - exit codes.

  What a set counts for, the units and the weekly values stay in `training-guidelines`, which this
  capability refers to.

### Modified Capabilities

- `program-validation`: Validate command gains the scenario of a missing catalog file, named on
  standard error by its path from the project root. The requirement's text does not change, and no
  report does.

`training-guidelines` does not change: it already defines the counting, the units and the corridors
that apply to a goal.

## Impact

- New:
  - `core/guidelines.mjs`, `core/stats.mjs`;
  - `tools/stats.mjs`, `tools/stats.test.mjs`;
  - `tools/program.mjs`, the reading of a program file, shared by both commands;
  - `schema/stats/`, the fixtures, and `schema/stats.test.mjs`, their runner.
- Changed:
  - `core/validate.mjs`: the parse is shared, and `validate` returns the same issues as before;
  - `core/catalog.mjs`: its YAML helper is exported for `core/guidelines.mjs`;
  - `tools/catalog.mjs`: a loader for the guidelines beside `loadCatalog`, and a missing file named by
    its path from the project root;
  - `tools/validate.mjs`: the reading of a program file moves to a module that both commands import;
  - `schema/catalog.test.mjs`: the message of a missing catalog file;
  - `CLAUDE.md`: the commands, the architecture of the report, and the end of the "planned" wording;
  - `CONTRIBUTING.md`: what the report does, and updating its expected reports when muscles change.
- Not touched:
  - the schema and its fixtures;
  - the catalog and guideline data;
  - `catalog/index.yaml`.
