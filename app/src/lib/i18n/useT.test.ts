import { describe, expect, it } from "vitest";
import { da } from "./da";
import { ar } from "./ar";
import { dirFor, useT } from "./useT";

describe("useT", () => {
  it("returnerer dansk ordbog som default", () => {
    expect(useT()).toBe(da);
  });

  it("returnerer dansk ordbog eksplicit", () => {
    expect(useT("da")).toBe(da);
  });

  it("returnerer arabisk ordbog", () => {
    expect(useT("ar")).toBe(ar);
  });
});

describe("dirFor", () => {
  it("dansk er ltr", () => {
    expect(dirFor("da")).toBe("ltr");
  });

  it("arabisk er rtl", () => {
    expect(dirFor("ar")).toBe("rtl");
  });
});

describe("da/ar nøgle-paritet (runtime-bevis oven på TS-typetjekket)", () => {
  const daRecord = da as unknown as Record<string, Record<string, unknown>>;
  const arRecord = ar as unknown as Record<string, Record<string, unknown>>;

  it("samme navnerum og nøgler i begge ordbøger", () => {
    for (const ns of Object.keys(daRecord)) {
      expect(Object.keys(arRecord[ns]).sort()).toEqual(
        Object.keys(daRecord[ns]).sort(),
      );
    }
  });

  it("ingen tom streng-oversættelse er sluppet igennem ved en fejl", () => {
    for (const ns of Object.keys(arRecord)) {
      for (const key of Object.keys(arRecord[ns])) {
        const value = arRecord[ns][key];
        if (typeof value === "string") {
          expect(value.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
