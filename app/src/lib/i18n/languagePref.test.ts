import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLanguagePref, setLanguagePref } from "./languagePref";

describe("languagePref", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("default er dansk uden noget gemt", () => {
    expect(getLanguagePref()).toBe("da");
  });

  it("husker et gemt sprog", () => {
    setLanguagePref("ar");
    expect(getLanguagePref()).toBe("ar");
  });

  it("falder tilbage til dansk ved ugyldigt indhold i lageret", () => {
    window.localStorage.setItem("nour_adult_lang_v1", "fr");
    expect(getLanguagePref()).toBe("da");
  });

  it("fail-soft: fejlende localStorage.getItem giver dansk, ikke en kastet fejl", () => {
    const spy = vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(getLanguagePref()).toBe("da");
    spy.mockRestore();
  });

  it("fail-soft: fejlende localStorage.setItem kaster ikke videre", () => {
    const spy = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => setLanguagePref("ar")).not.toThrow();
    spy.mockRestore();
  });
});
