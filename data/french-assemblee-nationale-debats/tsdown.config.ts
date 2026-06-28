import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  outDir: "dist",
  watch: process.env.NODE_ENV === "development",
  ignoreWatch: ["dist", "data", "public"],
});
