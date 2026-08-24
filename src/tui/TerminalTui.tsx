import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useEffect, useMemo, useState } from "react";

import type { NodeKind } from "../domain/architectureGraph.js";
import type { GraphProjection } from "../domain/graphProjection.js";
import { buildTerminalView, filterTerminalProjection } from "./terminalVisualizer.js";
import {
  createViewport,
  ensureNodeVisible,
  layoutNeighborhood,
  layoutProjection,
  panViewport,
  renderTerminalMap,
  type Density,
} from "./terminalMapLayout.js";

type Pane = "explorer" | "map" | "inspector";
type MapRepresentation = "territory" | "neighborhood";
export type ProjectionMode = "full" | "focus" | "upstream" | "downstream";

export type ProjectionChange = {
  readonly projection: GraphProjection;
  readonly mode: ProjectionMode;
  readonly rootNodeId: string;
};

type TerminalTuiProps = {
  readonly projection: GraphProjection;
  readonly initialSelectedNodeId?: string;
  readonly initialMode?: ProjectionMode;
  readonly projectFocus?: (nodeId: string) => ProjectionChange;
  readonly projectUpstream?: (nodeId: string) => ProjectionChange;
  readonly projectDownstream?: (nodeId: string) => ProjectionChange;
};

export type TerminalTuiLoadResult = {
  readonly projection: GraphProjection;
  readonly initialSelectedNodeId: string;
  readonly projectFocus?: (nodeId: string) => ProjectionChange;
  readonly projectUpstream?: (nodeId: string) => ProjectionChange;
  readonly projectDownstream?: (nodeId: string) => ProjectionChange;
};

type TerminalTuiLoaderProps = {
  readonly projectLabel: string;
  readonly load: () => Promise<TerminalTuiLoadResult>;
  readonly cancel?: () => void;
};

type ViewState = ProjectionChange & {
  readonly selectedNodeId: string | undefined;
  readonly nodeKinds: readonly NodeKind[];
};

const paneOrder: readonly Pane[] = ["explorer", "map", "inspector"];
const allNodeKinds: readonly NodeKind[] = ["Event", "Handler", "State", "External"];
const densities: readonly Density[] = ["compact", "normal", "detailed"];
const theme = {
  foreground: "#F8F8F2",
  muted: "#75715E",
  selection: "#AE81FF",
  Event: "#66D9EF",
  Handler: "#F92672",
  State: "#A6E22E",
  External: "#FD971F",
} as const;

const markerFor = (kind: NodeKind): string => (kind === "External" ? "X" : kind.slice(0, 1));

const paneTitle = (name: string, active: boolean): string => (active ? `${name} · active` : name);

const modeTitle = (mode: ProjectionMode, rootNodeId: string): string =>
  mode === "full" ? "FULL" : `${mode.toUpperCase()} · ${rootNodeId}`;

const LoaderShell = ({
  projectLabel,
  phase,
  message,
}: {
  readonly projectLabel: string;
  readonly phase: "loading" | "error";
  readonly message?: string | undefined;
}) => (
  <Box flexDirection="column" height="100%" width="100%" padding={1}>
    <Text color={theme.selection} bold>
      FlowAtlas · {phase === "loading" ? "ANALYZING PROJECT" : "ERROR"}
    </Text>
    <Text color={theme.muted}>{projectLabel}</Text>
    <Box flexDirection="row" flexGrow={1}>
      <Box
        borderColor={theme.muted}
        borderStyle="single"
        flexDirection="column"
        paddingX={1}
        width="25%"
      >
        <Text color={theme.foreground} bold>
          Explorer
        </Text>
        <Text color={theme.muted}>
          {phase === "loading" ? "Waiting for graph…" : "Unavailable"}
        </Text>
      </Box>
      <Box
        borderColor={theme.selection}
        borderStyle="single"
        flexDirection="column"
        paddingX={1}
        width="50%"
      >
        <Text color={theme.foreground} bold>
          Map
        </Text>
        <Text color={phase === "loading" ? theme.selection : theme.Event}>
          {phase === "loading" ? "Analyzing project…" : message}
        </Text>
      </Box>
      <Box
        borderColor={theme.muted}
        borderStyle="single"
        flexDirection="column"
        paddingX={1}
        width="25%"
      >
        <Text color={theme.foreground} bold>
          Inspector
        </Text>
        <Text color={theme.muted}>
          {phase === "loading" ? "Waiting for graph…" : "No node selected"}
        </Text>
      </Box>
    </Box>
    <Box borderColor={theme.muted} borderStyle="single" paddingX={1}>
      <Text color={theme.muted}>{phase === "loading" ? "q quit" : "q quit"}</Text>
    </Box>
  </Box>
);

export const TerminalTuiLoader = ({ projectLabel, load, cancel }: TerminalTuiLoaderProps) => {
  const { exit } = useApp();
  const [state, setState] = useState<
    | { readonly phase: "loading" }
    | { readonly phase: "ready"; readonly result: TerminalTuiLoadResult }
    | { readonly phase: "error"; readonly message: string }
  >({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    const loadAfterFirstFrame = setImmediate(() => {
      void load().then(
        (result) => {
          if (!cancelled) setState({ phase: "ready", result });
        },
        (error: unknown) => {
          if (!cancelled) {
            setState({
              phase: "error",
              message: error instanceof Error ? error.message : String(error),
            });
          }
        },
      );
    });

    return () => {
      cancelled = true;
      cancel?.();
      clearImmediate(loadAfterFirstFrame);
    };
  }, [cancel, load]);

  useInput(
    (input) => {
      if (state.phase !== "ready" && input === "q") exit();
    },
    { isActive: state.phase !== "ready" },
  );

  if (state.phase === "ready") {
    return <TerminalTui {...state.result} initialMode="full" />;
  }

  return (
    <LoaderShell
      projectLabel={projectLabel}
      phase={state.phase}
      message={state.phase === "error" ? state.message : undefined}
    />
  );
};

const nextVisibleSelection = (
  projection: GraphProjection,
  nodeKinds: readonly NodeKind[],
  selectedNodeId: string | undefined,
): string | undefined => {
  const filtered = filterTerminalProjection(projection, nodeKinds);
  return filtered.nodes.some((node) => node.id === selectedNodeId)
    ? selectedNodeId
    : filtered.nodes[0]?.id;
};

export const TerminalTui = ({
  projection,
  initialSelectedNodeId,
  initialMode = "full",
  projectFocus,
  projectUpstream,
  projectDownstream,
}: TerminalTuiProps) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [activePane, setActivePane] = useState<Pane>("map");
  const [searchMode, setSearchMode] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [density, setDensity] = useState<Density>("normal");
  const [mapRepresentation, setMapRepresentation] = useState<MapRepresentation>("territory");
  const [viewport, setViewport] = useState(() =>
    createViewport(Math.max(24, Math.floor((stdout.columns ?? 80) * 0.5) - 4), 16),
  );
  const [history, setHistory] = useState<readonly ViewState[]>([]);
  const [viewState, setViewState] = useState<ViewState>({
    projection,
    mode: initialMode,
    rootNodeId: initialSelectedNodeId ?? projection.nodes[0]?.id ?? "",
    selectedNodeId: initialSelectedNodeId,
    nodeKinds: allNodeKinds,
  });

  const filteredProjection = useMemo(
    () => filterTerminalProjection(viewState.projection, viewState.nodeKinds),
    [viewState.nodeKinds, viewState.projection],
  );
  const view = useMemo(
    () => buildTerminalView(filteredProjection, viewState.selectedNodeId, query),
    [filteredProjection, query, viewState.selectedNodeId],
  );
  const layout = useMemo(
    () =>
      mapRepresentation === "neighborhood" && viewState.selectedNodeId
        ? layoutNeighborhood(filteredProjection, viewState.selectedNodeId, { density })
        : layoutProjection(filteredProjection, { density }),
    [density, filteredProjection, mapRepresentation, viewState.selectedNodeId],
  );
  const cursorNode = view.visibleNodes[cursor] ?? view.visibleNodes[0];
  const mapWidth = Math.max(24, (stdout.columns ?? 80) - 4);
  const mapHeight = Math.max(8, (stdout.rows ?? 24) - 8);

  useEffect(() => {
    setViewport((current) => ({ ...current, width: mapWidth, height: mapHeight }));
  }, [mapHeight, mapWidth]);

  useEffect(() => {
    setViewport((current) => ensureNodeVisible(layout, current, viewState.selectedNodeId));
  }, [layout, viewState.selectedNodeId]);

  useEffect(() => {
    setViewState((current) => {
      const selectedNodeId = nextVisibleSelection(
        current.projection,
        current.nodeKinds,
        current.selectedNodeId,
      );
      return selectedNodeId === current.selectedNodeId ? current : { ...current, selectedNodeId };
    });
  }, [viewState.nodeKinds]);

  const changeProjection = (action: ((nodeId: string) => ProjectionChange) | undefined): void => {
    if (!action || !viewState.selectedNodeId) return;
    const next = action(viewState.selectedNodeId);
    setHistory((current) => [...current, viewState]);
    setViewState({
      ...next,
      selectedNodeId: next.rootNodeId,
      nodeKinds: viewState.nodeKinds,
    });
    setQuery("");
    setCursor(0);
  };

  useInput((input, key) => {
    if (searchMode) {
      if (key.escape || input === "\u001b") {
        setSearchMode(false);
        return;
      }
      if (key.return) {
        if (cursorNode) setViewState((current) => ({ ...current, selectedNodeId: cursorNode.id }));
        setActivePane("map");
        setSearchMode(false);
        return;
      }
      if (key.backspace || key.delete) {
        setQuery((current) => current.slice(0, -1));
        setCursor(0);
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setQuery((current) => current + input);
        setCursor(0);
      }
      return;
    }

    if (input === "q") {
      exit();
      return;
    }
    if (key.escape || input === "\u001b") {
      if (activePane !== "map") {
        setActivePane("map");
        setSearchMode(false);
        return;
      }
      const previous = history.at(-1);
      if (previous) {
        setHistory((current) => current.slice(0, -1));
        setViewState(previous);
        setQuery("");
        setCursor(0);
      }
      return;
    }
    if (input === "/" || input === "e") {
      setActivePane("explorer");
      setSearchMode(input === "/");
      return;
    }
    if (input === "i") {
      setActivePane("inspector");
      return;
    }
    if (input === "f") changeProjection(projectFocus);
    if (input === "u") changeProjection(projectUpstream);
    if (input === "d") changeProjection(projectDownstream);

    if (key.tab) {
      setActivePane((current) => {
        const nextPane = paneOrder[(paneOrder.indexOf(current) + 1) % paneOrder.length];
        return nextPane ?? current;
      });
      return;
    }

    if (activePane === "map") {
      if (input === "n") {
        setMapRepresentation("neighborhood");
        return;
      }
      if (input === "t") {
        setMapRepresentation("territory");
        return;
      }
      if (input === "h" || key.leftArrow)
        setViewport((current) => panViewport(current, { x: -4, y: 0 }));
      if (input === "l" || key.rightArrow)
        setViewport((current) => panViewport(current, { x: 4, y: 0 }));
      if (input === "k" || key.upArrow)
        setViewport((current) => panViewport(current, { x: 0, y: -2 }));
      if (input === "j" || key.downArrow)
        setViewport((current) => panViewport(current, { x: 0, y: 2 }));
      if (input === "+") {
        setDensity((current) => densities[densities.indexOf(current) + 1] ?? current);
      }
      if (input === "-") {
        setDensity((current) => densities[densities.indexOf(current) - 1] ?? current);
      }
      return;
    }

    if (activePane !== "explorer") return;
    if (input === "1" || input === "2" || input === "3" || input === "4") {
      const kind = allNodeKinds[Number(input) - 1];
      if (kind) {
        setViewState((current) => ({
          ...current,
          nodeKinds: current.nodeKinds.includes(kind)
            ? current.nodeKinds.filter((candidate) => candidate !== kind)
            : [...current.nodeKinds, kind],
        }));
        setCursor(0);
      }
      return;
    }
    if (input === "0") {
      setViewState((current) => ({ ...current, nodeKinds: allNodeKinds }));
      setCursor(0);
      return;
    }
    if (key.upArrow || input === "k") setCursor((current) => Math.max(0, current - 1));
    if (key.downArrow || input === "j") {
      setCursor((current) => Math.min(view.visibleNodes.length - 1, current + 1));
    }
    if (key.return && cursorNode) {
      setViewState((current) => ({ ...current, selectedNodeId: cursorNode.id }));
    }
  });

  return (
    <Box flexDirection="column" height="100%" width="100%" padding={1}>
      <Text color={theme.selection} bold>
        FlowAtlas · READY · {modeTitle(viewState.mode, viewState.rootNodeId)}
      </Text>
      <Box flexDirection="row" flexGrow={1}>
        {activePane === "explorer" && (
          <Box
            borderColor={theme.selection}
            borderStyle="single"
            flexDirection="column"
            paddingX={1}
            width="100%"
          >
            <Text color={activePane === "explorer" ? theme.selection : theme.foreground} bold>
              {paneTitle("Explorer", activePane === "explorer")}
            </Text>
            <Text color={searchMode ? theme.selection : theme.muted}>
              {searchMode ? `/${query}` : "/ search"}
            </Text>
            <Text color={theme.muted}>
              Kinds: {viewState.nodeKinds.map(markerFor).join(" ") || "none"} · 0 all
            </Text>
            {view.visibleNodes.map((node, index) => (
              <Text color={theme[node.kind]} key={node.id}>
                {index === cursor ? ">" : " "} [{markerFor(node.kind)}] {node.id}
              </Text>
            ))}
          </Box>
        )}
        {activePane === "map" && (
          <Box
            borderColor={theme.selection}
            borderStyle="single"
            flexDirection="column"
            paddingX={1}
            width="100%"
          >
            <Text color={activePane === "map" ? theme.selection : theme.foreground} bold>
              {paneTitle("Map", activePane === "map")}
            </Text>
            <Text color={theme.muted}>Representation: {mapRepresentation}</Text>
            <Text color={theme.muted}>Density: {density}</Text>
            {renderTerminalMap(layout, viewport, viewState.selectedNodeId).map((line, index) => (
              <Text key={`${line}-${index}`}>{line}</Text>
            ))}
          </Box>
        )}
        {activePane === "inspector" && (
          <Box
            borderColor={theme.selection}
            borderStyle="single"
            flexDirection="column"
            paddingX={1}
            width="100%"
          >
            <Text color={activePane === "inspector" ? theme.selection : theme.foreground} bold>
              {paneTitle("Inspector", activePane === "inspector")}
            </Text>
            {view.inspector.node ? (
              <>
                <Text bold>{view.inspector.node.id}</Text>
                <Text>Kind: {view.inspector.node.kind}</Text>
                <Text>
                  Source:{" "}
                  {view.inspector.node.sourceLocation
                    ? `${view.inspector.node.sourceLocation.file}:${view.inspector.node.sourceLocation.line}`
                    : "unavailable"}
                </Text>
                <Text>Incoming</Text>
                {view.inspector.incoming.map((line) => (
                  <Text key={`in-${line}`}>{line}</Text>
                ))}
                <Text>Outgoing</Text>
                {view.inspector.outgoing.map((line) => (
                  <Text key={`out-${line}`}>{line}</Text>
                ))}
              </>
            ) : (
              <Text>No node selected</Text>
            )}
          </Box>
        )}
      </Box>
      <Box borderColor={theme.muted} borderStyle="single" paddingX={1}>
        <Text color={theme.muted}>
          {activePane === "map"
            ? "e / explore   i inspect   n neighborhood   t territory   hjkl pan   +/- density   f focus   u upstream   d downstream   q quit"
            : activePane === "explorer"
              ? "↑↓/jk navigate   enter map   esc back   q quit"
              : "esc back   q quit"}
        </Text>
      </Box>
    </Box>
  );
};
