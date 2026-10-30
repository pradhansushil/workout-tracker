/**
 * Single entry point the UI talks to.
 *
 * The backend is chosen at build time:
 *  - Firestore when Firebase env vars are present
 *  - localStorage demo store otherwise (or when VITE_DATA_BACKEND=local)
 *
 * Both implementations expose the same async/subscribe API, so components never
 * care which one is live.
 */

import { backend, getFirestoreDb } from '../firebase.js';

async function createRepository() {
  if (backend === 'local') {
    const { createLocalRepository } = await import('./repositories/localRepository.js');
    return createLocalRepository();
  }

  const [{ createFirestoreRepository }, db] = await Promise.all([
    import('./repositories/firestoreRepository.js'),
    getFirestoreDb(),
  ]);
  return createFirestoreRepository(db);
}

export const repository = await createRepository();
export { backend };
