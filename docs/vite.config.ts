import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

/**
 * Dev-only same-origin image proxy so remote panorama URLs without usable CORS
 * (e.g. Access-Control-Allow-Origin: null) can still load into WebGL textures.
 */
function remoteImageCorsProxy(): Plugin {
  const prefix = "/__cors-image";

  return {
    name: "docs-remote-image-cors-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(prefix)) {
          next();
          return;
        }

        try {
          const requestUrl = new URL(req.url, "http://localhost");
          const target = requestUrl.searchParams.get("url");
          if (!target || !/^https?:\/\//i.test(target)) {
            res.statusCode = 400;
            res.end("Missing or invalid url query parameter");
            return;
          }

          const upstream = await fetch(target);
          if (!upstream.ok) {
            res.statusCode = upstream.status;
            res.end(`Upstream fetch failed: ${upstream.status}`);
            return;
          }

          const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
          const buffer = Buffer.from(await upstream.arrayBuffer());
          res.statusCode = 200;
          res.setHeader("Content-Type", contentType);
          res.setHeader("Cache-Control", "public, max-age=300");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.end(buffer);
        } catch (error) {
          res.statusCode = 502;
          res.end(error instanceof Error ? error.message : "Proxy fetch failed");
        }
      });
    },
  };
}

export default defineConfig({
  // GitHub Pages project site: /<repo>/ ; local/dev keeps "/"
  base: process.env.DOCS_BASE_PATH || "/",
  plugins: [react(), remoteImageCorsProxy()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 5273,
    fs: {
      // Allow serving built package assets from the monorepo root dist/
      allow: [resolve(__dirname, "..")],
    },
  },
});
