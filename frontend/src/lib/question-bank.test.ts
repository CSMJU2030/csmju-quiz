import { describe, expect, it } from "vitest";
import { bankItemQueryString, parseCsv } from "./question-bank";

describe("bankItemQueryString", () => {
  it("sends only page and limit when no filter is set", () => {
    expect(bankItemQueryString({ page: 1, limit: 20 })).toBe("page=1&limit=20");
  });

  it("trims and encodes search/tag and adds difficulty", () => {
    const qs = new URLSearchParams(
      bankItemQueryString({
        page: 2,
        limit: 20,
        search: "  เครือข่าย ",
        tag: " บทที่ 2 ",
        difficulty: "HARD",
      }),
    );
    expect(qs.get("page")).toBe("2");
    expect(qs.get("search")).toBe("เครือข่าย");
    expect(qs.get("tag")).toBe("บทที่ 2");
    expect(qs.get("difficulty")).toBe("HARD");
  });

  it("drops blank filters", () => {
    const qs = new URLSearchParams(
      bankItemQueryString({ page: 1, limit: 20, search: "  ", tag: "", difficulty: "" }),
    );
    expect(qs.has("search")).toBe(false);
    expect(qs.has("tag")).toBe(false);
    expect(qs.has("difficulty")).toBe(false);
  });
});

describe("parseCsv", () => {
  it("skips rows whose answer index is out of range", () => {
    expect(parseCsv("Q,a,b,,,3")).toHaveLength(0);
    expect(parseCsv("Q,a,b,,,2,x|y")[0]?.tags).toEqual(["x", "y"]);
  });
});
