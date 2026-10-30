export default function WallSitsCard({ banner }) {
  return (
    <section className="card card--supplemental" aria-label="Supplemental tendon isometrics">
      <header className="card__header">
        <span className="card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M4 4h2v16H4zM18 4h2v16h-2zM7 9h2v5H7zM10 8h4l4 3v3h-4l-4-3z" fill="currentColor" />
          </svg>
        </span>
        <div>
          <h2 className="card__title">{banner.title}</h2>
          <p className="card__eyebrow">Tendon resilience · not tracked</p>
        </div>
      </header>
      <p className="card__body">{banner.body}</p>
      <ul className="checklist">
        <li>Set 1 — hold until form breaks</li>
        <li>Rest 3 min</li>
        <li>Set 2 — hold as long as energy allows</li>
      </ul>
    </section>
  );
}
