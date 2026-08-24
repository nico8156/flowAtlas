import type { ArchitectureEdge, ArchitectureNode } from "../domain/architectureGraph.js";
import type { GraphProjection } from "../domain/graphProjection.js";

export type Density = "compact" | "normal" | "detailed";

export type LayoutNode = ArchitectureNode & {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type LayoutGraph = {
  readonly nodes: readonly LayoutNode[];
  readonly edges: readonly ArchitectureEdge[];
};

export type Viewport = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export const calculateMapHeight = (terminalRows: number): number => Math.max(8, terminalRows - 12);

type LayoutOptions = {
  readonly density: Density;
};

const selectNeighborhood = (
  projection: GraphProjection,
  selectedNodeId: string,
): GraphProjection => {
  const connectedNodeIds = new Set<string>([selectedNodeId]);
  for (const edge of projection.edges) {
    if (edge.source === selectedNodeId || edge.target === selectedNodeId) {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    }
  }

  return {
    nodes: projection.nodes.filter((node) => connectedNodeIds.has(node.id)),
    edges: projection.edges.filter(
      (edge) => connectedNodeIds.has(edge.source) && connectedNodeIds.has(edge.target),
    ),
  };
};

type Point = {
  readonly x: number;
  readonly y: number;
};

const densityMetrics: Record<Density, { nodeWidth: number; columnGap: number; rowGap: number }> = {
  compact: { nodeWidth: 18, columnGap: 18, rowGap: 2 },
  normal: { nodeWidth: 26, columnGap: 18, rowGap: 4 },
  detailed: { nodeWidth: 36, columnGap: 22, rowGap: 6 },
};

const visualEdge = (edge: ArchitectureEdge): { source: string; target: string } =>
  edge.kind === "LISTENS_TO"
    ? { source: edge.target, target: edge.source }
    : { source: edge.source, target: edge.target };

const compareByProjectionOrder =
  (order: ReadonlyMap<string, number>) =>
  (left: string, right: string): number =>
    (order.get(left) ?? Number.MAX_SAFE_INTEGER) - (order.get(right) ?? Number.MAX_SAFE_INTEGER);

const assignLevels = (projection: GraphProjection): ReadonlyMap<string, number> => {
  const order = new Map(projection.nodes.map((node, index) => [node.id, index]));
  const nodeIds = new Set(projection.nodes.map((node) => node.id));
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, number>();

  for (const node of projection.nodes) {
    outgoing.set(node.id, []);
    incoming.set(node.id, 0);
  }

  for (const edge of projection.edges) {
    const rendered = visualEdge(edge);
    if (!nodeIds.has(rendered.source) || !nodeIds.has(rendered.target)) continue;
    outgoing.get(rendered.source)?.push(rendered.target);
    incoming.set(rendered.target, (incoming.get(rendered.target) ?? 0) + 1);
  }

  const roots = projection.nodes
    .filter((node) => incoming.get(node.id) === 0)
    .map((node) => node.id);
  const queue = roots.length > 0 ? [...roots] : projection.nodes.slice(0, 1).map((node) => node.id);
  const levels = new Map<string, number>();

  for (const root of queue) levels.set(root, 0);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const currentLevel = levels.get(current) ?? 0;

    for (const target of outgoing.get(current) ?? []) {
      const nextLevel = currentLevel + 1;
      if (levels.has(target)) continue;
      levels.set(target, nextLevel);
      queue.push(target);
    }
  }

  const maxLevel = Math.max(-1, ...levels.values());
  for (const node of projection.nodes) {
    if (!levels.has(node.id)) levels.set(node.id, maxLevel + 1);
  }

  return new Map(
    [...levels.entries()].sort(([left], [right]) => compareByProjectionOrder(order)(left, right)),
  );
};

const nodeDimensions = (
  node: ArchitectureNode,
  density: Density,
): { width: number; height: number } => {
  const metrics = densityMetrics[density];
  const markerWidth = 4;
  return {
    width: Math.max(metrics.nodeWidth, node.id.length + markerWidth),
    height: density === "compact" ? 1 : 3,
  };
};

export const layoutProjection = (
  projection: GraphProjection,
  { density }: LayoutOptions,
): LayoutGraph => {
  const levels = assignLevels(projection);
  const metrics = densityMetrics[density];
  const nodesByLevel = new Map<number, ArchitectureNode[]>();

  for (const node of projection.nodes) {
    const level = levels.get(node.id) ?? 0;
    const nodes = nodesByLevel.get(level) ?? [];
    nodes.push(node);
    nodesByLevel.set(level, nodes);
  }

  const positions = new Map<string, Point>();
  const levelWidths = new Map<number, number>();
  for (const [level, nodes] of nodesByLevel) {
    levelWidths.set(level, Math.max(...nodes.map((node) => nodeDimensions(node, density).width)));
  }

  const levelOffsets = new Map<number, number>();
  let nextColumn = 0;
  for (const level of [...levelWidths.keys()].sort((left, right) => left - right)) {
    levelOffsets.set(level, nextColumn);
    nextColumn += (levelWidths.get(level) ?? 0) + metrics.columnGap;
  }

  for (const [level, nodes] of nodesByLevel) {
    nodes.forEach((node, index) => {
      positions.set(node.id, {
        x: levelOffsets.get(level) ?? 0,
        y: index * metrics.rowGap,
      });
    });
  }

  return {
    nodes: projection.nodes.map((node) => {
      const position = positions.get(node.id) ?? { x: 0, y: 0 };
      const dimensions = nodeDimensions(node, density);
      return { ...node, ...position, ...dimensions };
    }),
    edges: projection.edges,
  };
};

export const layoutNeighborhood = (
  projection: GraphProjection,
  selectedNodeId: string,
  options: LayoutOptions,
): LayoutGraph => layoutProjection(selectNeighborhood(projection, selectedNodeId), options);

export const createViewport = (width: number, height: number): Viewport => ({
  x: 0,
  y: 0,
  width,
  height,
});

export const panViewport = (viewport: Viewport, delta: Point): Viewport => ({
  ...viewport,
  x: Math.max(0, viewport.x + delta.x),
  y: Math.max(0, viewport.y + delta.y),
});

const markerFor = (node: ArchitectureNode): string =>
  node.kind === "External" ? "X" : node.kind.slice(0, 1);

const visualEdgeForLayout = (edge: ArchitectureEdge): { source: string; target: string } =>
  edge.kind === "LISTENS_TO"
    ? { source: edge.target, target: edge.source }
    : { source: edge.source, target: edge.target };

const put = (canvas: string[][], x: number, y: number, value: string): void => {
  if (y < 0 || y >= canvas.length || x < 0 || x >= (canvas[y]?.length ?? 0)) return;
  const row = canvas[y];
  if (!row) return;
  for (const [offset, character] of [...value].entries()) {
    const position = x + offset;
    if (position >= 0 && position < row.length && row[position] === " ") {
      row[position] = character;
    }
  }
};

const putLabel = (canvas: string[][], x: number, y: number, value: string): void => {
  if (y < 0 || y >= canvas.length) return;
  const row = canvas[y];
  if (!row) return;
  for (const [offset, character] of [...value].entries()) {
    const position = x + offset;
    if (position >= 0 && position < row.length) row[position] = character;
  }
};

export const ensureNodeVisible = (
  layout: LayoutGraph,
  viewport: Viewport,
  nodeId: string | undefined,
): Viewport => {
  const node = layout.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return viewport;

  const x =
    node.x < viewport.x
      ? node.x
      : node.x + node.width > viewport.x + viewport.width
        ? node.x + node.width - viewport.width
        : viewport.x;
  const y =
    node.y < viewport.y
      ? node.y
      : node.y + node.height > viewport.y + viewport.height
        ? node.y + node.height - viewport.height
        : viewport.y;

  return { ...viewport, x: Math.max(0, x), y: Math.max(0, y) };
};

export const renderTerminalMap = (
  layout: LayoutGraph,
  viewport: Viewport,
  selectedNodeId?: string,
): readonly string[] => {
  const canvas = Array.from({ length: viewport.height }, () => Array(viewport.width).fill(" "));
  const visibleNodes = layout.nodes.filter(
    (node) =>
      node.x + node.width > viewport.x &&
      node.x < viewport.x + viewport.width &&
      node.y + node.height > viewport.y &&
      node.y < viewport.y + viewport.height,
  );
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));

  for (const edge of layout.edges) {
    const rendered = visualEdgeForLayout(edge);
    const source = nodeById.get(rendered.source);
    const target = nodeById.get(rendered.target);
    if (!source || !target) continue;

    const x1 = source.x + source.width - viewport.x;
    const x2 = target.x - viewport.x;
    const sourceY = source.y - viewport.y;
    const targetY = target.y - viewport.y;
    if (x2 <= x1 || targetY < 0 || targetY >= viewport.height) continue;

    if (sourceY !== targetY) {
      const firstY = Math.min(sourceY, targetY);
      const lastY = Math.max(sourceY, targetY);
      for (let y = firstY; y <= lastY; y += 1) put(canvas, x1, y, "│");
    }

    for (let x = x1; x < x2; x += 1) put(canvas, x, targetY, "─");
    const label = edge.kind;
    const labelX = x1 + Math.max(0, Math.floor((x2 - x1 - label.length) / 2));
    putLabel(canvas, labelX, targetY, label);
    put(canvas, x2 - 1, targetY, "▶");
  }

  for (const node of visibleNodes) {
    const label = `${node.id === selectedNodeId ? ">" : " "} [${markerFor(node)}] ${node.id}`;
    putLabel(canvas, node.x - viewport.x, node.y - viewport.y, label);
  }

  return canvas.map((row) => row.join("").trimEnd());
};
