import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('./stats.mjs', import.meta.url));
const fullBody = fileURLToPath(new URL('../schema/stats/full-body.repscript.yaml', import.meta.url));
const invalid = fileURLToPath(new URL('../schema/tests/unknown-field.repscript.yaml', import.meta.url));
const NO_NUMBERS = 'No numbers: fix the errors above first.\n';

/** @param {string[]} args */
function run(...args) {
  const { status, stdout, stderr } = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  return { status, stdout, stderr };
}

/**
 * Splits the output into reports, each from a file path line to its findings line or its no-numbers line.
 * @param {string} stdout
 */
function reports(stdout) {
  return stdout.split(/(?<=^(?:findings: \d+|No numbers: fix the errors above first\.)\n)/m).filter(Boolean);
}

test('valid file with findings: the report, exit 0, without the draft warning', () => {
  const { status, stdout, stderr } = run(fullBody);
  assert.equal(status, 0);
  assert.equal(stderr, '');
  const expected = readFileSync(new URL('../schema/stats/full-body.stats.txt', import.meta.url), 'utf8');
  assert.equal(stdout, `${fullBody}\n${expected.replaceAll('\r\n', '\n')}`);
  assert.match(stdout, /\nfindings: 2\n$/);
  assert.doesNotMatch(stdout, /draft/);
});

test('invalid file among several: both reports, the validator report and no numbers, exit 1', () => {
  const { status, stdout } = run(fullBody, invalid);
  assert.equal(status, 1);
  const [first, second, ...rest] = reports(stdout);
  assert.deepEqual(rest, []);
  assert.ok(first.startsWith(`${fullBody}\ngoal: hypertrophy\n`), first);
  // The validator's report as it is, warnings included, then the line that explains the missing numbers.
  const validator = spawnSync(process.execPath, [fileURLToPath(new URL('./validate.mjs', import.meta.url)), invalid], {
    encoding: 'utf8',
  });
  assert.equal(second, `${validator.stdout}${NO_NUMBERS}`);
  assert.match(second, /\nerrors: 7, warnings: 1\nNo numbers: fix the errors above first\.\n$/);
});

test('missing file: the cannot-read report, no numbers, other files still reported, exit 1', () => {
  const missing = join(tmpdir(), 'repscript-no-such-file.yaml');
  const { status, stdout } = run(missing, fullBody);
  assert.equal(status, 1);
  const [first, second] = reports(stdout);
  assert.ok(first.startsWith(`${missing}\nerror: (top level)\n  Cannot read the file: `), first);
  assert.ok(first.endsWith(`  Hint: Check the file path.\nerrors: 1, warnings: 0\n${NO_NUMBERS}`), first);
  assert.ok(second.startsWith(`${fullBody}\ngoal: hypertrophy\n`), second);
});

test('no arguments: usage, exit 1', () => {
  const { status, stdout, stderr } = run();
  assert.equal(status, 1);
  assert.equal(stdout, '');
  assert.equal(stderr, 'Usage: node tools/stats.mjs <file>...\n');
});

const RESTORE =
  'The catalog comes with the project: restore catalog/ with git checkout -- catalog, or download the project again.\n';

/**
 * Runs a copy of the tool on the full-body program after breaking its catalog.
 * @param {(catalog: string) => void} breakCatalog
 */
function runBroken(breakCatalog) {
  const dir = mkdtempSync(join(tmpdir(), 'repscript-'));
  try {
    const root = new URL('..', import.meta.url);
    for (const path of ['tools', 'core', 'vendor', 'catalog', 'schema/repscript.schema.json'])
      cpSync(new URL(path, root), join(dir, path), { recursive: true });
    breakCatalog(join(dir, 'catalog'));
    const { status, stdout, stderr } = spawnSync(process.execPath, [join(dir, 'tools', 'stats.mjs'), fullBody], {
      encoding: 'utf8',
    });
    return { status, stdout, stderr };
  } finally {
    rmSync(dir, { recursive: true });
  }
}

test('broken corridors file: the file and the problem on standard error, no report, exit 1', () => {
  const result = runBroken(catalog => writeFileSync(join(catalog, 'corridors.yaml'), '- id: [hypertrophy\n'));
  assert.deepEqual(result, {
    status: 1,
    stdout: '',
    stderr:
      'Cannot read the guidelines: catalog/corridors.yaml (line 2): Flow sequence in block collection must be sufficiently indented and end with a ]\n' +
      RESTORE,
  });
});

test('missing targets file: named by its path from the project root, exit 1', () => {
  const result = runBroken(catalog => rmSync(join(catalog, 'targets.yaml')));
  assert.deepEqual(result, {
    status: 1,
    stdout: '',
    stderr: `Cannot read the guidelines: catalog/targets.yaml: the file cannot be read (ENOENT).\n${RESTORE}`,
  });
});

test('catalog entry with an unknown muscle key: named on standard error, no report, exit 1', () => {
  // The validator does not read an entry's muscles, so only the count would stumble on them.
  const result = runBroken(catalog => {
    const pushup = join(catalog, 'exercises', 'pushup.yaml');
    writeFileSync(pushup, readFileSync(pushup, 'utf8').replace('primary: [pecs]', 'primary: [pec]'));
  });
  assert.deepEqual(result, {
    status: 1,
    stdout: '',
    stderr: `Cannot read the catalog: catalog/exercises/pushup.yaml: muscles.primary is not a list of muscle keys.\n${RESTORE}`,
  });
});

test('broken catalog entry: the file and the problem on standard error, no report, exit 1', () => {
  const result = runBroken(catalog => writeFileSync(join(catalog, 'exercises', 'pushup.yaml'), 'id: [pushup\n'));
  assert.deepEqual(result, {
    status: 1,
    stdout: '',
    stderr:
      'Cannot read the catalog: catalog/exercises/pushup.yaml (line 2): Flow sequence in block collection must be sufficiently indented and end with a ]\n' +
      RESTORE,
  });
});
