import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: {
    sourcemap: true,
  },
  sourcemap: true,
  outDir: "dist",
  watch: process.env.NODE_ENV === "development",
  ignoreWatch: ["dist"],
  tsconfig: "./tsconfig.json",
  external: [],
  clean: true,
});
