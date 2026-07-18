import { describe, expect, it } from "vitest";
import { buildCrossfadeFilter } from "../src/hlslib.js";

describe("buildCrossfadeFilter", () => {
  it("returns empty for a single track", () => {
    expect(buildCrossfadeFilter(1, 3)).toBe("");
  });

  it("chains two tracks into one crossfade", () => {
    expect(buildCrossfadeFilter(2, 3)).toBe(
      "[0:a][1:a]acrossfade=d=3:c1=tri:c2=tri[out]",
    );
  });

  it("chains N tracks pairwise ending in [out]", () => {
    const filter = buildCrossfadeFilter(4, 2.5);
    expect(filter).toBe(
      "[0:a][1:a]acrossfade=d=2.5:c1=tri:c2=tri[a1];" +
        "[a1][2:a]acrossfade=d=2.5:c1=tri:c2=tri[a2];" +
        "[a2][3:a]acrossfade=d=2.5:c1=tri:c2=tri[out]",
    );
  });
});
