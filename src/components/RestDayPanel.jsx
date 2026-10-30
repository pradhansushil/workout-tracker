import { formatShortDate } from '../lib/dates.js';
import { getNextGymDay } from '../lib/schedule.js';

export default function RestDayPanel({ today }) {
  const nextGymDay = getNextGymDay(today);
  return (
    <section className="card card--rest" aria-label="Rest day">
      <header className="card__header">
        <span className="card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </span>
        <div>
          <h2 className="card__title">Rest day</h2>
          <p className="card__eyebrow">Sunday · always rest</p>
        </div>
      </header>
      <p className="card__body">
        No lifting, no tracking. Eat, sleep, stretch — the rotation picks back up on{' '}
        {nextGymDay ? formatShortDate(nextGymDay) : 'Monday'}.
      </p>
    </section>
  );
}
