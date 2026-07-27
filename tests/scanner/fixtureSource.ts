import { readFile } from "node:fs/promises";

export const readFixture = (fileName: string): Promise<string> =>
  readFile(new URL(`../fixtures/${fileName}`, import.meta.url), "utf8");
