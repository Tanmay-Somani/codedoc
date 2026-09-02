"use client";

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
    ran.current = true;

    let cancelled = false;
    let driver: Driver | null = null;

    const timeout = setTimeout(async () => {
      try {
        const { driver: createDriver } = await import("driver.js");
        await import("driver.js/dist/driver.css");
        if (cancelled) return;

        driver = createDriver({
          showProgress: true,
          animate: true,
          allowClose: true,
          overlayOpacity: 0.6,
          steps,
          onDestroy: () => {
            onCompleteRef.current?.();
          },
        });
        driver.drive();
      } catch {
        /* tour is non-critical — never crash the page */
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