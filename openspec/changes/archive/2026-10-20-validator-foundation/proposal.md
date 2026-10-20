# Proposal

## Why

The MVP loop depends on an AI agent that writes a program file, runs the validator, and fixes what it
reports until the file is clean. Before the format can grow, the path from a YAML file to an error an AI
can act on (what is wrong, where, how to fix it) has to exist and be pinned by tests. This change
builds that path on a deliberately tiny schema, so the format changes that follow only add schema
fields and fixtures.

## What Changes

- Vendor the `yaml` parser (eemeli, ISC) as a single ESM file. It reads YAML 1.2 core and keeps
  source positions for line numbers.
- Add a pure `core/` (no I/O, runs in Node and later in the browser player). It parses with source
  positions, interprets a small subset of JSON Schema, and formats issues as path, line, message and
  hint.
- Add `schema/repscript.schema.json` as the single source of truth for the format. It holds only
  `repscript`, `id`, `title` and `workouts[].id`. Every field's `description` doubles as the hint
  shown in errors.
- Add `tools/validate.mjs <file>...`: reads UTF-8 files, prints a report per file and exits non-zero
  on errors. It never modifies files and never crashes on a bad file (broken aliases included).
- Add `schema/tests/`: fixture files with golden expected output, run by `node --test`. A schema
  lint test rejects keywords the interpreter does not support and schemas without a description.
- Add CI (GitHub Actions: `node --test`, `tsc --noEmit` over JSDoc types) and an MIT `LICENSE`.

The roadmap's "done when" is met: broken YAML, a wrong type, a missing required field and an unknown
field (with a "did you mean" hint) each produce an error with a line and a hint, and `repscript: 0`
produces the draft-version warning. One difference from the roadmap wording: a YAML syntax error
carries a line and a column but no path, because the structure cannot be read past the error.

## Capabilities

### New Capabilities
- `program-format`: what a valid program file is. Covers encoding (YAML 1.2 core, JSON accepted),
  the format version, the top-level fields, workouts, and the closed field set with `x-*`
  extensions. Later format changes add their fields here.
- `program-validation`: how the validator checks a file and reports problems. Covers the command,
  the issue format, and the error and warning kinds an AI agent acts on.

### Modified Capabilities

None. There are no existing specs.

## Impact

- New files and directories: `vendor/yaml.mjs`, `core/`, `schema/`,
  `schema/tests/`, `tools/validate.mjs`, `tsconfig.json`, `.github/workflows/ci.yml`, `LICENSE`,
  `.gitignore`.
- Runtime dependencies: none to install. Node 22+ and the vendored `yaml` 2.9.1 only.
- Dev-only dependencies, installed in CI only: `typescript`, `@types/node`.
- The project folder is not a git repository yet, so CI runs only after it is pushed to GitHub.
  Setting up the repository is outside this change.
