import { formatShortDate } from '../lib/dates.js';

export default function AppHeader({ today, identity, onSwitchIdentity, backend }) {
  return (
    <header className="app__header">
      <div className="app__brand">
        <span className="brand-mark" aria-hidden="true" />
        <div>
          <span className="brand-word">ROTATION</span>
          <span className="app__date">{formatShortDate(today)}</span>
        </div>
      </div>

      <div className="identity-chip">
        <span className="avatar avatar--sm" aria-hidden="true">
          {identity.charAt(0).toUpperCase()}
        </span>
        <span className="identity-chip__name">
          {identity}
          {backend === 'local' ? <span className="dot-live dot-live--demo" title="Local demo data" /> : <span className="dot-live" title="Live sync" />}
        </span>
        <button type="button" className="identity-chip__switch" onClick={onSwitchIdentity}>
          Switch
        </button>
      </div>
    </header>
  );
}
