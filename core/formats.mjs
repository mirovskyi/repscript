// Value notations: the short forms of set counts, repetitions, durations and weights. The schema names
// one with the format keyword, check() in schema.mjs reports what parse returns, and the player reads
// values with the same parsers.

/**
 * @typedef {object} Range
 * @property {number} min
 * @property {number} max
 */

/**
 * @typedef {object} Problem
 * @property {string} message
 * @property {string} [hint] none for the generic messages: the field's description is the hint
 */

/**
 * @typedef {object} Format
 * @property {string} expected the notation as a noun phrase with examples
 * @property {(value: number | string) => Range | Problem} parse a number is checked by its value, a
 *   string by its text
 */

/**
 * A value in a notation's shape, before the minimum, unit and range order are checked.
 * @typedef {object} Form
 * @property {string[]} parts the numbers as written: one, or the two ends of a range
 * @property {number[]} numbers the numbers the minimum applies to
 * @property {string} unit written after the numbers, or ''
 * @property {Range} value
 * @property {boolean} [unitless] a duration written as a plain number or range
 */

/**
 * @typedef {object} Notation
 * @property {string} expected
 * @property {(value: number | string) => Form | undefined} read
 * @property {{ ok: (n: number) => boolean, message: string }} minimum
 */

const WHOLE = /^(-?\d+)(?:-(-?\d+))?$/;
const DECIMAL = /^(-?\d+(?:\.\d+)?)(?:-(-?\d+(?:\.\d+)?))?$/;
const TIMED = /^(-?\d+)(?:-(-?\d+))?([smh])$/;
const CLOCK = /^(\d+):([0-5]\d)$/;
/** @type {Record<string, number>} */
const SECONDS = { s: 1, m: 60, h: 3600 };

const AT_LEAST_1 = { ok: (/** @type {number} */ n) => n >= 1, message: 'Expected at least 1.' };
const ABOVE_0 = { ok: (/** @type {number} */ n) => n > 0, message: 'Expected more than 0.' };
const NO_UNIT = {
  message: 'The duration has no unit.',
  hint: 'Write a whole number with a unit: s for seconds, m for minutes, h for hours. Example: rest: 90s',
};

const FAILURE = /^(?:(?:to |until )?failure|amrap)$/i;
const DASH = /[\u2010-\u2015\u2212]/;
/** @type {[string, RegExp][]} */
const UNIT_WORDS = [
  ['s', /^(?:secs?|seconds?|с|сек)$/iu],
  ['m', /^(?:mins?|minutes?|мин)$/iu],
  ['h', /^(?:hrs?|hours?|ч)$/iu],
];

/**
 * @param {RegExpExecArray | null} match one number, or two for a range
 * @param {string} [unit]
 * @param {number} [scale]
 * @returns {Form | undefined}
 */
function range(match, unit = '', scale = 1) {
  if (!match) return undefined;
  const parts = match[2] === undefined ? [match[1]] : [match[1], match[2]];
  const numbers = parts.map(Number);
  return { parts, numbers, unit, value: { min: numbers[0] * scale, max: numbers[numbers.length - 1] * scale } };
}

/** @param {number} n @returns {Form} */
function single(n) {
  return { parts: [String(n)], numbers: [n], unit: '', value: { min: n, max: n } };
}

/** @type {Record<string, Notation>} */
const NOTATIONS = {
  count: {
    expected: 'a whole number such as 3, or a range such as 3-4',
    minimum: AT_LEAST_1,
    read: value => typeof value === 'number' ? (Number.isInteger(value) ? single(value) : undefined) : range(WHOLE.exec(value)),
  },
  reps: {
    expected: 'a whole number such as 10, a range such as 8-12, a minimum such as 5+, or max',
    minimum: AT_LEAST_1,
    read(value) {
      if (typeof value === 'number') return Number.isInteger(value) ? single(value) : undefined;
      if (value === 'max') return { parts: [], numbers: [], unit: '', value: { min: 0, max: Infinity } };
      const plus = /^(-?\d+)\+$/.exec(value);
      if (plus) return { ...single(Number(plus[1])), value: { min: Number(plus[1]), max: Infinity } };
      return range(WHOLE.exec(value));
    },
  },
  duration: {
    expected: 'a duration such as 30s, 2m, 1h or 1:30, or a range such as 2-3m',
    minimum: ABOVE_0,
    read(value) {
      if (typeof value === 'number') return Number.isFinite(value) ? { ...single(value), unitless: true } : undefined;
      const timed = TIMED.exec(value);
      if (timed) return range(timed, timed[3], SECONDS[timed[3]]);
      const clock = CLOCK.exec(value);
      if (clock) return { ...single(Number(clock[1]) * 60 + Number(clock[2])), parts: [value] };
      const bare = range(DECIMAL.exec(value));
      return bare && { ...bare, unitless: true };
    },
  },
  weight: {
    expected: 'a number such as 18 or 2.5, or a range such as 2-5',
    minimum: ABOVE_0,
    read: value => typeof value === 'number' ? (Number.isFinite(value) ? single(value) : undefined) : range(DECIMAL.exec(value)),
  },
};

/**
 * Applies the slip corrections in order.
 * @param {string} name the notation
 * @param {string} text
 * @param {string[]} notes receives the message of each correction that changes the text
 */
function correct(name, text, notes) {
  /** @param {string} fixed @param {string} message */
  const apply = (fixed, message) => {
    if (fixed !== text) {
      text = fixed;
      notes.push(message);
    }
  };
  if (name === 'reps') apply(FAILURE.test(text) ? 'max' : text, 'A set to failure is written as max.');
  const dash = DASH.exec(text)?.[0];
  if (dash) {
    const code = dash.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
    apply(text.replace(new RegExp(DASH, 'g'), '-'), `The range is joined with U+${code} instead of a hyphen (-).`);
  }
  apply(text.replace(/(?<=\d),(?=\d)/g, '.'), 'The number has a decimal comma instead of a dot.');
  // Spaces between two digits stay: removing them would turn 8 12 into another number, 812.
  if (!/\d\s+\d/.test(text)) apply(text.replace(/\s/g, ''), 'The value has spaces in it.');
  if (name === 'duration') {
    const unit = (/** @type {string} */ word) => UNIT_WORDS.find(([, words]) => words.test(word))?.[0] ?? word;
    apply(text.replace(/(?<=\d)\p{L}+/gu, unit), 'Duration units are written as s, m or h.');
    apply(text.replace(/^(\d+)([smh])-(\d+)\2$/, '$1-$3$2'), 'A range has its unit once, at the end.');
  }
  return text;
}

/**
 * @param {Form} form
 * @returns {Problem | undefined}
 */
function order({ parts, numbers, unit }) {
  if (parts.length < 2 || numbers[0] < numbers[1]) return undefined;
  return numbers[0] > numbers[1]
    ? { message: 'The range starts with the larger number.', hint: `Write ${parts[1]}-${parts[0]}${unit}.` }
    : { message: 'The range has the same number at both ends.', hint: `Write ${parts[0]}${unit}.` };
}

/**
 * Checks in order: shape (correcting slips in a string without it), minimum, unit, range order.
 * Reports only the first problem.
 * @param {string} name
 * @returns {Format}
 */
function format(name) {
  const { expected, read, minimum } = NOTATIONS[name];
  return {
    expected,
    parse(value) {
      /** @type {string[]} */
      const notes = [];
      let form = read(value);
      let fixed = ''; // the corrected text, set whenever notes is not empty
      if (!form && typeof value === 'string') {
        fixed = correct(name, value, notes);
        form = read(fixed);
      }
      if (!form) return { message: `Expected ${expected}.` };
      if (!form.numbers.every(minimum.ok)) return { message: minimum.message };
      const problem = form.unitless ? NO_UNIT : order(form);
      if (problem) return { message: [...notes, problem.message].join(' '), hint: problem.hint };
      return notes.length ? { message: notes.join(' '), hint: `Write ${fixed}.` } : form.value;
    },
  };
}

/** The notations by the name the schema's format keyword uses. @type {Record<string, Format>} */
export const FORMATS = Object.fromEntries(Object.keys(NOTATIONS).map(name => [name, format(name)]));
