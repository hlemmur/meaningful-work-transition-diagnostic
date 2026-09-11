import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { LandingCover } from "./landing-cover";

function html(props: Parameters<typeof LandingCover>[0]) {
  return renderToStaticMarkup(createElement(LandingCover, props));
}

describe("landing cover", () => {
  it("reads as an editorial cover with mock checkout behind Begin the diagnostic", () => {
    const markup = html({ mock: true, canSell: false });

    expect(markup).toContain("Meaningful Work Transition Diagnostic");
    expect(markup).toMatch(/already know what they want/i);
    expect(markup).toMatch(/self-paced/i);
    expect(markup).toMatch(/chapters/i);
    expect(markup).toMatch(/private link/i);
    expect(markup).toMatch(/Lena reviews/i);
    expect(markup).toMatch(/report/i);
    expect(markup).toContain("href=\"/privacy\"");
    expect(markup).toContain("Begin the diagnostic");
    expect(markup).toContain("href=\"/mock/checkout\"");
    expect(markup).not.toContain("Continue in mock checkout");
    expect(markup).not.toContain("launch gate");
    expect(markup).not.toMatch(/\$|€|£|price/i);
  });

  it("uses calm customer-facing copy when live purchase is not open", () => {
    const markup = html({ mock: false, canSell: false });

    expect(markup).toMatch(/not open for purchase yet/i);
    expect(markup).not.toContain("launch gate");
    expect(markup).not.toContain("Begin the diagnostic");
    expect(markup).not.toMatch(/\$|€|£/i);
  });

  it("offers purchase without showing a price once live checkout exists", () => {
    const markup = html({
      mock: false,
      canSell: true,
      liveCheckoutUrl: "https://example.com/checkout",
    });

    expect(markup).toContain("Purchase the diagnostic");
    expect(markup).toContain("href=\"https://example.com/checkout\"");
    expect(markup).not.toMatch(/\$|€|£|price/i);
  });
});
