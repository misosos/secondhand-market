import { stripHtml } from "./sanitize";

describe("stripHtml", () => {
  it("removes script tags entirely, not just neuters them", () => {
    expect(stripHtml('hello <script>alert(1)</script> world')).toBe("hello  world");
  });

  it("removes arbitrary HTML tags since bio/chat are plain text only", () => {
    expect(stripHtml("<b>bold</b> and <i>italic</i>")).toBe("bold and italic");
  });

  it("strips tag attributes too (e.g. onerror handlers on img)", () => {
    expect(stripHtml('<img src=x onerror="alert(1)">')).toBe("");
  });

  it("leaves plain text completely untouched", () => {
    expect(stripHtml("just a normal message, no markup here")).toBe("just a normal message, no markup here");
  });
});
