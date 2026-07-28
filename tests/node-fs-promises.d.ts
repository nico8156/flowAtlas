declare module "node:fs/promises" {
  export function readFile(file: string | URL, encoding: "utf8"): Promise<string>;
  export function readdir(
    path: string | URL,
    options: { withFileTypes: true },
  ): Promise<ReadonlyArray<{ name: string; isDirectory(): boolean }>>;
}

declare module "node:fs" {
  export function existsSync(file: string | URL): boolean;
}

declare module "node:path" {
  export function basename(path: string): string;
  export function extname(path: string): string;
  export function relative(from: string, to: string): string;
  export function resolve(...paths: string[]): string;
}

declare module "node:child_process" {
  export function execFile(
    file: string,
    arguments_: readonly string[],
    options: { cwd: string },
    callback: (error: Error | null, stdout: string, stderr: string) => void,
  ): void;
}

declare const process: {
  env: Record<string, string | undefined>;
  cwd(): string;
  argv: string[];
  execPath: string;
  stdout: { write(data: string): void };
  stderr: { write(data: string): void };
  exitCode?: number;
};
