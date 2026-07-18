import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AudioPlayer, fadeVolumeFor } from "../components/AudioPlayer";

// hls.js touches browser globals at import time in some builds; keep the
// unit test hermetic (effects never run in static SSR anyway).
vi.mock("hls.js", () => ({ default: { isSupported: () => false } }));

describe("fadeVolumeFor", () => {
  it("holds full volume outside the fade window and ramps to silence", () => {
    expect(fadeVolumeFor(30)).toBe(1);
    expect(fadeVolumeFor(4)).toBe(1);
    expect(fadeVolumeFor(2)).toBe(0.5);
    expect(fadeVolumeFor(1)).toBe(0.25);
    expect(fadeVolumeFor(0)).toBe(0);
    expect(fadeVolumeFor(-0.1)).toBe(0);
  });
});

describe("AudioPlayer", () => {
  it("renders a paused play button initially", () => {
    const html = renderToStaticMarkup(<AudioPlayer />);
    expect(html).toContain('aria-label="Play"');
    expect(html).toContain("<audio");
    expect(html).not.toContain('aria-label="Pause"');
  });
});
