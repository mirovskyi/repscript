import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildCatalog, buildIndex, equipmentSatisfies, normalizeName } from '../core/catalog.mjs';
import { DESCRIPTIONS, programEquipment } from '../core/exercises.mjs';
import { formatIssues, validateEntry } from '../core/validate.mjs';
import { loadCatalog, readCatalogFiles } from '../tools/catalog.mjs';
import { parse } from '../vendor/yaml.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TEST_CATALOG = new URL('./tests/catalog/', import.meta.url);
const PROJECT_CATALOG = new URL('../catalog/', import.meta.url);
const SCHEMA = JSON.parse(readFileSync(new URL('./repscript.schema.json', import.meta.url), 'utf8'));

test('normalizeName ignores case, separators, ё and English plurals', () => {
  assert.equal(normalizeName('Wide-grip pull-ups'), normalizeName('Wide grip pullup'));
  assert.equal(normalizeName('Wide-grip pull-ups'), 'widegrippullup');
  assert.equal(normalizeName('PUSH UPS'), normalizeName('Push-up'));
  assert.equal(normalizeName('Жим лёжа'), normalizeName('жим лежа'));
  assert.notEqual(normalizeName('Подтягивания широким хватом'), normalizeName('Широкие подтягивания'));
  assert.deepEqual(['flies', 'crunches', 'presses', 'raises', 'squats', 'ups'].map(normalizeName), [
    'fly',
    'crunch',
    'press',
    'raise',
    'squat',
    'up',
  ]);
  assert.deepEqual(['press', 'glass', 'us'].map(normalizeName), ['press', 'glass', 'us']);
  // Only Latin words are folded: a Russian plural stays as it is.
  assert.equal(normalizeName('Махи гирей'), 'махигирей');
  assert.equal(normalizeName('ｐｕｓｈ－ｕｐ'), 'pushup');
});

test('buildCatalog on the test catalog', () => {
  const catalog = buildCatalog(readCatalogFiles(TEST_CATALOG));
  assert.deepEqual(
    [...catalog.exercises.keys()],
    [
      'bench_press.dumbbell',
      'dip',
      'kettlebell_swing',
      'lateral_raise.dumbbell',
      'plank',
      'pullup',
      'pullup.wide',
      'pullup.wide_grip',
      'pushup',
      'row.dumbbell',
      'squat.goblet',
      'walk',
    ],
  );
  assert.deepEqual(catalog.exercises.get('walk'), {
    id: 'walk',
    names: { en: 'Walk', ru: 'Ходьба' },
    equipment: [],
    muscles: { primary: ['quads'] },
  });
  assert.equal(catalog.names.get('widegrippullup'), 'pullup.wide');
  assert.equal(catalog.names.get(normalizeName('Подтягивания широким хватом')), 'pullup.wide');
  assert.equal(catalog.names.get('отжиманияотпола'), 'pushup');
  assert.ok(![...catalog.names.values()].includes('pullup.wide_grip'));
  assert.deepEqual(
    [...catalog.muscles.keys()],
    [
      'back',
      'lats',
      'chest',
      'pecs',
      'shoulders',
      'deltoids',
      'delt_front',
      'delt_side',
      'arms',
      'biceps',
      'triceps',
      'core',
      'abs',
      'legs',
      'quads',
    ],
  );
  assert.deepEqual(catalog.muscles.get('shoulders'), { group: true, children: ['deltoids'] });
  assert.deepEqual(catalog.muscles.get('deltoids'), { group: false, children: ['delt_front', 'delt_side'] });
  assert.deepEqual(catalog.muscles.get('delt_front'), { group: false, children: [] });
  assert.deepEqual(
    [...catalog.equipment],
    ['dumbbells', 'kettlebell', 'bench', 'bench.adjustable', 'pullup_bar', 'dip_bars', 'backpack'],
  );
});

test('buildCatalog sorts entries by id, not by file name', () => {
  /** @param {string} id */
  const entry = id => ({ file: `catalog/exercises/${id}.yaml`, source: `id: ${id}\nnames: {en: ${id}}\n` });
  const dictionary = { file: 'catalog/x.yaml', source: '[]' };
  // File order: pullup.wide.yaml sorts before pullup.yaml.
  const catalog = buildCatalog({
    exercises: [entry('pullup.wide'), entry('pullup.wide_grip'), entry('pullup')],
    muscles: dictionary,
    equipment: dictionary,
  });
  assert.deepEqual([...catalog.exercises.keys()], ['pullup', 'pullup.wide', 'pullup.wide_grip']);
});

test('the first entry in id order owns a shared name', () => {
  const dictionary = { file: 'catalog/x.yaml', source: '[]' };
  const catalog = buildCatalog({
    exercises: [
      { file: 'b.yaml', source: 'id: b\nnames: {en: Row}\n' },
      { file: 'a.yaml', source: 'id: a\nnames: {en: Rows}\naliases: [Row, 5]\n' },
      { file: 'c.yaml', source: 'id: c\nnames: 5\naliases: x\n' },
    ],
    muscles: dictionary,
    equipment: dictionary,
  });
  assert.deepEqual([...catalog.names], [['row', 'a']]);
});

/**
 * buildCatalog's error for one broken file, the others being valid.
 * @param {'exercises' | 'muscles' | 'equipment'} which
 * @param {string} source
 */
function buildError(which, source) {
  const files = {
    exercises: [{ file: 'catalog/exercises/pushup.yaml', source: 'id: pushup\nnames: {en: Push-up}\n' }],
    muscles: { file: 'catalog/muscles.yaml', source: '[{id: back, names: {en: Back}}]' },
    equipment: { file: 'catalog/equipment.yaml', source: '[{id: bench, names: {en: Bench}}]' },
  };
  if (which === 'exercises') files.exercises[0].source = source;
  else files[which].source = source;
  try {
    buildCatalog(files);
  } catch (error) {
    return /** @type {Error} */ (error).message;
  }
  return 'no error';
}

test('buildCatalog names the file it cannot use', () => {
  assert.equal(
    buildError('exercises', 'id: pushup\nnames: {en: Push-up\n'),
    'catalog/exercises/pushup.yaml (line 3): Flow map in block collection must be sufficiently indented and end with a }',
  );
  assert.equal(
    buildError('exercises', 'id: *pushup\n'),
    'catalog/exercises/pushup.yaml: Unresolved alias (the anchor must be set before the alias): pushup',
  );
  assert.equal(
    buildError('exercises', 'names: {en: Push-up}\n'),
    'catalog/exercises/pushup.yaml: expected an exercise entry, a mapping with a string id.',
  );
  assert.equal(
    buildError('exercises', '- id: pushup\n'),
    'catalog/exercises/pushup.yaml: expected an exercise entry, a mapping with a string id.',
  );
  assert.equal(
    buildError('muscles', 'id: back\n'),
    'catalog/muscles.yaml: expected a list of mappings, each with a string id.',
  );
  assert.equal(
    buildError('equipment', '- id: bench\n- bench.adjustable\n'),
    'catalog/equipment.yaml: [1] is not a mapping with a string id.',
  );
  assert.equal(
    buildError('muscles', '- id: back\n  children:\n    - id: 5\n'),
    'catalog/muscles.yaml: [0].children[0] is not a mapping with a string id.',
  );
  assert.equal(
    buildError('muscles', '- id: back\n  children: lats\n'),
    'catalog/muscles.yaml: children of back is not a list.',
  );
  assert.equal(buildError('muscles', '- id: back\n  children: [{id: lats}]\n'), 'no error');
});

test('readCatalogFiles returns every file with its / path from the project root', () => {
  const files = readCatalogFiles(TEST_CATALOG);
  const dir = 'schema/tests/catalog';
  const names = readdirSync(new URL('exercises/', TEST_CATALOG)).sort();
  assert.deepEqual(
    files.exercises.map(({ file }) => file),
    names.map(name => `${dir}/exercises/${name}`),
  );
  for (const { file, source } of [...files.exercises, files.muscles, files.equipment])
    assert.equal(source, readFileSync(join(ROOT, file), 'utf8'), file);
  assert.equal(files.muscles.file, `${dir}/muscles.yaml`);
  assert.equal(files.equipment.file, `${dir}/equipment.yaml`);
});

test('loadCatalog returns the two error lines for a broken catalog', () => {
  const dir = mkdtempSync(join(tmpdir(), 'repscript-catalog-'));
  try {
    cpSync(fileURLToPath(TEST_CATALOG), dir, { recursive: true });
    const broken = join(dir, 'exercises', 'pushup.yaml');
    writeFileSync(broken, 'id: [pushup\n');
    const file = relative(ROOT, broken).replaceAll('\\', '/');
    assert.deepEqual(loadCatalog(pathToFileURL(`${dir}/`)), {
      error: [
        `Cannot read the catalog: ${file} (line 2): Flow sequence in block collection must be sufficiently indented and end with a ]`,
        'The catalog comes with the project: restore catalog/ with git checkout -- catalog, or download the project again.',
      ].join('\n'),
    });
    // A missing file or folder is named by its path from the project root, not by the operating system's.
    const firstLine = () =>
      /** @type {{ error: string }} */ (loadCatalog(pathToFileURL(`${dir}/`))).error.split('\n')[0];
    rmSync(join(dir, 'muscles.yaml'));
    assert.equal(
      firstLine(),
      `Cannot read the catalog: ${relative(ROOT, join(dir, 'muscles.yaml')).replaceAll('\\', '/')}: the file cannot be read (ENOENT).`,
    );
    rmSync(join(dir, 'exercises'), { recursive: true });
    assert.equal(
      firstLine(),
      `Cannot read the catalog: ${relative(ROOT, join(dir, 'exercises')).replaceAll('\\', '/')}/: the file cannot be read (ENOENT).`,
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
  const { catalog } = /** @type {{ catalog: import('../core/catalog.mjs').Catalog }} */ (loadCatalog(TEST_CATALOG));
  assert.ok(catalog.exercises.has('pushup'));
});

test('loadCatalog names a file that is not UTF-8 text or not a .yaml entry', () => {
  const dir = mkdtempSync(join(tmpdir(), 'repscript-catalog-'));
  try {
    cpSync(fileURLToPath(TEST_CATALOG), dir, { recursive: true });
    const url = pathToFileURL(`${dir}/`);
    const fileOf = (/** @type {string} */ name) => relative(ROOT, join(dir, name)).replaceAll('\\', '/');
    const firstLine = () => /** @type {{ error: string }} */ (loadCatalog(url)).error.split('\n')[0];
    const hang = join(dir, 'exercises', 'hang.yaml');
    const notUtf8 = `Cannot read the catalog: ${fileOf('exercises/hang.yaml')}: the file is not UTF-8 text.`;
    // "names: {ru: Вис}" with the Cyrillic word in Windows-1251.
    writeFileSync(
      hang,
      Buffer.concat([Buffer.from('id: hang\nnames: {ru: '), Buffer.from([0xc2, 0xe8, 0xf1]), Buffer.from('}\n')]),
    );
    assert.equal(firstLine(), notUtf8);
    // Every byte is below 0x80, so it decodes as UTF-8, but with NULs.
    writeFileSync(hang, Buffer.from('id: hang\n', 'utf16le'));
    assert.equal(firstLine(), notUtf8);
    rmSync(hang);
    writeFileSync(join(dir, 'exercises', 'hang.yml'), 'id: hang\n');
    assert.equal(
      firstLine(),
      `Cannot read the catalog: ${fileOf('exercises/hang.yml')}: entry files are named <id>.yaml.`,
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('the project catalog loads and has the exercises the CLI tests use', () => {
  const result = loadCatalog(PROJECT_CATALOG);
  assert.ok('catalog' in result, 'error' in result ? result.error : '');
  assert.ok(result.catalog.exercises.has('pushup'));
  assert.ok(result.catalog.exercises.has('pullup'));
});

test('programEquipment: the equipment of the exercises plus every implement', () => {
  const catalog = buildCatalog(readCatalogFiles(TEST_CATALOG));
  const program = {
    exercises: [{ id: 'my.towel_pullup', names: { en: 'Towel pull-up' } }],
    workouts: [
      {
        id: 'A',
        blocks: [
          { exercise: 'row.dumbbell', sets: 3, reps: 10, load: { kg: 18, implement: 'dumbbells' } },
          { exercise: 'pullup.wide', sets: 3, reps: 5, load: { bw: true, add_kg: 5, implement: 'backpack' } },
          // Equipment unknown: adds nothing.
          { exercise: 'my.towel_pullup', sets: 3, reps: 5 },
          { exercise: 'no_such_exercise', sets: 3, reps: 5, load: { kg: 5 } },
          { exercise: 5, sets: 3, reps: 5 },
        ],
      },
    ],
  };
  assert.deepEqual(programEquipment(program, catalog), ['backpack', 'bench', 'dumbbells', 'pullup_bar']);
  assert.deepEqual(programEquipment('A', catalog), []);
});

/**
 * The formatted report of validateEntry against the test catalog.
 * @param {string} file
 * @param {string} source
 */
function entryReport(file, source) {
  return formatIssues(validateEntry(source, SCHEMA, buildCatalog(readCatalogFiles(TEST_CATALOG)), file));
}

/** The required fields of a catalog entry, after its id. */
const HANG = 'names: {en: Dead hang, ru: Вис на турнике}\nequipment: [pullup_bar]\nmuscles: {primary: [lats]}\n';

test('validateEntry: catalog id rules', () => {
  assert.equal(entryReport('catalog/exercises/hang.yaml', `id: hang\n${HANG}`), 'errors: 0, warnings: 0\n');
  assert.equal(
    entryReport('catalog/exercises/Dead-Hang.yaml', `id: Dead-Hang\n${HANG}`),
    `error: id (line 1) = "Dead-Hang"
  An exercise id is lowercase Latin letters, digits, _ and dots, starting with a letter.
  Hint: Catalog ids name the movement, then a variant after a dot, e.g. id: row.dumbbell
errors: 1, warnings: 0
`,
  );
  assert.equal(
    entryReport('catalog/exercises/my.hang.yaml', `id: my.hang\n${HANG}`),
    `error: id (line 1) = "my.hang"
  my. ids are for own exercises in programs, not for the catalog.
  Hint: Remove my. from the id and from the file name.
errors: 1, warnings: 0
`,
  );
  assert.equal(
    entryReport(
      'catalog/exercises/pullup.yaml',
      'id: pullup.wide\nnames: {en: Wide-grip pull-up, ru: Подтягивания широким хватом}\nequipment: [pullup_bar]\nmuscles: {primary: [lats]}\n',
    ),
    `error: id (line 1) = "pullup.wide"
  The file is named pullup.yaml, but the id is pullup.wide.
  Hint: Name the file pullup.wide.yaml, or change the id.
errors: 1, warnings: 0
`,
  );
});

test('validateEntry: a catalog entry needs names in en and ru, muscles and equipment', () => {
  assert.equal(
    entryReport('catalog/exercises/hang.yaml', 'id: hang\nnames: {en: Dead hang}\n'),
    `error: muscles (line 1)
  A catalog entry needs muscles.
  Hint: ${DESCRIPTIONS.muscles}
error: equipment (line 1)
  A catalog entry needs equipment.
  Hint: List what the exercise needs, or write equipment: [] when it needs nothing.
error: names.ru (line 2)
  A catalog entry needs a name in ru.
  Hint: ${DESCRIPTIONS.names}
errors: 3, warnings: 0
`,
  );
});

test('validateEntry: catalog muscle keys name muscles, not groups', () => {
  const muscles = (/** @type {string} */ key) =>
    `id: hang\nnames: {en: Dead hang, ru: Вис на турнике}\nequipment: [pullup_bar]\nmuscles: {primary: [${key}]}\n`;
  assert.equal(
    entryReport('catalog/exercises/hang.yaml', muscles('arms')),
    `error: muscles.primary[0] (line 4) = "arms"
  This is a muscle group: a catalog entry names the muscles themselves.
  Hint: Write one of its muscles: biceps, triceps.
errors: 1, warnings: 0
`,
  );
  // The group legs is one edit away, but not a candidate here.
  assert.equal(
    entryReport('catalog/exercises/hang.yaml', muscles('leg')),
    `error: muscles.primary[0] (line 4) = "leg"
  Unknown muscle key.
  Hint: Muscle keys (catalog/muscles.yaml): lats, pecs, deltoids, delt_front, delt_side, biceps, triceps, abs, quads.
errors: 1, warnings: 0
`,
  );
});

test('validateEntry: names taken by an earlier entry, and a replacement outside the catalog', () => {
  assert.equal(
    entryReport(
      'catalog/exercises/pullup.towel.yaml',
      'id: pullup.towel\nnames: {en: Towel pull-up, ru: Подтягивания на полотенце}\naliases: [Подтягивания]\nequipment: [pullup_bar]\nmuscles: {primary: [lats]}\n',
    ),
    `error: aliases[0] (line 3) = "Подтягивания"
  The catalog entry pullup already has a matching name.
  Hint: Give each catalog exercise its own names. Keep a shared name as an alias of one entry only.
errors: 1, warnings: 0
`,
  );
  assert.equal(
    entryReport('catalog/exercises/hang.yaml', `id: hang\n${HANG}deprecated: true\nreplaced_by: my.towel_pullup\n`),
    `error: replaced_by (line 6) = "my.towel_pullup"
  No catalog exercise has this id.
  Hint: ${DESCRIPTIONS.replaced_by}
errors: 1, warnings: 0
`,
  );
  assert.equal(
    entryReport('catalog/exercises/hang.yaml', '- id: hang\n'),
    `error: (top level) (line 1)
  Expected a mapping, found a list.
  Hint: ${SCHEMA.properties.exercises.items.description}
errors: 1, warnings: 0
`,
  );
});

test('validateEntry: names under x- fields are not names', () => {
  assert.equal(
    entryReport(
      'catalog/exercises/hang.yaml',
      'id: hang\nnames: {en: Dead hang, ru: Вис на турнике, x-source: Pull-up}\nequipment: [pullup_bar]\nmuscles: {primary: [lats]}\n',
    ),
    'errors: 0, warnings: 0\n',
  );
});

test('validateEntry: an entry and its muscles are closed, and primary needs a muscle', () => {
  assert.equal(
    entryReport('catalog/exercises/hang.yaml', `id: hang\n${HANG}cues: [Keep the shoulders down]\n`),
    `error: cues (line 5)
  Unknown field.
  Hint: Allowed fields here: id, names, aliases, equipment, muscles, deprecated, replaced_by. Extension fields start with x-.
errors: 1, warnings: 0
`,
  );
  const primary = SCHEMA.properties.exercises.items.properties.muscles.properties.primary.description;
  const muscles = (/** @type {string} */ value) =>
    entryReport(
      'catalog/exercises/hang.yaml',
      `id: hang\nnames: {en: Dead hang, ru: Вис на турнике}\nequipment: [pullup_bar]\nmuscles: ${value}\n`,
    );
  assert.equal(
    muscles('{primary: [lats], tempo: slow}'),
    `error: muscles.tempo (line 4)
  Unknown field.
  Hint: Allowed fields here: primary, secondary. Extension fields start with x-.
errors: 1, warnings: 0
`,
  );
  assert.equal(
    muscles('{secondary: [biceps]}'),
    `error: muscles.primary (line 4)
  Missing required field.
  Hint: ${primary}
errors: 1, warnings: 0
`,
  );
  assert.equal(
    muscles('{primary: []}'),
    `error: muscles.primary (line 4)
  Expected at least 1 item.
  Hint: ${primary}
errors: 1, warnings: 0
`,
  );
});

test('validateEntry: the id form', () => {
  for (const id of ['Pull-Up', 'pull-up', '1pullup', 'pullup.', 'pull..up', '.pullup']) {
    assert.match(
      entryReport(`catalog/exercises/${id}.yaml`, `id: "${id}"\n${HANG}`),
      /^error: id \(line 1\) = .*\n {2}An exercise id is lowercase Latin letters, digits, _ and dots, starting with a letter\.\n/,
      id,
    );
  }
  for (const id of ['pullup.wide', 'split_squat.bulgarian', 'hang2'])
    assert.equal(entryReport(`catalog/exercises/${id}.yaml`, `id: ${id}\n${HANG}`), 'errors: 0, warnings: 0\n', id);
});

/**
 * The report of every failing file of a catalog made of inline entries and the test catalog's
 * dictionaries, each under its path.
 * @param {Record<string, string>} entries the fields after the id, by id
 */
function inlineCatalogReport(entries) {
  const exercises = Object.entries(entries).map(([id, fields]) => ({
    file: `catalog/exercises/${id}.yaml`,
    source: `id: ${id}\n${fields}`,
  }));
  const catalog = buildCatalog({ ...readCatalogFiles(TEST_CATALOG), exercises });
  return exercises
    .map(({ file, source }) => ({ file, issues: validateEntry(source, SCHEMA, catalog, file) }))
    .filter(({ issues }) => issues.length)
    .map(({ file, issues }) => `${file}\n${formatIssues(issues)}`)
    .join('');
}

test('catalog checks: of two entries with a matching name, the later one in id order is reported', () => {
  const rest = 'equipment: []\nmuscles: {primary: [abs]}\n';
  const taken = `  The catalog entry aa already has a matching name.
  Hint: Give each catalog exercise its own names. Keep a shared name as an alias of one entry only.
errors: 1, warnings: 0
`;
  assert.equal(
    inlineCatalogReport({
      aa: `names: {en: Alpha, ru: Альфа}\naliases: [Shared]\n${rest}`,
      bb: `names: {en: Beta, ru: Бета}\naliases: [Shared]\n${rest}`,
      cc: `names: {en: Shared, ru: Цэ}\n${rest}`,
    }),
    `catalog/exercises/bb.yaml\nerror: aliases[0] (line 3) = "Shared"\n${taken}` +
      `catalog/exercises/cc.yaml\nerror: names.en (line 2) = "Shared"\n${taken}`,
  );
});

test('catalog checks: a replacement cycle is reported at each entry on it', () => {
  const rest = 'equipment: []\nmuscles: {primary: [abs]}\ndeprecated: true\n';
  const cycle = (/** @type {string} */ ids) => `error: (top level) (line 1)
  The replacements form a cycle: ${ids}.
  Hint: End the chain at an exercise that is not deprecated.
errors: 1, warnings: 0
`;
  assert.equal(
    inlineCatalogReport({
      cc: `names: {en: Cee, ru: Цэ}\n${rest}replaced_by: dd\n`,
      dd: `names: {en: Dee, ru: Дэ}\n${rest}replaced_by: cc\n`,
    }),
    `catalog/exercises/cc.yaml\n${cycle('cc, dd, cc')}catalog/exercises/dd.yaml\n${cycle('dd, cc, dd')}`,
  );
});

for (const [name, dir] of /** @type {[string, URL][]} */ ([
  ['test', TEST_CATALOG],
  ['project', PROJECT_CATALOG],
])) {
  test(`every entry of the ${name} catalog passes the catalog checks`, () => {
    const files = readCatalogFiles(dir);
    const catalog = buildCatalog(files);
    const reports = files.exercises
      .map(({ file, source }) => ({ file, issues: validateEntry(source, SCHEMA, catalog, file) }))
      .filter(({ issues }) => issues.length)
      .map(({ file, issues }) => `${file}\n${formatIssues(issues)}`);
    assert.equal(reports.join(''), '');
  });

  test(`the dictionaries of the ${name} catalog follow their requirements`, () => {
    assert.deepEqual(dictionaryProblems(readCatalogFiles(dir)), []);
  });
}

test('the dictionary check finds each kind of problem', () => {
  const file = (/** @type {string} */ name, /** @type {string} */ source) => ({ file: name, source });
  const muscles = `- id: back
  names: {en: Back}
  children:
    - id: Lats
      names: {en: Lats, ru: Широчайшие}
      children:
        - id: back
          names: {en: Upper lats, ru: Верх}
          children:
            - {id: deep, names: {en: Deep, ru: Глубокие}}
`;
  const equipment =
    '- {id: bench.adjustable, names: {en: Adjustable bench, ru: Скамья}}\n- {id: Bar, names: {ru: Гриф}}\n- {id: Bar, names: {en: Bar, ru: Гриф}}\n';
  assert.deepEqual(
    dictionaryProblems({ exercises: [], muscles: file('m.yaml', muscles), equipment: file('e.yaml', equipment) }),
    [
      'm.yaml: back: no name in ru',
      'm.yaml: Lats: not in the key form',
      'm.yaml: back: repeated',
      'm.yaml: back: a fourth level',
      'e.yaml: bench.adjustable: no bench in the dictionary',
      'e.yaml: Bar: not in the id form',
      'e.yaml: Bar: no name in en',
      'e.yaml: Bar: not in the id form',
      'e.yaml: Bar: repeated',
    ],
  );
});

/**
 * Problems in a catalog's dictionaries that buildCatalog leaves to the checks: key forms, repeated keys,
 * a fourth muscle level, an equipment variant without its base, and names missing in en or ru.
 * @param {import('../core/catalog.mjs').CatalogFiles} files
 * @returns {string[]}
 */
function dictionaryProblems(files) {
  // buildCatalog throws on anything that is not a list of mappings with string ids.
  buildCatalog(files);
  const problems = [];
  /** @param {string} where @param {any} item */
  const names = (where, item) => {
    for (const code of ['en', 'ru'])
      if (typeof item.names?.[code] !== 'string') problems.push(`${where}: no name in ${code}`);
  };

  const muscleKeys = new Set();
  /** @param {any[]} items @param {number} level */
  const walk = (items, level) => {
    for (const item of items) {
      const where = `${files.muscles.file}: ${item.id}`;
      if (!/^[a-z][a-z0-9_]*$/.test(item.id)) problems.push(`${where}: not in the key form`);
      if (muscleKeys.has(item.id)) problems.push(`${where}: repeated`);
      muscleKeys.add(item.id);
      names(where, item);
      if (!item.children) continue;
      if (level === 3) problems.push(`${where}: a fourth level`);
      else walk(item.children, level + 1);
    }
  };
  walk(parse(files.muscles.source), 1);

  const items = parse(files.equipment.source);
  const equipmentKeys = new Set(items.map((/** @type {any} */ item) => item.id));
  const seen = new Set();
  for (const item of items) {
    const where = `${files.equipment.file}: ${item.id}`;
    if (!/^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)*$/.test(item.id)) problems.push(`${where}: not in the id form`);
    if (seen.has(item.id)) problems.push(`${where}: repeated`);
    seen.add(item.id);
    const dot = item.id.lastIndexOf('.');
    const base = item.id.slice(0, dot);
    if (dot > 0 && !equipmentKeys.has(base)) problems.push(`${where}: no ${base} in the dictionary`);
    names(where, item);
  }
  return problems;
}

test('buildIndex lists the entries that are not deprecated, in id order and flow style', () => {
  const long = 'A very long exercise name that goes on well past the eighty characters of a usual line';
  const entry = (/** @type {string} */ id, /** @type {string} */ fields) => ({
    file: `catalog/exercises/${id}.yaml`,
    source: `id: ${id}\n${fields}`,
  });
  const catalog = buildCatalog({
    exercises: [
      entry('row', `names: {en: "${long}", ru: Тяга}\nequipment: [dumbbells, bench]\n`),
      entry('hang', 'names: {en: "Hang: dead", ru: Вис}\naliases: [Dead hang, "Hang, passive"]\nequipment: []\n'),
      entry('hang.old', 'names: {en: Old hang}\nequipment: []\ndeprecated: true\nreplaced_by: hang\n'),
      entry('plank', 'names: {en: Plank, ru: Планка, x-note: draft}\naliases: []\nequipment: []\n'),
    ],
    muscles: { file: 'catalog/muscles.yaml', source: '[]' },
    equipment: { file: 'catalog/equipment.yaml', source: '[]' },
  });
  assert.equal(
    buildIndex(catalog),
    `# Generated from catalog/exercises/ by node scripts/build-catalog-index.mjs.
# Do not edit: change the entries and rebuild.
- id: hang
  names: {en: "Hang: dead", ru: Вис}
  aliases: [Dead hang, "Hang, passive"]
  equipment: []
- id: plank
  names: {en: Plank, ru: Планка}
  equipment: []
- id: row
  names: {en: ${long}, ru: Тяга}
  equipment: [dumbbells, bench]
`,
  );
});

test('catalog/index.yaml is up to date', () => {
  const loaded = loadCatalog(PROJECT_CATALOG);
  assert.ok('catalog' in loaded, 'error' in loaded ? loaded.error : '');
  const { catalog } = loaded;
  const index = new URL('index.yaml', PROJECT_CATALOG);
  const written = existsSync(index) ? readFileSync(index, 'utf8').replaceAll('\r', '') : '';
  assert.ok(
    written === buildIndex(catalog),
    'catalog/index.yaml is out of date: run node scripts/build-catalog-index.mjs.',
  );
});

test('hints taken from the schema match it', () => {
  const entry = SCHEMA.properties.exercises.items.properties;
  for (const [field, description] of Object.entries(DESCRIPTIONS)) assert.equal(description, entry[field].description);
});

test('equipmentSatisfies: a variant satisfies its base, not the reverse', () => {
  assert.equal(equipmentSatisfies('bench.adjustable', 'bench'), true);
  assert.equal(equipmentSatisfies('bench', 'bench.adjustable'), false);
  assert.equal(equipmentSatisfies('bench', 'bench'), true);
  assert.equal(equipmentSatisfies('benchpress', 'bench'), false);
});
