declare module "node:fs/promises" {
  export function readFile(file: string | URL, encoding: "utf8"): Promise<string>;
}
