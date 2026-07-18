import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "../app/page.js";

describe("Home page", () => {
  it("renders the webplay landing content", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("webplay");
    expect(html).toContain("always on");
  });
});
