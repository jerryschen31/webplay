import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Home from "../app/page.js";

// hls.js touches browser globals at import time in some builds; keep the
// unit test hermetic (effects never run in static SSR anyway).
vi.mock("hls.js", () => ({ default: { isSupported: () => false } }));

describe("Home page", () => {
  it("renders the webplay landing content", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("webplay");
    expect(html).toContain("always on");
  });

  it("lists every channel and defaults to lofi", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("Lofi Beats for Study");
    expect(html).toContain("Calm Music for Sleep");
    expect(html).toContain("Jazz for Lounging");
    expect(html).toContain("AI radio, always on.");
    expect(html).not.toContain("Lofi beats for study —");
    expect(html).toContain("lofi-beats-1.jpg");
  });
});
