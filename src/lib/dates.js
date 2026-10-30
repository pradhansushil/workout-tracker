export const WEEKDAY_SHORT = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
export const WEEKDAY_LETTER = Object.freeze(['S', 'M', 'T', 'W', 'T', 'F', 'S']);

export function formatShortDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/** Milliseconds until the next local midnight — used to roll the day over. */
export function msUntilTomorrow(now = new Date()) {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
  return Math.max(1000, tomorrow.getTime() - now.getTime());
}
