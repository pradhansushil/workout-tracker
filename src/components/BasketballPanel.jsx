export default function BasketballPanel({ rainedOut, rainEligible, onToggleRain }) {
  return (
    <section className="card card--basketball" aria-label="Basketball day">
      <header className="card__header">
        <span className="card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M3 12h18M12 3v18M5.6 5.6c3.5 3.2 3.5 9.6 0 12.8M18.4 18.4c-3.5-3.2-3.5-9.6 0-12.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </span>
        <div>
          <h2 className="card__title">Basketball today</h2>
          <p className="card__eyebrow">Court session · no gym log needed</p>
        </div>
      </header>

      <p className="card__body">
        It’s a basketball day on the rotation, so there’s no lifting checklist. Get your
        court work in, then run the wall-sit isometrics below.
      </p>

      {rainEligible ? (
        <div className="rain-row">
          <div>
            <p className="rain-row__title">Raining out?</p>
            <p className="rain-row__hint">
              {rainedOut
                ? 'Today is treated as a gym day.'
                : 'Turn today into a gym day — it flips Upper/Lower from the last gym session.'}
            </p>
          </div>
          <button
            type="button"
            className={`btn ${rainedOut ? 'btn--ghost' : 'btn--rain'}`}
            onClick={onToggleRain}
            aria-pressed={rainedOut}
          >
            {rainedOut ? 'Rain stopped' : 'It’s raining — go to gym'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
