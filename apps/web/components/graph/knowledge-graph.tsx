"use client";

import * as d3 from "d3";
import { useRef, useEffect, useCallback } from "react";
import { Maximize2 } from "lucide-react";
import type { GraphNode, GraphEdge } from "@/actions/graph";

// Extend GraphNode to include D3 simulation coordinates
interface SimNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface SimLink {
  source: string | SimNode;
  target: string | SimNode;
  edgeType: string;
}

const NODE_COLORS = {
  healthy: "#14b8a6",
  misconception: "#f87171",
  unprobed: "#a1a1aa",
  bridge: "#a78bfa",
} as const;

function getNodeColor(node: GraphNode): string {
  if (node.isBridge) return NODE_COLORS.bridge;
  return NODE_COLORS[node.status] ?? NODE_COLORS.unprobed;
}

function getNodeRadius(node: GraphNode): number {
  return Math.min(8 + node.visitCount * 2, 24);
}

function getEdgeColor(edgeType: string): { color: string; opacity: number } {
  switch (edgeType) {
    case "bridge":
      return { color: "var(--color-bridge, #a78bfa)", opacity: 0.5 };
    case "misconception_cluster":
      return { color: "var(--color-misconception, #f87171)", opacity: 0.4 };
    case "curiosity_link":
    default:
      return { color: "#18181b", opacity: 0.25 };
  }
}

interface KnowledgeGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick: (nodeId: string) => void;
}

export function KnowledgeGraph({ nodes, edges, onNodeClick }: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Stable callback ref to avoid re-running effect on every render
  const onNodeClickRef = useRef(onNodeClick);
  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  });

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svgEl = svgRef.current;
    const svg = d3.select(svgEl);

    // CRITICAL: Clear SVG on each run (handles re-renders + Strict Mode double mount)
    svg.selectAll("*").remove();

    const { width, height } = svgEl.getBoundingClientRect();
    const effectiveWidth = width || 800;
    const effectiveHeight = height || 600;

    // CRITICAL: Deep-clone nodes and links before passing to D3 (D3 mutates objects)
    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = edges.map((e) => ({ ...e }));

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Create simulation
    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(80)
      )
      .force("charge", d3.forceManyBody<SimNode>().strength(-120))
      .force("center", d3.forceCenter(effectiveWidth / 2, effectiveHeight / 2))
      .force(
        "collision",
        d3.forceCollide<SimNode>().radius((d) => getNodeRadius(d) + 4)
      )
      .alphaDecay(prefersReducedMotion ? 0.9 : 0.02)
      .velocityDecay(0.4);

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 3])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    // Main container group for zoom transform
    const container = svg.append("g");

    // Tooltip helpers
    let tooltipTimer: ReturnType<typeof setTimeout> | null = null;

    function showTooltip(event: MouseEvent, node: SimNode) {
      if (tooltipTimer) clearTimeout(tooltipTimer);
      tooltipTimer = setTimeout(() => {
        if (!tooltipRef.current) return;
        const visitLabel = node.visitCount === 1 ? "1 visit" : `${node.visitCount} visits`;
        tooltipRef.current.textContent = `${node.name} · ${visitLabel}`;
        tooltipRef.current.style.display = "block";
        tooltipRef.current.style.left = `${event.offsetX + 12}px`;
        tooltipRef.current.style.top = `${event.offsetY - 8}px`;
      }, 200);
    }

    function hideTooltip() {
      if (tooltipTimer) {
        clearTimeout(tooltipTimer);
        tooltipTimer = null;
      }
      if (tooltipRef.current) {
        tooltipRef.current.style.display = "none";
      }
    }

    // Draw edges (z-order: edges first, nodes on top)
    const link = container
      .append("g")
      .attr("class", "edges")
      .selectAll("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", (d) => getEdgeColor(d.edgeType).color)
      .attr("stroke-opacity", (d) => getEdgeColor(d.edgeType).opacity)
      .attr("stroke-width", 1.5);

    // Draw node groups
    const drag = d3
      .drag<SVGGElement, SimNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        // Keep node pinned where it was dropped (user releases on drag end)
        // Double-click releases pin (handled below)
      });

    const node = container
      .append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes)
      .join("g")
      .attr("role", "button")
      .attr("tabindex", "0")
      .attr(
        "aria-label",
        (d) =>
          `${d.name}, ${d.isBridge ? "bridge" : d.status} concept, ${d.visitCount} visit${d.visitCount === 1 ? "" : "s"}. Press to view details.`
      )
      .style("cursor", "pointer")
      .call(drag);

    // Transparent hit circle for 44px minimum touch target
    node
      .append("circle")
      .attr("r", (d) => Math.max(getNodeRadius(d) + 10, 22))
      .attr("fill", "transparent")
      .attr("stroke", "none")
      .style("pointer-events", "all");

    // Visible circle
    node
      .append("circle")
      .attr("r", (d) => getNodeRadius(d))
      .attr("fill", (d) => getNodeColor(d))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);

    // Node label
    node
      .append("text")
      .text((d) => d.name)
      .attr("text-anchor", "middle")
      .attr("dy", (d) => getNodeRadius(d) + 14)
      .style("font-size", "12px")
      .style("font-family", "Inter, ui-sans-serif, system-ui, sans-serif")
      .style("font-weight", "400")
      .style("fill", "currentColor")
      .style("pointer-events", "none")
      .style("user-select", "none");

    // Click handler
    node.on("click", (event, d) => {
      event.stopPropagation();
      onNodeClickRef.current(d.id);
    });

    // Keyboard handler (Enter/Space to open side panel)
    node.on("keydown", (event: KeyboardEvent, d) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onNodeClickRef.current(d.id);
      }
    });

    // Double-click to release pin
    node.on("dblclick", (event, d) => {
      event.stopPropagation();
      d.fx = null;
      d.fy = null;
      simulation.alpha(0.3).restart();
    });

    // Hover tooltip (desktop only)
    node
      .on("mouseover", (event: MouseEvent, d) => showTooltip(event, d))
      .on("mousemove", (event: MouseEvent, d) => showTooltip(event, d))
      .on("mouseout", () => hideTooltip());

    // Simulation tick: update positions
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);

      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // CRITICAL cleanup: stop simulation and clear SVG on unmount
    return () => {
      if (tooltipTimer) clearTimeout(tooltipTimer);
      simulation.stop();
      svg.selectAll("*").remove();
    };
  }, [nodes, edges]);

  function resetZoom() {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(300)
      .call(zoomRef.current.transform, d3.zoomIdentity);
  }

  return (
    <div className="relative w-full" style={{ height: "calc(100vh - 120px)" }}>
      <svg
        ref={svgRef}
        className="w-full h-full"
        role="img"
        aria-label={`Knowledge graph showing ${nodes.length} concept${nodes.length === 1 ? "" : "s"}`}
      />
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        role="tooltip"
        style={{
          position: "absolute",
          display: "none",
          pointerEvents: "none",
          background: "#18181b",
          color: "#fff",
          borderRadius: "6px",
          padding: "4px 10px",
          fontSize: "14px",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          fontWeight: 400,
          whiteSpace: "nowrap",
          zIndex: 10,
        }}
      />
      {/* Zoom reset button */}
      <button
        onClick={resetZoom}
        aria-label="Reset graph zoom"
        style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          width: "44px",
          height: "44px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff",
          border: "1px solid #e4e4e7",
          borderRadius: "8px",
          cursor: "pointer",
          zIndex: 10,
        }}
      >
        <Maximize2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
