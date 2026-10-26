import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildCatalog } from '../core/catalog.mjs';
import { buildGuidelines } from '../core/guidelines.mjs';
import { formatStats, programStats } from '../core/stats.mjs';
import { checkProgram } from '../core/validate.mjs';
import { readCatalogFiles, readGuidelineFiles } from '../tools/catalog.mjs';

/** @typedef {import('../core/stats.mjs').Report} Report */
/** @typedef {import('../core/guidelines.mjs').Guidelines} Guidelines */
/** @typedef {import('../core/guidelines.mjs').Corridor} Corridor */

const SCHEMA = JSON.parse(readFileSync(new URL('./repscript.schema.json', import.meta.url), 'utf8'));
// The project's catalog and guidelines, not the test catalog: the counts name real entries and their
// muscles, and a change to an entry that moves a count must show here.
const PROJECT_CATALOG = new URL('../catalog/', import.meta.url);
const catalog = buildCatalog(readCatalogFiles(PROJECT_CATALOG));
const guidelines = buildGuidelines(readGuidelineFiles(PROJECT_CATALOG), catalog);

const HEAD = 'repscript: 0\nid: p\nrevision: 1\ntitle: T\n';

/**
 * The report of a program, which must have no validator error.
 * @param {string} body the lines after the required fields: goal, schedule, exercises, workouts
 * @param {Guidelines} [withGuidelines]
 * @returns {Report}
 */
function stats(body, withGuidelines = guidelines) {
  const { issues, data, lineOf } = checkProgram(`${HEAD}${body}`, SCHEMA, catalog);
  assert.deepEqual(
    issues.filter(issue => issue.severity === 'error'),
    [],
  );
  return programStats(data, lineOf, catalog, withGuidelines);
}

/**
 * A program body from its goal, schedule and workouts, each workout a list of flow-style blocks.
 * @param {{ goal?: string, perWeek?: string | number, exercises?: string[], workouts: Record<string, string[]> }} parts
 */
function body({ goal, perWeek, exercises, workouts }) {
  const lines = [];
  if (goal) lines.push(`goal: ${goal}`);
  if (perWeek !== undefined) lines.push(`schedule: {per_week: ${perWeek}}`);
  if (exercises) lines.push('exercises:', ...exercises.map(entry => `  - ${entry}`));
  lines.push('workouts:');
  for (const [id, blocks] of Object.entries(workouts))
    lines.push(`  - id: ${JSON.stringify(id)}`, '    blocks:', ...blocks.map(block => `      - ${block}`));
  return `${lines.join('\n')}\n`;
}

/**
 * @param {Report} report
 * @param {string} id
 */
function target(report, id) {
  const found = report.targets.find(item => item.id === id);
  assert.ok(found, id);
  return found;
}

/**
 * The weekly value of a target's sets, its sessions or a group's days, with unknown as it is.
 * @param {Report} report
 * @param {string} id
 * @param {'sets' | 'sessions' | 'days'} which
 */
function value(report, id, which) {
  if (which === 'days') return report.groups.find(group => group.id === id)?.days.value;
  return target(report, id)[which].value;
}

/** @param {number} n */
const exactly = n => ({ min: n, max: n });

const FULL_BODY = {
  A: [
    '{exercise: squat.barbell, sets: 3, reps: 8-12, rest: 2m}',
    '{exercise: bench_press.barbell, sets: 3, reps: 8-12, rest: 2m}',
  ],
  B: [
    '{exercise: romanian_deadlift.dumbbell, sets: 3, reps: 8-12, rest: 2m}',
    '{exercise: pullup, sets: 3, reps: 8-12, rest: 2m}',
  ],
};

/**
 * A corridor for the tests, with bands from the given bounds.
 * @param {Partial<Corridor> & { unit: string }} fields
 * @param {[number, boolean][]} bands each band's from and whether it gives a finding
 * @returns {Corridor}
 */
function corridor(fields, bands) {
  return {
    id: 'test.corridor',
    goal: undefined,
    subjects: [],
    extrapolated: [],
    extrapolation: undefined,
    ...fields,
    bands: bands.map(([from, finding], k) => ({
      from,
      to: bands[k + 1]?.[0],
      label: `band ${k}`,
      finding,
      description: `Band ${k}.`,
      cites: [{ key: 'pelland2026', at: 'Table 3' }],
    })),
  };
}

/** @param {Corridor[]} corridors */
const withCorridors = corridors => ({ ...guidelines, corridors });

test('weekly sets: two workouts three times a week, 2-3 a week, and no schedule', () => {
  const workouts = {
    A: ['{exercise: bench_press.barbell, sets: 3, reps: 10}'],
    B: ['{exercise: squat.barbell, sets: 3, reps: 10}'],
  };
  assert.deepEqual(value(stats(body({ perWeek: 3, workouts })), 'chest', 'sets'), exactly(4.5));
  assert.deepEqual(value(stats(body({ perWeek: '2-3', workouts })), 'chest', 'sets'), { min: 3, max: 4.5 });
  const unscheduled = stats(body({ workouts }));
  assert.equal(value(unscheduled, 'chest', 'sets'), 'unknown');
  assert.deepEqual(value(unscheduled, 'abs', 'sets'), exactly(0));
  assert.equal(value(unscheduled, 'chest', 'sessions'), 'unknown');
  assert.deepEqual(value(unscheduled, 'abs', 'sessions'), exactly(0));
  assert.equal(value(unscheduled, 'chest', 'days'), 'unknown');
  assert.deepEqual(value(unscheduled, 'abdomen', 'days'), exactly(0));
  assert.equal(unscheduled.perWeek, undefined);
});

test('the full-body rotation: sets, sessions and days', () => {
  const report = stats(body({ goal: 'hypertrophy', perWeek: 3, workouts: FULL_BODY }));
  const sets = Object.fromEntries(report.targets.map(({ id, sets }) => [id, sets.value]));
  assert.deepEqual(sets, {
    chest: exactly(4.5),
    back: exactly(4.5),
    front_delts: exactly(2.25),
    side_delts: exactly(0),
    rear_delts: exactly(2.25),
    biceps: exactly(2.25),
    triceps: exactly(2.25),
    quads: exactly(4.5),
    hamstrings: exactly(4.5),
    glutes: exactly(9),
    calves: exactly(0),
    abs: exactly(0),
  });
  assert.deepEqual(value(report, 'chest', 'sessions'), exactly(1.5));
  assert.deepEqual(value(report, 'biceps', 'sessions'), exactly(0.75));
  assert.deepEqual(value(report, 'triceps', 'sessions'), exactly(0.75));
  assert.deepEqual(value(report, 'glutes', 'sessions'), exactly(3));
  const days = Object.fromEntries(report.groups.map(({ id, days }) => [id, days.value]));
  assert.deepEqual(days, {
    legs: exactly(3),
    hips: exactly(3),
    back: exactly(1.5),
    abdomen: exactly(0),
    chest: exactly(1.5),
    shoulders: exactly(3),
    arms: exactly(3),
  });
  assert.deepEqual(target(report, 'glutes').byWorkout, [
    { workout: 'A', sets: exactly(3) },
    { workout: 'B', sets: exactly(3) },
  ]);
  assert.deepEqual(target(report, 'side_delts').byWorkout, []);
  assert.deepEqual(report.notCounted, []);
});

test('timed sets count for the weekly values', () => {
  const report = stats(body({ perWeek: 2, workouts: { A: ['{exercise: plank, sets: 3, time: 30s}'] } }));
  assert.deepEqual(target(report, 'abs').byWorkout, [{ workout: 'A', sets: exactly(3) }]);
  assert.deepEqual(value(report, 'abs', 'sets'), exactly(6));
});

test('values per block: reps of 8-12, 5+ and max, rest of 1:30 and 2-3m, none without rest or for time', () => {
  // Every band gives a finding, so each value shows as one.
  /** @type {[number, boolean][]} */
  const everyBand = [
    [0, true],
    [10, true],
  ];
  const report = stats(
    body({
      perWeek: 2,
      workouts: {
        A: [
          '{exercise: pushup, sets: 3, reps: 8-12, rest: "1:30"}',
          '{exercise: pullup, sets: 3, reps: 5+, rest: 2-3m}',
          '{exercise: dip, sets: 3, reps: max}',
          '{exercise: plank, sets: 3, time: 30s, rest: 30s}',
        ],
      },
    }),
    withCorridors([
      corridor({ id: 'test.reps', unit: 'reps_per_set' }, everyBand),
      corridor({ id: 'test.rest', unit: 'rest_seconds' }, everyBand),
    ]),
  );
  const shown = report.findings.map(({ corridor, band, subject, value, ends }) => [
    corridor,
    band.from,
    subject.kind === 'block' && [subject.path, subject.line, subject.value],
    value,
    ends,
  ]);
  assert.deepEqual(shown, [
    ['test.reps', 0, ['workouts[0].blocks[0].reps', 9, '8-12'], { min: 8, max: 12 }, 'lower'],
    ['test.reps', 0, ['workouts[0].blocks[1].reps', 10, '5+'], exactly(5), 'both'],
    ['test.reps', 10, ['workouts[0].blocks[0].reps', 9, '8-12'], { min: 8, max: 12 }, 'upper'],
    ['test.rest', 10, ['workouts[0].blocks[0].rest', 9, '1:30'], exactly(90), 'both'],
    ['test.rest', 10, ['workouts[0].blocks[1].rest', 10, '2-3m'], { min: 120, max: 180 }, 'both'],
    ['test.rest', 10, ['workouts[0].blocks[3].rest', 12, '30s'], exactly(30), 'both'],
  ]);
  // reps: max still counts its sets.
  assert.deepEqual(target(report, 'triceps').byWorkout, [{ workout: 'A', sets: { min: 4.5, max: 4.5 } }]);
});

test('a value on a band bound is exact: 6 sets over three workouts at 2 a week is 4, and 7 sets 14/3', () => {
  const workouts = (/** @type {number} */ sets) => ({
    A: [`{exercise: bench_press.barbell, sets: ${sets}, reps: 10}`],
    B: ['{exercise: squat.barbell, sets: 3, reps: 10}'],
    C: ['{exercise: pullup, sets: 3, reps: 10}'],
  });
  const six = target(stats(body({ goal: 'hypertrophy', perWeek: 2, workouts: workouts(6) })), 'chest').sets;
  assert.deepEqual(six.value, exactly(4));
  assert.equal(six.bands?.[0].label, 'minimum effective dose');
  const seven = target(stats(body({ goal: 'hypertrophy', perWeek: 2, workouts: workouts(7) })), 'chest').sets;
  assert.deepEqual(seven.value, exactly(14 / 3));
});

test('sets: 3-4 at both ends', () => {
  const report = stats(body({ perWeek: 2, workouts: { A: ['{exercise: bench_press.barbell, sets: 3-4, reps: 10}'] } }));
  assert.deepEqual(value(report, 'chest', 'sets'), { min: 6, max: 8 });
  assert.deepEqual(value(report, 'triceps', 'sets'), { min: 3, max: 4 });
  assert.deepEqual(value(report, 'chest', 'sessions'), exactly(2));
  assert.deepEqual(target(report, 'chest').byWorkout, [{ workout: 'A', sets: { min: 3, max: 4 } }]);
});

test('exercises that count for nothing, and a deprecated own exercise whose replacement has muscles', () => {
  const report = stats(
    body({
      perWeek: 2,
      exercises: [
        '{id: my.towel_row, names: {en: Towel row}}',
        '{id: my.wrist_roller, names: {en: Wrist roller}, muscles: {primary: [forearms]}}',
        '{id: my.pullup_towel, names: {en: Pull-up on a towel}, deprecated: true, replaced_by: my.towel_pullup}',
        '{id: my.towel_pullup, names: {en: Towel pull-up}, muscles: {primary: [lats]}}',
      ],
      workouts: {
        A: [
          '{exercise: my.towel_row, sets: 3, reps: 10}',
          '{exercise: my.wrist_roller, sets: 3, time: 30s}',
          '{exercise: my.towel_row, sets: 3, reps: 10}',
          '{exercise: my.pullup_towel, sets: 3, reps: 5}',
        ],
      },
    }),
  );
  assert.deepEqual(report.notCounted, [
    { exercise: 'my.towel_row', reason: 'no muscles' },
    { exercise: 'my.wrist_roller', reason: 'muscles in no target' },
    { exercise: 'my.pullup_towel', reason: 'no muscles' },
  ]);
  for (const { id, sets } of report.targets) assert.deepEqual(sets.value, exactly(0), id);
});

test('a group key and a muscle with bundles in an own exercise', () => {
  const report = stats(
    body({
      perWeek: 1,
      exercises: [
        '{id: my.band_press, names: {en: Band press}, muscles: {primary: [shoulders]}}',
        '{id: my.lat_raise, names: {en: Lat raise}, muscles: {primary: [lats], secondary: [deltoids]}}',
      ],
      workouts: { A: ['{exercise: my.band_press, sets: 2, reps: 12}', '{exercise: my.lat_raise, sets: 2, reps: 12}'] },
    }),
  );
  for (const id of ['front_delts', 'side_delts', 'rear_delts']) {
    assert.deepEqual(value(report, id, 'sets'), exactly(3), id);
    assert.deepEqual(value(report, id, 'sessions'), exactly(1), id);
  }
  assert.deepEqual(value(report, 'back', 'sets'), exactly(2));
});

test('the exactness of the count holds on the project data: weights in halves, whole band bounds', () => {
  for (const weight of Object.values(guidelines.weights)) assert.ok(Number.isInteger(weight * 2), String(weight));
  for (const { id, bands } of guidelines.corridors)
    for (const { from, to } of bands) {
      assert.ok(Number.isInteger(from), `${id} ${from}`);
      assert.ok(to === undefined || Number.isInteger(to), `${id} ${to}`);
    }
});

test('every band with a finding is the first or the last of its corridor, so both ends find it', () => {
  for (const { id, bands } of guidelines.corridors)
    bands.forEach(({ finding, label }, k) => {
      if (finding) assert.ok(k === 0 || k === bands.length - 1, `${id}: ${label}`);
    });
});

test('the corridors that apply to the goal, in file order', () => {
  const workouts = { A: ['{exercise: squat.barbell, sets: 3, reps: 5}'] };
  assert.deepEqual(stats(body({ workouts })).corridors, ['major_groups']);
  assert.deepEqual(stats(body({ goal: 'strength', workouts })).corridors, ['major_groups', 'strength.reps']);
  assert.deepEqual(stats(body({ goal: 'hypertrophy', workouts })).corridors, [
    'major_groups',
    'hypertrophy.weekly_sets',
    'hypertrophy.reps',
    'hypertrophy.rest',
  ]);
  assert.deepEqual(stats(body({ goal: 'health', workouts })).corridors, ['major_groups']);
  // Without a corridor in its unit, a value has no band.
  const report = stats(body({ goal: 'strength', perWeek: 3, workouts }));
  assert.equal(target(report, 'quads').sets.bands, undefined);
  assert.equal(target(report, 'quads').sessions.bands, undefined);
});

test('findings: lower end only, both ends in two finding bands, and the extrapolation of a subject', () => {
  const lowerOnly = stats(
    body({
      goal: 'hypertrophy',
      perWeek: '2-3',
      workouts: { A: ['{exercise: pushup, sets: 3, reps: 10}'], B: ['{exercise: pullup, sets: 3, reps: 10}'] },
    }),
  );
  const volume = lowerOnly.findings.filter(({ corridor }) => corridor === 'hypertrophy.weekly_sets');
  // One finding per subject here: a second one for chest would be lost in byId.
  assert.equal(new Set(volume.map(({ subject }) => subject.kind === 'target' && subject.id)).size, volume.length);
  assert.equal(volume.filter(({ subject }) => subject.kind === 'target' && subject.id === 'chest').length, 1);
  const byId = Object.fromEntries(
    volume.map(finding => [finding.subject.kind === 'target' && finding.subject.id, finding]),
  );
  assert.equal(byId.chest.ends, 'lower');
  assert.deepEqual(byId.chest.value, { min: 3, max: 4.5 });
  assert.equal(byId.chest.extrapolation, undefined);
  assert.equal(byId.front_delts.ends, 'both');
  assert.equal(byId.back.ends, 'lower');
  assert.match(byId.back.extrapolation ?? '', /^The meta-regression measured/);
  assert.match(byId.side_delts.extrapolation ?? '', /^The meta-regression measured/);
  assert.equal(byId.side_delts.band.label, 'below the minimum effective dose');

  // 3 to 45 sets a week: below the minimum effective dose at one end, too little data at the other.
  const wide = stats(
    body({
      goal: 'hypertrophy',
      perWeek: '1-15',
      workouts: { A: ['{exercise: bench_press.barbell, sets: 3, reps: 10}'] },
    }),
  );
  const chest = wide.findings.filter(({ subject }) => subject.kind === 'target' && subject.id === 'chest');
  assert.deepEqual(
    chest.map(({ band, ends, value }) => [band.label, ends, value]),
    [
      ['below the minimum effective dose', 'lower', { min: 3, max: 45 }],
      ['too little data', 'upper', { min: 3, max: 45 }],
    ],
  );
  // An unknown value gives no finding.
  const unknown = stats(body({ goal: 'hypertrophy', workouts: FULL_BODY }));
  assert.deepEqual(
    unknown.findings.map(({ subject }) => subject.kind !== 'block' && subject.id),
    ['abdomen', 'side_delts', 'calves', 'abs'],
  );
});

/**
 * The text of a program's report.
 * @param {Parameters<typeof body>[0]} parts
 * @param {Guidelines} [withGuidelines]
 */
function text(parts, withGuidelines) {
  return formatStats(stats(body(parts), withGuidelines));
}

/**
 * The lines of a text that start with a prefix.
 * @param {string} report
 * @param {string} prefix
 */
function linesStarting(report, prefix) {
  return report.split('\n').filter(line => line.startsWith(prefix));
}

test('formatStats: the last band, two decimals, a half up, and the singular', () => {
  const wide = text({
    goal: 'hypertrophy',
    perWeek: '1-15',
    workouts: { A: ['{exercise: bench_press.barbell, sets: 3, reps: 10}'] },
  });
  assert.deepEqual(linesStarting(wide, 'finding: hypertrophy.weekly_sets'), [
    'finding: hypertrophy.weekly_sets: below the minimum effective dose, 0 to under 4 fractional sets a week',
    'finding: hypertrophy.weekly_sets: too little data, 43 or more fractional sets a week',
  ]);
  assert.match(wide, /^ {2}targets: chest 3-45 \(lower end\), /m);
  assert.match(wide, /^ {2}targets: chest 3-45 \(upper end\)$/m);
  assert.match(
    wide,
    /^ {2}chest {7}3-45 sets: below the minimum effective dose \* to too little data \*; 1-15 sessions; per workout: A 3$/m,
  );

  const thirds = text({
    perWeek: 2,
    workouts: {
      A: ['{exercise: bench_press.barbell, sets: 7, reps: 10}'],
      B: ['{exercise: squat.barbell, sets: 3, reps: 10}'],
      C: ['{exercise: pullup, sets: 3, reps: 10}'],
    },
  });
  assert.match(thirds, /^ {2}chest {7}4\.67 sets; 0\.67 sessions; per workout: A 7$/m);
  const quarters = text({
    perWeek: 3,
    workouts: {
      A: ['{exercise: bench_press.barbell, sets: 3, reps: 10}'],
      B: ['{exercise: squat.barbell, sets: 3, reps: 10}'],
      C: ['{exercise: pullup, sets: 3, reps: 10}'],
      D: ['{exercise: plank, sets: 3, time: 30s}'],
    },
  });
  // 1.5 front delt sets over the rotation, 3 a week: 1.125.
  assert.match(quarters, /^ {2}front_delts 1\.13 sets; 0\.38 sessions; per workout: A 1\.5$/m);
  const once = text({ perWeek: 1, workouts: { A: ['{exercise: bench_press.barbell, sets: 1, reps: 10}'] } });
  assert.match(once, /^ {2}chest {7}1 set; 1 session; per workout: A 1$/m);
  assert.match(once, /^ {2}triceps {5}0\.5 sets; 0\.5 sessions; per workout: A 0\.5$/m);
  // A tie that binary holds a little below the half: 1.5 / 20 is 0.075, and toFixed gives 0.07.
  const twenty = text({
    perWeek: 1,
    workouts: Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [
        `W${i}`,
        [i === 0 ? '{exercise: bench_press.barbell, sets: 3, reps: 10}' : '{exercise: plank, sets: 1, time: 30s}'],
      ]),
    ),
  });
  assert.match(twenty, /^ {2}front_delts 0\.08 sets; 0\.03 sessions; per workout: W0 1\.5$/m);
  assert.match(twenty, /^ {2}abs {9}0\.95 sets; 0\.95 sessions; per workout: W1 1, W2 1, /m);
});

test('formatStats: workouts after per workout, and quoted ids', () => {
  const fullBody = text({ goal: 'hypertrophy', perWeek: 3, workouts: FULL_BODY });
  assert.match(fullBody, /^ {2}glutes {6}9 sets: higher efficiency; 3 sessions; per workout: A 3, B 3$/m);
  assert.match(fullBody, /^ {2}side_delts {2}0 sets: below the minimum effective dose \*; 0 sessions$/m);
  const report = text({
    perWeek: 2,
    workouts: {
      'Day 1': ['{exercise: bench_press.barbell, sets: 3, reps: 10}'],
      'Day 2': ['{exercise: squat.barbell, sets: 3, reps: 10}'],
    },
  });
  assert.match(report, /^workouts: "Day 1", "Day 2"; 2 a week$/m);
  assert.match(report, /^ {2}chest {7}3 sets; 1 session; per workout: "Day 1" 3$/m);
  assert.match(report, /^ {2}glutes {6}3 sets; 1 session; per workout: "Day 2" 3$/m);
  const plain = text({
    perWeek: 3,
    workouts: {
      'push-1.a': ['{exercise: squat.barbell, sets: 3, reps: 10}'],
      B_2: ['{exercise: squat.barbell, sets: 3, reps: 10}'],
    },
  });
  assert.match(plain, /^workouts: push-1\.a, B_2; 3 a week$/m);
  assert.match(plain, /^ {2}glutes {6}9 sets; 3 sessions; per workout: push-1\.a 3, B_2 3$/m);
});

test('formatStats: marks of a subject, one Extrapolation line, and a block line', () => {
  const report = text({
    goal: 'hypertrophy',
    perWeek: '2-3',
    workouts: {
      A: ['{exercise: pushup, sets: 3, reps: 10, rest: 90s}'],
      B: [
        '{exercise: curl.dumbbell, sets: 3, reps: 8-30, rest: 45s}',
        '{exercise: pullup, sets: 3, reps: 5-8, rest: 2m}',
      ],
    },
  });
  assert.match(
    report,
    /^ {2}targets: chest 3-4\.5 \(lower end\), back 3-4\.5 \(lower end, extrapolated\), front_delts 1\.5-2\.25, side_delts 0 \(extrapolated\), /m,
  );
  assert.equal(linesStarting(report, '  Extrapolation: ').length, 1);
  assert.deepEqual(
    report.split('\n').filter(line => line.startsWith('  workouts[')),
    ['  workouts[1].blocks[0].reps (line 13) = "8-30" (upper end)', '  workouts[1].blocks[0].rest (line 13) = "45s"'],
  );
  assert.match(report, /^finding: hypertrophy\.reps: lighter than the loads studied, 29 or more repetitions per set$/m);
  assert.match(report, /^finding: hypertrophy\.rest: shorter than recommended, 0 to under 60 seconds of rest$/m);
  // Only measured targets: no Extrapolation line.
  const quadsAndChest = text(
    {
      perWeek: 1,
      workouts: {
        A: ['{exercise: squat.barbell, sets: 1, reps: 10}', '{exercise: bench_press.barbell, sets: 1, reps: 10}'],
      },
    },
    withCorridors([guidelines.corridors[1]].map(c => ({ ...c, goal: undefined, subjects: ['chest', 'quads'] }))),
  );
  assert.match(quadsAndChest, /^ {2}targets: chest 1, quads 1$/m);
  assert.equal(linesStarting(quadsAndChest, '  Extrapolation: ').length, 0);
});

test('formatStats: a band after the sessions, from a corridor in sessions', () => {
  const sessions = corridor({ unit: 'fractional_sessions_per_week', subjects: ['chest'] }, [
    [0, true],
    [2, false],
  ]);
  const report = text(
    {
      perWeek: 3,
      workouts: {
        A: ['{exercise: bench_press.barbell, sets: 3, reps: 10}'],
        B: ['{exercise: squat.barbell, sets: 3, reps: 10}'],
      },
    },
    withCorridors([guidelines.corridors[0], sessions]),
  );
  assert.match(report, /^ {2}chest {7}4\.5 sets; 1\.5 sessions: band 0 \*; per workout: A 3$/m);
  assert.match(
    report,
    /^finding: test\.corridor: band 0, 0 to under 2 fractional sessions a week\n {2}targets: chest 1\.5\n/m,
  );
  assert.match(report, /^ {2}triceps {5}2\.25 sets; 0\.75 sessions; per workout: A 1\.5$/m);
});

test('formatStats: days lines by band, a pair of bands between them, unknown days, and days without a band', () => {
  const pair = text({
    perWeek: '3-4',
    workouts: {
      A: ['{exercise: bench_press.barbell, sets: 3, reps: 10}', '{exercise: squat.barbell, sets: 3, reps: 10}'],
      B: ['{exercise: squat.barbell, sets: 3, reps: 10}'],
    },
  });
  const days = pair.slice(pair.indexOf('major groups: days involved a week\n'));
  assert.equal(
    days,
    'major groups: days involved a week\n' +
      '  back 0, abdomen 0: less than twice a week *\n' +
      '  chest 1.5-2, shoulders 1.5-2, arms 1.5-2: less than twice a week * to twice a week or more\n' +
      '  legs 3-4, hips 3-4: twice a week or more\n' +
      'findings: 1\n',
  );
  assert.match(
    pair,
    /^ {2}groups: back 0, abdomen 0, chest 1\.5-2 \(lower end\), shoulders 1\.5-2 \(lower end\), arms 1\.5-2 \(lower end\)$/m,
  );

  const unknown = text({ goal: 'hypertrophy', workouts: FULL_BODY });
  assert.match(
    unknown,
    /^major groups: days involved a week\n {2}abdomen 0: less than twice a week \*\n {2}legs unknown, hips unknown, back unknown, chest unknown, shoulders unknown, arms unknown\n/m,
  );
  assert.match(unknown, /^ {2}chest {7}unknown sets; unknown sessions; per workout: A 3$/m);
  assert.match(unknown, /^workouts: A, B; per week not stated$/m);
  assert.match(unknown, /^goal: hypertrophy$/m);

  const everyGroup = {
    A: [
      '{exercise: squat.barbell, sets: 3, reps: 10}',
      '{exercise: pullup, sets: 3, reps: 10}',
      '{exercise: plank, sets: 3, time: 30s}',
    ],
    B: ['{exercise: bench_press.barbell, sets: 3, reps: 10}', '{exercise: overhead_press.barbell, sets: 3, reps: 10}'],
  };
  const noDays = text({ perWeek: 4, workouts: everyGroup }, withCorridors([]));
  assert.match(
    noDays,
    /^major groups: days involved a week\n {2}legs 2, hips 2, back 2, abdomen 2, chest 2, shoulders 4, arms 4\nfindings: 0\n$/m,
  );
  assert.match(noDays, /^goal: not stated\nworkouts: A, B; 4 a week\ncorridors: none\nnumbers/);
  const allUnknown = text({ workouts: everyGroup }, withCorridors([]));
  assert.match(allUnknown, /^major groups: days involved a week\n {2}legs unknown, /m);
  // Known groups before unknown ones, each line without a band.
  const someUnknown = text({ workouts: { A: ['{exercise: squat.barbell, sets: 3, reps: 10}'] } }, withCorridors([]));
  assert.equal(
    someUnknown.slice(someUnknown.indexOf('major groups:')),
    'major groups: days involved a week\n' +
      '  back 0, abdomen 0, chest 0, shoulders 0, arms 0\n' +
      '  legs unknown, hips unknown\n' +
      'findings: 0\n',
  );
});

test('formatStats: a report whose bands are copies groups its findings as the original does', () => {
  const report = stats(body({ goal: 'hypertrophy', perWeek: 3, workouts: FULL_BODY }));
  assert.equal(formatStats(structuredClone(report)), formatStats(report));
});

test('formatStats: the not counted line', () => {
  const report = text({
    perWeek: 2,
    exercises: [
      '{id: my.towel_row, names: {en: Towel row}}',
      '{id: my.wrist_roller, names: {en: Wrist roller}, muscles: {primary: [forearms]}}',
    ],
    workouts: { A: ['{exercise: my.towel_row, sets: 3, reps: 10}', '{exercise: my.wrist_roller, sets: 3, time: 30s}'] },
  });
  assert.match(
    report,
    /\nnot counted: my\.towel_row \(no muscles\), my\.wrist_roller \(muscles in no target\)\nfindings: 1\n$/,
  );
});

const fixtures = new URL('./stats/', import.meta.url);
for (const file of readdirSync(fixtures).filter(name => name.endsWith('.repscript.yaml'))) {
  const name = file.slice(0, -'.repscript.yaml'.length);
  test(`stats report ${name}`, () => {
    const source = readFileSync(new URL(file, fixtures), 'utf8');
    const expected = readFileSync(new URL(`${name}.stats.txt`, fixtures), 'utf8').replaceAll('\r\n', '\n');
    const { issues, data, lineOf } = checkProgram(source, SCHEMA, catalog);
    assert.deepEqual(
      issues.filter(issue => issue.severity === 'error'),
      [],
    );
    assert.equal(formatStats(programStats(data, lineOf, catalog, guidelines)), expected);
  });
}
