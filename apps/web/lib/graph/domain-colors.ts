/**
 * Shared domain color palette used by both the 3D graph (solar-nodes.tsx)
 * and the filter bar UI (graph-filter-bar.tsx).
 */

export const DOMAIN_HUE_PALETTE = [
  "#22d3ee", // cyan
  "#a78bfa", // violet
  "#f472b6", // pink
  "#fb923c", // orange
  "#4ade80", // green
  "#facc15", // yellow
  "#60a5fa", // blue
  "#e879f9", // fuchsia
  "#34d399", // emerald
  "#f87171", // red-light
];

// Track domain → color assignments (stable within a session)
const domainColorMap = new Map<string, string>();
let nextIndex = 0;

/**
 * Returns a deterministic hex color for a domain name.
 * Assignments are stable within a session — the same domain always
 * gets the same color once assigned.
 */
export function getDomainColor(domain: string): string {
  let color = domainColorMap.get(domain);
  if (!color) {
    color = DOMAIN_HUE_PALETTE[nextIndex % DOMAIN_HUE_PALETTE.length];
    domainColorMap.set(domain, color);
    nextIndex++;
  }
  return color;
}
