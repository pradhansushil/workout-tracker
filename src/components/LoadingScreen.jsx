export default function LoadingScreen() {
  return (
    <div className="app app--centered">
      <div className="loading">
        <div className="loading__mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="loading__text">Loading today’s rotation…</p>
        <div className="skeleton-stack" aria-hidden="true">
          <div className="skeleton skeleton--hero" />
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton skeleton--short" />
        </div>
      </div>
    </div>
  );
}
