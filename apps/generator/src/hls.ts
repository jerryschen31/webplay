/**
 * Milestone 0 playlist builder (notes/phase1-feature1.md revision):
 * pre-renders a channel rotation offline — crossfades N tracks with
 * ffmpeg, chops the result into VOD HLS segments, and uploads playlist
 * + segments to the webplay-stream R2 bucket for the edge worker.
 * Replaced by live Liquidsoap mixing when the droplet lands.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

const AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".m4a", ".aac", ".flac"]);

interface HlsArgs {
  inDir: string;
  channel: string;
  crossfadeSec: number;
  outDir: string;
  upload: boolean;
}

function parseCliArgs(argv: string[]): HlsArgs {
  const { values } = parseArgs({
    args: argv,
    options: {
      in: { type: "string", short: "i" },
      channel: { type: "string", short: "c" },
      crossfade: { type: "string", short: "x" },
      out: { type: "string", short: "o" },
      upload: { type: "boolean", short: "u" },
    },
  });
  if (!values.in) {
    console.error(
      "usage: pnpm hls --in <dir-of-tracks> [--channel lofi] [--crossfade 3] [--out dir] [--upload]",
    );
    process.exit(2);
  }
  const crossfadeSec = Number(values.crossfade ?? "3");
  if (!Number.isFinite(crossfadeSec) || crossfadeSec < 0) {
    console.error(`invalid --crossfade: ${values.crossfade}`);
    process.exit(2);
  }
  const channel = values.channel ?? "lofi";
  return {
    inDir: resolve(values.in),
    channel,
    crossfadeSec,
    outDir: resolve(values.out ?? `./hls-out/${channel}`),
    upload: values.upload ?? false,
  };
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-800)}`));
    });
  });
}

/**
 * Chain acrossfade pairwise: [0][1]→a1, [a1][2]→a2, … producing one
 * continuous stream with `crossfadeSec` overlap at each boundary.
 */
export function buildCrossfadeFilter(
  trackCount: number,
  crossfadeSec: number,
): string {
  if (trackCount < 2) return "";
  const parts: string[] = [];
  let prev = "0:a";
  for (let i = 1; i < trackCount; i++) {
    const label = i === trackCount - 1 ? "out" : `a${i}`;
    parts.push(
      `[${prev}][${i}:a]acrossfade=d=${crossfadeSec}:c1=tri:c2=tri[${label}]`,
    );
    prev = label;
  }
  return parts.join(";");
}

async function uploadToR2(
  channel: string,
  outDir: string,
  files: string[],
): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN not set");
  }
  for (const file of files) {
    const body = await readFile(join(outDir, file));
    const key = encodeURIComponent(`${channel}/${file}`);
    const contentType = file.endsWith(".m3u8")
      ? "application/vnd.apple.mpegurl"
      : "video/mp2t";
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/webplay-stream/objects/${key}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": contentType,
        },
        body,
      },
    );
    if (!res.ok) {
      throw new Error(
        `upload failed for ${file}: HTTP ${res.status} ${await res.text()}`,
      );
    }
    console.error(`[hls] uploaded ${channel}/${file} (${body.length} bytes)`);
  }
}

async function main(): Promise<void> {
  const rootEnv = resolve(import.meta.dirname, "../../../.env");
  if (existsSync(rootEnv)) {
    process.loadEnvFile(rootEnv);
  }
  const args = parseCliArgs(process.argv.slice(2));

  const entries = await readdir(args.inDir);
  const tracks = entries
    .filter((f) => AUDIO_EXTENSIONS.has(extname(f).toLowerCase()))
    .sort()
    .map((f) => join(args.inDir, f));
  if (tracks.length === 0) {
    console.error(`no audio files found in ${args.inDir}`);
    process.exit(1);
  }

  await mkdir(args.outDir, { recursive: true });
  const inputArgs = tracks.flatMap((t) => ["-i", t]);
  const filter = buildCrossfadeFilter(tracks.length, args.crossfadeSec);
  const mapArgs =
    tracks.length >= 2 ? ["-filter_complex", filter, "-map", "[out]"] : [];

  console.error(
    `[hls] ${tracks.length} tracks, ${args.crossfadeSec}s crossfade -> ${args.outDir}`,
  );
  await runFfmpeg([
    "-y",
    ...inputArgs,
    ...mapArgs,
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-f",
    "hls",
    "-hls_time",
    "4",
    "-hls_playlist_type",
    "vod",
    "-hls_segment_filename",
    join(args.outDir, "seg-%05d.ts"),
    join(args.outDir, "playlist.m3u8"),
  ]);

  const produced = (await readdir(args.outDir)).filter(
    (f) => f.endsWith(".ts") || f.endsWith(".m3u8"),
  );
  if (args.upload) {
    await uploadToR2(args.channel, args.outDir, produced.sort());
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        channel: args.channel,
        tracks: tracks.length,
        segments: produced.filter((f) => f.endsWith(".ts")).length,
        outDir: args.outDir,
        uploaded: args.upload,
        streamUrl: args.upload
          ? `https://stream.webplay.io/stream/${args.channel}/playlist.m3u8`
          : null,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error("[hls] failed:", err);
  process.exit(1);
});
