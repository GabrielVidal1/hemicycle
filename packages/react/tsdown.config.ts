import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  watch: process.env.NODE_ENV === "development",
  ignoreWatch: ["dist"],
  tsconfig: "./tsconfig.json",
  external: [],
  exports: true,
});
