import { describe, expect, it } from 'vitest';

import {
  DAY_KINDS,
  RESOLUTION_ACTIONS,
  WORKOUT_TYPES,
  buildDayPlan,
  flipWorkoutType,
  fromDateKey,
  getBaseDayKind,
  getDayKind,
  getWeekPreview,
  normalizeWorkoutType,
  resolveWorkoutType,
  toDateKey,
} from './schedule.js';

// 2026-10-26 is a Monday.
const MONDAY = '2026-10-26';
const TUESDAY = '2026-10-27';
const WEDNESDAY = '2026-10-28';
const THURSDAY = '2026-10-29';
const FRIDAY = '2026-10-30';
const SATURDAY = '2026-10-31';
const SUNDAY = '2026-11-01';

describe('date helpers', () => {
  it('round-trips a local date key', () => {
    for (const key of [MONDAY, TUESDAY, SUNDAY]) {
      expect(toDateKey(fromDateKey(key))).toBe(key);
    }
  });

  it('rejects malformed and impossible dates', () => {
    expect(fromDateKey('2026-2-3')).toBeNull();
    expect(fromDateKey('2026-02-30')).toBeNull();
    expect(fromDateKey('not-a-date')).toBeNull();
    expect(fromDateKey('')).toBeNull();
  });

  it('builds keys from local time, not UTC', () => {
    const lateNight = new Date(2026, 9, 30, 23, 45);
    expect(toDateKey(lateNight)).toBe('2026-10-30');
  });
});

describe('base schedule', () => {
  it('makes Monday and Thursday always gym days', () => {
    expect(getBaseDayKind(fromDateKey(MONDAY))).toBe(DAY_KINDS.GYM);
    expect(getBaseDayKind(fromDateKey(THURSDAY))).toBe(DAY_KINDS.GYM);
  });

  it('makes Sunday always rest', () => {
    expect(getBaseDayKind(fromDateKey(SUNDAY))).toBe(DAY_KINDS.REST);
  });

  it('makes Tue/Wed/Fri/Sat basketball by default', () => {
    for (const key of [TUESDAY, WEDNESDAY, FRIDAY, SATURDAY]) {
      expect(getBaseDayKind(fromDateKey(key))).toBe(DAY_KINDS.BASKETBALL);
    }
  });
});

describe('rain flag', () => {
  it('turns a basketball day into a gym day', () => {
    expect(getDayKind(fromDateKey(TUESDAY), { rainedOut: true })).toBe(DAY_KINDS.GYM);
  });

  it('does nothing on an always-gym day', () => {
    expect(getDayKind(fromDateKey(MONDAY), { rainedOut: false })).toBe(DAY_KINDS.GYM);
    expect(getDayKind(fromDateKey(MONDAY), { rainedOut: true })).toBe(DAY_KINDS.GYM);
  });

  it('does nothing on a rest day', () => {
    expect(getDayKind(fromDateKey(SUNDAY), { rainedOut: true })).toBe(DAY_KINDS.REST);
  });

  it('only treats the literal true as rain', () => {
    expect(getDayKind(fromDateKey(TUESDAY), { rainedOut: 'true' })).toBe(
      DAY_KINDS.BASKETBALL,
    );
  });
});

describe('workout type helpers', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeWorkoutType(' upper ')).toBe(WORKOUT_TYPES.UPPER);
    expect(normalizeWorkoutType('LOWER')).toBe(WORKOUT_TYPES.LOWER);
    expect(normalizeWorkoutType('arms')).toBeNull();
    expect(normalizeWorkoutType(undefined)).toBeNull();
  });

  it('flips Upper <-> Lower', () => {
    expect(flipWorkoutType('Upper')).toBe('Lower');
    expect(flipWorkoutType('Lower')).toBe('Upper');
    expect(flipWorkoutType('nope')).toBeNull();
  });
});

describe('resolveWorkoutType', () => {
  it('asks for a manual seed when meta/schedule is missing', () => {
    const result = resolveWorkoutType({ todayKey: MONDAY });
    expect(result).toEqual({
      type: null,
      action: RESOLUTION_ACTIONS.SEED_REQUIRED,
      nextMeta: null,
    });
  });

  it('saves the chosen seed and dates it today', () => {
    const result = resolveWorkoutType({ todayKey: MONDAY, seedType: 'Lower' });
    expect(result.type).toBe('Lower');
    expect(result.action).toBe(RESOLUTION_ACTIONS.SEEDED);
    expect(result.nextMeta).toEqual({
      lastWorkoutType: 'Lower',
      lastWorkoutDate: MONDAY,
    });
  });

  it('flips when the last gym day was an earlier day', () => {
    const result = resolveWorkoutType({
      lastWorkoutType: 'Upper',
      lastWorkoutDate: '2026-10-22',
      todayKey: MONDAY,
    });
    expect(result.type).toBe('Lower');
    expect(result.action).toBe(RESOLUTION_ACTIONS.FLIPPED);
    expect(result.nextMeta).toEqual({
      lastWorkoutType: 'Lower',
      lastWorkoutDate: MONDAY,
    });
  });

  it('flips from the last ACTUAL gym day across several days of basketball', () => {
    // Last gym was Friday; next gym day is Monday, so the rotation advances once.
    const result = resolveWorkoutType({
      lastWorkoutType: 'Lower',
      lastWorkoutDate: '2026-10-23',
      todayKey: MONDAY,
    });
    expect(result.type).toBe('Upper');
  });

  it('never double-flips on the same day', () => {
    const result = resolveWorkoutType({
      lastWorkoutType: 'Upper',
      lastWorkoutDate: MONDAY,
      todayKey: MONDAY,
    });
    expect(result.type).toBe('Upper');
    expect(result.action).toBe(RESOLUTION_ACTIONS.ALREADY_TODAY);
    expect(result.nextMeta).toBeNull();
  });

  it('respects a workout day that already exists even if meta lags behind', () => {
    const result = resolveWorkoutType({
      lastWorkoutType: 'Upper',
      lastWorkoutDate: '2026-10-22',
      todayKey: MONDAY,
      existingType: 'Upper',
    });
    expect(result.type).toBe('Upper');
    expect(result.action).toBe(RESOLUTION_ACTIONS.EXISTING_TODAY);
    expect(result.nextMeta).toEqual({
      lastWorkoutType: 'Upper',
      lastWorkoutDate: MONDAY,
    });
  });

  it('does not rewrite meta when it is already in sync', () => {
    const result = resolveWorkoutType({
      lastWorkoutType: 'Upper',
      lastWorkoutDate: MONDAY,
      todayKey: MONDAY,
      existingType: 'Upper',
    });
    expect(result.nextMeta).toBeNull();
  });

  it('validates the today key', () => {
    expect(() => resolveWorkoutType({ todayKey: '30-10-2026' })).toThrow();
  });
});

describe('buildDayPlan', () => {
  it('builds a Monday gym plan and flips the type', () => {
    const plan = buildDayPlan({
      date: fromDateKey(MONDAY),
      scheduleMeta: { lastWorkoutType: 'Lower', lastWorkoutDate: '2026-10-24' },
    });
    expect(plan.dateKey).toBe(MONDAY);
    expect(plan.dayKind).toBe(DAY_KINDS.GYM);
    expect(plan.baseKind).toBe(DAY_KINDS.GYM);
    expect(plan.workoutType).toBe('Upper');
    expect(plan.scheduleAction).toBe(RESOLUTION_ACTIONS.FLIPPED);
    expect(plan.rainEligible).toBe(false);
  });

  it('keeps a rained-out Tuesday as a gym day', () => {
    const plan = buildDayPlan({
      date: fromDateKey(TUESDAY),
      rainedOut: true,
      scheduleMeta: { lastWorkoutType: 'Upper', lastWorkoutDate: MONDAY },
    });
    expect(plan.dayKind).toBe(DAY_KINDS.GYM);
    expect(plan.rainedOut).toBe(true);
    expect(plan.rainEligible).toBe(true);
    expect(plan.workoutType).toBe('Lower');
  });

  it('ignores rain on an always-gym Monday', () => {
    const plan = buildDayPlan({
      date: fromDateKey(MONDAY),
      rainedOut: true,
      scheduleMeta: null,
      seedType: 'Upper',
    });
    expect(plan.dayKind).toBe(DAY_KINDS.GYM);
    expect(plan.rainedOut).toBe(false);
    expect(plan.workoutType).toBe('Upper');
  });

  it('stays on basketball when it is not raining', () => {
    const plan = buildDayPlan({
      date: fromDateKey(FRIDAY),
      rainedOut: false,
      scheduleMeta: { lastWorkoutType: 'Lower', lastWorkoutDate: MONDAY },
    });
    expect(plan.dayKind).toBe(DAY_KINDS.BASKETBALL);
    expect(plan.workoutType).toBeNull();
    expect(plan.rainEligible).toBe(true);
  });

  it('returns a rest day on Sunday', () => {
    const plan = buildDayPlan({ date: fromDateKey(SUNDAY) });
    expect(plan.dayKind).toBe(DAY_KINDS.REST);
    expect(plan.workoutType).toBeNull();
    expect(plan.scheduleAction).toBe(RESOLUTION_ACTIONS.NOT_GYM_DAY);
  });
});

describe('getWeekPreview', () => {
  it('returns Monday-first week with today flagged', () => {
    const week = getWeekPreview(fromDateKey(FRIDAY), { rainedOut: false });
    expect(week).toHaveLength(7);
    expect(week[0].dateKey).toBe(MONDAY);
    expect(week[6].dateKey).toBe(SUNDAY);
    expect(week.filter((day) => day.isToday)).toHaveLength(1);
    expect(week.find((day) => day.isToday).dateKey).toBe(FRIDAY);
  });

  it('applies rain only to today', () => {
    const week = getWeekPreview(fromDateKey(TUESDAY), { rainedOut: true });
    expect(week.find((day) => day.isToday).dayKind).toBe(DAY_KINDS.GYM);
    expect(week.find((day) => day.dateKey === WEDNESDAY).dayKind).toBe(
      DAY_KINDS.BASKETBALL,
    );
  });

  it('handles a Sunday without breaking the Monday-first layout', () => {
    const week = getWeekPreview(fromDateKey(SUNDAY));
    expect(week[0].dateKey).toBe(MONDAY);
    expect(week[6].dateKey).toBe(SUNDAY);
    expect(week[6].isToday).toBe(true);
  });
});
