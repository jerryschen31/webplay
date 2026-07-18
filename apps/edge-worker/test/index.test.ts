import { describe, expect, it, vi } from "vitest";
import worker, { type Env, headersFor, parseStreamPath } from "../src/index.js";

function envWith(objects: Record<string, string>): Env {
  return {
    STREAM_BUCKET: {
      get: vi.fn(async (key: string) => {
        const body = objects[key];
        if (body === undefined) return null;
        return {
          body: new Response(body).body as ReadableStream,
          etag: `etag-${key}`,
        };
      }),
    },
  };
}

describe("parseStreamPath", () => {
  it("parses channel and file", () => {
    expect(parseStreamPath("/stream/lofi/playlist.m3u8")).toEqual({
      channel: "lofi",
      file: "playlist.m3u8",
    });
    expect(parseStreamPath("/stream/lofi/seg-00042.ts")).toEqual({
      channel: "lofi",
      file: "seg-00042.ts",
    });
  });

  it("rejects traversal, nesting, and junk", () => {
    expect(parseStreamPath("/stream/lofi/../secret")).toBeNull();
    expect(parseStreamPath("/stream/lofi/a/b.m3u8")).toBeNull();
    expect(parseStreamPath("/stream/LOFI/playlist.m3u8")).toBeNull();
    expect(parseStreamPath("/other/lofi/playlist.m3u8")).toBeNull();
    expect(parseStreamPath("/stream/lofi/")).toBeNull();
  });

  it("rejects non-playlist/segment extensions", () => {
    expect(parseStreamPath("/stream/lofi/secret.txt")).toBeNull();
    expect(parseStreamPath("/stream/lofi/backup.wav")).toBeNull();
    expect(parseStreamPath("/stream/lofi/playlist.m3u8.bak")).toBeNull();
    expect(parseStreamPath("/stream/lofi/.m3u8")).toBeNull();
    expect(parseStreamPath("/stream/lofi/x.v1.m3u8")).toEqual({
      channel: "lofi",
      file: "x.v1.m3u8",
    });
  });
});

describe("headersFor", () => {
  it("marks playlists never-stale and segments immutable", () => {
    expect(headersFor("playlist.m3u8")["Cache-Control"]).toContain(
      "must-revalidate",
    );
    expect(headersFor("seg-1.ts")["Cache-Control"]).toContain("immutable");
    expect(headersFor("seg-1.aac")["Content-Type"]).toBe("audio/aac");
    expect(headersFor("playlist.m3u8")["Content-Type"]).toBe(
      "application/vnd.apple.mpegurl",
    );
  });
});

describe("fetch handler", () => {
  it("serves an existing playlist with CORS and ETag", async () => {
    const env = envWith({ "lofi/playlist.m3u8": "#EXTM3U\n" });
    const res = await worker.fetch(
      new Request("https://stream.webplay.io/stream/lofi/playlist.m3u8"),
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("#EXTM3U\n");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("ETag")).toBe("etag-lofi/playlist.m3u8");
  });

  it("404s on missing objects and bad paths", async () => {
    const env = envWith({});
    const missing = await worker.fetch(
      new Request("https://stream.webplay.io/stream/lofi/playlist.m3u8"),
      env,
    );
    expect(missing.status).toBe(404);
    const bad = await worker.fetch(
      new Request("https://stream.webplay.io/nope"),
      env,
    );
    expect(bad.status).toBe(404);
  });

  it("answers /health and OPTIONS without touching the bucket", async () => {
    const env = envWith({});
    const health = await worker.fetch(
      new Request("https://stream.webplay.io/health"),
      env,
    );
    expect(health.status).toBe(200);
    const preflight = await worker.fetch(
      new Request("https://stream.webplay.io/stream/lofi/x.ts", {
        method: "OPTIONS",
      }),
      env,
    );
    expect(preflight.status).toBe(204);
    expect(env.STREAM_BUCKET.get).not.toHaveBeenCalled();
  });

  it("rejects non-GET methods with CORS and Allow headers", async () => {
    const res = await worker.fetch(
      new Request("https://stream.webplay.io/stream/lofi/x.ts", {
        method: "POST",
      }),
      envWith({}),
    );
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET, HEAD, OPTIONS");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("preflight advertises Range and exposes ETag", async () => {
    const res = await worker.fetch(
      new Request("https://stream.webplay.io/stream/lofi/x.ts", {
        method: "OPTIONS",
      }),
      envWith({}),
    );
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Range");
    expect(res.headers.get("Access-Control-Expose-Headers")).toContain("ETag");
  });
});
