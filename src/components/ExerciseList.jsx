import ExerciseCard from './ExerciseCard.jsx';

export default function ExerciseList({
  exercises,
  entry,
  onToggleSet,
  disabled = false,
  readOnly = false,
}) {
  let hint = 'Tap a set to check it off';
  if (readOnly) hint = 'Past session — view only';
  else if (disabled) hint = 'Setting up today’s session…';

  return (
    <section className="exercise-list" aria-label="Exercises">
      <div className="section-heading">
        <h2 className="section-title">Exercises</h2>
        <span className="section-hint">{hint}</span>
      </div>
      {exercises.map((exercise, index) => (
        <ExerciseCard
          key={exercise.id}
          exercise={exercise}
          index={index}
          entry={entry}
          onToggleSet={onToggleSet}
          disabled={disabled || readOnly}
        />
      ))}
      {readOnly ? null : (
        <p className="exercise-list__note">Sets save as you go. Only you can edit your own sets.</p>
      )}
    </section>
  );
}
