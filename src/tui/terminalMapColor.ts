const reset = "\u001b[39m";

const colors = {
  Event: "\u001b[38;2;102;217;239m",
  Handler: "\u001b[38;2;249;38;114m",
  State: "\u001b[38;2;166;226;46m",
  External: "\u001b[38;2;253;151;31m",
  relation: "\u001b[38;2;117;113;94m",
  selection: "\u001b[38;2;174;129;255m",
} as const;

const colorize = (value: string, color: string): string => `${color}${value}${reset}`;

export const colorizeTerminalMap = (lines: readonly string[]): readonly string[] =>
  lines.map((line) => {
    let colored = line.replace(/\[([EHSX])\]/g, (marker) => {
      const kind = { E: "Event", H: "Handler", S: "State", X: "External" }[marker[1] ?? ""] as
        keyof typeof colors | undefined;
      return kind ? colorize(marker, colors[kind]) : marker;
    });

    colored = colored.replace(/\b(LISTENS_TO|DISPATCHES|UPDATES|CALLS_EXTERNAL)\b/g, (relation) =>
      colorize(relation, colors.relation),
    );

    if (colored.trimStart().startsWith(">")) {
      colored = colored.replace(">", colorize(">", colors.selection));
    }

    return colored;
  });
