# Spec Delta

## MODIFIED Requirements

### Requirement: Validate command
Running `node tools/validate.mjs <file>...` with Node 22 or later and nothing installed SHALL check
each given file against the format and the project's exercise catalog, and print a report for each one
to standard output. The command SHALL NOT modify any file. When the catalog cannot be read, it SHALL
print the catalog file and the problem to standard error, check no file, and exit with code 1.

#### Scenario: Valid file
- **WHEN** the command is run on a file with no errors
- **THEN** it prints the file's report and exits with code 0, even if the report has warnings

#### Scenario: Invalid file among several
- **WHEN** the command is run on two files and one of them has an error
- **THEN** it prints a report for both files and exits with code 1

#### Scenario: Unreadable file
- **WHEN** a given file does not exist or cannot be read
- **THEN** that file's report has an error saying it cannot be read, the other files are still
  checked, and the command exits with code 1

#### Scenario: File not in UTF-8
- **WHEN** a given file is not valid UTF-8 text, for example saved as Windows-1251 or UTF-16
- **THEN** that file's report has an error saying it is not UTF-8 text, and the command exits with
  code 1

#### Scenario: No arguments
- **WHEN** the command is run without files
- **THEN** it prints a usage line and exits with code 1

#### Scenario: Broken catalog
- **WHEN** a file in `catalog/exercises/` is not valid YAML
- **THEN** the command names that file and the problem on standard error, prints no report and exits
  with code 1

#### Scenario: Missing catalog file
- **WHEN** `catalog/muscles.yaml` or the folder `catalog/exercises/` does not exist
- **THEN** standard error names it by its path from the project root, written with `/`, never by a path
  of the operating system, with the reason, such as `(ENOENT)`; no report is printed, and the command
  exits with code 1
