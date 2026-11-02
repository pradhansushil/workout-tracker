import { DAY_KINDS } from '../lib/schedule.js';

const COPY = {
  [DAY_KINDS.BASKETBALL]: 'Basketball day — there was no gym session to log.',
  [DAY_KINDS.REST]: 'Rest day — nothing to log.',
  [DAY_KINDS.GYM]: 'No gym session was logged for this day.',
};

export default function PastDayPanel({ dayKind, loading }) {
  return (
    <section className="card" aria-label="Past day">
      <p className="card__body">{loading ? 'Loading…' : COPY[dayKind]}</p>
    </section>
  );
}
