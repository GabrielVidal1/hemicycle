import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, existsSync, createReadStream } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEBATS_PUBLIC = resolve(
  HERE,
  "../../data/french-assemblee-nationale-debats/public",
);

/**
 * Serve the debates dataset (per-séance transcripts + per-law summaries) at
 * /debats: as dev middleware, and copied into dist/debats at build time. The
 * data lives in the @hemicycle/french-assemblee-nationale-debats package; this
 * keeps the large JSON out of the JS bundle while making it fetchable.
 */
function debatsData(): Plugin {
  return {
    name: "debats-data",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "").split("?")[0];
        if (!url.startsWith("/debats/")) return next();
        const file = resolve(DEBATS_PUBLIC, decodeURIComponent(url.slice("/debats/".length)));
        if (!file.startsWith(DEBATS_PUBLIC) || !existsSync(file)) {
          res.statusCode = 404;
          return res.end("not found");
        }
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      if (existsSync(DEBATS_PUBLIC)) {
        cpSync(DEBATS_PUBLIC, resolve(HERE, "dist/debats"), { recursive: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), debatsData()],
  server: { port: 5174 },
});
