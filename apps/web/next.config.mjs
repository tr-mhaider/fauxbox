import { dirname } from "path";
import { fileURLToPath } from "url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the tracing root to this app so the monorepo's other lockfiles don't
  // confuse workspace-root inference.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  // Proxy the Go API in dev so the browser sees same-origin requests and the
  // SameSite=Lax auth cookies flow. In prod the Go server serves this app at
  // the same origin, so no rewrite is needed. Override the target with
  // API_PROXY_TARGET.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET ?? "http://localhost:8025";
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
