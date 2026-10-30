import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * These tests run the real repository code against an in-memory fake of the
 * Firestore modular SDK, so the transactional rotation logic and deep-merge
 * write shape are exercised without a network.
 */
vi.mock('firebase/firestore', () => {
  const store = new Map();
  const SERVER_TIMESTAMP = { __serverTimestamp: true };

  const snapshotFor = (path) => {
    const value = store.get(path);
    return {
      id: path.split('/').at(-1),
      exists: () => value !== undefined,
      data: () => (value === undefined ? undefined : structuredClone(value)),
    };
  };

  function mergeInto(path, data) {
    const current = store.get(path) ?? {};
    const next = mergeDeep(current, data);
    store.set(path, next);
    return next;
  }

  function mergeDeep(current, patch) {
    const next = { ...current };
    for (const [key, value] of Object.entries(patch)) {
      if (value === SERVER_TIMESTAMP) {
        next[key] = 1_700_000_000;
        continue;
      }
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        current[key] &&
        typeof current[key] === 'object'
      ) {
        next[key] = mergeDeep(current[key], value);
      } else {
        next[key] = value;
      }
    }
    return next;
  }

  return {
    doc: (_db, ...segments) => ({ path: segments.join('/'), id: segments.at(-1) }),
    serverTimestamp: () => SERVER_TIMESTAMP,
    runTransaction: async (_db, updateFn) => {
      const writes = [];
      const transaction = {
        get: async (ref) => snapshotFor(ref.path),
        set: (ref, data, options) => writes.push({ ref, data, options }),
      };
      const result = await updateFn(transaction);
      for (const { ref, data, options } of writes) {
        if (options?.merge) mergeInto(ref.path, data);
        else store.set(ref.path, structuredClone(data));
      }
      return result;
    },
    getDoc: async (ref) => snapshotFor(ref.path),
    setDoc: async (ref, data, options) => {
      if (options?.merge) mergeInto(ref.path, data);
      else store.set(ref.path, structuredClone(data));
    },
    onSnapshot: (ref, onNext) => {
      onNext(snapshotFor(ref.path));
      return () => {};
    },
    __store: store,
    __snapshot: snapshotFor,
  };
});

const firestore = await import('firebase/firestore');
const { createFirestoreRepository } = await import('./firestoreRepository.js');

const db = {};
const DATE = '2026-10-26';
const THURSDAY = '2026-10-29';

function store() {
  return firestore.__store;
}

function readDoc(path) {
  return store().get(path);
}

beforeEach(() => {
  store().clear();
});

describe('Firestore repository — bootstrap', () => {
  it('seeds meta/people with the default roster once', async () => {
    const repo = createFirestoreRepository(db);
    await repo.seedPeople();
    expect(readDoc('meta/people').names).toEqual(['Person A', 'Person B']);

    await repo.addPerson('Sushil');
    await repo.seedPeople(); // must not wipe the added person
    expect(readDoc('meta/people').names).toEqual(['Person A', 'Person B', 'Sushil']);
  });

  it('rejects duplicate and empty names', async () => {
    const repo = createFirestoreRepository(db);
    await repo.seedPeople();
    await expect(repo.addPerson('person a')).resolves.toMatchObject({ added: false });
    await expect(repo.addPerson('   ')).rejects.toThrow();
  });
});

describe('Firestore repository — rotation', () => {
  it('asks for a seed on the very first gym day', async () => {
    const repo = createFirestoreRepository(db);
    const result = await repo.ensureDayType({ dateKey: DATE });
    expect(result).toEqual({ needsSeed: true, type: null, action: 'seed-required' });
    expect(readDoc(`workoutDays/${DATE}`)).toBeUndefined();
  });

  it('creates the day + meta when a seed is supplied', async () => {
    const repo = createFirestoreRepository(db);
    const result = await repo.ensureDayType({ dateKey: DATE, seedType: 'Upper' });

    expect(result).toMatchObject({ needsSeed: false, type: 'Upper', action: 'seeded' });
    expect(readDoc('meta/schedule')).toMatchObject({
      lastWorkoutType: 'Upper',
      lastWorkoutDate: DATE,
    });

    const day = readDoc(`workoutDays/${DATE}`);
    expect(day.type).toBe('Upper');
    expect(Object.keys(day.participants)).toEqual(['Person A', 'Person B']);
    expect(day.participants['Person A'].exercises['chest-press'].sets).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('never flips twice in one day', async () => {
    const repo = createFirestoreRepository(db);
    await repo.ensureDayType({ dateKey: DATE, seedType: 'Upper' });
    const again = await repo.ensureDayType({ dateKey: DATE });

    expect(again).toMatchObject({ type: 'Upper', action: 'existing-today' });
    expect(readDoc(`workoutDays/${DATE}`).type).toBe('Upper');
    expect(readDoc('meta/schedule').lastWorkoutType).toBe('Upper');
  });

  it('alternates on the next gym day, not on the weekday', async () => {
    const repo = createFirestoreRepository(db);
    await repo.ensureDayType({ dateKey: DATE, seedType: 'Upper' });

    const next = await repo.ensureDayType({ dateKey: THURSDAY });
    expect(next).toMatchObject({ type: 'Lower', action: 'flipped' });
    expect(readDoc('meta/schedule')).toMatchObject({
      lastWorkoutType: 'Lower',
      lastWorkoutDate: THURSDAY,
    });
    expect(readDoc(`workoutDays/${THURSDAY}`).type).toBe('Lower');
  });

  it('keeps stale meta in sync with a day document another device created', async () => {
    const repo = createFirestoreRepository(db);
    await repo.ensureDayType({ dateKey: DATE, seedType: 'Upper' });
    // Simulate a device that wrote today's day doc but died before meta updated.
    store().set('meta/schedule', { lastWorkoutType: 'Upper', lastWorkoutDate: '2026-10-22' });

    const result = await repo.ensureDayType({ dateKey: DATE });
    expect(result).toMatchObject({ type: 'Upper', action: 'existing-today' });
    expect(readDoc('meta/schedule').lastWorkoutDate).toBe(DATE);
  });

  it('adds people who joined after the day doc was created', async () => {
    const repo = createFirestoreRepository(db);
    await repo.ensureDayType({ dateKey: DATE, seedType: 'Lower' });
    await repo.addPerson('Sushil');

    await repo.ensureDayType({ dateKey: DATE });
    const day = readDoc(`workoutDays/${DATE}`);
    expect(Object.keys(day.participants)).toEqual(['Person A', 'Person B', 'Sushil']);
    expect(day.participants.Sushil.exercises['leg-press'].sets).toEqual([false, false, false]);
  });
});

describe('Firestore repository — writes', () => {
  it('deep-merges only the current person’s set and recomputes completion', async () => {
    const repo = createFirestoreRepository(db);
    await repo.ensureDayType({ dateKey: DATE, seedType: 'Upper' });

    await repo.setSetChecked({
      dateKey: DATE,
      type: 'Upper',
      personName: 'Person B',
      exerciseId: 'chest-press',
      setIndex: 0,
      checked: true,
    });

    const day = readDoc(`workoutDays/${DATE}`);
    expect(day.participants['Person B'].exercises['chest-press'].sets).toEqual([
      true,
      false,
      false,
    ]);
    expect(day.participants['Person B'].isCompleted).toBe(false);
    // Untouched people stay untouched.
    expect(day.participants['Person A'].exercises['chest-press'].sets).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('flags the day complete when every set of every exercise is checked', async () => {
    const repo = createFirestoreRepository(db);
    await repo.ensureDayType({ dateKey: DATE, seedType: 'Lower' });

    const plan = readDoc(`workoutDays/${DATE}`);
    for (const [exerciseId, entry] of Object.entries(
      plan.participants['Person A'].exercises,
    )) {
      for (let setIndex = 0; setIndex < entry.sets.length; setIndex += 1) {
        await repo.setSetChecked({
          dateKey: DATE,
          type: 'Lower',
          personName: 'Person A',
          exerciseId,
          setIndex,
          checked: true,
        });
      }
    }

    const day = readDoc(`workoutDays/${DATE}`);
    expect(day.participants['Person A'].isCompleted).toBe(true);
    expect(day.participants['Person B'].isCompleted).toBe(false);
  });

  it('writes a date-scoped rain flag', async () => {
    const repo = createFirestoreRepository(db);
    await repo.setRain({ dateKey: '2026-10-27', rainedOut: true });

    expect(readDoc('rainStatus/2026-10-27')).toMatchObject({ rainedOut: true });
    expect(readDoc('rainStatus/2026-10-28')).toBeUndefined();

    const rainValues = [];
    const unsubscribe = repo.subscribeRain('2026-10-27', (value) => rainValues.push(value));
    expect(rainValues).toEqual([true]);
    unsubscribe();
  });

  it('refuses to write sets before the day type exists', async () => {
    const repo = createFirestoreRepository(db);
    await expect(
      repo.setSetChecked({
        dateKey: DATE,
        type: null,
        personName: 'Person A',
        exerciseId: 'chest-press',
        setIndex: 0,
        checked: true,
      }),
    ).rejects.toThrow(/not set yet/);
  });

  it('stores weights in lbs', async () => {
    const repo = createFirestoreRepository(db);
    await repo.ensureDayType({ dateKey: DATE, seedType: 'Upper' });
    await repo.setWeight({
      dateKey: DATE,
      type: 'Upper',
      personName: 'Person A',
      exerciseId: 'cable-row',
      weight: 77.5,
    });
    expect(readDoc(`workoutDays/${DATE}`).participants['Person A'].exercises['cable-row'].weight)
      .toBe(77.5);
  });

  it('streams day documents and falls back to the default roster', async () => {
    const repo = createFirestoreRepository(db);
    const seen = [];
    repo.subscribeDay(DATE, (value) => seen.push(value));
    expect(seen).toEqual([null]);

    const people = [];
    repo.subscribePeople((names) => people.push(names));
    expect(people).toEqual([['Person A', 'Person B']]);
  });
});
