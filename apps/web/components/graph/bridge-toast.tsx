"use client";

import { useEffect } from "react";
import { toast } from "sonner";

interface BridgeToastProps {
  bridgeNodeId: string;
  bridgeNodeName: string;
  domainA: string;
  domainB: string;
  onExplore: (nodeId: string) => void;
}

const BRIDGE_LAST_SHOWN_KEY = "bridgeLastShown";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * BridgeToast — fires a Sonner toast on the student's first page load of the week
 * announcing the "surprise connection" bridge node (GRPH-08).
 *
 * - Checks localStorage for bridgeLastShown timestamp
 * - If within 7 days, silently does nothing
 * - Otherwise fires toast with "Surprise connection" title, 8-second duration,
 *   and an "Explore" action button that opens the node side panel
 * - Returns null (no DOM output — toast is fire-and-forget)
 */
export function BridgeToast({
  bridgeNodeId,
  bridgeNodeName,
  domainA,
  domainB,
  onExplore,
}: BridgeToastProps) {
  useEffect(() => {
    // Check 7-day cooldown (T-03-12: user can clear localStorage — accepted, no security impact)
    const lastShown = localStorage.getItem(BRIDGE_LAST_SHOWN_KEY);
    if (lastShown) {
      const lastShownTime = new Date(lastShown).getTime();
      if (!Number.isNaN(lastShownTime) && Date.now() - lastShownTime < SEVEN_DAYS_MS) {
        return;
      }
    }

    // Set timestamp before firing — prevents duplicate if effect runs twice (React Strict Mode)
    localStorage.setItem(BRIDGE_LAST_SHOWN_KEY, new Date().toISOString());

    toast("Surprise connection", {
      description: `Did you know ${bridgeNodeName} connects ${domainA} and ${domainB}? Tap to explore.`,
      duration: 8000,
      action: {
        label: "Explore",
        onClick: () => onExplore(bridgeNodeId),
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
