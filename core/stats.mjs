// The program report: counts a valid program by the training guidelines, places each value in the bands
// of the corridors that apply to it, and formats the report an AI agent reads. No I/O, like the rest of
// core/: the tools pass the parsed program now, and the player will later.

import { FORMATS } from './formats.mjs';
import { formatPath, formatValue } from './validate.mjs';

/** @typedef {import('./catalog.mjs').Catalog} Catalog */
/** @typedef {import('./guidelines.mjs').Guidelines} Guidelines */
/** @typedef {import('./guidelines.mjs').Corridor} Corridor */
/** @typedef {import('./guidelines.mjs').Band} Band */
/** @typedef {import('./formats.mjs').Range} Range */

/**
 * @typedef {Range | 'unknown'} Value
 * @typedef {{ value: Value, bands: Band[] | undefined }} Measure bands: the band at each end, when a
 *   corridor in the value's unit applies to it and the value is known
 * @typedef {{ kind: 'target' | 'group', id: string }
 *   | { kind: 'block', path: string, line: number | undefined, value: unknown }} Subject path: as a
 *   validator issue writes it, such as workouts[0].blocks[2].rest; value: as written
 */

/**
 * @typedef {object} Finding one corridor, one band, one subject
 * @property {string} corridor
 * @property {string} unit
 * @property {Band} band
 * @property {Subject} subject
 * @property {Range} value
 * @property {'lower' | 'upper' | 'both'} ends the ends that fall in this band
 * @property {string | undefined} extrapolation the corridor's extrapolation, when it lists the subject
 */

/**
 * @typedef {object} Report
 * @property {string | undefined} goal
 * @property {string[]} workouts ids in list order
 * @property {Range | undefined} perWeek
 * @property {string[]} corridors ids of the applying corridors, in file order
 * @property {{ id: string, sets: Measure, sessions: Measure, byWorkout: { workout: string, sets: Range }[] }[]} targets
 *   in target order; byWorkout: the workouts that add to the target, in list order
 * @property {{ id: string, days: Measure }[]} groups in group order
 * @property {{ exercise: string, reason: 'no muscles' | 'muscles in no target' }[]} notCounted in the
 *   order of first use
 * @property {Finding[]} findings atomic, by corridor in file order, band in corridor order, then subject
 */

/**
 * The parts of a valid program that the count reads: the schema and the rules have held.
 * @typedef {{ exercise: string, sets: number | string, reps?: number | string, rest?: number | string }} Block
 * @typedef {object} Program
 * @property {string} [goal]
 * @property {{ per_week: number | string }} [schedule]
 * @property {Record<string, unknown>[]} [exercises]
 * @property {{ id: string, blocks: Block[] }[]} workouts
 */

/**
 * A value of a valid program in its notation.
 * @param {string} format
 * @param {number | string} value
 * @returns {Range}
 */
function parse(format, value) {
  return /** @type {Range} */ (FORMATS[format].parse(value));
}

/**
 * The band a value falls in: the one where from <= value < to, or the last band.
 * @param {Band[]} bands
 * @param {number} value
 */
function bandAt(bands, value) {
  return bands.find(band => band.to !== undefined && band.from <= value && value < band.to) ?? bands[bands.length - 1];
}

/**
 * Counts a valid program. The caller has validated it: no issue is an error.
 * @param {unknown} data the parsed program
 * @param {(path: (string|number)[]) => number | undefined} lineOf the line of a path in its source
 * @param {Catalog} catalog every entry's muscles pass musclesProblem in guidelines.mjs, as loadGuidelines
 *   checks
 * @param {Guidelines} guidelines
 * @returns {Report}
 */
export function programStats(data, lineOf, catalog, guidelines) {
  const program = /** @type {Program} */ (data);
  const corridors = guidelines.corridors.filter(({ goal }) => goal === undefined || goal === program.goal);

  /** @type {Map<string, Record<string, unknown>>} */
  const own = new Map();
  for (const entry of program.exercises ?? []) if (!own.has(String(entry.id))) own.set(String(entry.id), entry);
  /** @type {Map<string, Map<string, number> | undefined>} the weights per target of each exercise used */
  const weightsOf = new Map();
  /** @type {Report['notCounted']} */
  const notCounted = [];
  for (const { blocks } of program.workouts) {
    for (const { exercise } of blocks) {
      if (weightsOf.has(exercise)) continue;
      // The entry the block names, deprecated or not: the report counts what the program states.
      const entry = /** @type {Record<string, unknown>} */ (catalog.exercises.get(exercise) ?? own.get(exercise));
      const weights = targetWeights(entry, guidelines);
      weightsOf.set(exercise, weights);
      if (!weights) notCounted.push({ exercise, reason: 'no muscles' });
      else if ([...weights.values()].every(weight => weight === 0))
        notCounted.push({ exercise, reason: 'muscles in no target' });
    }
  }

  // Per workout: the fractional sets and sessions of each target.
  const perWorkout = program.workouts.map(({ blocks }) => {
    /** @type {Map<string, Range>} */
    const sets = new Map(guidelines.targets.map(({ id }) => [id, { min: 0, max: 0 }]));
    /** @type {Map<string, number>} */
    const sessions = new Map(guidelines.targets.map(({ id }) => [id, 0]));
    for (const block of blocks) {
      const count = parse('count', block.sets);
      for (const [target, weight] of weightsOf.get(block.exercise) ?? []) {
        const range = /** @type {Range} */ (sets.get(target));
        range.min += count.min * weight;
        range.max += count.max * weight;
        sessions.set(target, Math.max(/** @type {number} */ (sessions.get(target)), weight));
      }
    }
    return { sets, sessions };
  });

  const n = program.workouts.length;
  const perWeek = program.schedule ? parse('count', program.schedule.per_week) : undefined;
  /**
   * The mean week of the rotation, at both ends. Multiplied before the one division, so a whole value
   * stays exact.
   * @param {Range} sum over the rotation
   * @returns {Value}
   */
  const weekly = sum => {
    if (perWeek) return { min: (perWeek.min * sum.min) / n, max: (perWeek.max * sum.max) / n };
    return sum.max === 0 ? { min: 0, max: 0 } : 'unknown';
  };
  /** @param {Range[]} ranges */
  const total = ranges => ({
    min: ranges.reduce((sum, { min }) => sum + min, 0),
    max: ranges.reduce((sum, { max }) => sum + max, 0),
  });
  /** @param {number[]} values */
  const both = values => total(values.map(value => ({ min: value, max: value })));
  /**
   * @param {string} unit
   * @param {string} id
   * @param {Value} value
   * @returns {Measure}
   */
  const measure = (unit, id, value) => {
    const corridor = corridors.find(c => c.unit === unit && c.subjects.includes(id));
    if (!corridor || value === 'unknown') return { value, bands: undefined };
    return { value, bands: [bandAt(corridor.bands, value.min), bandAt(corridor.bands, value.max)] };
  };

  const targets = guidelines.targets.map(({ id }) => {
    const sets = perWorkout.map(workout => /** @type {Range} */ (workout.sets.get(id)));
    const sessions = perWorkout.map(workout => /** @type {number} */ (workout.sessions.get(id)));
    return {
      id,
      sets: measure('fractional_sets_per_week', id, weekly(total(sets))),
      sessions: measure('fractional_sessions_per_week', id, weekly(both(sessions))),
      byWorkout: program.workouts
        .map((workout, i) => ({ workout: workout.id, sets: sets[i] }))
        .filter(({ sets }) => sets.max > 0),
    };
  });
  const groups = guidelines.groups.map(({ id, targets: members }) => {
    const days = perWorkout.map(({ sessions }) =>
      members.some(target => /** @type {number} */ (sessions.get(target)) > 0) ? 1 : 0,
    );
    return { id, days: measure('days_involved_per_week', id, weekly(both(days))) };
  });

  /** @type {Record<string, { subject: Subject, value: Value }[]>} the values of every subject by unit */
  const values = {
    fractional_sets_per_week: targets.map(({ id, sets }) => ({ subject: { kind: 'target', id }, value: sets.value })),
    fractional_sessions_per_week: targets.map(({ id, sessions }) => ({
      subject: { kind: 'target', id },
      value: sessions.value,
    })),
    days_involved_per_week: groups.map(({ id, days }) => ({ subject: { kind: 'group', id }, value: days.value })),
    ...blockValues(program, lineOf),
  };

  /** @type {Finding[]} */
  const findings = [];
  for (const corridor of corridors) {
    const subjects = values[corridor.unit].filter(
      ({ subject }) => subject.kind === 'block' || corridor.subjects.includes(subject.id),
    );
    for (const band of corridor.bands) {
      if (!band.finding) continue;
      for (const { subject, value } of subjects) {
        if (value === 'unknown') continue;
        const lower = bandAt(corridor.bands, value.min) === band;
        const upper = bandAt(corridor.bands, value.max) === band;
        if (!lower && !upper) continue;
        const extrapolated = subject.kind !== 'block' && corridor.extrapolated.includes(subject.id);
        findings.push({
          corridor: corridor.id,
          unit: corridor.unit,
          band,
          subject,
          value,
          ends: lower && upper ? 'both' : lower ? 'lower' : 'upper',
          extrapolation: extrapolated ? corridor.extrapolation : undefined,
        });
      }
    }
  }

  return {
    goal: program.goal,
    workouts: program.workouts.map(({ id }) => id),
    perWeek,
    corridors: corridors.map(({ id }) => id),
    targets,
    groups,
    notCounted,
    findings,
  };
}

/**
 * An exercise's weight for each target: the primary weight when one of its primary keys reaches the
 * target, else the secondary weight when one of its secondary keys does, else 0.
 * @param {Record<string, unknown>} entry
 * @param {Guidelines} guidelines
 * @returns {Map<string, number> | undefined} undefined for an exercise without muscles
 */
function targetWeights(entry, { targets, reach, weights }) {
  const muscles = /** @type {{ primary: string[], secondary?: string[] } | undefined} */ (entry.muscles);
  if (!muscles) return undefined;
  /** @param {string[]} keys @param {string} target */
  const reaches = (keys, target) => keys.some(key => /** @type {Set<string>} */ (reach.get(key)).has(target));
  return new Map(
    targets.map(({ id }) => [
      id,
      reaches(muscles.primary, id) ? weights.primary : reaches(muscles.secondary ?? [], id) ? weights.secondary : 0,
    ]),
  );
}

/**
 * The values per block, in program order: the repetitions per set, and the rest in seconds. A block with
 * reps: max, with time, or without rest has no such value.
 * @param {Program} program
 * @param {(path: (string|number)[]) => number | undefined} lineOf
 */
function blockValues(program, lineOf) {
  /** @type {{ subject: Subject, value: Value }[]} */
  const reps = [];
  /** @type {{ subject: Subject, value: Value }[]} */
  const rest = [];
  program.workouts.forEach((workout, i) => {
    workout.blocks.forEach((block, j) => {
      /** @param {string} field @param {unknown} value @returns {Subject} */
      const subject = (field, value) => {
        const path = ['workouts', i, 'blocks', j, field];
        return { kind: 'block', path: formatPath(path), line: lineOf(path), value };
      };
      if (block.reps !== undefined && block.reps !== 'max') {
        const { min, max } = parse('reps', block.reps);
        // 5+ is counted at its minimum.
        reps.push({ subject: subject('reps', block.reps), value: { min, max: max === Infinity ? min : max } });
      }
      if (block.rest !== undefined)
        rest.push({ subject: subject('rest', block.rest), value: parse('duration', block.rest) });
    });
  });
  return { reps_per_set: reps, rest_seconds: rest };
}

/** The words of each unit in the report. @type {Record<string, string>} */
const UNIT_WORDS = {
  fractional_sets_per_week: 'fractional sets a week',
  fractional_sessions_per_week: 'fractional sessions a week',
  days_involved_per_week: 'days involved a week',
  reps_per_set: 'repetitions per set',
  rest_seconds: 'seconds of rest',
};

/**
 * A number rounded to two decimals, a half up, without trailing zeros. A weekly value is k / (2n) for a
 * whole k and n workouts, and one that ends in 5 at the third decimal may be held a little below the
 * tie, as 1.5 / 20 is: toFixed would give 0.07. The added margin lifts such a tie and stays far below
 * 1 / (2n) hundredths, the least distance between a tie and any other value, for any n below 100.
 * @param {number} value
 */
function formatNumber(value) {
  return String(Math.round(value * 100 + 1e-9) / 100);
}

/** @param {Range} range */
function formatRange({ min, max }) {
  return min === max ? formatNumber(min) : `${formatNumber(min)}-${formatNumber(max)}`;
}

/** @param {Value} value */
function formatMeasureValue(value) {
  return value === 'unknown' ? 'unknown' : formatRange(value);
}

/**
 * A workout id as it is when it holds only letters, digits, _, - and ., else as a JSON string, so that
 * Day 1 does not read as two words.
 * @param {string} id
 */
function formatWorkout(id) {
  return /^[\p{L}\p{Nd}_.-]+$/u.test(id) ? id : JSON.stringify(id);
}

/** @param {Band} band */
function formatBand(band) {
  return band.finding ? `${band.label} *` : band.label;
}

/**
 * The band of a value, or the bands of its two ends, the lower first.
 * @param {Band[]} bands
 */
function formatBands([lower, upper]) {
  return lower === upper || sameBand(lower, upper) ? formatBand(lower) : `${formatBand(lower)} to ${formatBand(upper)}`;
}

/**
 * Whether two bands are one, also in a report that was copied and so lost the shared objects.
 * @param {Band} a
 * @param {Band} b
 */
function sameBand(a, b) {
  return a.from === b.from && a.label === b.label;
}

/**
 * A value with its unit word and its band, as a target line shows it.
 * @param {Measure} measure
 * @param {string} word the unit word for a value of exactly 1
 */
function formatMeasure({ value, bands }, word) {
  const one = value !== 'unknown' && value.min === 1 && value.max === 1;
  const text = `${formatMeasureValue(value)} ${one ? word : `${word}s`}`;
  return bands ? `${text}: ${formatBands(bands)}` : text;
}

/**
 * The text of a finding's subject.
 * @param {Finding} finding
 */
function formatSubject({ subject, value, ends, extrapolation }) {
  const marks = [];
  if (ends !== 'both') marks.push(`${ends} end`);
  if (extrapolation !== undefined) marks.push('extrapolated');
  const suffix = marks.length ? ` (${marks.join(', ')})` : '';
  if (subject.kind !== 'block') return `${subject.id} ${formatRange(value)}${suffix}`;
  const line = subject.line === undefined ? '' : ` (line ${subject.line})`;
  const shown = formatValue(subject.value);
  return `${subject.path}${line}${shown === undefined ? '' : ` = ${shown}`}${suffix}`;
}

/**
 * The report text for a valid program: the caller prints the file path above it.
 * @param {Report} report
 * @returns {string} lines ending with a newline
 */
export function formatStats(report) {
  const perWeek = report.perWeek ? `${formatRange(report.perWeek)} a week` : 'per week not stated';
  const lines = [
    `goal: ${report.goal ?? 'not stated'}`,
    `workouts: ${report.workouts.map(formatWorkout).join(', ')}; ${perWeek}`,
    `corridors: ${report.corridors.join(', ') || 'none'}`,
  ];

  // The atomic findings grouped by corridor and band, which are adjacent in data order.
  /** @type {Finding[][]} */
  const groups = [];
  for (const finding of report.findings) {
    const last = groups[groups.length - 1]?.[0];
    if (last && last.corridor === finding.corridor && sameBand(last.band, finding.band))
      groups[groups.length - 1].push(finding);
    else groups.push([finding]);
  }
  for (const group of groups) {
    const [{ corridor, unit, band }] = group;
    const range =
      band.to === undefined
        ? `${formatNumber(band.from)} or more ${UNIT_WORDS[unit]}`
        : `${formatNumber(band.from)} to under ${formatNumber(band.to)} ${UNIT_WORDS[unit]}`;
    lines.push(`finding: ${corridor}: ${band.label}, ${range}`);
    const [{ subject }] = group;
    if (subject.kind === 'block') for (const finding of group) lines.push(`  ${formatSubject(finding)}`);
    else lines.push(`  ${subject.kind}s: ${group.map(formatSubject).join(', ')}`);
    lines.push(`  ${band.description}`);
    const extrapolated = group.find(({ extrapolation }) => extrapolation !== undefined);
    if (extrapolated) lines.push(`  Extrapolation: ${extrapolated.extrapolation}`);
    lines.push(`  Sources: ${band.cites.map(({ key, at }) => `${key} ${at}`).join('; ')}`);
  }

  lines.push('numbers (information, no action needed)', 'targets: fractional sets and sessions a week');
  const width = Math.max(...report.targets.map(({ id }) => id.length));
  for (const { id, sets, sessions, byWorkout } of report.targets) {
    let line = `  ${id.padEnd(width)} ${formatMeasure(sets, 'set')}; ${formatMeasure(sessions, 'session')}`;
    if (byWorkout.length)
      line += `; per workout: ${byWorkout.map(({ workout, sets }) => `${formatWorkout(workout)} ${formatRange(sets)}`).join(', ')}`;
    lines.push(line);
  }

  lines.push('major groups: days involved a week');
  /** @type {Map<string, { bands: Band[], groups: string[] }>} groups by the bands of their two ends */
  const byBands = new Map();
  const plain = [];
  const unknown = [];
  for (const { id, days } of report.groups) {
    if (days.value === 'unknown') unknown.push(`${id} unknown`);
    else if (!days.bands) plain.push(`${id} ${formatRange(days.value)}`);
    else {
      const key = days.bands.map(({ from, label }) => `${from} ${label}`).join('\n');
      const line = byBands.get(key) ?? { bands: days.bands, groups: [] };
      line.groups.push(`${id} ${formatRange(days.value)}`);
      byBands.set(key, line);
    }
  }
  const banded = [...byBands.values()].sort(
    (a, b) => a.bands[0].from - b.bands[0].from || a.bands[1].from - b.bands[1].from,
  );
  for (const { bands, groups } of banded) lines.push(`  ${groups.join(', ')}: ${formatBands(bands)}`);
  if (plain.length) lines.push(`  ${plain.join(', ')}`);
  if (unknown.length) lines.push(`  ${unknown.join(', ')}`);

  if (report.notCounted.length)
    lines.push(`not counted: ${report.notCounted.map(({ exercise, reason }) => `${exercise} (${reason})`).join(', ')}`);
  lines.push(`findings: ${groups.length}`);
  return `${lines.join('\n')}\n`;
}
