import { formatShortDate, WEEKDAY_LETTER } from '../lib/dates.js';
import { DAY_KINDS } from '../lib/schedule.js';

const KIND_LABEL = {
  [DAY_KINDS.GYM]: 'Gym',
  [DAY_KINDS.BASKETBALL]: 'Basketball',
  [DAY_KINDS.REST]: 'Rest',
};

export default function WeekStrip({
  week,
  selectedKey,
  onSelect,
  canGoNewer = false,
  onOlder,
  onNewer,
}) {
  return (
    <div className="week-wrap">
      <button type="button" className="week-nav" onClick={onOlder} aria-label="Earlier week">
        ‹
      </button>
      <div className="week" role="group" aria-label="Week">
        {week.map((day) => {
          const clickable = day.isToday || day.isPast;
          const selected = day.dateKey === selectedKey;
          const label = `${formatShortDate(day.date)} · ${KIND_LABEL[day.dayKind]}`;
          return (
            <button
              key={day.dateKey}
              type="button"
              disabled={!clickable}
              onClick={() => onSelect(day.dateKey)}
              aria-label={label}
              aria-pressed={selected}
              className={`week__day week__day--${day.dayKind} ${day.isToday ? 'is-today' : ''} ${day.isPast ? 'is-past' : ''} ${selected ? 'is-selected' : ''}`}
            >
              <span className="week__letter">{WEEKDAY_LETTER[day.weekday]}</span>
              <span className="week__date">{day.date.getDate()}</span>
              <span className="week__dot" aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="week-nav"
        onClick={onNewer}
        disabled={!canGoNewer}
        aria-label="Later week"
      >
        ›
      </button>
    </div>
  );
}
