/**
 * Identity is intentionally low-tech for phase 1: a name in localStorage.
 * No auth, no accounts.
 */

const IDENTITY_KEY = 'workoutTracker:identity';

export function readIdentity() {
  try {
    const value = localStorage.getItem(IDENTITY_KEY);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

export function writeIdentity(name) {
  try {
    localStorage.setItem(IDENTITY_KEY, name);
    return true;
  } catch {
    return false;
  }
}

export function clearIdentity() {
  try {
    localStorage.removeItem(IDENTITY_KEY);
  } catch {
    // ignore
  }
}
