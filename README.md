# Rotation — Dual/Multi-Athlete Workout Tracker

A small, installable PWA for a shared gym rotation. Two people (expandable to more)
share one Firestore-backed dashboard: today's Upper/Lower session, per-set
checkboxes, working weights, and each other's progress — read-only for anyone but
yourself.

No login. Identity is a name picked once and remembered in `localStorage`.

---

## Stack

| Piece      | Choice                                                     |
| ---------- | ---------------------------------------------------------- |
| UI         | React 19 + Vite 8                                          |
| Data       | Firebase Firestore (Spark plan — no Cloud Functions needed) |
| PWA        | `vite-plugin-pwa` (Workbox `generateSW`, auto-update)       |
| Hosting    | Vercel (static SPA)                                        |
| Tests      | Vitest + Testing Library (jsdom)                            |

---

## Quick start

```bash
npm install
npm run dev
```

Without Firebase keys the app boots into **local demo mode**: everything works,
but data lives in `localStorage` on that one device. The header shows an amber
dot and the footer says “Local demo data” while you're in that mode.

```bash
npm test        # unit + jsdom integration tests
npm run lint
npm run build   # emits /dist with the service worker + web manifest
npm run preview # serve the production build locally
```

---

## Wiring up Firebase

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
   and add a **Web app**. Copy the config object it gives you.
2. Enable **Firestore Database** (production mode is fine) in your region.
3. Paste your values into `.env.local` (copy `.env.example` first):

   ```dotenv
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

4. Publish the security rules from `firestore.rules` (Firebase console → Firestore →
   Rules, or `firebase deploy --only firestore:rules`). Phase 1 has no auth, so the
   rules are intentionally open for the three collections the app uses — see the
   comment at the top of that file.
5. Restart `npm run dev`. The footer should now read “Live sync”.

> Env vars are read at build time. On Vercel, add the same variables under
> **Project → Settings → Environment Variables**, then redeploy.

### Deploying to Vercel

`vercel.json` already declares the Vite build, the SPA rewrite, and long-cache-safe
headers for `sw.js` / the manifest. Import the repo, add the six env vars above,
deploy. Nothing else is required — Firestore talks to Google directly from the
browser, so there are no server functions.

### Installing the PWA

- **iOS**: Safari → Share → *Add to Home Screen*. Launches standalone/full-screen.
- **Android/Chrome**: menu → *Install app*.
- The service worker precaches the app shell, so the UI opens offline. Writes made
  offline are queued by Firestore and flushed when the connection returns.

---

## How the rotation works

The whole scheduling brain lives in [`src/lib/schedule.js`](src/lib/schedule.js) — pure
functions, no React or Firebase, fully unit-tested.

| Day                        | Result                                 |
| -------------------------- | -------------------------------------- |
| Monday, Thursday           | Gym day, always                        |
| Sunday                     | Rest day, always                       |
| Tue / Wed / Fri / Sat      | Basketball… unless that date is rained out, then it's a gym day |

Upper/Lower alternation is based on the **last gym day that actually happened**,
stored in `meta/schedule`:

```
meta/schedule = { lastWorkoutType: "Lower", lastWorkoutDate: "2026-10-22" }
```

On a gym day (in a single Firestore transaction):

1. If today's `workoutDays/{date}` already exists → use its `type` (another device
   may have created it) and make sure `meta/schedule` matches today.
2. Else if `lastWorkoutDate === today` → redisplay `lastWorkoutType`. Never flip twice.
3. Else if `meta/schedule` exists → flip Upper ⇄ Lower, save the new type + today's date.
4. Else (first run ever) → prompt once for a seed value (Upper or Lower) and save it.

Rain is date-scoped: `rainStatus/{date}: { rainedOut: true }`. Because the flag is
keyed by the date, tomorrow is automatically dry — there is no reset job and no
scheduled Cloud Function anywhere.

---

## Data model

```
meta/schedule          { lastWorkoutType: "Upper" | "Lower", lastWorkoutDate: "YYYY-MM-DD" }
meta/people            { names: string[] }                     // roster, seeded with Person A + Person B

rainStatus/{date}      { rainedOut: boolean }                  // date-scoped rain flag

workoutDays/{date}     {
  type: "Upper" | "Lower",
  date: "YYYY-MM-DD",
  participants: {
    [personName]: {
      exercises: {
        [exerciseId]: { sets: [bool, bool, bool], weight: number | null }
      },
      isCompleted: bool          // derived: every set of every exercise checked
    }
  }
}
```

Notes:

- The current person's checkmark/weight writes are deep-merged `setDoc` calls that
  only touch their own subtree, which keeps them working offline in the gym.
  Creating the day document and advancing the rotation use `runTransaction`, so two
  phones can't double-flip the rotation.
- The UI applies each tap optimistically, so hammering three set buttons in a row
  always writes the full, correct set array (Firestore replaces arrays wholesale).
  If a caller has no entry in hand, the repository falls back to the freshest
  document it can read before computing the completion flag.
- `isCompleted` is recomputed whenever a set or weight is written.
- Exercise ids are stable slugs (`chest-press`, `leg-press`, …) defined in
  [`src/data/exercises.js`](src/data/exercises.js). Editing them from the UI is a
  later phase.

---

## Screens

- **Who are you?** — name picker (Person A / Person B seeded) plus **+ Add Person**.
  The choice is stored in `localStorage` and can be changed with *Switch* in the header.
- **Dashboard** — today's type, a Monday-first week strip, the banners, the squad's
  progress, then the exercise list with per-set toggles and a weight field (`lb`,
  auto-saved on blur).
- **Lower day** — prominent mandatory knee-safety banner, plus a persistent warning on
  the Leg Press card itself.
- **Upper day** — explosive-tempo note for the presses.
- **Basketball days** — court message, wall-sit isometrics card, and an
  “It's raining — go to gym” toggle that writes `rainStatus/{date}`.
- **Rest day (Sunday)** — rest message with the next gym day.

Wall-sit isometrics appear on Upper gym days and on basketball days, never on Lower
days, exactly as specified.

---

## Project structure

```
src/
  firebase.js                  env-driven config + lazy Firestore init
  App.jsx                      orchestration: subscriptions, day resolution, handlers
  index.css                    design system (dark athletic, auto light mode)
  components/
    IdentityGate.jsx           “Who are you?” + add person
    Dashboard.jsx  DayHero.jsx  WeekStrip.jsx
    BannerStack.jsx            knee safety + tempo banners
    ExerciseList.jsx  ExerciseCard.jsx
    SquadPanel.jsx  BasketballPanel.jsx  WallSitsCard.jsx  RestDayPanel.jsx
    SeedPrompt.jsx  LoadingScreen.jsx  Toast.jsx  ProgressRing.jsx  AppHeader.jsx
  data/exercises.js            hardcoded phase-1 exercise library + banner copy
  lib/
    schedule.js                pure scheduling logic  (schedule.test.js)
    schedule.test.js
    workout.js                 derived selectors: sets, weights, completion, banners
    workout.test.js
    documents.js               document builders/mergers for both backends
    documents.test.js
    repository.js              picks Firestore or the local demo store
    repositories/firestoreRepository.js
    repositories/localRepository.js
    identity.js  dates.js
  App.integration.test.jsx      jsdom tests for the real screens/flows
public/                        PWA icons, favicon
firestore.rules                phase-1 (no auth) rules
vercel.json                    build + SPA rewrite + SW headers
```

### Demo mode

`VITE_DATA_BACKEND` can be `auto` (default), `local`, or `firestore`.
`local` forces the `localStorage` store — handy for UI work without touching
production data. In the browser console while in demo mode:

```js
// wipe demo data and start over
Object.keys(localStorage)
  .filter((key) => key.startsWith('workoutTracker:demo:'))
  .forEach((key) => localStorage.removeItem(key));
location.reload();
```

---

## Explicitly out of scope for this phase

Authentication, round-robin/equipment rotation, editable exercise lists, per-person
restriction tagging, onboarding profiles (age/height/weight/BMI), a lbs/kg toggle,
and scheduled push notifications. Nothing above is implemented or scaffolded.

Known phase-1 realities:

- The “today” date comes from the device clock (one person travelling across time
  zones can be a day ahead).
- Security rules are open because there is no auth yet — keep the URL private.
- Creating the day document requires a brief connection; Firestore's own offline
  cache only handles writes to documents it has already seen.
- Flipping the rain toggle on and then off again leaves `meta/schedule` pointing at
  the type that rained-out day advanced to. The next gym day continues from there —
  which is the correct behaviour if anyone actually trained that day.
