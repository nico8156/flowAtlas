declare module "node:fs/promises" {
  export function readFile(file: string | URL, encoding: "utf8"): Promise<string>;
}

declare module "node:fs" {
  export function existsSync(file: string | URL): boolean;
}

declare module "node:path" {
  export function resolve(...paths: string[]): string;
}

declare const process: {
  env: Record<string, string | undefined>;
};
