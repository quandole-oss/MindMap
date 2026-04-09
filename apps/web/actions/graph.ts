"use server";

import { auth } from "@/lib/auth";
import { db, schema, getEdgeCoOccurrences } from "@mindmap/db";
import { eq, and, inArray, or } from "drizzle-orm";
import { computeBetweennessCentrality, findTopBridgeNode } from "@/lib/graph/centrality";
import { generateObject } from "ai";
import { createLLMAdapter } from "@mindmap/llm";
import { z } from "zod";

export interface GraphNode {
  id: string;
  name: string;
  domain: string;
  status: "unprobed" | "healthy" | "misconception";
  visitCount: number;
  isBridge: boolean;
  degree: number;
  betweenness: number;
  importance: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  edgeType: string;
  weight: number;
}

export async function getGraphData(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  // T-03-07: userId from session only — never from client params
  const concepts = await db.query.concepts.findMany({
    where: eq(schema.concepts.userId, session.user.id),
    columns: {
      id: true,
      name: true,
      domain: true,
      status: true,
      visitCount: true,
    },
  });

  if (concepts.length === 0) {
    return { nodes: [], edges: [] };
  }

  const conceptIds = concepts.map((c) => c.id);

  // Query edges where source or target belongs to this user's concepts
  const rawEdges = await db
    .select()
    .from(schema.conceptEdges)
    .where(
      or(
        inArray(schema.conceptEdges.sourceConceptId, conceptIds),
        inArray(schema.conceptEdges.targetConceptId, conceptIds)
      )
    );

  const edgePairs = rawEdges.map((e) => ({
    source: e.sourceConceptId,
    target: e.targetConceptId,
    edgeType: e.edgeType,
  }));

  // Compute degree per node
  const degreeMap = new Map<string, number>();
  for (const id of conceptIds) degreeMap.set(id, 0);
  for (const e of edgePairs) {
    degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1);
    degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1);
  }

  // Compute full betweenness centrality map (T-03-13: O(V*E), server-side only)
  const centralityMap = computeBetweennessCentrality(
    conceptIds,
    edgePairs.map((e) => ({ source: e.source, target: e.target }))
  );

  // Detect bridge node — reuse precomputed centrality to avoid double computation
  const bridge = findTopBridgeNode(
    concepts.map((c) => ({ id: c.id, domain: c.domain })),
    edgePairs.map((e) => ({ source: e.source, target: e.target })),
    centralityMap
  );

  // Co-occurrence counts for edge weight
  const coOccurrences = await getEdgeCoOccurrences(conceptIds);

  // Normalize all metrics to [0..1]
  const degreeValues = Array.from(degreeMap.values());
  const centralityValues = Array.from(centralityMap.values());
  const maxDegree = (degreeValues.length > 0 ? Math.max(...degreeValues) : 0) || 1;
  const maxBetweenness = (centralityValues.length > 0 ? Math.max(...centralityValues) : 0) || 1;
  const maxVisitCount = Math.max(...concepts.map((c) => c.visitCount)) || 1;
  const coValues = Array.from(coOccurrences.values());
  const maxCoOccurrence = coValues.length > 0 ? Math.max(...coValues) : 1;

  const nodes: GraphNode[] = concepts.map((c) => {
    const isBridge = bridge !== null && c.id === bridge.nodeId;
    const normDegree = (degreeMap.get(c.id) ?? 0) / maxDegree;
    const normBetweenness = (centralityMap.get(c.id) ?? 0) / maxBetweenness;
    const normVisitCount = c.visitCount / maxVisitCount;
    const rawImportance =
      0.35 * normDegree +
      0.30 * normBetweenness +
      0.25 * normVisitCount +
      0.10 * (isBridge ? 1 : 0);
    const importance = Math.pow(rawImportance, 0.6);

    return {
      id: c.id,
      name: c.name,
      domain: c.domain,
      status: c.status as "unprobed" | "healthy" | "misconception",
      visitCount: c.visitCount,
      isBridge,
      degree: degreeMap.get(c.id) ?? 0,
      betweenness: normBetweenness,
      importance,
    };
  });

  // Build importance lookup for edge weight computation
  const importanceMap = new Map<string, number>();
  for (const n of nodes) importanceMap.set(n.id, n.importance);

  const edges: GraphEdge[] = edgePairs.map((e) => {
    // Co-occurrence signal
    const key = e.source < e.target ? `${e.source}:${e.target}` : `${e.target}:${e.source}`;
    const rawCo = coOccurrences.get(key) ?? 0;
    const normCo = maxCoOccurrence > 0 ? rawCo / maxCoOccurrence : 0;

    // Endpoint importance signal — avg of connected nodes
    const srcImp = importanceMap.get(e.source) ?? 0;
    const tgtImp = importanceMap.get(e.target) ?? 0;
    const endpointAvg = (srcImp + tgtImp) / 2;

    // Edge type bonus: bridge edges always strong
    const typeBonus = e.edgeType === "bridge" ? 0.3 : e.edgeType === "misconception_cluster" ? 0.15 : 0;

    // Blend: 30% co-occurrence + 50% endpoint importance + 20% type bonus
    const weight = Math.min(0.30 * normCo + 0.50 * endpointAvg + 0.20 * (typeBonus / 0.3), 1);
    return { ...e, weight: Math.max(weight, 0.05) };
  });

  return { nodes, edges };
}

export async function getNodeDetails(
  conceptId: string
): Promise<{
  concept: { name: string; domain: string; status: string; visitCount: number };
  exchanges: Array<{ questionText: string; aiResponse: string | null; createdAt: Date | null }>;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  // T-03-08: Include userId check — user cannot access another student's concept details
  const concept = await db.query.concepts.findFirst({
    where: and(
      eq(schema.concepts.id, conceptId),
      eq(schema.concepts.userId, session.user.id)
    ),
  });

  if (!concept) {
    throw new Error("Concept not found or access denied");
  }

  // Get all questions linked to this concept via the conceptQuestions join table
  const conceptQuestionLinks = await db.query.conceptQuestions.findMany({
    where: eq(schema.conceptQuestions.conceptId, conceptId),
  });

  const questionIds = conceptQuestionLinks.map((cq) => cq.questionId);

  let exchanges: Array<{ questionText: string; aiResponse: string | null; createdAt: Date | null }> = [];

  if (questionIds.length > 0) {
    const questions = await db
      .select({
        text: schema.questions.text,
        aiResponse: schema.questions.aiResponse,
        createdAt: schema.questions.createdAt,
      })
      .from(schema.questions)
      .where(
        and(
          inArray(schema.questions.id, questionIds),
          // Additional safety: only questions belonging to this user
          eq(schema.questions.userId, session.user.id)
        )
      )
      .orderBy(schema.questions.createdAt);

    exchanges = questions.map((q) => ({
      questionText: q.text,
      aiResponse: q.aiResponse,
      createdAt: q.createdAt,
    }));
  }

  return {
    concept: {
      name: concept.name,
      domain: concept.domain,
      status: concept.status,
      visitCount: concept.visitCount,
    },
    exchanges,
  };
}

/**
 * Get the top bridge node info for the weekly "surprise connection" toast.
 * T-03-11: userId sourced from auth() session only — never from client params.
 */
export async function getBridgeConnection(): Promise<{
  bridgeNodeId: string;
  bridgeNodeName: string;
  domainA: string;
  domainB: string;
} | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const concepts = await db.query.concepts.findMany({
    where: eq(schema.concepts.userId, session.user.id),
    columns: { id: true, name: true, domain: true },
  });

  if (concepts.length < 3) {
    return null;
  }

  const conceptIds = concepts.map((c) => c.id);

  const rawEdges = await db
    .select()
    .from(schema.conceptEdges)
    .where(
      or(
        inArray(schema.conceptEdges.sourceConceptId, conceptIds),
        inArray(schema.conceptEdges.targetConceptId, conceptIds)
      )
    );

  if (rawEdges.length < 2) {
    return null;
  }

  const edges = rawEdges.map((e) => ({
    source: e.sourceConceptId,
    target: e.targetConceptId,
  }));

  const bridge = findTopBridgeNode(
    concepts.map((c) => ({ id: c.id, domain: c.domain })),
    edges
  );

  if (!bridge) {
    return null;
  }

  const bridgeNode = concepts.find((c) => c.id === bridge.nodeId);
  if (!bridgeNode) {
    return null;
  }

  return {
    bridgeNodeId: bridge.nodeId,
    bridgeNodeName: bridgeNode.name,
    domainA: bridge.connectedDomains[0],
    domainB: bridge.connectedDomains[1],
  };
}

/**
 * Search nodes using natural language via Claude.
 * Takes a query and the list of concept names, returns matching concept IDs.
 */
export async function searchNodes(
  query: string,
  nodes: Array<{ id: string; name: string; domain: string }>
): Promise<string[]> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  if (nodes.length === 0 || !query.trim()) return [];

  const adapter = createLLMAdapter();
  const model = adapter.getModel();

  const nodeList = nodes
    .map((n, i) => `${i}. "${n.name}" (${n.domain})`)
    .join("\n");

  const { object } = await generateObject({
    model,
    schema: z.object({
      matchingIndices: z.array(z.number()).describe("Indices of concepts that match the search query"),
    }),
    prompt: `You are helping a student search their knowledge graph. Given the search query and list of concepts, return the indices of ALL concepts that are relevant to the query. Be inclusive — if a concept is even loosely related, include it.

Search query: "${query}"

Concepts:
${nodeList}

Return the indices (numbers) of matching concepts.`,
  });

  return object.matchingIndices
    .filter((i) => i >= 0 && i < nodes.length)
    .map((i) => nodes[i].id);
}
