// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import App from './App.jsx';

/**
 * End-to-end-ish rendering tests against the local demo backend.
 * These catch wiring bugs (subscriptions, effects, day creation) that the pure
 * unit tests cannot.
 */

function setNow(isoLocal) {
  vi.setSystemTime(new Date(isoLocal));
}

async function signIn(name = 'Person A') {
  const gate = await screen.findByText('Who are you?');
  expect(gate).toBeTruthy();
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }));
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  localStorage.clear();
  document.body.innerHTML = '';
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('App — first run', () => {
  it('asks who you are, then seeds the rotation once', async () => {
    setNow('2026-10-26T09:00:00'); // Monday
    render(<App />);

    await signIn();
    const seedTitle = await screen.findByText(/Which rotation starts today/i);
    expect(seedTitle).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Upper Body/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Upper Body' })).toBeTruthy();
    });
    expect(screen.getByText('Explosive Tempo Note')).toBeTruthy();
    expect(screen.getByText(/Supplemental Tendon Isometrics/i)).toBeTruthy();
    expect(screen.queryByText(/KNEE SAFETY PROTOCOL/)).toBeNull();
    expect(localStorage.getItem('workoutTracker:identity')).toBe('Person A');
  });

  it('remembers the identity on the next visit and keeps the stored type', async () => {
    setNow('2026-10-26T09:00:00');
    const first = render(<App />);
    await signIn();
    fireEvent.click(await screen.findByRole('button', { name: /Lower Body/i }));
    await screen.findByRole('heading', { name: 'Lower Body' });
    first.unmount();

    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Lower Body' })).toBeTruthy();
    });
    expect(screen.queryByText('Who are you?')).toBeNull();
  });
});

describe('App — gym day behaviour', () => {
  beforeEach(async () => {
    setNow('2026-10-26T09:00:00');
    render(<App />);
    await signIn();
    fireEvent.click(await screen.findByRole('button', { name: /Upper Body/i }));
    await screen.findByRole('heading', { name: 'Upper Body' });
  });

  it('shows the knee safety banner and leg press warning on Lower days only', async () => {
    // Move to the next gym day (Thursday) — rotation flips to Lower.
    cleanup();
    localStorage.setItem('workoutTracker:identity', 'Person A');
    setNow('2026-10-29T09:00:00'); // Thursday
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Lower Body' })).toBeTruthy();
    });
    expect(screen.getByText(/MANDATORY KNEE SAFETY PROTOCOL/)).toBeTruthy();
    expect(screen.getByText(/On Leg Press and Hip Thrust/)).toBeTruthy();
    expect(screen.queryByText(/Supplemental Tendon Isometrics/i)).toBeNull();
    expect(screen.getAllByText(/Comfortable depth only/i).length).toBeGreaterThan(0);
  });

  it('checks off sets, weights and completes the exercise', async () => {
    const card = screen.getByRole('heading', { name: 'Chest Press (Machine)' }).closest('article');
    expect(card).toBeTruthy();

    const setButtons = within(card).getAllByRole('checkbox');
    expect(setButtons).toHaveLength(3);

    for (const button of setButtons) {
      fireEvent.click(button);
    }

    await waitFor(() => {
      expect(card.className).toContain('is-complete');
    });
    expect(setButtons.every((button) => button.getAttribute('aria-checked') === 'true')).toBe(true);

    const weight = within(card).getByLabelText(/Working weight/i);
    fireEvent.focus(weight);
    fireEvent.change(weight, { target: { value: '135' } });
    fireEvent.blur(weight);

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('workoutTracker:demo:day:2026-10-26'));
      expect(stored.participants['Person A'].exercises['chest-press'].weight).toBe(135);
    });
  });

  it('survives rapid consecutive taps without clobbering sets', async () => {
    const card = screen.getByRole('heading', { name: 'Chest Press (Machine)' }).closest('article');
    const buttons = within(card).getAllByRole('checkbox');

    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    fireEvent.click(buttons[2]);

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('workoutTracker:demo:day:2026-10-26'));
      expect(stored.participants['Person A'].exercises['chest-press'].sets).toEqual([
        true,
        true,
        true,
      ]);
    });
    expect(buttons.every((button) => button.getAttribute('aria-checked') === 'true')).toBe(true);
  });

  it('shows other people’s progress read-only', async () => {
    const card = screen.getByRole('heading', { name: 'Chest Press (Machine)' }).closest('article');
    const others = within(card).getByLabelText(/Other people’s progress/i);
    expect(within(others).getByText('Person B')).toBeTruthy();
    expect(within(others).queryByRole('checkbox')).toBeNull();
  });
});

describe('App — basketball and rain', () => {
  beforeEach(async () => {
    // Seed the rotation on Monday, then jump to Tuesday.
    setNow('2026-10-26T09:00:00');
    render(<App />);
    await signIn();
    fireEvent.click(await screen.findByRole('button', { name: /Upper Body/i }));
    await screen.findByRole('heading', { name: 'Upper Body' });
    cleanup();
    localStorage.setItem('workoutTracker:identity', 'Person A');
    setNow('2026-10-27T09:00:00');
    render(<App />);
    await screen.findByRole('heading', { name: 'Basketball' });
  });

  it('shows the basketball message, wall sits and a rain toggle', () => {
    expect(screen.getByText(/Basketball today/i)).toBeTruthy();
    expect(screen.getByText(/Supplemental Tendon Isometrics/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /It’s raining — go to gym/i })).toBeTruthy();
  });

  it('rain turns the day into a Lower body gym day and persists the flag', async () => {
    fireEvent.click(screen.getByRole('button', { name: /It’s raining — go to gym/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Lower Body' })).toBeTruthy();
    });
    expect(screen.getByText(/MANDATORY KNEE SAFETY PROTOCOL/)).toBeTruthy();
    const storedRain = JSON.parse(localStorage.getItem('workoutTracker:demo:rain:2026-10-27'));
    expect(storedRain.rainedOut).toBe(true);

    // Rain flag is date-scoped: Wednesday stays basketball.
    cleanup();
    setNow('2026-10-28T09:00:00');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Basketball' })).toBeTruthy();
    });
  });

  it('turning rain off goes back to basketball', async () => {
    fireEvent.click(screen.getByRole('button', { name: /It’s raining — go to gym/i }));
    await screen.findByRole('heading', { name: 'Lower Body' });
    fireEvent.click(screen.getByRole('button', { name: /Rain stopped\? Back to basketball/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Basketball' })).toBeTruthy();
    });
  });
});

describe('App — rest day', () => {
  it('shows a rest message on Sunday', async () => {
    localStorage.setItem('workoutTracker:identity', 'Person A');
    setNow('2026-11-01T10:00:00'); // Sunday
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Rest Day' })).toBeTruthy();
    });
    expect(screen.getByText(/No lifting, no tracking/i)).toBeTruthy();
  });
});

describe('App — day rollover', () => {
  it('moves to the new day without a reload and never reuses yesterday’s doc', async () => {
    setNow('2026-10-26T23:59:40'); // Monday, seconds before midnight
    render(<App />);
    await signIn();
    fireEvent.click(await screen.findByRole('button', { name: /Upper Body/i }));
    await screen.findByRole('heading', { name: 'Upper Body' });

    vi.setSystemTime(new Date('2026-10-27T00:00:05')); // Tuesday now
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Basketball' })).toBeTruthy();
    });
    expect(screen.queryByRole('heading', { name: 'Upper Body' })).toBeNull();
  });
});

describe('App — adding a person', () => {
  it('adds a third participant and signs them in', async () => {
    setNow('2026-10-26T09:00:00');
    render(<App />);
    await screen.findByText('Who are you?');

    fireEvent.click(screen.getByRole('button', { name: /\+ Add Person/i }));
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Sushil/i), {
      target: { value: 'Sushil' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add & continue/i }));

    await screen.findByText(/Which rotation starts today/i);
    fireEvent.click(screen.getByRole('button', { name: /Upper Body/i }));

    await screen.findByRole('heading', { name: 'Upper Body' });
    expect(localStorage.getItem('workoutTracker:identity')).toBe('Sushil');
    const squad = screen.getByLabelText(/Everyone’s progress/i);
    expect(within(squad).getByText('Sushil')).toBeTruthy();
    expect(within(squad).getByText('Person A')).toBeTruthy();
  });
});
