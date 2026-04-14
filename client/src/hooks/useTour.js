import { useCallback, useEffect, useRef, useState } from "react";
import "@/styles/tour.css";

export const useTour = () => {
  const [isActive, setIsActive] = useState(false);
  const [currentTour, setCurrentTour] = useState(null);
  const driverRef = useRef(null);
  const keydownHandlerRef = useRef(null);

  const stopTour = useCallback(() => {
    const driverInstance = driverRef.current;

    if (driverInstance?.isActive()) {
      try {
        driverInstance.destroy();
      } catch {
        // driver.js may throw during destroy if already cleaned up — safe to ignore
      }
    }

    if (keydownHandlerRef.current) {
      document.removeEventListener("keydown", keydownHandlerRef.current, {
        capture: true,
      });
      keydownHandlerRef.current = null;
    }

    driverRef.current = null;
    setIsActive(false);
    setCurrentTour(null);
  }, []);

  const startTour = useCallback(async (tourName, steps, onComplete) => {
    const { driver } = await import("driver.js");
    const filteredSteps = steps.filter((step) =>
      document.querySelector(step.element),
    );

    if (filteredSteps.length === 0) {
      if (onComplete) {
        onComplete();
      }
      return;
    }

    const driverInstance = driver({
      showProgress: true,
      animate: true,
      allowClose: false,
      overlayClickBehavior: "nextStep",
      stagePadding: 4,
      stageRadius: 8,
      steps: filteredSteps,
      onDestroyStarted: () => {
        if (onComplete) {
          onComplete();
        }
        driverInstance.destroy();
      },
      popoverClass: "azan-tour-popover",
    });

    driverRef.current = driverInstance;
    setCurrentTour(tourName);
    setIsActive(true);
    driverInstance.drive();

    const handleKeyDown = (event) => {
      if (event.code === "Space" && driverRef.current?.isActive()) {
        event.preventDefault();
        event.stopPropagation();
        driverRef.current.moveNext();
      }
    };

    keydownHandlerRef.current = handleKeyDown;
    document.addEventListener("keydown", handleKeyDown, { capture: true });
  }, []);

  useEffect(
    () => () => {
      stopTour();
    },
    [stopTour],
  );

  return {
    startTour,
    stopTour,
    isActive,
    currentTour,
  };
};
