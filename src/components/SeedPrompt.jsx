export default function SeedPrompt({ onChoose, busy }) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="seed-title">
      <div className="modal__card">
        <span className="modal__eyebrow">One-time setup</span>
        <h2 id="seed-title" className="modal__title">
          Which workout is up next?
        </h2>
        <p className="modal__body">
          Pick the session you’re doing next. After that, the app alternates Upper and Lower
          for you, based on the last gym day that actually happened.
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
      </div>
    </div>
  );
}
