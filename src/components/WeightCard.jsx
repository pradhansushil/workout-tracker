import { useEffect, useRef, useState } from 'react';

import { normalizeWeightInput } from '../lib/documents.js';

/** One body-weight box for the whole session (instead of one per exercise). */
export default function WeightCard({ value, onCommit, disabled = false }) {
  const [draft, setDraft] = useState(value ? String(value) : '');
  const [error, setError] = useState(null);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(value ? String(value) : '');
  }, [value]);

  const commit = () => {
    const parsed = normalizeWeightInput(draft);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setDraft(parsed.value === null ? '' : String(parsed.value));
    if (parsed.value !== (value || null)) onCommit(parsed.value);
  };

  return (
    <section className="card weight-card" aria-label="Body weight">
      <div>
        <h2 className="card__title">Body weight</h2>
        <p className="card__eyebrow">Log it once per gym day</p>
      </div>
      <label className={`weight ${error ? 'has-error' : ''}`}>
        <span className="weight__box">
          <input
            className="weight__input"
            type="number"
            inputMode="decimal"
            min="0"
            max="2000"
            step="0.1"
            placeholder="—"
            value={draft}
            disabled={disabled}
            aria-label="Body weight in pounds"
            aria-invalid={error ? 'true' : 'false'}
            onFocus={() => {
              focusedRef.current = true;
            }}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              focusedRef.current = false;
              commit();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === 'Escape') {
                setDraft(value ? String(value) : '');
                setError(null);
                event.currentTarget.blur();
              }
            }}
          />
          <span className="weight__unit">lb</span>
        </span>
        {error ? <span className="field__error">{error}</span> : null}
      </label>
    </section>
  );
}
