import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AudioPlayer } from "../components/AudioPlayer";

// hls.js touches browser globals at import time in some builds; keep the
// unit test hermetic (effects never run in static SSR anyway).
vi.mock("hls.js", () => ({ default: { isSupported: () => false } }));

describe("AudioPlayer", () => {
  it("renders a paused play button initially", () => {
    const html = renderToStaticMarkup(<AudioPlayer />);
    expect(html).toContain('aria-label="Play"');
    expect(html).toContain("<audio");
    expect(html).not.toContain('aria-label="Pause"');
  });
});
