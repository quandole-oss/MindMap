"use client";

import { useState, useEffect } from "react";

interface GrowthSummaryOverlayProps {
  /** Number of new concepts added */
  conceptCount: number;
  /** Number of new connections added */
  connectionCount: number;
  /** Called when the overlay is dismissed (by timeout or interaction) */
  onDismiss: () => void;
}

/**
 * Floating card showing "+N concepts, +N connections" after graph growth animation.
 *
 * D-12: Position at bottom center above HealthLegend
 * D-13: Visible 4s then fades out; bg-black/50 backdrop-blur-md border border-white/10
 * D-14: Dismissed immediately on any graph interaction
 *
 * Accessibility: role="status" + aria-live="polite" for screen reader announcement (UI-SPEC)
 */
export function GrowthSummaryOverlay({
  conceptCount,
  connectionCount,
  onDismiss,
}: GrowthSummaryOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  // Fade in on mount (UI-SPEC: 200ms fade-in)
  useEffect(() => {
    const fadeInTimer = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(fadeInTimer);
  }, []);

  // D-13: Auto-dismiss after 4 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setFading(true);
      // Wait for fade-out animation (400ms) then call onDismiss
      setTimeout(onDismiss, 400);
    }, 4000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  // D-14: Dismiss on any graph interaction (pointerdown)
  useEffect(() => {
    const handleInteraction = () => {
      setFading(true);
      setTimeout(onDismiss, 100);
    };

    // Delay listener attachment to avoid catching the navigation click
    const attachTimer = setTimeout(() => {
      document.addEventListener("pointerdown", handleInteraction, {
        once: true,
      });
    }, 500);

    return () => {
      clearTimeout(attachTimer);
      document.removeEventListener("pointerdown", handleInteraction);
    };
  }, [onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 bg-black/50 backdrop-blur-md border border-white/10 rounded-lg px-5 py-2.5 text-center"
      style={{
        opacity: fading ? 0 : visible ? 1 : 0,
        transition: `opacity ${fading ? "400ms" : "200ms"} ease`,
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <p className="text-[20px] font-semibold text-white">
        +{conceptCount} concept{conceptCount !== 1 ? "s" : ""}, +
        {connectionCount} connection{connectionCount !== 1 ? "s" : ""}
      </p>
      <p className="text-[13px] text-white/70">added to your graph</p>
    </div>
  );
}
