import ProgressRing from './ProgressRing.jsx';
import { DAY_KINDS, getDaySubtitle, getDayTitle } from '../lib/schedule.js';
import { getParticipantStats } from '../lib/workout.js';

const KIND_LABEL = {
  [DAY_KINDS.GYM]: 'Gym day',
  [DAY_KINDS.BASKETBALL]: 'Basketball day',
  [DAY_KINDS.REST]: 'Rest day',
};

function KindGlyph({ dayKind }) {
  if (dayKind === DAY_KINDS.BASKETBALL) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="hero__glyph">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3 12h18M12 3v18M5.6 5.6c3.5 3.2 3.5 9.6 0 12.8M18.4 18.4c-3.5-3.2-3.5-9.6 0-12.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (dayKind === DAY_KINDS.REST) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="hero__glyph">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="hero__glyph">
      <path d="M3 9h2.5M3 15h2.5M18.5 9H21M18.5 15H21M6.5 7.5v9M17.5 7.5v9M6.5 12h11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function DayHero({ plan, todayKey, myEntry, exercises, onToggleRain }) {
  const isGym = plan.dayKind === DAY_KINDS.GYM;
  const stats = getParticipantStats(myEntry, exercises);
  const title = getDayTitle(plan.dayKind, plan.workoutType);
  const subtitle = getDaySubtitle(plan);

  return (
    <section className={`hero hero--${plan.dayKind}`}>
      <div className="hero__top">
        <span className="hero__eyebrow">
          <KindGlyph dayKind={plan.dayKind} />
          {KIND_LABEL[plan.dayKind]}
          {plan.rainedOut ? <span className="pill pill--rain">Rain swap</span> : null}
        </span>
        {isGym ? (
          <ProgressRing
            percent={stats.percent}
            size={62}
            label={`${stats.percent}% of today’s exercises complete`}
            tone={stats.isComplete ? 'done' : 'accent'}
          />
        ) : null}
      </div>

      <h1 className="hero__title">{title}</h1>
      <p className="hero__subtitle">{subtitle}</p>

      {isGym ? (
        <div className="hero__stats">
          <div className="stat">
            <span className="stat__value">
              {stats.completedExercises}
              <span className="stat__divider">/</span>
              {stats.totalExercises}
            </span>
            <span className="stat__label">exercises</span>
          </div>
          <div className="stat">
            <span className="stat__value">
              {stats.completedSets}
              <span className="stat__divider">/</span>
              {stats.totalSets}
            </span>
            <span className="stat__label">sets</span>
          </div>
          <div className="stat">
            <span className="stat__value">{stats.isComplete ? 'Complete' : 'In progress'}</span>
            <span className="stat__label">your day</span>
          </div>
        </div>
      ) : null}

      {plan.rainedOut ? (
        <button type="button" className="btn btn--quiet hero__rain-undo" onClick={onToggleRain}>
          Rain stopped? Back to basketball
        </button>
      ) : null}

      <span className="sr-only">{todayKey}</span>
    </section>
  );
}
