import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  external: ["typescript"],
  dts: true,
  clean: true,
  sourcemap: true,
});
