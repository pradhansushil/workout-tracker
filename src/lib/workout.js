/**
 * Derived helpers for the workoutDays document shape.
 * Pure and unit-tested — used by both the UI and the data layer when it
 * recomputes `isCompleted`.
 */

import { EXERCISES_BY_TYPE, WALL_SITS_TITLE, BANNERS } from '../data/exercises.js';
import { DAY_KINDS, WORKOUT_TYPES, normalizeWorkoutType } from './schedule.js';

export function getExercisesForType(type) {
  const normalized = normalizeWorkoutType(type);
  return normalized ? EXERCISES_BY_TYPE[normalized] : [];
}

export function getExerciseById(type, exerciseId) {
  return getExercisesForType(type).find((exercise) => exercise.id === exerciseId) ?? null;
}

export function getParticipantEntry(workoutDay, personName) {
  if (!workoutDay?.participants || !personName) return null;
  return workoutDay.participants[personName] ?? null;
}

export function getExerciseEntry(participant, exerciseId) {
  return participant?.exercises?.[exerciseId] ?? null;
}

/** Always returns an array of exactly `exercise.setCount` booleans. */
export function getSetStates(participant, exercise) {
  const stored = getExerciseEntry(participant, exercise.id)?.sets;
  return Array.from({ length: exercise.setCount }, (_, index) => stored?.[index] === true);
}

export function getSetState(participant, exercise, setIndex) {
  return getSetStates(participant, exercise)[setIndex] === true;
}

export function getWeight(participant, exerciseId) {
  const weight = getExerciseEntry(participant, exerciseId)?.weight;
  const numeric = typeof weight === 'number' ? weight : Number(weight);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

export function isExerciseComplete(participant, exercise) {
  return getSetStates(participant, exercise).every(Boolean);
}

/**
 * @returns {{ totalExercises:number, completedExercises:number, totalSets:number,
 *             completedSets:number, percent:number, isComplete:boolean }}
 */
export function getParticipantStats(participant, exercises) {
  const totalExercises = exercises.length;
  let completedExercises = 0;
  let totalSets = 0;
  let completedSets = 0;

  for (const exercise of exercises) {
    const sets = getSetStates(participant, exercise);
    const done = sets.filter(Boolean).length;
    totalSets += sets.length;
    completedSets += done;
    if (sets.length > 0 && done === sets.length) completedExercises += 1;
  }

  const isComplete = totalExercises > 0 && completedExercises === totalExercises;
  return {
    totalExercises,
    completedExercises,
    totalSets,
    completedSets,
    percent:
      totalExercises === 0 ? 0 : Math.round((completedExercises / totalExercises) * 100),
    isComplete,
  };
}

/**
 * Banners relevant to a day, in priority order.
 * Wall sits appear on Upper gym days and on basketball days (never Lower).
 */
export function getDayBanners({ dayKind, workoutType }) {
  if (dayKind === DAY_KINDS.GYM) {
    const type = normalizeWorkoutType(workoutType);
    if (type === WORKOUT_TYPES.LOWER) {
      return {
        kneeSafety: BANNERS.kneeSafety,
        tempo: BANNERS.tempoLower,
        wallSits: null,
        legPressWarning: BANNERS.kneeSafety,
      };
    }
    if (type === WORKOUT_TYPES.UPPER) {
      return {
        kneeSafety: null,
        tempo: BANNERS.tempoPress,
        wallSits: { title: WALL_SITS_TITLE, body: BANNERS.wallSits },
        legPressWarning: null,
      };
    }
  }
  if (dayKind === DAY_KINDS.BASKETBALL) {
    return {
      kneeSafety: null,
      tempo: null,
      wallSits: { title: WALL_SITS_TITLE, body: BANNERS.wallSits },
      legPressWarning: null,
    };
  }
  return { kneeSafety: null, tempo: null, wallSits: null, legPressWarning: null };
}
