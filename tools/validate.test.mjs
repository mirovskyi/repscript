import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('./validate.mjs', import.meta.url));
const valid = fileURLToPath(new URL('../schema/tests/minimal.repscript.yaml', import.meta.url));
const invalid = fileURLToPath(new URL('../schema/tests/unknown-field.repscript.yaml', import.meta.url));

/** @param {string[]} args */
function run(...args) {
  const { status, stdout, stderr } = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  return { status, stdout, stderr };
}

/**
 * Splits the output into reports, each from a file path line to its counts line.
 * @param {string} stdout
 */
function reports(stdout) {
  return stdout.split(/(?<=^errors: \d+, warnings: \d+\n)/m).filter(Boolean);
}

test('valid file: exit 0 even with the draft warning', () => {
  const { status, stdout } = run(valid);
  assert.equal(status, 0);
  assert.ok(stdout.startsWith(`${valid}\nwarning: repscript (line 1) = 0\n`), stdout);
});

test('invalid file among several: both reports, exit 1', () => {
  const { status, stdout } = run(valid, invalid);
  assert.equal(status, 1);
  const [first, second] = reports(stdout);
  assert.ok(first.startsWith(`${valid}\n`), first);
  assert.ok(second.startsWith(`${invalid}\n`), second);
  assert.match(second, /errors: 7, warnings: 1\n$/);
});

test('missing file: cannot-read error, other files still checked, exit 1', () => {
  const missing = join(tmpdir(), 'repscript-no-such-file.yaml');
  const { status, stdout } = run(missing, valid);
  assert.equal(status, 1);
  const [first, second] = reports(stdout);
  assert.ok(first.startsWith(`${missing}\nerror: (top level)\n  Cannot read the file: `), first);
  assert.ok(second.startsWith(`${valid}\n`), second);
});

for (const [encoding, bytes] of [
  // "title: Сила" with the Cyrillic word in Windows-1251.
  ['Windows-1251', Buffer.concat([Buffer.from('repscript: 0\ntitle: '), Buffer.from([0xd1, 0xe8, 0xeb, 0xe0]), Buffer.from('\n')])],
  // Every byte is below 0x80 ("С" is 21 04, "r" is 72 00), so it decodes as UTF-8 without an error.
  ['UTF-16LE without a byte order mark', Buffer.from('repscript: 0\ntitle: Сила\n', 'utf16le')],
]) {
  test(`${encoding} file: not-UTF-8 error, exit 1`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'repscript-'));
    try {
      const file = join(dir, 'program.repscript.yaml');
      writeFileSync(file, bytes);
      const { status, stdout } = run(file);
      assert.equal(status, 1);
      assert.equal(stdout, `${file}\nerror: (top level)\n  The file is not UTF-8 text.\n  Hint: Save the file as UTF-8.\nerrors: 1, warnings: 0\n`);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
}

test('no arguments: usage, exit 1', () => {
  const { status, stdout, stderr } = run();
  assert.equal(status, 1);
  assert.equal(stdout, '');
  assert.equal(stderr, 'Usage: node tools/validate.mjs <file>...\n');
});
