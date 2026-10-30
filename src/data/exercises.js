/**
 * Phase 1 exercise library — hardcoded on purpose.
 * Editing exercises from the UI is explicitly out of scope for this phase.
 *
 * `setCount` drives the per-set checkboxes stored in Firestore as
 *   workoutDays/{date}.participants[name].exercises[id].sets = [bool, ...]
 */

export const EXERCISES_BY_TYPE = Object.freeze({
  Upper: Object.freeze([
    {
      id: 'chest-press',
      name: 'Chest Press (Machine)',
      setCount: 3,
      target: '3 × 10',
      cue: 'Explosive push / 2-3s negative',
      muscle: 'Chest',
    },
    {
      id: 'lat-pulldown',
      name: 'Lat Pulldown (Seated)',
      setCount: 3,
      target: '3 × 10',
      cue: 'Full stretch at top, pull to chest',
      muscle: 'Back',
    },
    {
      id: 'cable-row',
      name: 'Cable Row',
      setCount: 3,
      target: '3 × 10',
      cue: 'Squeeze shoulder blades, torso quiet',
      muscle: 'Back',
    },
    {
      id: 'shoulder-press',
      name: 'Shoulder Press (Machine / DB)',
      setCount: 3,
      target: '3 × 10',
      cue: 'Explosive drive overhead / controlled descent',
      muscle: 'Shoulders',
    },
    {
      id: 'delt-raises',
      name: 'Delt Raises (Rear / Side / Front)',
      setCount: 2,
      target: '2 × 12 each',
      cue: 'Strict form, zero momentum. One set = rear + side + front.',
      muscle: 'Shoulders',
      badge: 'Rear · Side · Front',
    },
    {
      id: 'shrugs',
      name: 'Shrugs (DB or Machine)',
      setCount: 3,
      target: '3 × 10',
      cue: 'Pause 1 sec at top contraction',
      muscle: 'Traps',
    },
    {
      id: 'tricep-pulldown',
      name: 'Tricep Pulldown',
      setCount: 2,
      target: '2 × 10–12',
      cue: 'Lock elbows at sides, isolate triceps',
      muscle: 'Triceps',
    },
    {
      id: 'wrist-curls',
      name: 'Wrist Curls',
      setCount: 2,
      target: '2 × 12–15',
      cue: 'Forearm stability for martial arts grip',
      muscle: 'Forearms',
    },
  ]),
  Lower: Object.freeze([
    {
      id: 'leg-press',
      name: 'Leg Press (Machine)',
      setCount: 3,
      target: '3 × 10',
      cue: 'Comfortable depth only; drive explosively',
      muscle: 'Quads / Glutes',
      safety:
        'Knee safety: keep depth strictly within a pain-free, comfortable range on every rep.',
    },
    {
      id: 'romanian-deadlift',
      name: 'Romanian Deadlift (Free Weight)',
      setCount: 3,
      target: '3 × 10',
      cue: 'Hinge at hips, flat back, loaded hamstrings',
      muscle: 'Hamstrings',
    },
    {
      id: 'leg-curl',
      name: 'Leg Curl (Machine)',
      setCount: 3,
      target: '3 × 10',
      cue: 'Controlled extension, smooth contraction',
      muscle: 'Hamstrings',
    },
    {
      id: 'calf-raises',
      name: 'Calf Raises',
      setCount: 3,
      target: '3 × 12–15',
      cue: 'Full stretch at bottom, explosive ankle extension',
      muscle: 'Calves',
    },
    {
      id: 'hip-thrust',
      name: 'Hip Thrust (Machine or Barbell)',
      setCount: 3,
      target: '3 × 10',
      cue: 'Squeeze glutes at top lockout; athletic power',
      muscle: 'Glutes',
    },
  ]),
});

export const BANNERS = Object.freeze({
  kneeSafety:
    'MANDATORY KNEE SAFETY PROTOCOL: Avoid squats, lunges, step-ups, or deep knee flexion. On Leg Press, keep depth strictly within a pain-free, comfortable range.',
  tempoPress:
    'Explosive Tempo Note: On Chest Press and Shoulder Press, drive explosively on the lift, lower with control over 2-3 seconds.',
  tempoLower:
    'Explosive Tempo Note: On Leg Press and Hip Thrust, drive up explosively, lower with control over 2-3 seconds.',
  wallSits:
    'Back flat against wall, hold a pain-free knee angle. 2 sets, hold as long as possible, rest 3 min between sets. Scale by daily energy.',
});

export const WALL_SITS_TITLE = 'Supplemental Tendon Isometrics (Wall Sits)';
