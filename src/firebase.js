/**
 * Firebase bootstrap.
 *
 * The SDK is imported dynamically (see getFirestoreDb) so that the app never
 * downloads Firebase at all when it runs against the local demo store. Your keys
 * come from Vite env vars — copy .env.example to .env.local and fill them in.
 */

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const REQUIRED_KEYS = ['apiKey', 'projectId', 'appId'];

export const missingFirebaseKeys = REQUIRED_KEYS.filter((key) => !firebaseConfig[key]);

const requestedBackend = String(import.meta.env.VITE_DATA_BACKEND ?? 'auto').toLowerCase();
const canUseFirebase = missingFirebaseKeys.length === 0;
const useLocalBackend =
  requestedBackend === 'local' || (requestedBackend === 'auto' && !canUseFirebase);

export const backend = useLocalBackend ? 'local' : 'firestore';

let dbPromise = null;

/** Lazily create the Firestore instance (only used when backend === 'firestore'). */
export function getFirestoreDb() {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    const [{ initializeApp }, { initializeFirestore }] = await Promise.all([
      import('firebase/app'),
      import('firebase/firestore'),
    ]);
    const app = initializeApp(firebaseConfig);
    // ignoreUndefinedProperties keeps optional fields out of the way.
    return initializeFirestore(app, { ignoreUndefinedProperties: true });
  })();

  return dbPromise;
}

if (backend === 'local') {
  console.info(
    '[workout-tracker] Running with the local demo store. Add your Firebase keys ' +
      'to .env.local to sync across devices.',
  );
}
