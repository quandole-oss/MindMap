"use server";

import { auth } from "@/lib/auth";
import { db, schema } from "@mindmap/db";
import { eq, and, inArray, or } from "drizzle-orm";
import { findTopBridgeNode } from "@/lib/graph/centrality";

export interface GraphNode {
  id: string;
  name: string;
  domain: string;
  status: "unprobed" | "healthy" | "misconception";
  visitCount: number;
  isBridge: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  edgeType: string;
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

  const edges: GraphEdge[] = rawEdges.map((e) => ({
    source: e.sourceConceptId,
    target: e.targetConceptId,
    edgeType: e.edgeType,
  }));

  // Detect bridge node via betweenness centrality (T-03-13: O(V*E), server-side only)
  const bridge = findTopBridgeNode(
    concepts.map((c) => ({ id: c.id, domain: c.domain })),
    edges.map((e) => ({ source: e.source, target: e.target }))
  );

  const nodes: GraphNode[] = concepts.map((c) => ({
    id: c.id,
    name: c.name,
    domain: c.domain,
    status: c.status as "unprobed" | "healthy" | "misconception",
    visitCount: c.visitCount,
    isBridge: bridge !== null && c.id === bridge.nodeId,
  }));

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
