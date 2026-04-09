"use client";

interface LegendItem {
  color: string;
  label: string;
}

const legendItems: LegendItem[] = [
  { color: "var(--color-healthy)", label: "Understood" },
  { color: "var(--color-misconception)", label: "Needs review" },
  { color: "var(--color-unprobed)", label: "Not yet explored" },
  { color: "var(--color-bridge)", label: "Connects topics" },
];

export function HealthLegend() {
  const items = (
    <div className="flex flex-wrap gap-4 items-center">
      {legendItems.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            style={{
              backgroundColor: item.color,
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span className="text-[13px] font-normal text-white/70">{item.label}</span>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Desktop: inline legend */}
      <div className="hidden md:block">{items}</div>

      {/* Mobile: collapsible legend */}
      <details className="md:hidden">
        <summary className="text-[13px] font-normal text-white/70 cursor-pointer select-none mb-2">
          Legend
        </summary>
        {items}
      </details>
    </>
  );
}
