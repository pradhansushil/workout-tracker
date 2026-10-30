import { useMemo } from 'react';

import AppHeader from './AppHeader.jsx';
import BannerStack from './BannerStack.jsx';
import BasketballPanel from './BasketballPanel.jsx';
import DayHero from './DayHero.jsx';
import ExerciseList from './ExerciseList.jsx';
import RestDayPanel from './RestDayPanel.jsx';
import SquadPanel from './SquadPanel.jsx';
import WallSitsCard from './WallSitsCard.jsx';
import WeekStrip from './WeekStrip.jsx';
import { DAY_KINDS, getWeekPreview } from '../lib/schedule.js';
import { getDayBanners } from '../lib/workout.js';

export default function Dashboard({
  plan,
  today,
  todayKey,
  dayDoc,
  people,
  identity,
  myEntry,
  exercises,
  backend,
  error,
  onDismissError,
  onToggleSet,
  onCommitWeight,
  onToggleRain,
  onSwitchIdentity,
}) {
  const banners = getDayBanners({ dayKind: plan.dayKind, workoutType: plan.workoutType });
  const week = useMemo(
    () => getWeekPreview(today, { rainedOut: plan.rainedOut }),
    [today, plan.rainedOut],
  );
  const isGym = plan.dayKind === DAY_KINDS.GYM;
  // Editing is only safe once today's workout document exists on the backend.
  const canEdit = Boolean(dayDoc?.type);

  return (
    <div className="app">
      <AppHeader
        today={today}
        identity={identity}
        onSwitchIdentity={onSwitchIdentity}
        backend={backend}
      />

      {error ? (
        <div className="banner banner--error" role="alert">
          <div>
            <strong>Sync problem.</strong> {error}
          </div>
          <button type="button" className="banner__dismiss" onClick={onDismissError}>
            Dismiss
          </button>
        </div>
      ) : null}

      <main className="app__main">
        <DayHero
          plan={plan}
          todayKey={todayKey}
          myEntry={myEntry}
          exercises={exercises}
          onToggleRain={onToggleRain}
        />

        <WeekStrip week={week} />

        <BannerStack banners={banners} />

        {isGym ? (
          <>
            <SquadPanel
              people={people}
              participants={dayDoc?.participants}
              exercises={exercises}
              identity={identity}
            />
            <ExerciseList
              exercises={exercises}
              entry={myEntry}
              people={people}
              participants={dayDoc?.participants}
              identity={identity}
              onToggleSet={onToggleSet}
              onCommitWeight={onCommitWeight}
              disabled={!canEdit}
            />
          </>
        ) : null}

        {plan.dayKind === DAY_KINDS.BASKETBALL ? (
          <BasketballPanel
            rainedOut={plan.rainedOut}
            onToggleRain={onToggleRain}
            rainEligible={plan.rainEligible}
          />
        ) : null}

        {plan.dayKind === DAY_KINDS.REST ? <RestDayPanel today={today} /> : null}

        {banners.wallSits ? <WallSitsCard banner={banners.wallSits} /> : null}
      </main>

      <footer className="app__footer">
        <span>Phase 1 · lbs only · shared rotation</span>
        <span className={`backend-tag backend-tag--${backend}`}>
          {backend === 'firestore' ? 'Live sync' : 'Local demo data'}
        </span>
      </footer>
    </div>
  );
}
