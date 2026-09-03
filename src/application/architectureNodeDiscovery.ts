import type { ArchitectureGraph, ArchitectureNode, NodeKind } from "../domain/architectureGraph.js";

export type ArchitectureNodeDiscovery = {
  readonly schemaVersion: 1;
  readonly query: string;
  readonly request: {
    readonly kinds: readonly NodeKind[];
    readonly limit: number;
  };
  readonly matches: readonly ArchitectureNode[];
};

const normalize = (value: string): string => value.toLocaleLowerCase("en-US");

const identifierWords = (identifier: string): readonly string[] =>
  normalize(identifier.replaceAll(/([a-z\d])([A-Z])/g, "$1 $2")).split(/[^a-z\d]+/);

const matchRank = (node: ArchitectureNode, query: string): number | undefined => {
  const id = normalize(node.id);
  if (id === query) return 0;
  if (id.startsWith(query)) return 1;
  if (identifierWords(node.id).includes(query)) return 2;
  if (id.includes(query)) return 3;
  if (node.sourceLocation && normalize(node.sourceLocation.file).includes(query)) return 4;
  if (node.source && normalize(node.source).includes(query)) return 5;
  return undefined;
};

export const findArchitectureNodes = (
  graph: ArchitectureGraph,
  query: string,
  kinds: readonly NodeKind[],
  limit: number,
): ArchitectureNodeDiscovery => {
  const normalizedQuery = normalize(query.trim());
  if (!normalizedQuery) throw new Error("Discovery query must not be empty");

  const matches = graph.nodes
    .map((node) => ({ node, rank: matchRank(node, normalizedQuery) }))
    .filter(
      (candidate): candidate is { node: ArchitectureNode; rank: number } =>
        candidate.rank !== undefined && kinds.includes(candidate.node.kind),
    )
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        normalize(left.node.id).localeCompare(normalize(right.node.id), "en-US") ||
        left.node.id.localeCompare(right.node.id, "en-US"),
    )
    .slice(0, limit)
    .map(({ node }) => node);

  return {
    schemaVersion: 1,
    query,
    request: { kinds, limit },
    matches,
  };
};

export const serializeArchitectureNodeDiscovery = (discovery: ArchitectureNodeDiscovery): string =>
  JSON.stringify(discovery, null, 2);
