import { getParticipantStats } from '../lib/workout.js';

export default function SquadPanel({ people, participants, exercises, identity }) {
  return (
    <section aria-label="Everyone’s progress">
      <div className="section-heading">
        <h2 className="section-title">Squad</h2>
        <span className="section-hint">Read-only for everyone but you</span>
      </div>
      <div className="squad">
        {people.map((person) => {
          const entry = participants?.[person] ?? null;
          const stats = getParticipantStats(entry, exercises);
          const isMe = person === identity;
          return (
            <article key={person} className={`squad__card ${isMe ? 'is-me' : ''}`}>
              <div className="squad__row">
                <span className="avatar avatar--sm" aria-hidden="true">
                  {person.charAt(0).toUpperCase()}
                </span>
                <div className="squad__identity">
                  <p className="squad__name">
                    {person}
                    {isMe ? <span className="pill pill--you">You</span> : null}
                  </p>
                  <p className="squad__stats">
                    {stats.completedExercises}/{stats.totalExercises} exercises ·{' '}
                    {stats.completedSets}/{stats.totalSets} sets
                  </p>
                </div>
                {stats.isComplete ? (
                  <span className="badge badge--done">Day done</span>
                ) : (
                  <span className="squad__percent">{stats.percent}%</span>
                )}
              </div>
              <div className="meter" aria-hidden="true">
                <span
                  className={`meter__fill ${stats.isComplete ? 'is-done' : ''}`}
                  style={{ width: `${stats.percent}%` }}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
