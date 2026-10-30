/**
 * Pure scheduling logic for the shared gym rotation.
 *
 * No React, no Firebase — everything in this module is plain, synchronous and
 * unit-tested in `schedule.test.js`.
 *
 * Rules implemented here:
 *  - Monday + Thursday are always gym days.
 *  - Sunday is always a rest day.
 *  - Tue / Wed / Fri / Sat are basketball days by default, and become gym days
 *    when a per-date "rain" flag is set for that date.
 *  - Gym days alternate Upper / Lower based on the LAST ACTUAL gym day (stored
 *    in meta/schedule), not on the calendar weekday.
 */

export const WORKOUT_TYPES = Object.freeze({
  UPPER: 'Upper',
  LOWER: 'Lower',
});

export const DAY_KINDS = Object.freeze({
  GYM: 'gym',
  BASKETBALL: 'basketball',
  REST: 'rest',
});

/** Monday (1) and Thursday (4). */
export const ALWAYS_GYM_WEEKDAYS = Object.freeze([1, 4]);
/** Tuesday (2), Wednesday (3), Friday (5), Saturday (6). */
export const RAIN_ELIGIBLE_WEEKDAYS = Object.freeze([2, 3, 5, 6]);
/** Sunday (0). */
export const REST_WEEKDAY = 0;

const ALWAYS_GYM = new Set(ALWAYS_GYM_WEEKDAYS);
const RAIN_ELIGIBLE = new Set(RAIN_ELIGIBLE_WEEKDAYS);

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(value) {
  return String(value).padStart(2, '0');
}

/**
 * Local-time calendar key, e.g. "2026-10-30".
 * Deliberately built from local getters (not toISOString) so a user at 11pm
 * does not get tomorrow's date.
 */
export function toDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) throw new Error('toDateKey: invalid date');
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Inverse of {@link toDateKey}; returns null when the key is malformed. */
export function fromDateKey(dateKey) {
  const match = DATE_KEY_PATTERN.exec(String(dateKey ?? ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function isValidDateKey(dateKey) {
  return fromDateKey(dateKey) !== null;
}

export function getWeekday(date = new Date()) {
  const d = date instanceof Date ? date : fromDateKey(date);
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.getDay();
}

export function isAlwaysGymDay(date) {
  return ALWAYS_GYM.has(getWeekday(date));
}

export function isRainEligibleDay(date) {
  return RAIN_ELIGIBLE.has(getWeekday(date));
}

export function isRestDay(date) {
  return getWeekday(date) === REST_WEEKDAY;
}

/**
 * The schedule before rain is taken into account:
 * Mon/Thu -> gym, Sun -> rest, everything else -> basketball.
 */
export function getBaseDayKind(date) {
  const weekday = getWeekday(date);
  if (weekday === null) throw new Error('getBaseDayKind: invalid date');
  if (ALWAYS_GYM.has(weekday)) return DAY_KINDS.GYM;
  if (weekday === REST_WEEKDAY) return DAY_KINDS.REST;
  return DAY_KINDS.BASKETBALL;
}

/**
 * Resolve what today actually is, after applying the per-date rain flag.
 * A rain flag can only ever convert a basketball day into a gym day.
 */
export function getDayKind(date, { rainedOut = false } = {}) {
  const baseKind = getBaseDayKind(date);
  if (baseKind === DAY_KINDS.BASKETBALL && rainedOut === true) {
    return DAY_KINDS.GYM;
  }
  return baseKind;
}

/** "Upper"/"upper"/" UPPER " -> "Upper"; anything else -> null. */
export function normalizeWorkoutType(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'upper') return WORKOUT_TYPES.UPPER;
  if (normalized === 'lower') return WORKOUT_TYPES.LOWER;
  return null;
}

/** "Upper" -> "Lower" and vice-versa. Unknown input -> null. */
export function flipWorkoutType(type) {
  const normalized = normalizeWorkoutType(type);
  if (normalized === WORKOUT_TYPES.UPPER) return WORKOUT_TYPES.LOWER;
  if (normalized === WORKOUT_TYPES.LOWER) return WORKOUT_TYPES.UPPER;
  return null;
}

export const RESOLUTION_ACTIONS = Object.freeze({
  EXISTING_TODAY: 'existing-today',
  ALREADY_TODAY: 'already-today',
  FLIPPED: 'flipped',
  SEEDED: 'seeded',
  SEED_REQUIRED: 'seed-required',
  NOT_GYM_DAY: 'not-gym-day',
});

/**
 * Decide today's workout type without side effects.
 *
 * @param {object} input
 * @param {string|null} input.lastWorkoutType  meta/schedule.lastWorkoutType
 * @param {string|null} input.lastWorkoutDate  meta/schedule.lastWorkoutDate (YYYY-MM-DD)
 * @param {string} input.todayKey              today's YYYY-MM-DD
 * @param {string|null} [input.seedType]       manual seed chosen on first run
 * @param {string|null} [input.existingType]   type already on today's workoutDays doc
 * @returns {{ type: string|null, action: string, nextMeta: {lastWorkoutType:string,lastWorkoutDate:string}|null }}
 */
export function resolveWorkoutType({
  lastWorkoutType = null,
  lastWorkoutDate = null,
  todayKey,
  seedType = null,
  existingType = null,
} = {}) {
  if (!isValidDateKey(todayKey)) {
    throw new Error('resolveWorkoutType: todayKey must be a YYYY-MM-DD date');
  }

  // Today's workout document is the source of truth if it already exists
  // (e.g. it was created by another device a moment ago).
  const existing = normalizeWorkoutType(existingType);
  if (existing) {
    const metaInSync =
      normalizeWorkoutType(lastWorkoutType) === existing &&
      lastWorkoutDate === todayKey;
    return {
      type: existing,
      action: RESOLUTION_ACTIONS.EXISTING_TODAY,
      nextMeta: metaInSync
        ? null
        : { lastWorkoutType: existing, lastWorkoutDate: todayKey },
    };
  }

  const stored = normalizeWorkoutType(lastWorkoutType);
  if (stored) {
    // Already advanced for today: redisplay the stored type, never flip twice.
    if (lastWorkoutDate === todayKey) {
      return {
        type: stored,
        action: RESOLUTION_ACTIONS.ALREADY_TODAY,
        nextMeta: null,
      };
    }
    const flipped = flipWorkoutType(stored);
    return {
      type: flipped,
      action: RESOLUTION_ACTIONS.FLIPPED,
      nextMeta: { lastWorkoutType: flipped, lastWorkoutDate: todayKey },
    };
  }

  const seed = normalizeWorkoutType(seedType);
  if (seed) {
    return {
      type: seed,
      action: RESOLUTION_ACTIONS.SEEDED,
      nextMeta: { lastWorkoutType: seed, lastWorkoutDate: todayKey },
    };
  }

  return {
    type: null,
    action: RESOLUTION_ACTIONS.SEED_REQUIRED,
    nextMeta: null,
  };
}

/**
 * Combine the calendar, the rain flag and meta/schedule into one view model.
 */
export function buildDayPlan({
  date = new Date(),
  rainedOut = false,
  scheduleMeta = null,
  seedType = null,
  existingType = null,
} = {}) {
  const dateObj =
    date instanceof Date ? date : (fromDateKey(date) ?? new Date(date));
  if (Number.isNaN(dateObj.getTime())) throw new Error('buildDayPlan: invalid date');

  const dateKey = toDateKey(dateObj);
  const baseKind = getBaseDayKind(dateObj);
  const rainEligible = isRainEligibleDay(dateObj);
  const rainApplies = baseKind === DAY_KINDS.BASKETBALL && rainedOut === true;
  const dayKind = getDayKind(dateObj, { rainedOut });

  const resolution =
    dayKind === DAY_KINDS.GYM
      ? resolveWorkoutType({
          lastWorkoutType: scheduleMeta?.lastWorkoutType ?? null,
          lastWorkoutDate: scheduleMeta?.lastWorkoutDate ?? null,
          todayKey: dateKey,
          seedType,
          existingType,
        })
      : {
          type: null,
          action: RESOLUTION_ACTIONS.NOT_GYM_DAY,
          nextMeta: null,
        };

  return {
    date: dateObj,
    dateKey,
    weekday: dateObj.getDay(),
    baseKind,
    dayKind,
    rainEligible,
    rainedOut: rainApplies,
    workoutType: resolution.type,
    scheduleAction: resolution.action,
    nextMeta: resolution.nextMeta,
  };
}

export function getDayTitle(dayKind, workoutType) {
  switch (dayKind) {
    case DAY_KINDS.GYM:
      return workoutType ? `${workoutType} Body` : 'Gym Day';
    case DAY_KINDS.BASKETBALL:
      return 'Basketball';
    case DAY_KINDS.REST:
      return 'Rest Day';
    default:
      return 'Today';
  }
}

export function getDaySubtitle(plan) {
  if (!plan) return '';
  const { dayKind, baseKind, rainedOut } = plan;
  if (dayKind === DAY_KINDS.GYM) {
    if (baseKind === DAY_KINDS.BASKETBALL && rainedOut) {
      return 'Rain called it — basketball swapped for the gym.';
    }
    return 'Mandatory gym day on the rotation.';
  }
  if (dayKind === DAY_KINDS.BASKETBALL) {
    return 'Court day. Rain? Flip it to a gym session below.';
  }
  return 'Sunday is rest. Recovery is part of the program.';
}

/**
 * Next calendar gym day strictly after `date` (rain days not considered).
 * Used for the rest-day message.
 */
export function getNextGymDay(date = new Date(), { includeToday = false } = {}) {
  const start = date instanceof Date ? date : fromDateKey(date);
  if (!start) return null;
  for (let offset = includeToday ? 0 : 1; offset <= 7; offset += 1) {
    const candidate = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + offset,
    );
    if (isAlwaysGymDay(candidate)) return candidate;
  }
  return null;
}

/**
 * Base (rain-agnostic) schedule for a 7-day strip, Monday first.
 * Rain flags are only ever known for "today" in this phase.
 */
export function getWeekPreview(date = new Date(), { rainedOut = false } = {}) {
  const day = date instanceof Date ? new Date(date) : fromDateKey(date);
  if (!day) return [];
  const weekday = day.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const monday = new Date(day.getFullYear(), day.getMonth(), day.getDate() + mondayOffset);
  const todayKey = toDateKey(day);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + index,
    );
    const currentKey = toDateKey(current);
    const baseKind = getBaseDayKind(current);
    const isToday = currentKey === todayKey;
    return {
      date: current,
      dateKey: currentKey,
      weekday: current.getDay(),
      baseKind,
      dayKind: isToday ? getDayKind(current, { rainedOut }) : baseKind,
      isToday,
      isPast: currentKey < todayKey,
    };
  });
}
