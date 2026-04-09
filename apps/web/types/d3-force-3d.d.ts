/**
 * Minimal type declarations for d3-force-3d.
 * This package has no official @types package.
 * Typed to match the API used in use-graph-layout.ts.
 */
declare module "d3-force-3d" {
  export interface SimulationNode {
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number | null;
    fy?: number | null;
    fz?: number | null;
    [key: string]: unknown;
  }

  export interface SimulationLink<N extends SimulationNode = SimulationNode> {
    source: string | N;
    target: string | N;
    [key: string]: unknown;
  }

  export interface Simulation<N extends SimulationNode = SimulationNode> {
    force(name: string, force?: Force): this;
    stop(): this;
    tick(iterations?: number): this;
    alpha(alpha?: number): this | number;
    alphaMin(alpha?: number): this | number;
    alphaDecay(decay?: number): this | number;
    alphaTarget(target?: number): this | number;
    velocityDecay(decay?: number): this | number;
    nodes(): N[];
    nodes(nodes: N[]): this;
    on(type: string, listener: (event?: unknown) => void): this;
    restart(): this;
    numDimensions(n?: number): this;
  }

  export interface Force {
    [key: string]: unknown;
  }

  export interface LinkForce extends Force {
    id(fn: (d: unknown) => string): this;
    distance(d: number | ((link: unknown) => number)): this;
    strength(s: number | ((link: unknown) => number)): this;
  }

  export interface ManyBodyForce extends Force {
    strength(s: number | ((node: unknown) => number)): this;
    theta(t: number): this;
    distanceMin(d: number): this;
    distanceMax(d: number): this;
  }

  export interface CollideForce extends Force {
    radius(r: number | ((node: unknown) => number)): this;
    strength(s: number): this;
    iterations(n: number): this;
  }

  export interface CenterForce extends Force {
    x(x?: number): this;
    y(y?: number): this;
    z(z?: number): this;
    strength(s: number): this;
  }

  export function forceSimulation<N = SimulationNode>(
    nodes?: N[],
    numDimensions?: number
  ): Simulation<N & SimulationNode>;

  export function forceLink<N extends SimulationNode>(
    links?: SimulationLink<N>[]
  ): LinkForce;

  export function forceManyBody(): ManyBodyForce;

  export function forceCenter(x?: number, y?: number, z?: number): CenterForce;

  export function forceCollide(
    radius?: number | ((node: unknown) => number)
  ): CollideForce;

  export function forceX(x?: number | ((node: unknown) => number)): Force;
  export function forceY(y?: number | ((node: unknown) => number)): Force;
  export function forceZ(z?: number | ((node: unknown) => number)): Force;
  export function forceRadial(
    radius: number | ((node: unknown) => number),
    x?: number,
    y?: number,
    z?: number
  ): Force;
}
