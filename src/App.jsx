import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Dashboard from './components/Dashboard.jsx';
import IdentityGate from './components/IdentityGate.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import SeedPrompt from './components/SeedPrompt.jsx';
import Toast from './components/Toast.jsx';
import { repository } from './lib/repository.js';
import { backend } from './firebase.js';
import { clearIdentity, readIdentity, writeIdentity } from './lib/identity.js';
import { DAY_KINDS, buildDayPlan, fromDateKey, toDateKey } from './lib/schedule.js';
import { applySetChecked, applyWeight } from './lib/documents.js';
import { msUntilTomorrow } from './lib/dates.js';
import { getExercisesForType, getParticipantEntry } from './lib/workout.js';

function describeError(error) {
  if (!error) return 'Something went wrong.';
  if (error.code === 'permission-denied') {
    return 'Firestore denied the request. Check your security rules allow reads and writes.';
  }
  if (error.code === 'failed-precondition') {
    return 'Firestore is not set up yet. Create the database in the Firebase console and retry.';
  }
  if (error.code === 'unavailable') {
    return 'Could not reach Firestore. Check your connection and retry.';
  }
  return error.message ?? 'Something went wrong.';
}

export default function App() {
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()));
  const [identity, setIdentity] = useState(() => readIdentity());
  const [people, setPeople] = useState(undefined);
  // Both are tagged with the date they belong to, so a stale snapshot from
  // yesterday can never leak into today's plan right after midnight.
  const [rainState, setRainState] = useState(undefined);
  const [dayState, setDayState] = useState(undefined);
  const [scheduleMeta, setScheduleMeta] = useState(undefined);
  const [needsSeed, setNeedsSeed] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const attemptedRef = useRef(new Set());
  const ensureInFlightRef = useRef(null);
  // Optimistic copy of the signed-in person's entry so rapid taps never write a
  // stale set array (Firestore merges arrays wholesale).
  const [optimistic, setOptimistic] = useState(null);
  const writeSeqRef = useRef(0);

  // Roll over to the new day without a manual refresh.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTodayKey(toDateKey(new Date()));
      attemptedRef.current.clear();
    }, msUntilTomorrow());
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        const key = toDateKey(new Date());
        setTodayKey((current) => (current === key ? current : key));
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [todayKey]);

  // Live subscriptions — one per document for the current date.
  useEffect(() => {
    let active = true;
    const onError = (err) => {
      console.error('[workout-tracker]', err);
      if (active) setError(describeError(err));
    };

    const unsubscribers = [
      repository.subscribePeople((names) => {
        if (active) setPeople(names);
      }, onError),
      repository.subscribeDay(todayKey, (doc) => {
        if (active) setDayState({ dateKey: todayKey, doc });
      }, onError),
      repository.subscribeRain(todayKey, (value) => {
        if (active) setRainState({ dateKey: todayKey, value });
      }, onError),
      repository.subscribeSchedule((meta) => {
        if (active) setScheduleMeta(meta);
      }, onError),
    ];

    repository.seedPeople().catch(onError);

    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [todayKey]);

  const dataLoading =
    people === undefined ||
    rainState === undefined ||
    scheduleMeta === undefined ||
    dayState === undefined;

  const dayDoc = dayState?.dateKey === todayKey ? dayState.doc : null;
  const rain = rainState?.dateKey === todayKey ? rainState.value : false;

  const today = useMemo(() => fromDateKey(todayKey) ?? new Date(), [todayKey]);

  const plan = useMemo(
    () =>
      buildDayPlan({
        date: today,
        rainedOut: rain === true,
        scheduleMeta: scheduleMeta ?? null,
        existingType: dayDoc?.type ?? null,
      }),
    [today, rain, scheduleMeta, dayDoc],
  );

  const workoutType = dayDoc?.type ?? plan.workoutType;
  const exercises = useMemo(() => getExercisesForType(workoutType), [workoutType]);

  // Create today's workout document / advance the rotation when needed.
  // Runs at most once per day+rain-state; the write itself is transactional and
  // idempotent on the server, so a duplicate call would be harmless anyway.
  useEffect(() => {
    if (dataLoading || needsSeed) return;
    if (plan.dayKind !== DAY_KINDS.GYM) return;
    if (dayDoc && plan.nextMeta === null && plan.workoutType) return;
    if (ensureInFlightRef.current) return;

    const attemptKey = `${todayKey}:${plan.rainedOut ? 'rain' : 'calendar'}`;
    if (attemptedRef.current.has(attemptKey)) return;
    attemptedRef.current.add(attemptKey);

    ensureInFlightRef.current = repository
      .ensureDayType({ dateKey: todayKey })
      .then((result) => {
        if (result.needsSeed) setNeedsSeed(true);
      })
      .catch((err) => {
        attemptedRef.current.delete(attemptKey);
        console.error('[workout-tracker] ensureDayType', err);
        setError(describeError(err));
      })
      .finally(() => {
        ensureInFlightRef.current = null;
      });
  }, [dataLoading, needsSeed, plan.dayKind, plan.rainedOut, plan.nextMeta, plan.workoutType, dayDoc, todayKey]);

  const activeIdentity =
    identity && Array.isArray(people) && people.includes(identity) ? identity : null;

  const snapshotEntry = getParticipantEntry(dayDoc, activeIdentity);
  // The optimistic copy only applies to the person + day it was written for.
  const optimisticEntry =
    optimistic && optimistic.identity === activeIdentity && optimistic.dateKey === todayKey
      ? optimistic.entry
      : null;
  const myEntry = optimisticEntry ?? snapshotEntry;
  const canEdit = Boolean(dayDoc?.type);

  const toastTimerRef = useRef(null);
  const showToast = useCallback((message) => {
    setToast({ message });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  const handleSelectIdentity = useCallback((name) => {
    writeIdentity(name);
    setIdentity(name);
  }, []);

  const handleAddPerson = useCallback(
    async (rawName) => {
      const result = await repository.addPerson(rawName);
      handleSelectIdentity(result.name);
      if (result.added) showToast(`Added ${result.name} to the rotation.`);
      return result;
    },
    [handleSelectIdentity, showToast],
  );

  const handleSwitchIdentity = useCallback(() => {
    clearIdentity();
    setIdentity(null);
  }, []);

  const runEntryWrite = useCallback(
    async (computeNext, write) => {
      if (!workoutType || !activeIdentity || !canEdit) return;
      const nextEntry = computeNext(myEntry);
      const seq = writeSeqRef.current + 1;
      writeSeqRef.current = seq;
      setOptimistic({ identity: activeIdentity, dateKey: todayKey, entry: nextEntry });
      try {
        await write(nextEntry);
        // Writes land in order; only the newest one hands control back to the
        // snapshot, which by then already contains every queued change.
        if (writeSeqRef.current === seq) setOptimistic(null);
      } catch (err) {
        if (writeSeqRef.current === seq) setOptimistic(null);
        showToast(describeError(err));
      }
    },
    [workoutType, activeIdentity, todayKey, canEdit, myEntry, showToast],
  );

  const handleToggleSet = useCallback(
    (exercise, setIndex, checked) =>
      runEntryWrite(
        (current) => applySetChecked({ entry: current, type: workoutType, exerciseId: exercise.id, setIndex, checked }),
        (nextEntry) =>
          repository.setSetChecked({
            dateKey: todayKey,
            type: workoutType,
            personName: activeIdentity,
            entry: nextEntry,
            exerciseId: exercise.id,
            setIndex,
            checked,
          }),
      ),
    [runEntryWrite, workoutType, todayKey, activeIdentity],
  );

  const handleCommitWeight = useCallback(
    (exercise, weight) =>
      runEntryWrite(
        (current) => applyWeight({ entry: current, type: workoutType, exerciseId: exercise.id, weight }),
        (nextEntry) =>
          repository.setWeight({
            dateKey: todayKey,
            type: workoutType,
            personName: activeIdentity,
            entry: nextEntry,
            exerciseId: exercise.id,
            weight,
          }),
      ),
    [runEntryWrite, workoutType, todayKey, activeIdentity],
  );

  const handleToggleRain = useCallback(async () => {
    try {
      await repository.setRain({ dateKey: todayKey, rainedOut: rain !== true });
    } catch (err) {
      showToast(describeError(err));
    }
  }, [todayKey, rain, showToast]);

  const handleSeed = useCallback(
    async (type) => {
      setSeeding(true);
      try {
        await repository.ensureDayType({ dateKey: todayKey, seedType: type });
        setNeedsSeed(false);
        setError(null);
      } catch (err) {
        setError(describeError(err));
      } finally {
        setSeeding(false);
      }
    },
    [todayKey],
  );

  if (error && !dayDoc && !people) {
    return (
      <div className="app app--centered">
        <div className="card card--error">
          <h1 className="gate__title">Can’t reach the schedule</h1>
          <p className="muted">{error}</p>
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (dataLoading) {
    return <LoadingScreen />;
  }

  if (!activeIdentity) {
    return (
      <div className="app app--centered">
        <IdentityGate
          people={people}
          storedIdentity={identity}
          onSelect={handleSelectIdentity}
          onAddPerson={handleAddPerson}
          demo={backend === 'local'}
        />
        {toast ? <Toast message={toast.message} /> : null}
      </div>
    );
  }

  return (
    <>
      <Dashboard
        plan={plan}
        today={today}
        todayKey={todayKey}
        dayDoc={dayDoc}
        people={people}
        identity={activeIdentity}
        myEntry={myEntry}
        exercises={exercises}
        backend={backend}
        error={error}
        onDismissError={() => setError(null)}
        onToggleSet={handleToggleSet}
        onCommitWeight={handleCommitWeight}
        onToggleRain={handleToggleRain}
        onSwitchIdentity={handleSwitchIdentity}
      />
      {needsSeed ? <SeedPrompt onChoose={handleSeed} busy={seeding} /> : null}
      {toast ? <Toast message={toast.message} /> : null}
    </>
  );
}
