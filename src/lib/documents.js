/**
 * Pure helpers for building/merging Firestore documents.
 * Shared by the Firestore repository, the local demo repository and the tests.
 *
 * Document shapes (kept in one place so both backends stay identical):
 *
 *   meta/schedule   { lastWorkoutType: "Upper"|"Lower", lastWorkoutDate: "YYYY-MM-DD" }
 *   meta/people     { names: string[] }
 *   rainStatus/{date}                      boolean
 *   workoutDays/{date}                     { type, date, participants, createdAt, updatedAt }
 *   workoutDays/{date}.participants.{name} { exercises: { [exerciseId]: { sets: bool[], weight: number|null } }, isCompleted }
 */

import { getExercisesForType, getParticipantStats } from './workout.js';

export const DEFAULT_PEOPLE = Object.freeze(['Person A', 'Person B']);
export const MAX_NAME_LENGTH = 24;

// Dots, slashes, tildes, brackets and control characters are awkward or
// illegal in Firestore map keys / debug output.
const INVALID_NAME_CODES = new Set([0x2e, 0x2f, 0x5c, 0x7e, 0x2a, 0x5b, 0x5d]);

function stripInvalidNameChars(value) {
  let clean = '';
  for (const char of value) {
    const code = char.codePointAt(0);
    if (INVALID_NAME_CODES.has(code)) continue;
    // Drop control characters as well.
    if (code < 0x20 || code === 0x7f) continue;
    clean += char;
  }
  return clean;
}

/**
 * @returns {{ ok: true, name: string } | { ok: false, error: string }}
 */
export function sanitizePersonName(raw) {
  if (typeof raw !== 'string') return { ok: false, error: 'Enter a name.' };
  const name = stripInvalidNameChars(raw).replace(/\s+/g, ' ').trim();
  if (!name) return { ok: false, error: 'Enter a name.' };
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Keep it under ${MAX_NAME_LENGTH} characters.` };
  }
  return { ok: true, name };
}

export function hasPerson(people, name) {
  return people.some((person) => person.toLowerCase() === String(name).toLowerCase());
}

/** New participant entry with every phase-1 exercise pre-created and unchecked. */
export function createPersonEntry(type) {
  const exercises = {};
  for (const exercise of getExercisesForType(type)) {
    exercises[exercise.id] = {
      sets: Array.from({ length: exercise.setCount }, () => false),
      weight: null,
    };
  }
  return { exercises, isCompleted: false };
}

/**
 * A brand-new day document. Every listed person starts with a fully unchecked
 * entry so the dashboard can render other participants immediately.
 */
export function createDayDoc({ dateKey, type, people = DEFAULT_PEOPLE }) {
  const participants = {};
  for (const person of people) participants[person] = createPersonEntry(type);
  return { type, date: dateKey, participants };
}

export function computeCompletion(entry, type) {
  return getParticipantStats(entry, getExercisesForType(type)).isComplete;
}

/**
 * Return a NEW participant entry with one set toggled.
 * Missing participants/exercises are created on the fly.
 */
export function applySetChecked({
  entry,
  type,
  exerciseId,
  setIndex,
  checked,
  exercise,
}) {
  const target = exercise ?? getExercisesForType(type).find((e) => e.id === exerciseId);
  if (!target) throw new Error(`Unknown exercise: ${exerciseId}`);
  if (!Number.isInteger(setIndex) || setIndex < 0 || setIndex >= target.setCount) {
    throw new Error(`Set index out of range: ${setIndex}`);
  }

  const base = entry ?? createPersonEntry(type);
  const current = base.exercises?.[exerciseId];
  const sets = Array.from({ length: target.setCount }, (_, index) =>
    index === setIndex ? checked === true : current?.sets?.[index] === true,
  );

  const nextEntry = {
    ...base,
    exercises: {
      ...base.exercises,
      [exerciseId]: { ...current, sets },
    },
  };
  return { ...nextEntry, isCompleted: computeCompletion(nextEntry, type) };
}

/**
 * Return a NEW participant entry with one weight updated.
 * `weight` is `null` when the field is cleared, otherwise a positive number.
 */
export function applyWeight({ entry, type, exerciseId, weight, exercise }) {
  const target = exercise ?? getExercisesForType(type).find((e) => e.id === exerciseId);
  if (!target) throw new Error(`Unknown exercise: ${exerciseId}`);

  const numeric = weight === null || weight === '' ? null : Number(weight);
  if (numeric !== null && (!Number.isFinite(numeric) || numeric < 0 || numeric > 2000)) {
    throw new Error('Weight must be a number between 0 and 2000.');
  }

  const base = entry ?? createPersonEntry(type);
  const current = base.exercises?.[exerciseId];
  const nextEntry = {
    ...base,
    exercises: {
      ...base.exercises,
      [exerciseId]: { ...current, weight: numeric },
    },
  };
  return { ...nextEntry, isCompleted: computeCompletion(nextEntry, type) };
}

/** Merge people into a day doc, creating unchecked entries for anyone new. */
export function addMissingParticipants(dayDoc, people) {
  if (!dayDoc?.type) return dayDoc;
  const participants = { ...(dayDoc.participants ?? {}) };
  let changed = false;
  for (const person of people) {
    if (!participants[person]) {
      participants[person] = createPersonEntry(dayDoc.type);
      changed = true;
    }
  }
  return changed ? { ...dayDoc, participants } : dayDoc;
}

export function normalizeWeightInput(raw) {
  const trimmed = String(raw ?? '').trim();
  if (trimmed === '') return { value: null, error: null };
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 2000) {
    return { value: null, error: 'Enter a weight in lbs.' };
  }
  return { value: Math.round(numeric * 10) / 10, error: null };
}
