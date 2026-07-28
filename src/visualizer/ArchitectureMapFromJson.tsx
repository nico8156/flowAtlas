import { deserializeArchitectureGraph } from "../application/architectureGraphJson.js";
import { ArchitectureMap } from "./ArchitectureMap.js";

export const ArchitectureMapFromJson = ({ json }: { json: string }) => (
  <ArchitectureMap graph={deserializeArchitectureGraph(json)} />
);
