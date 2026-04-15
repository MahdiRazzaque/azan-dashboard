import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { DateTime } from "luxon";
import { useClientPreferences } from "@/hooks/useClientPreferences";
import { formatPrayerLabel } from "@/utils/prayerNames";

const FocusCard = ({
  nextPrayer,
  prayers,
  lastUpdated,
  onCountdownComplete,
  timezone,
}) => {
  const getCurrentTime = useCallback(
    () => (timezone ? DateTime.now().setZone(timezone) : DateTime.now()),
    [timezone],
  );
  const [, setClockTick] = useState(0);
  const { preferences } = useClientPreferences();
  const {
    clockFormat,
    showSeconds,
    countdownMode,
    skipSunriseCountdown,
    prayerNameLanguage,
  } = preferences.appearance;
  const lastTriggeredRef = useRef(null);
  const isFetchingRef = useRef(false);
  const now = getCurrentTime();

  // Calculate effective next prayer (skip sunrise if preference is set)
  const effectiveNextPrayer = useMemo(() => {
    if (!nextPrayer) return null;
    if (
      nextPrayer.name === "sunrise" &&
      skipSunriseCountdown &&
      prayers?.dhuhr?.start
    ) {
      return {
        name: "dhuhr",
        time: prayers.dhuhr.start,
        isTomorrow: false,
      };
    }
    return nextPrayer;
  }, [nextPrayer, skipSunriseCountdown, prayers]);

  useEffect(() => {
    const timer = setInterval(
      () => setClockTick((currentTick) => currentTick + 1),
      1000,
    );
    return () => clearInterval(timer);
  }, []);

  // Trigger refetch when countdown completes
  useEffect(() => {
    if (!effectiveNextPrayer || !onCountdownComplete) return;

    const target = DateTime.fromISO(effectiveNextPrayer.time).setZone(
      timezone || DateTime.local().zoneName,
    );
    const secondsLeft = Math.floor((target.toMillis() - now.toMillis()) / 1000);

    // Only trigger if we haven't already triggered for this specific prayer time
    // and we're not currently in a fetching state
    if (
      secondsLeft <= 0 &&
      lastTriggeredRef.current !== effectiveNextPrayer.time &&
      !isFetchingRef.current
    ) {
      lastTriggeredRef.current = effectiveNextPrayer.time;
      isFetchingRef.current = true;

      console.log(
        `[FocusCard] Countdown finished for ${effectiveNextPrayer.name}. Triggering refetch in 5s...`,
      );

      const timer = setTimeout(() => {
        onCountdownComplete();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [effectiveNextPrayer, now, onCountdownComplete, timezone]);

  // Retry loop: monitor lastUpdated to detect if server returned stale data
  useEffect(() => {
    if (!isFetchingRef.current || !effectiveNextPrayer || !onCountdownComplete)
      return;

    const target = DateTime.fromISO(effectiveNextPrayer.time).setZone(
      timezone || DateTime.local().zoneName,
    );
    const currentNow = getCurrentTime();
    const secondsLeft = Math.floor(
      (target.toMillis() - currentNow.toMillis()) / 1000,
    );

    if (secondsLeft > 0) {
      // Success: server returned new prayer, unlock UI
      console.log(
        `[FocusCard] Transition successful. Next prayer: ${effectiveNextPrayer.name} in ${secondsLeft}s`,
      );
      isFetchingRef.current = false;
    } else {
      // Server still returning old prayer, retry after 5s
      console.log(
        `[FocusCard] Server still returning old prayer (${effectiveNextPrayer.name}). Retrying in 5s...`,
      );

      const timer = setTimeout(() => {
        onCountdownComplete();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [
    effectiveNextPrayer,
    getCurrentTime,
    lastUpdated,
    onCountdownComplete,
    timezone,
  ]);

  const getCountdown = () => {
    if (!effectiveNextPrayer) return null;
    const target = DateTime.fromISO(effectiveNextPrayer.time).setZone(
      timezone || DateTime.local().zoneName,
    );
    const secondsLeft = Math.max(
      0,
      Math.ceil((target.toMillis() - now.toMillis()) / 1000),
    );

    if (secondsLeft <= 0) return "0sec";

    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    const seconds = secondsLeft % 60;

    if (countdownMode === "digital") {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }

    if (countdownMode === "minimal") {
      if (hours > 0) return `${hours}h ${minutes}m`;
      if (minutes > 0) return `${minutes}m ${seconds}s`;
      return `${seconds}s`;
    }

    // Normal/Natural mode
    if (hours > 0) return `${hours}hr ${minutes}min ${seconds}sec`;
    if (minutes > 0) return `${minutes}min ${seconds}sec`;
    return `${seconds}sec`;
  };

  const nextName = effectiveNextPrayer
    ? formatPrayerLabel(effectiveNextPrayer.name, prayerNameLanguage)
    : "";

  return (
    <div
      id="tour-focus-card"
      className="bg-app-card rounded-3xl h-auto lg:h-full flex flex-col items-center justify-center text-center p-[clamp(1.5rem,3vw,4rem)] shadow-2xl relative overflow-hidden"
    >
      {/* Background Decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/30 pointer-events-none" />

      {/* Content wrapper with max-width for ultrawide screens */}
      <div className="z-10 w-full max-w-[900px] mx-auto flex flex-col items-center justify-center">
        {/* Date Display */}
        <div className="text-[clamp(1.1rem,1.8vw+0.3rem,2.5rem)] text-app-dim font-light tracking-wide mb-[clamp(0.75rem,1.5vw,1.5rem)] w-full text-center">
          {now.toFormat("cccc, d MMMM")}
        </div>

        {/* Main Clock */}
        <div className="font-bold text-app-text tracking-widest leading-none select-none pb-[clamp(1rem,2vw,2rem)] text-[clamp(3.5rem,8vw+1rem,10rem)] flex items-baseline justify-center w-full">
          <span>{now.toFormat(clockFormat === "12h" ? "hh:mm" : "HH:mm")}</span>
          {showSeconds && (
            <span className="text-[clamp(1.25rem,2.5vw,3rem)] text-app-dim font-medium opacity-40 ml-[clamp(0.5rem,1vw,1rem)]">
              {now.toFormat("ss")}
            </span>
          )}
          {clockFormat === "12h" && (
            <span className="text-[clamp(1.1rem,2vw,2.5rem)] text-app-dim font-medium ml-[clamp(0.5rem,1vw,1rem)] uppercase">
              {now.toFormat("a")}
            </span>
          )}
        </div>

        {/* Countdown Section */}
        {effectiveNextPrayer && (
          <div className="flex flex-col items-center space-y-[clamp(0.5rem,1vw,1.5rem)] mt-[clamp(0.5rem,1vw,1.5rem)] w-full">
            <div className="text-[clamp(1rem,1.5vw+0.3rem,2rem)] text-app-accent font-semibold uppercase tracking-[0.3em] opacity-90 drop-shadow-md text-center w-full">
              Upcoming: {nextName}
            </div>
            <div className="text-[clamp(1.75rem,4vw+0.5rem,5rem)] text-center font-mono text-app-text bg-app-bg/40 px-[clamp(1.5rem,2.5vw,3.5rem)] py-[clamp(0.5rem,1vw,1.5rem)] rounded-2xl backdrop-blur-lg border border-app-border shadow-inner">
              {getCountdown()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FocusCard;
