import ExerciseCard from './ExerciseCard.jsx';

export default function ExerciseList({
  exercises,
  entry,
  people,
  participants,
  identity,
  onToggleSet,
  onCommitWeight,
  disabled = false,
}) {
  return (
    <section className="exercise-list" aria-label="Today’s exercises">
      <div className="section-heading">
        <h2 className="section-title">Exercises</h2>
        <span className="section-hint">
          {disabled ? 'Setting up today’s session…' : 'Tap a set to check it off'}
        </span>
      </div>
      {exercises.map((exercise, index) => (
        <ExerciseCard
          key={exercise.id}
          exercise={exercise}
          index={index}
          entry={entry}
          people={people}
          participants={participants}
          identity={identity}
          onToggleSet={onToggleSet}
          onCommitWeight={onCommitWeight}
          disabled={disabled}
        />
      ))}
      <p className="exercise-list__note">
        Sets and weights save as you go. Only you can edit your row.
      </p>
    </section>
  );
}
