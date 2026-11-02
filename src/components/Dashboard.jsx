import { useEffect, useMemo, useState } from "react";

import AppHeader from "./AppHeader.jsx";
import BannerStack from "./BannerStack.jsx";
import BasketballPanel from "./BasketballPanel.jsx";
import DayHero from "./DayHero.jsx";
import ExerciseList from "./ExerciseList.jsx";
import PastDayPanel from "./PastDayPanel.jsx";
import RestDayPanel from "./RestDayPanel.jsx";
import SquadPanel from "./SquadPanel.jsx";
import WallSitsCard from "./WallSitsCard.jsx";
import WeekStrip from "./WeekStrip.jsx";
import WeightCard from "./WeightCard.jsx";
import { repository } from "../lib/repository.js";
import {
  DAY_KINDS,
  fromDateKey,
  getBaseDayKind,
  getWeekPreview,
} from "../lib/schedule.js";
import {
  getBodyWeight,
  getDayBanners,
  getExercisesForType,
  getParticipantEntry,
} from "../lib/workout.js";

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
  onCommitBodyWeight,
  onToggleRain,
  onSwitchIdentity,
  viewKey,
  viewDoc,
  viewLoading,
  onSelectDay,
}) {
  // 0 = this week, -1 = last week, and so on. Future weeks aren't shown.
  const [weekOffset, setWeekOffset] = useState(0);
  const isPast = Boolean(viewKey);

  // Saved gym sessions for the days in the strip. A saved type means it was a gym day,
  // even if rain made it one.
  const [savedTypes, setSavedTypes] = useState({});

  const baseWeek = useMemo(() => {
    const anchor = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + weekOffset * 7
    );
    return getWeekPreview(anchor, {
      rainedOut: weekOffset === 0 && plan.rainedOut,
      todayKey,
    });
  }, [today, todayKey, weekOffset, plan.rainedOut]);

  useEffect(() => {
    const pastKeys = baseWeek
      .filter((day) => day.isPast)
      .map((day) => day.dateKey);
    if (pastKeys.length === 0) return undefined;
    let active = true;
    repository
      .getDayTypes(pastKeys)
      .then((types) => {
        if (active) setSavedTypes((current) => ({ ...current, ...types }));
      })
      .catch(() => {}); // If this fails, the dots just fall back to the normal schedule.
    return () => {
      active = false;
    };
  }, [baseWeek, viewKey]);

  const week = useMemo(
    () =>
      baseWeek.map((day) =>
        day.isPast && savedTypes[day.dateKey]
          ? { ...day, dayKind: DAY_KINDS.GYM }
          : day
      ),
    [baseWeek, savedTypes]
  );

  // What the page is showing: today's live plan, or a read-only past day.
  // While the past-day document is still loading, do not invent a calendar
  // dayKind (Basketball/Rest) — that was the source of the title flash.
  const view = useMemo(() => {
    if (!isPast) {
      return {
        plan,
        entry: myEntry,
        exercises,
        type: plan.workoutType,
        canEdit: Boolean(dayDoc?.type),
      };
    }
    const date = fromDateKey(viewKey);
    if (viewLoading) {
      return {
        plan: {
          date,
          dateKey: viewKey,
          baseKind: null,
          dayKind: null,
          workoutType: null,
          rainedOut: false,
          rainEligible: false,
        },
        entry: null,
        exercises: [],
        type: null,
        canEdit: false,
      };
    }
    const type = viewDoc?.type ?? null;
    const baseKind = date ? getBaseDayKind(date) : DAY_KINDS.REST;
    return {
      plan: {
        date,
        dateKey: viewKey,
        baseKind,
        dayKind: type ? DAY_KINDS.GYM : baseKind,
        workoutType: type,
        rainedOut: false,
        rainEligible: false,
      },
      entry: getParticipantEntry(viewDoc, identity),
      exercises: getExercisesForType(type),
      type,
      canEdit: false,
    };
  }, [isPast, plan, myEntry, exercises, dayDoc, viewKey, viewDoc, viewLoading, identity]);

  const banners = getDayBanners({
    dayKind: plan.dayKind,
    workoutType: plan.workoutType,
  });
  const showSession = view.plan.dayKind === DAY_KINDS.GYM && Boolean(view.type);
  const showMissingPast = isPast && !showSession;

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
          <button
            type="button"
            className="banner__dismiss"
            onClick={onDismissError}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <main className="app__main">
        <div className={`top-row ${showSession ? "top-row--split" : ""}`}>
          <DayHero
            plan={view.plan}
            todayKey={isPast ? viewKey : todayKey}
            myEntry={view.entry}
            exercises={view.exercises}
            onToggleRain={onToggleRain}
            isPast={isPast}
            onBackToToday={() => onSelectDay(todayKey)}
            loading={viewLoading} // ← new
          />
          {showSession ? (
            <div className="top-side">
              <SquadPanel
                people={people}
                participants={
                  isPast ? viewDoc?.participants : dayDoc?.participants
                }
                exercises={view.exercises}
                identity={identity}
                readOnly={isPast}
              />
              <WeightCard
                value={getBodyWeight(view.entry)}
                onCommit={onCommitBodyWeight}
                disabled={isPast || !view.canEdit}
              />
            </div>
          ) : null}
        </div>

        <WeekStrip
          week={week}
          selectedKey={viewKey ?? todayKey}
          onSelect={onSelectDay}
          canGoNewer={weekOffset < 0}
          onOlder={() => setWeekOffset((current) => current - 1)}
          onNewer={() => setWeekOffset((current) => Math.min(0, current + 1))}
        />

        {isPast ? null : <BannerStack banners={banners} />}

        {!isPast && banners.wallSits ? (
          <WallSitsCard banner={banners.wallSits} />
        ) : null}

        {showSession ? (
          <ExerciseList
            exercises={view.exercises}
            entry={view.entry}
            onToggleSet={onToggleSet}
            disabled={!view.canEdit}
            readOnly={isPast}
          />
        ) : null}

        {showMissingPast ? (
          <PastDayPanel dayKind={view.plan.dayKind} loading={viewLoading} />
        ) : null}

        {!isPast && plan.dayKind === DAY_KINDS.BASKETBALL ? (
          <BasketballPanel
            rainedOut={plan.rainedOut}
            onToggleRain={onToggleRain}
            rainEligible={plan.rainEligible}
          />
        ) : null}

        {!isPast && plan.dayKind === DAY_KINDS.REST ? (
          <RestDayPanel today={today} />
        ) : null}
      </main>

      <footer className="app__footer">
        <span>lbs only</span>
        <span className={`backend-tag backend-tag--${backend}`}>
          {backend === "firestore" ? "Live sync" : "Local demo data"}
        </span>
      </footer>
    </div>
  );
}
