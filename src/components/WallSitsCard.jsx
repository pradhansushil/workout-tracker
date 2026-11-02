/** Compact, expandable strip so the isometrics stay visible without taking over the page. */
export default function WallSitsCard({ banner }) {
  return (
    <details className="strip" aria-label="Supplemental tendon isometrics">
      <summary className="strip__summary">
        <span className="strip__title">{banner.title}</span>
        <span className="strip__hint">2 sets · rest 3 min · tap for details</span>
      </summary>
      <div className="strip__body">
        <p className="card__body">{banner.body}</p>
        <ul className="checklist">
          <li>Set 1 — hold until form breaks</li>
          <li>Rest 3 min</li>
          <li>Set 2 — hold as long as energy allows</li>
        </ul>
      </div>
    </details>
  );
}
