"use client";

import "driver.js/dist/driver.css";

import { useEffect, useRef } from "react";
import type { Driver, DriveStep } from "driver.js";

export function useOnboardingTour({
  enabled,
  steps,
  onComplete,
}: {
  enabled: boolean;
  steps: DriveStep[];
  onComplete?: () => void;
}) {
  const ran = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!enabled || ran.current) return;

    let cancelled = false;
    let driver: Driver | null = null;

    const timeout = setTimeout(async () => {
      try {
        const { driver: createDriver } = await import("driver.js");
        if (cancelled) return;

        driver = createDriver({
          showProgress: true,
          animate: true,
          allowClose: true,
          overlayOpacity: 0.6,
          steps,
          onDestroyed: () => {
            onCompleteRef.current?.();
          },
        });
        // Mark as started only right before driving so React StrictMode's
        // dev double-mount (mount → cleanup → mount) doesn't consume the flag.
        ran.current = true;
        driver.drive();
      } catch (err) {
        console.warn("Guided tour failed to start:", err);
      }
    }, 700);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      try {
        driver?.destroy();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, steps]);
}