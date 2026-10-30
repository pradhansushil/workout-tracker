import { WEEKDAY_LETTER } from '../lib/dates.js';
import { DAY_KINDS } from '../lib/schedule.js';

const KIND_LABEL = {
  [DAY_KINDS.GYM]: 'Gym',
  [DAY_KINDS.BASKETBALL]: 'Basketball',
  [DAY_KINDS.REST]: 'Rest',
};

export default function WeekStrip({ week }) {
  return (
    <div className="week" aria-label="This week">
      {week.map((day) => (
        <div
          key={day.dateKey}
          className={`week__day week__day--${day.dayKind} ${day.isToday ? 'is-today' : ''} ${day.isPast ? 'is-past' : ''}`}
          title={`${day.dateKey} · ${KIND_LABEL[day.dayKind]}`}
        >
          <span className="week__letter">{WEEKDAY_LETTER[day.weekday]}</span>
          <span className="week__date">{day.date.getDate()}</span>
          <span className="week__dot" aria-hidden="true" />
          <span className="sr-only">{KIND_LABEL[day.dayKind]}</span>
        </div>
      ))}
    </div>
  );
}
