export type RoutingDecision =
  | { mode: "enrich" }
  | { mode: "diagnose"; misconceptionId: string; probability: number };

export function routeQuestion(): RoutingDecision {
  throw new Error("Router not implemented — see Phase 2");
}
