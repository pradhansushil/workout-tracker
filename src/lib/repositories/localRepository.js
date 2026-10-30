/**
 * localStorage implementation of the data layer, used when no Firebase config is
 * present (demo mode) or when VITE_DATA_BACKEND=local is set.
 *
 * It mirrors the Firestore repository exactly, persists across reloads and syncs
 * between tabs on the same device via the `storage` event.
 */

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

const PREFIX = 'workoutTracker:demo:';
const KEYS = {
  schedule: `${PREFIX}schedule`,
  people: `${PREFIX}people`,
  day: (dateKey) => `${PREFIX}day:${dateKey}`,
  rain: (dateKey) => `${PREFIX}rain:${dateKey}`,
};

function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private-mode quota issues should never break the UI.
  }
}

function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function createLocalRepository() {
  const subscribers = new Map();
  let nextId = 1;

  function emit(topic) {
    for (const { topic: subscriberTopic, push } of subscribers.values()) {
      if (subscriberTopic === topic) push();
    }
  }

  function register(topic, push) {
    const id = nextId;
    nextId += 1;
    subscribers.set(id, { topic, push });
    push();
    return () => subscribers.delete(id);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', () => {
      for (const topic of new Set(
        [...subscribers.values()].map((entry) => entry.topic),
      )) {
        emit(topic);
      }
    });
  }

  function readPeople() {
    const names = read(KEYS.people, null);
    return Array.isArray(names) && names.length > 0 ? names : [...DEFAULT_PEOPLE];
  }

  function subscribeDay(dateKey, onData) {
    return register(`day:${dateKey}`, () => onData(read(KEYS.day(dateKey), null)));
  }

  function subscribeRain(dateKey, onData) {
    return register(`rain:${dateKey}`, () => {
      const data = read(KEYS.rain(dateKey), null);
      onData(data?.rainedOut === true || data?.value === true);
    });
  }

  function subscribePeople(onData) {
    return register('people', () => onData(readPeople()));
  }

  function subscribeSchedule(onData) {
    return register('schedule', () => onData(read(KEYS.schedule, null)));
  }

  async function seedPeople() {
    if (!read(KEYS.people, null)) write(KEYS.people, [...DEFAULT_PEOPLE]);
    emit('people');
  }

  async function addPerson(rawName) {
    const sanitized = sanitizePersonName(rawName);
    if (!sanitized.ok) throw new Error(sanitized.error);
    const name = sanitized.name;
    const names = readPeople();
    if (hasPerson(names, name)) return { name, added: false, names };
    const nextNames = [...names, name];
    write(KEYS.people, nextNames);
    emit('people');
    return { name, added: true, names: nextNames };
  }

  async function ensureDayType({ dateKey, seedType = null }) {
    const meta = read(KEYS.schedule, null);
    const existing = read(KEYS.day(dateKey), null);
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

    const people = readPeople();
    if (!existing) {
      write(KEYS.day(dateKey), {
        ...createDayDoc({ dateKey, type: resolution.type, people }),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else {
      const patched = addMissingParticipants(existing, people);
      if (patched !== existing) {
        write(KEYS.day(dateKey), { ...patched, updatedAt: Date.now() });
      }
    }

    if (resolution.nextMeta) {
      write(KEYS.schedule, { ...resolution.nextMeta, updatedAt: Date.now() });
    }

    emit(`day:${dateKey}`);
    emit('schedule');
    return { needsSeed: false, type: resolution.type, action: resolution.action };
  }

  async function setRain({ dateKey, rainedOut }) {
    write(KEYS.rain(dateKey), { rainedOut: rainedOut === true, updatedAt: Date.now() });
    emit(`rain:${dateKey}`);
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
    const day = read(KEYS.day(dateKey), null);
    if (!day) throw new Error('Today’s workout has not been created yet.');
    const nextEntry = applySetChecked({
      entry: entry ?? day.participants?.[personName] ?? createPersonEntry(type),
      type,
      exerciseId,
      setIndex,
      checked,
    });
    write(KEYS.day(dateKey), {
      ...day,
      participants: { ...day.participants, [personName]: nextEntry },
      updatedAt: Date.now(),
    });
    emit(`day:${dateKey}`);
  }

  async function setWeight({ dateKey, type, personName, entry, exerciseId, weight }) {
    if (!normalizeWorkoutType(type)) {
      throw new Error('Today’s workout type is not set yet.');
    }
    const day = read(KEYS.day(dateKey), null);
    if (!day) throw new Error('Today’s workout has not been created yet.');
    const nextEntry = applyWeight({
      entry: entry ?? day.participants?.[personName] ?? createPersonEntry(type),
      type,
      exerciseId,
      weight,
    });
    write(KEYS.day(dateKey), {
      ...day,
      participants: { ...day.participants, [personName]: nextEntry },
      updatedAt: Date.now(),
    });
    emit(`day:${dateKey}`);
  }

  /** Test/tooling helper — wipes the demo store. */
  function resetDemoData() {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) remove(key);
    }
    for (const topic of new Set([...subscribers.values()].map((entry) => entry.topic))) {
      emit(topic);
    }
  }

  return {
    backend: 'local',
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
    resetDemoData,
  };
}
