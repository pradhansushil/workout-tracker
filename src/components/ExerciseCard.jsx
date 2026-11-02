import { getSetStates } from '../lib/workout.js';

export default function ExerciseCard({
  exercise,
  index,
  entry,
  onToggleSet,
  disabled = false,
}) {
  const sets = getSetStates(entry, exercise);
  const isComplete = sets.length > 0 && sets.every(Boolean);

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
      </div>

      <span className="sr-only">
        {isComplete ? 'Exercise complete. ' : ''}
        {sets.filter(Boolean).length} of {exercise.setCount} sets checked.
      </span>
    </article>
  );
}
