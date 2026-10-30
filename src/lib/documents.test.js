import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PEOPLE,
  addMissingParticipants,
  applySetChecked,
  applyWeight,
  createDayDoc,
  createPersonEntry,
  normalizeWeightInput,
  sanitizePersonName,
} from './documents.js';
import { EXERCISES_BY_TYPE } from '../data/exercises.js';
import { getParticipantStats, getSetStates } from './workout.js';

const dateKey = '2026-10-26';

describe('sanitizePersonName', () => {
  it('trims and collapses whitespace', () => {
    expect(sanitizePersonName('  Sushil   Raj  ')).toEqual({ ok: true, name: 'Sushil Raj' });
  });

  it('strips characters that break field paths', () => {
    expect(sanitizePersonName('A.B/C')).toEqual({ ok: true, name: 'ABC' });
  });

  it('rejects empty names', () => {
    expect(sanitizePersonName('   ').ok).toBe(false);
    expect(sanitizePersonName('.').ok).toBe(false);
    expect(sanitizePersonName(null).ok).toBe(false);
  });

  it('caps the length', () => {
    expect(sanitizePersonName('x'.repeat(25)).ok).toBe(false);
    expect(sanitizePersonName('x'.repeat(24)).ok).toBe(true);
  });
});

describe('createPersonEntry', () => {
  it('creates every upper exercise with 3 or 2 unchecked sets', () => {
    const entry = createPersonEntry('Upper');
    expect(Object.keys(entry.exercises)).toHaveLength(EXERCISES_BY_TYPE.Upper.length);
    expect(entry.exercises['chest-press'].sets).toEqual([false, false, false]);
    expect(entry.exercises['delt-raises'].sets).toEqual([false, false]);
    expect(entry.isCompleted).toBe(false);
  });

  it('creates every lower exercise', () => {
    const entry = createPersonEntry('Lower');
    expect(entry.exercises['leg-press'].sets).toHaveLength(3);
    expect(entry.exercises['hip-thrust'].weight).toBeNull();
  });

  it('returns no exercises for an unknown type', () => {
    expect(createPersonEntry('Cardio').exercises).toEqual({});
  });
});

describe('createDayDoc', () => {
  it('seeds all people', () => {
    const day = createDayDoc({ dateKey, type: 'Upper' });
    expect(day.type).toBe('Upper');
    expect(day.date).toBe(dateKey);
    expect(Object.keys(day.participants)).toEqual([...DEFAULT_PEOPLE]);
  });

  it('seeds custom people', () => {
    const day = createDayDoc({ dateKey, type: 'Lower', people: ['A', 'B', 'C'] });
    expect(Object.keys(day.participants)).toEqual(['A', 'B', 'C']);
  });
});

describe('applySetChecked', () => {
  it('toggles a single set without mutating the input', () => {
    const entry = createPersonEntry('Upper');
    const next = applySetChecked({
      entry,
      type: 'Upper',
      exerciseId: 'chest-press',
      setIndex: 1,
      checked: true,
    });
    expect(next.exercises['chest-press'].sets).toEqual([false, true, false]);
    expect(entry.exercises['chest-press'].sets).toEqual([false, false, false]);
    expect(next.isCompleted).toBe(false);
  });

  it('marks the participant complete once every set is checked', () => {
    let entry = createPersonEntry('Upper');
    for (const exercise of EXERCISES_BY_TYPE.Upper) {
      for (let setIndex = 0; setIndex < exercise.setCount; setIndex += 1) {
        entry = applySetChecked({
          entry,
          type: 'Upper',
          exerciseId: exercise.id,
          setIndex,
          checked: true,
        });
      }
    }
    expect(entry.isCompleted).toBe(true);
  });

  it('un-checks a set and clears completion', () => {
    let entry = createPersonEntry('Lower');
    for (const exercise of EXERCISES_BY_TYPE.Lower) {
      entry = applySetChecked({
        entry,
        type: 'Lower',
        exerciseId: exercise.id,
        setIndex: 0,
        checked: true,
      });
    }
    expect(getParticipantStats(entry, EXERCISES_BY_TYPE.Lower).percent).toBeLessThan(100);
    const before = getParticipantStats(entry, EXERCISES_BY_TYPE.Lower).completedSets;
    const next = applySetChecked({
      entry,
      type: 'Lower',
      exerciseId: 'leg-press',
      setIndex: 0,
      checked: false,
    });
    expect(getParticipantStats(next, EXERCISES_BY_TYPE.Lower).completedSets).toBe(before - 1);
  });

  it('creates a missing participant entry on the fly', () => {
    const next = applySetChecked({
      entry: null,
      type: 'Lower',
      exerciseId: 'calf-raises',
      setIndex: 2,
      checked: true,
    });
    expect(getSetStates(next, { id: 'calf-raises', setCount: 3 })).toEqual([false, false, true]);
  });

  it('rejects unknown exercises and out-of-range sets', () => {
    expect(() =>
      applySetChecked({ entry: null, type: 'Upper', exerciseId: 'nope', setIndex: 0, checked: true }),
    ).toThrow();
    expect(() =>
      applySetChecked({
        entry: null,
        type: 'Upper',
        exerciseId: 'chest-press',
        setIndex: 3,
        checked: true,
      }),
    ).toThrow();
  });

  it('does not confuse a truthy value with a real check', () => {
    const next = applySetChecked({
      entry: createPersonEntry('Upper'),
      type: 'Upper',
      exerciseId: 'shrugs',
      setIndex: 0,
      checked: 'yes',
    });
    expect(next.exercises.shrugs.sets[0]).toBe(false);
  });
});

describe('applyWeight', () => {
  it('stores a numeric weight', () => {
    const next = applyWeight({
      entry: createPersonEntry('Upper'),
      type: 'Upper',
      exerciseId: 'cable-row',
      weight: '62.5',
    });
    expect(next.exercises['cable-row'].weight).toBe(62.5);
  });

  it('clears the weight with null', () => {
    const next = applyWeight({
      entry: createPersonEntry('Upper'),
      type: 'Upper',
      exerciseId: 'cable-row',
      weight: null,
    });
    expect(next.exercises['cable-row'].weight).toBeNull();
  });

  it('rejects nonsense weights', () => {
    expect(() =>
      applyWeight({ entry: null, type: 'Upper', exerciseId: 'cable-row', weight: 9000 }),
    ).toThrow();
  });
});

describe('addMissingParticipants', () => {
  it('adds new people without touching existing data', () => {
    const day = createDayDoc({ dateKey, type: 'Upper', people: ['A'] });
    day.participants.A.exercises['chest-press'].sets = [true, true, true];
    const next = addMissingParticipants(day, ['A', 'B']);
    expect(Object.keys(next.participants)).toEqual(['A', 'B']);
    expect(next.participants.A.exercises['chest-press'].sets).toEqual([true, true, true]);
    expect(next.participants.B.isCompleted).toBe(false);
  });

  it('returns the same doc when nothing is missing', () => {
    const day = createDayDoc({ dateKey, type: 'Upper', people: ['A'] });
    expect(addMissingParticipants(day, ['A'])).toBe(day);
  });
});

describe('normalizeWeightInput', () => {
  it('rounds to one decimal', () => {
    expect(normalizeWeightInput('62.54')).toEqual({ value: 62.5, error: null });
  });

  it('treats blank as cleared', () => {
    expect(normalizeWeightInput('  ')).toEqual({ value: null, error: null });
  });

  it('reports errors', () => {
    expect(normalizeWeightInput('heavy').error).toBeTruthy();
    expect(normalizeWeightInput('-5').error).toBeTruthy();
    expect(normalizeWeightInput('9999').error).toBeTruthy();
  });
});
