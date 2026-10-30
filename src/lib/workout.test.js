import { describe, expect, it } from 'vitest';

import { EXERCISES_BY_TYPE } from '../data/exercises.js';
import { applySetChecked, createDayDoc, createPersonEntry } from './documents.js';
import {
  getDayBanners,
  getExerciseById,
  getExercisesForType,
  getParticipantEntry,
  getParticipantStats,
  getSetStates,
  getWeight,
  isExerciseComplete,
} from './workout.js';
import { DAY_KINDS } from './schedule.js';

describe('exercise catalog', () => {
  it('has the eight upper body exercises in order', () => {
    expect(getExercisesForType('Upper').map((exercise) => exercise.id)).toEqual([
      'chest-press',
      'lat-pulldown',
      'cable-row',
      'shoulder-press',
      'delt-raises',
      'shrugs',
      'tricep-pulldown',
      'wrist-curls',
    ]);
  });

  it('has the five lower body exercises in order', () => {
    expect(getExercisesForType('Lower').map((exercise) => exercise.id)).toEqual([
      'leg-press',
      'romanian-deadlift',
      'leg-curl',
      'calf-raises',
      'hip-thrust',
    ]);
  });

  it('keeps the leg press knee-safety note attached', () => {
    expect(getExerciseById('Lower', 'leg-press').safety).toMatch(/pain-free/i);
  });

  it('returns nothing for non-gym types', () => {
    expect(getExercisesForType('Basketball')).toEqual([]);
  });
});

describe('participant helpers', () => {
  it('reads a participant out of a day doc', () => {
    const day = createDayDoc({ dateKey: '2026-10-26', type: 'Upper', people: ['A'] });
    expect(getParticipantEntry(day, 'A')).toBeTruthy();
    expect(getParticipantEntry(day, 'Missing')).toBeNull();
    expect(getParticipantEntry(null, 'A')).toBeNull();
  });

  it('pads set states to the exercise set count', () => {
    const entry = createPersonEntry('Upper');
    const exercise = getExerciseById('Upper', 'delt-raises');
    expect(getSetStates(entry, exercise)).toEqual([false, false]);
    expect(getSetStates(null, exercise)).toEqual([false, false]);
  });

  it('reads weights with sane fallbacks', () => {
    const entry = createPersonEntry('Upper');
    expect(getWeight(entry, 'chest-press')).toBe(0);
    entry.exercises['chest-press'].weight = 95;
    expect(getWeight(entry, 'chest-press')).toBe(95);
    entry.exercises['chest-press'].weight = null;
    expect(getWeight(entry, 'chest-press')).toBe(0);
  });

  it('computes exercise completion and overall stats', () => {
    const exercises = getExercisesForType('Upper');
    let entry = createPersonEntry('Upper');
    const chest = getExerciseById('Upper', 'chest-press');
    expect(isExerciseComplete(entry, chest)).toBe(false);

    entry = applySetChecked({ entry, type: 'Upper', exerciseId: chest.id, setIndex: 0, checked: true });
    entry = applySetChecked({ entry, type: 'Upper', exerciseId: chest.id, setIndex: 1, checked: true });
    expect(isExerciseComplete(entry, chest)).toBe(false);
    entry = applySetChecked({ entry, type: 'Upper', exerciseId: chest.id, setIndex: 2, checked: true });
    expect(isExerciseComplete(entry, chest)).toBe(true);

    const stats = getParticipantStats(entry, exercises);
    expect(stats.completedExercises).toBe(1);
    expect(stats.totalExercises).toBe(8);
    expect(stats.completedSets).toBe(3);
    expect(stats.totalSets).toBe(21);
    expect(stats.percent).toBe(13);
    expect(stats.isComplete).toBe(false);
  });

  it('handles a missing participant as zero progress', () => {
    const stats = getParticipantStats(null, getExercisesForType('Lower'));
    expect(stats.completedExercises).toBe(0);
    expect(stats.totalSets).toBe(15);
    expect(stats.percent).toBe(0);
    expect(stats.isComplete).toBe(false);
  });
});

describe('banners', () => {
  it('shows knee safety, lower tempo and no wall sits on Lower days', () => {
    const banners = getDayBanners({ dayKind: DAY_KINDS.GYM, workoutType: 'Lower' });
    expect(banners.kneeSafety).toMatch(/KNEE SAFETY/);
    expect(banners.tempo).toMatch(/Leg Press and Hip Thrust/);
    expect(banners.wallSits).toBeNull();
  });

  it('shows press tempo and wall sits on Upper days', () => {
    const banners = getDayBanners({ dayKind: DAY_KINDS.GYM, workoutType: 'Upper' });
    expect(banners.kneeSafety).toBeNull();
    expect(banners.tempo).toMatch(/Chest Press and Shoulder Press/);
    expect(banners.wallSits.title).toMatch(/Wall Sits/);
  });

  it('shows wall sits but no tempo on basketball days', () => {
    const banners = getDayBanners({ dayKind: DAY_KINDS.BASKETBALL, workoutType: null });
    expect(banners.tempo).toBeNull();
    expect(banners.wallSits.body).toMatch(/3 min/);
  });

  it('shows nothing extra on rest days', () => {
    const banners = getDayBanners({ dayKind: DAY_KINDS.REST, workoutType: null });
    expect(banners).toEqual({
      kneeSafety: null,
      tempo: null,
      wallSits: null,
      legPressWarning: null,
    });
  });
});

describe('phase 1 scope guardrails', () => {
  it('locks lbs as the only unit', () => {
    const units = Object.keys(EXERCISES_BY_TYPE).flatMap((type) =>
      EXERCISES_BY_TYPE[type].map((exercise) => exercise.unit),
    );
    expect(units.every((unit) => unit === undefined)).toBe(true);
  });
});
