function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="banner__icon">
      <path d="M12 3 2.5 20h19L12 3Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12 9v5M12 17.2v.1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="banner__icon">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function splitNote(text) {
  const index = text.indexOf(':');
  if (index === -1) return { title: 'Note', body: text };
  return { title: text.slice(0, index), body: text.slice(index + 1).trim() };
}

export default function BannerStack({ banners }) {
  const knee = banners.kneeSafety;
  const tempo = banners.tempo ? splitNote(banners.tempo) : null;

  if (!knee && !tempo) return null;

  return (
    <section className="banners" aria-label="Safety and tempo notes">
      {knee ? (
        <div className="banner banner--danger">
          <WarningIcon />
          <p className="banner__text">{knee}</p>
        </div>
      ) : null}
      {tempo ? (
        <div className="banner banner--tempo">
          <BoltIcon />
          <div>
            <p className="banner__title">{tempo.title}</p>
            <p className="banner__text">{tempo.body}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
