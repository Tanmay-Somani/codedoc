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
    let blurEl: HTMLDivElement | null = null;

    const removeBlur = () => {
      blurEl?.remove();
      blurEl = null;
    };

    const syncBlur = (element: Element | undefined) => {
      if (!blurEl) return;
      if (!element) {
        blurEl.style.webkitMaskImage = "none";
        blurEl.style.maskImage = "none";
        return;
      }
      const pad = 16;
      const rect = element.getBoundingClientRect();
      const x = Math.max(0, Math.round(rect.left - pad));
      const y = Math.max(0, Math.round(rect.top - pad));
      const w = Math.min(rect.width + pad * 2, window.innerWidth - x);
      const h = Math.min(rect.height + pad * 2, window.innerHeight - y);
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" ` +
        `width="${window.innerWidth}" height="${window.innerHeight}">` +
        `<rect width="100%" height="100%" fill="#fff"/>` +
        `<rect x="${x}" y="${y}" width="${Math.max(0, w)}" height="${Math.max(0, h)}" fill="#000"/>` +
        `</svg>`;
      const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
      blurEl.style.webkitMaskImage = url;
      blurEl.style.maskImage = url;
    };

    const timeout = setTimeout(async () => {
      try {
        const { driver: createDriver } = await import("driver.js");
        if (cancelled) return;

        blurEl = document.createElement("div");
        blurEl.className = "codedoc-tour-blur";
        document.body.appendChild(blurEl);

        driver = createDriver({
          showProgress: true,
          animate: true,
          allowClose: true,
          smoothScroll: true,
          overlayColor: "#0a0f1e",
          overlayOpacity: 0.5,
          stagePadding: 16,
          stageRadius: 14,
          popoverClass: "codedoc-tour",
          nextBtnText: "Continue",
          prevBtnText: "Back",
          doneBtnText: "Done",
          steps,
          onHighlighted: (element) => {
            syncBlur(element);
          },
          onPopoverRender: (popover) => {
            if (popover.wrapper.querySelector(".codedoc-tour-brand")) return;
            const brand = document.createElement("div");
            brand.className = "codedoc-tour-brand";
            brand.textContent = "CODEDOC // TOUR";
            popover.wrapper.insertBefore(brand, popover.title);
          },
          onDestroyed: () => {
            removeBlur();
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
      removeBlur();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, steps]);
}