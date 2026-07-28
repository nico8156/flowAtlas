import { Box, Text, useApp, useInput } from "ink";
import { useMemo, useState } from "react";

import type { NodeKind } from "../domain/architectureGraph.js";
import type { GraphProjection } from "../domain/graphProjection.js";
import { buildTerminalView } from "./terminalVisualizer.js";

type Pane = "explorer" | "map" | "inspector";

type TerminalTuiProps = {
  readonly projection: GraphProjection;
  readonly initialSelectedNodeId?: string;
};

const paneOrder: readonly Pane[] = ["explorer", "map", "inspector"];
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

export const TerminalTui = ({ projection, initialSelectedNodeId }: TerminalTuiProps) => {
  const { exit } = useApp();
  const [activePane, setActivePane] = useState<Pane>("explorer");
  const [searchMode, setSearchMode] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(() => {
    const index = projection.nodes.findIndex((node) => node.id === initialSelectedNodeId);
    return index >= 0 ? index : 0;
  });
  const [selectedNodeId, setSelectedNodeId] = useState(initialSelectedNodeId);

  const view = useMemo(
    () => buildTerminalView(projection, selectedNodeId, query),
    [projection, query, selectedNodeId],
  );
  const cursorNode = view.visibleNodes[cursor] ?? view.visibleNodes[0];

  useInput((input, key) => {
    if (searchMode) {
      if (key.escape) {
        setSearchMode(false);
        return;
      }

      if (key.return) {
        if (cursorNode) setSelectedNodeId(cursorNode.id);
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

    if (key.tab) {
      setActivePane((current) => {
        const nextPane = paneOrder[(paneOrder.indexOf(current) + 1) % paneOrder.length];
        return nextPane ?? current;
      });
      return;
    }

    if (activePane !== "explorer") return;

    if (input === "/") {
      setSearchMode(true);
      return;
    }

    if (key.upArrow || input === "k") {
      setCursor((current) => Math.max(0, current - 1));
    }

    if (key.downArrow || input === "j") {
      setCursor((current) => Math.min(view.visibleNodes.length - 1, current + 1));
    }

    if (key.return && cursorNode) {
      setSelectedNodeId(cursorNode.id);
    }
  });

  return (
    <Box flexDirection="column" height="100%" width="100%" padding={1}>
      <Box flexDirection="row" flexGrow={1}>
        <Box
          borderColor={activePane === "explorer" ? theme.selection : theme.muted}
          borderStyle="single"
          flexDirection="column"
          paddingX={1}
          width="25%"
        >
          <Text color={activePane === "explorer" ? theme.selection : theme.foreground} bold>
            {paneTitle("Explorer", activePane === "explorer")}
          </Text>
          <Text color={searchMode ? theme.selection : theme.muted}>
            {searchMode ? `/${query}` : "/ search"}
          </Text>
          {view.visibleNodes.map((node, index) => (
            <Text
              color={node.kind in theme ? theme[node.kind as keyof typeof theme] : theme.foreground}
              key={node.id}
            >
              {index === cursor ? ">" : " "} [{markerFor(node.kind)}] {node.id}
            </Text>
          ))}
        </Box>

        <Box
          borderColor={activePane === "map" ? theme.selection : theme.muted}
          borderStyle="single"
          flexDirection="column"
          paddingX={1}
          width="50%"
        >
          <Text color={activePane === "map" ? theme.selection : theme.foreground} bold>
            {paneTitle("Map", activePane === "map")}
          </Text>
          {view.mapLines.map((line, index) => (
            <Text key={`${line}-${index}`}>{line}</Text>
          ))}
        </Box>

        <Box
          borderColor={activePane === "inspector" ? theme.selection : theme.muted}
          borderStyle="single"
          flexDirection="column"
          paddingX={1}
          width="25%"
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
      </Box>
      <Box borderColor={theme.muted} borderStyle="single" paddingX={1}>
        <Text color={theme.muted}>/ search tab pane ↑↓/jk navigate enter select q quit</Text>
      </Box>
    </Box>
  );
};
