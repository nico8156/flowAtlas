import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli/scanWorker.ts"],
  format: ["esm"],
  external: ["typescript"],
  dts: true,
  clean: true,
  sourcemap: true,
});
