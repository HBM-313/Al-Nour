import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetDeviceRoster,
  getChildRoster,
  rememberChildInRoster,
} from "./childRoster";

beforeEach(() => {
  localStorage.clear();
});

describe("rememberChildInRoster / getChildRoster", () => {
  it("gemmer og henter en enkelt profil", () => {
    rememberChildInRoster({ profileId: "ali", displayName: "Ali", avatar: "🦁", hasPin: true });

    expect(getChildRoster()).toEqual([
      { profileId: "ali", displayName: "Ali", avatar: "🦁", hasPin: true },
    ]);
  });

  it("flere søskende samles i samme roster", () => {
    rememberChildInRoster({ profileId: "ali", displayName: "Ali", avatar: "🦁", hasPin: true });
    rememberChildInRoster({ profileId: "zainab", displayName: "Zainab", avatar: "🐰", hasPin: false });

    const roster = getChildRoster();
    expect(roster).toHaveLength(2);
    expect(roster.map((e) => e.profileId).sort()).toEqual(["ali", "zainab"]);
  });

  it("et gentaget login for samme profil OPDATERER posten, opretter ikke en dublet", () => {
    rememberChildInRoster({ profileId: "ali", displayName: "Ali", avatar: "🦁", hasPin: true });
    rememberChildInRoster({ profileId: "ali", displayName: "Ali", avatar: "🐸", hasPin: false });

    const roster = getChildRoster();
    expect(roster).toHaveLength(1);
    expect(roster[0]).toEqual({ profileId: "ali", displayName: "Ali", avatar: "🐸", hasPin: false });
  });

  it("aldrig noget udover profileId/displayName/avatar/hasPin bevares — ALDRIG pin_hash o.l.", () => {
    rememberChildInRoster({
      profileId: "ali",
      displayName: "Ali",
      avatar: "🦁",
      hasPin: true,
      // @ts-expect-error — tester runtime-adfærd hvis en kalder alligevel sender ekstra felter
      pin_hash: "$2a$hemmelig",
    });

    const stored = localStorage.getItem("nour_child_roster_v2");
    expect(stored).not.toContain("hemmelig");
    expect(stored).not.toContain("pin_hash");
  });
});

describe("forgetDeviceRoster (\"Glem denne enhed\")", () => {
  it("rydder hele rosteren", () => {
    rememberChildInRoster({ profileId: "ali", displayName: "Ali", avatar: "🦁", hasPin: true });
    rememberChildInRoster({ profileId: "zainab", displayName: "Zainab", avatar: "🐰", hasPin: false });

    forgetDeviceRoster();

    expect(getChildRoster()).toEqual([]);
  });
});

describe("Fail-soft ved korrupt eller utilgængeligt lager", () => {
  it("korrupt JSON i localStorage giver en tom liste i stedet for at kaste", () => {
    localStorage.setItem("nour_child_roster_v2", "{ ikke json");
    expect(getChildRoster()).toEqual([]);
  });

  it("et lagret objekt der ikke er et array giver en tom liste", () => {
    localStorage.setItem("nour_child_roster_v2", JSON.stringify({ not: "an array" }));
    expect(getChildRoster()).toEqual([]);
  });

  it("ugyldige poster i arrayet filtreres væk, gyldige poster bevares", () => {
    localStorage.setItem(
      "nour_child_roster_v2",
      JSON.stringify([
        { profileId: "ali", displayName: "Ali", avatar: "🦁", hasPin: true },
        { profileId: "", displayName: "Tom id", hasPin: false },
        { displayName: "Mangler profileId", hasPin: false },
        "ikke engang et objekt",
      ]),
    );
    expect(getChildRoster()).toEqual([
      { profileId: "ali", displayName: "Ali", avatar: "🦁", hasPin: true },
    ]);
  });

  it("gamle v1-poster uden hasPin filtreres væk (bevidst ren afskæring, ingen gætning)", () => {
    localStorage.setItem(
      "nour_child_roster_v1",
      JSON.stringify([{ profileId: "ali", displayName: "Ali", avatar: "🦁" }]),
    );
    // v2-nøglen er tom — v1-data læses aldrig, uanset indhold.
    expect(getChildRoster()).toEqual([]);
  });

  it("kaster ikke når localStorage.setItem fejler (fx privat browsing/kvote)", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });

    expect(() =>
      rememberChildInRoster({ profileId: "ali", displayName: "Ali", avatar: "🦁", hasPin: true }),
    ).not.toThrow();

    spy.mockRestore();
  });
});
