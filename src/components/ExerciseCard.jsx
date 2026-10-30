import { useEffect, useRef, useState } from 'react';

import { normalizeWeightInput } from '../lib/documents.js';
import { getSetStates, getWeight } from '../lib/workout.js';

function WeightInput({ exerciseId, value, onCommit, disabled }) {
  const [draft, setDraft] = useState(value ? String(value) : '');
  const [error, setError] = useState(null);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(value ? String(value) : '');
  }, [value]);

  const commit = () => {
    const parsed = normalizeWeightInput(draft);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    setError(null);
    const normalized = parsed.value === null ? null : parsed.value;
    setDraft(normalized === null ? '' : String(normalized));
    if (normalized !== (value || null)) onCommit(normalized);
  };

  return (
    <label className={`weight ${error ? 'has-error' : ''}`}>
      <span className="control-label">Weight</span>
      <span className="weight__box">
        <input
          className="weight__input"
          type="number"
          inputMode="decimal"
          min="0"
          max="2000"
          step="0.5"
          placeholder="—"
          value={draft}
          disabled={disabled}
          aria-label="Working weight in pounds"
          aria-invalid={error ? 'true' : 'false'}
          data-exercise={exerciseId}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            focusedRef.current = false;
            commit();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              setDraft(value ? String(value) : '');
              setError(null);
              event.currentTarget.blur();
            }
          }}
        />
        <span className="weight__unit">lb</span>
      </span>
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}

function OtherProgress({ people, participants, exercise, identity }) {
  const others = people.filter((person) => person !== identity);
  if (others.length === 0) return null;

  return (
    <ul className="others" aria-label="Other people’s progress on this exercise">
      {others.map((person) => {
        const participantEntry = participants?.[person] ?? null;
        const sets = getSetStates(participantEntry, exercise);
        const done = sets.filter(Boolean).length;
        const weight = getWeight(participantEntry, exercise.id);
        return (
          <li key={person} className="others__item">
            <span className="avatar avatar--xs" aria-hidden="true">
              {person.charAt(0).toUpperCase()}
            </span>
            <span className="others__name">{person}</span>
            <span className="others__value">
              {weight > 0 ? `${weight} lb` : '—'}
              <span className="others__sets">
                {done}/{exercise.setCount}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function ExerciseCard({
  exercise,
  index,
  entry,
  people,
  participants,
  identity,
  onToggleSet,
  onCommitWeight,
  disabled = false,
}) {
  const sets = getSetStates(entry, exercise);
  const isComplete = sets.length > 0 && sets.every(Boolean);
  const weight = getWeight(entry, exercise.id);

  return (
    <article className={`exercise ${isComplete ? 'is-complete' : ''}`}>
      <div className="exercise__top">
        <span className="exercise__index" aria-hidden="true">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="exercise__heading">
          <h3 className="exercise__name">{exercise.name}</h3>
          <div className="exercise__meta">
            <span className="pill pill--target">{exercise.target}</span>
            <span className="pill pill--ghost">{exercise.muscle}</span>
            {exercise.badge ? <span className="pill pill--ghost">{exercise.badge}</span> : null}
          </div>
        </div>
        <span className="exercise__status" aria-hidden="true">
          {isComplete ? (
            <svg viewBox="0 0 24 24">
              <path d="m5 13 5 5L19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </span>
      </div>

      <p className="exercise__cue">{exercise.cue}</p>

      {exercise.safety ? (
        <p className="inline-warning">
          <span aria-hidden="true">⚠</span> {exercise.safety}
        </p>
      ) : null}

      <div className="exercise__controls">
        <div className="sets" role="group" aria-label={`${exercise.name} sets`}>
          <span className="control-label">Sets</span>
          <div className="sets__row">
            {sets.map((checked, setIndex) => (
              <button
                key={setIndex}
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={`Set ${setIndex + 1}${checked ? ', done' : ', not done'}`}
                className={`set-toggle ${checked ? 'is-on' : ''}`}
                disabled={disabled}
                onClick={() => onToggleSet(exercise, setIndex, !checked)}
              >
                <span aria-hidden="true">{checked ? '✓' : setIndex + 1}</span>
              </button>
            ))}
          </div>
        </div>

        <WeightInput
          exerciseId={exercise.id}
          value={weight}
          disabled={disabled}
          onCommit={(nextWeight) => onCommitWeight(exercise, nextWeight)}
        />
      </div>

      <OtherProgress
        people={people}
        participants={participants}
        exercise={exercise}
        identity={identity}
      />

      <span className="sr-only">
        {isComplete ? 'Exercise complete. ' : ''}
        {sets.filter(Boolean).length} of {exercise.setCount} sets checked.
      </span>
    </article>
  );
}
