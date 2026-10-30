/**
 * Firestore implementation of the data layer.
 *
 * Reads use onSnapshot so every device stays in sync. Writes that only touch
 * the current user's own subtree use deep-merged setDoc calls (no transaction)
 * so check-ins still queue while a phone is offline in the gym.
 */

import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import {
  DEFAULT_PEOPLE,
  addMissingParticipants,
  applySetChecked,
  applyWeight,
  createDayDoc,
  createPersonEntry,
  hasPerson,
  sanitizePersonName,
} from '../documents.js';
import {
  RESOLUTION_ACTIONS,
  normalizeWorkoutType,
  resolveWorkoutType,
} from '../schedule.js';

const SCHEDULE_PATH = ['meta', 'schedule'];
const PEOPLE_PATH = ['meta', 'people'];

export function createFirestoreRepository(db) {
  const dayRef = (dateKey) => doc(db, 'workoutDays', dateKey);
  const rainRef = (dateKey) => doc(db, 'rainStatus', dateKey);
  const scheduleRef = () => doc(db, ...SCHEDULE_PATH);
  const peopleRef = () => doc(db, ...PEOPLE_PATH);

  function subscribeDay(dateKey, onData, onError) {
    return onSnapshot(
      dayRef(dateKey),
      (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      onError,
    );
  }

  function subscribeRain(dateKey, onData, onError) {
    return onSnapshot(
      rainRef(dateKey),
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        onData(data ? data.rainedOut === true || data.value === true : false);
      },
      onError,
    );
  }

  function subscribePeople(onData, onError) {
    return onSnapshot(
      peopleRef(),
      (snap) => {
        const names = snap.exists() ? snap.data()?.names : null;
        onData(Array.isArray(names) && names.length > 0 ? names : [...DEFAULT_PEOPLE]);
      },
      onError,
    );
  }

  function subscribeSchedule(onData, onError) {
    return onSnapshot(
      scheduleRef(),
      (snap) => onData(snap.exists() ? snap.data() : null),
      onError,
    );
  }

  /** Create meta/people with the default roster the very first time. */
  async function seedPeople() {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(peopleRef());
      const names = snap.exists() ? snap.data()?.names : null;
      if (Array.isArray(names) && names.length > 0) return;
      transaction.set(
        peopleRef(),
        { names: [...DEFAULT_PEOPLE], updatedAt: serverTimestamp() },
        { merge: true },
      );
    });
  }

  async function addPerson(rawName) {
    const sanitized = sanitizePersonName(rawName);
    if (!sanitized.ok) throw new Error(sanitized.error);
    const name = sanitized.name;

    return runTransaction(db, async (transaction) => {
      const snap = await transaction.get(peopleRef());
      const names = snap.exists() ? snap.data()?.names ?? [] : [];
      if (hasPerson(names, name)) return { name, added: false, names };
      const nextNames = names.length > 0 ? [...names, name] : [...DEFAULT_PEOPLE, name];
      transaction.set(
        peopleRef(),
        { names: nextNames, updatedAt: serverTimestamp() },
        { merge: true },
      );
      return { name, added: true, names: nextNames };
    });
  }

  /**
   * Make sure today's workout document exists and, if this is the first gym day
   * ever, that meta/schedule has been advanced for today.
   *
   * @returns {Promise<{ needsSeed: boolean, type: string|null, action: string }>}
   */
  async function ensureDayType({ dateKey, seedType = null }) {
    return runTransaction(db, async (transaction) => {
      // All reads first (Firestore requirement).
      const [scheduleSnap, daySnap, peopleSnap] = await Promise.all([
        transaction.get(scheduleRef()),
        transaction.get(dayRef(dateKey)),
        transaction.get(peopleRef()),
      ]);

      const meta = scheduleSnap.exists() ? scheduleSnap.data() : null;
      const existing = daySnap.exists() ? daySnap.data() : null;
      const storedNames = peopleSnap.exists() ? peopleSnap.data()?.names : null;
      const people =
        Array.isArray(storedNames) && storedNames.length > 0
          ? storedNames
          : [...DEFAULT_PEOPLE];

      const resolution = resolveWorkoutType({
        lastWorkoutType: meta?.lastWorkoutType ?? null,
        lastWorkoutDate: meta?.lastWorkoutDate ?? null,
        todayKey: dateKey,
        seedType,
        existingType: existing?.type ?? null,
      });

      if (!resolution.type) {
        return {
          needsSeed: resolution.action === RESOLUTION_ACTIONS.SEED_REQUIRED,
          type: null,
          action: resolution.action,
        };
      }

      if (!existing) {
        transaction.set(dayRef(dateKey), {
          ...createDayDoc({ dateKey, type: resolution.type, people }),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const patched = addMissingParticipants(existing, people);
        if (patched !== existing) {
          const missing = {};
          for (const [person, entry] of Object.entries(patched.participants)) {
            if (!existing.participants?.[person]) missing[person] = entry;
          }
          if (Object.keys(missing).length > 0) {
            transaction.set(
              dayRef(dateKey),
              { participants: missing, updatedAt: serverTimestamp() },
              { merge: true },
            );
          }
        }
      }

      if (resolution.nextMeta) {
        transaction.set(
          scheduleRef(),
          { ...resolution.nextMeta, updatedAt: serverTimestamp() },
          { merge: true },
        );
      }

      return {
        needsSeed: false,
        type: resolution.type,
        action: resolution.action,
      };
    });
  }

  async function setRain({ dateKey, rainedOut }) {
    await setDoc(
      rainRef(dateKey),
      { rainedOut: rainedOut === true, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }

  /**
   * Prefer the entry the UI handed us (it includes optimistic local edits);
   * otherwise fall back to the freshest document Firestore knows about so a
   * second device can't corrupt the day's completion flag.
   */
  async function resolveEntry({ dateKey, personName, entry }) {
    if (entry) return entry;
    const snap = await getDoc(dayRef(dateKey));
    if (!snap.exists()) return null;
    return snap.data()?.participants?.[personName] ?? null;
  }

  async function setSetChecked({
    dateKey,
    type,
    personName,
    entry,
    exerciseId,
    setIndex,
    checked,
  }) {
    if (!normalizeWorkoutType(type)) {
      throw new Error('Today’s workout type is not set yet.');
    }
    const current = (await resolveEntry({ dateKey, personName, entry })) ?? createPersonEntry(type);
    const nextEntry = applySetChecked({
      entry: current,
      type,
      exerciseId,
      setIndex,
      checked,
    });
    await setDoc(
      dayRef(dateKey),
      {
        participants: {
          [personName]: {
            exercises: { [exerciseId]: nextEntry.exercises[exerciseId] },
            isCompleted: nextEntry.isCompleted,
          },
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  async function setWeight({ dateKey, type, personName, entry, exerciseId, weight }) {
    if (!normalizeWorkoutType(type)) {
      throw new Error('Today’s workout type is not set yet.');
    }
    const current = (await resolveEntry({ dateKey, personName, entry })) ?? createPersonEntry(type);
    const nextEntry = applyWeight({
      entry: current,
      type,
      exerciseId,
      weight,
    });
    await setDoc(
      dayRef(dateKey),
      {
        participants: {
          [personName]: {
            exercises: { [exerciseId]: nextEntry.exercises[exerciseId] },
            isCompleted: nextEntry.isCompleted,
          },
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  return {
    backend: 'firestore',
    subscribeDay,
    subscribeRain,
    subscribePeople,
    subscribeSchedule,
    seedPeople,
    addPerson,
    ensureDayType,
    setRain,
    setSetChecked,
    setWeight,
  };
}
