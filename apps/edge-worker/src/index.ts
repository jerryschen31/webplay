/**
 * webplay edge worker — serves HLS playlists and audio segments for
 * stream.webplay.io from the webplay-stream R2 bucket, cached at the
 * Cloudflare edge (see notes/phase1-feature3.md).
 */

/** Structural subset of the R2 binding this worker relies on. */
export interface StreamBucket {
  get(key: string): Promise<{
    body: ReadableStream;
    etag: string;
  } | null>;
}

export interface Env {
  STREAM_BUCKET: StreamBucket;
}

export interface StreamPath {
  channel: string;
  file: string;
}

/**
 * GET /stream/{channel}/{file} — anything else is null. Only playlist
 * and segment extensions are servable, so unrelated bucket objects can
 * never leak through this route.
 */
export function parseStreamPath(pathname: string): StreamPath | null {
  const match = pathname.match(
    /^\/stream\/([a-z0-9-]+)\/([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*\.(?:m3u8|ts|aac))$/,
  );
  if (!match?.[1] || !match[2]) return null;
  return { channel: match[1], file: match[2] };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, If-None-Match",
  "Access-Control-Expose-Headers": "ETag",
} as const;

/**
 * Playlists mutate constantly and must never be served stale (listeners
 * would fetch deleted segments); segments are immutable once written.
 */
export function headersFor(file: string): Record<string, string> {
  if (file.endsWith(".m3u8")) {
    return {
      ...CORS_HEADERS,
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "public, max-age=2, must-revalidate",
    };
  }
  const contentType = file.endsWith(".ts")
    ? "video/mp2t"
    : file.endsWith(".aac")
      ? "audio/aac"
      : "application/octet-stream";
  return {
    ...CORS_HEADERS,
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=300, immutable",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed", {
        status: 405,
        headers: { ...CORS_HEADERS, Allow: "GET, HEAD, OPTIONS" },
      });
    }
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const parsed = parseStreamPath(url.pathname);
    if (!parsed) {
      return new Response("not found", { status: 404, headers: CORS_HEADERS });
    }

    const object = await env.STREAM_BUCKET.get(
      `${parsed.channel}/${parsed.file}`,
    );
    if (!object) {
      return new Response("not found", { status: 404, headers: CORS_HEADERS });
    }

    return new Response(request.method === "HEAD" ? null : object.body, {
      headers: { ...headersFor(parsed.file), ETag: object.etag },
    });
  },
};
