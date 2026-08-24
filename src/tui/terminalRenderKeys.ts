export const relationRenderKey = (section: "in" | "out", line: string, index: number): string =>
  `${section}-${index}-${line}`;
