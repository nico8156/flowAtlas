export type ArchitectureGraph = {
  nodes: unknown[];
  edges: unknown[];
};

export const createArchitectureGraph = (): ArchitectureGraph => ({
  nodes: [],
  edges: [],
});
