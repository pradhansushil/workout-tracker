export default function SeedPrompt({ onChoose, busy }) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="seed-title">
      <div className="modal__card">
        <span className="modal__eyebrow">First run</span>
        <h2 id="seed-title" className="modal__title">
          Which rotation starts today?
        </h2>
        <p className="modal__body">
          There’s no saved schedule yet, so pick the session you’re doing today. From
          now on the app alternates Upper and Lower automatically, based on the last gym
          day that actually happened.
        </p>
        <div className="modal__actions">
          <button
            type="button"
            className="btn btn--primary btn--large"
            disabled={busy}
            onClick={() => onChoose('Upper')}
          >
            Upper Body
          </button>
          <button
            type="button"
            className="btn btn--primary btn--large"
            disabled={busy}
            onClick={() => onChoose('Lower')}
          >
            Lower Body
          </button>
        </div>
        <p className="modal__footnote">Saved to meta/schedule — done only once.</p>
      </div>
    </div>
  );
}
