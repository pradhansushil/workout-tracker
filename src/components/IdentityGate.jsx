import { useState } from 'react';

import { sanitizePersonName } from '../lib/documents.js';

export default function IdentityGate({ people, storedIdentity, onSelect, onAddPerson, demo }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const sanitized = sanitizePersonName(name);
    if (!sanitized.ok) {
      setError(sanitized.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onAddPerson(sanitized.name);
    } catch (err) {
      setError(err.message ?? 'Could not add that person.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gate">
      <div className="gate__brand">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-word">ROTATION</span>
      </div>

      <h1 className="gate__title">Who are you?</h1>
      <p className="gate__subtitle">
        Pick your name so the app can track your sets. This device will remember you.
      </p>

      <ul className="gate__people">
        {people.map((person) => {
          const isStored = storedIdentity === person;
          return (
            <li key={person}>
              <button type="button" className="person-button" onClick={() => onSelect(person)}>
                <span className="avatar" aria-hidden="true">
                  {person.trim().charAt(0).toUpperCase()}
                </span>
                <span className="person-button__name">
                  {person}
                  {isStored ? <span className="pill pill--ghost">Last used</span> : null}
                </span>
                <span className="person-button__chevron" aria-hidden="true">
                  →
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {adding ? (
        <form className="gate__add-form" onSubmit={submit}>
          <label className="field">
            <span className="field__label">New person’s name</span>
            <input
              className="field__input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Sushil"
              maxLength={24}
              autoFocus
            />
          </label>
          {error ? <p className="field__error">{error}</p> : null}
          <div className="gate__add-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Adding…' : 'Add & continue'}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn--dashed" onClick={() => setAdding(true)}>
          + Add Person
        </button>
      )}

      <p className="gate__footnote">
        No accounts, no passwords. Your name lives on this device only.
        {demo ? ' Demo mode: data is stored locally on this device.' : ''}
      </p>
    </div>
  );
}
