import { describe, expect, it, vi } from "vitest";
import {
  reportError,
  sanitizeErrorPayload,
  type ErrorLogSender,
} from "./errorLog";

describe("sanitizeErrorPayload — dataminimerings-hvidliste", () => {
  it("beholder kun message/component/age_skin, uanset ekstra felter i input", () => {
    // Simulerer en kalder UDEN typesikkerhed (fx en ren JS-fejl et sted i
    // kodebasen) der ved en fejl sender persondata med — hvidlisten skal
    // stadig holde, uanset hvad TypeScript ville have fanget ved compile-time.
    const inputFromUntypedCaller = {
      message: "TypeError: x is undefined",
      component: "MatchPairsGame",
      ageSkin: "mid",
      profileId: "b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42",
      displayName: "Ali",
    } as unknown as Parameters<typeof sanitizeErrorPayload>[0];

    const result = sanitizeErrorPayload(inputFromUntypedCaller);

    expect(result).toEqual({
      message: "TypeError: x is undefined",
      component: "MatchPairsGame",
      age_skin: "mid",
    });
    expect(Object.keys(result).sort()).toEqual(["age_skin", "component", "message"]);
    expect(result).not.toHaveProperty("profileId");
    expect(result).not.toHaveProperty("displayName");
  });

  it("falder tilbage til en generisk besked hvis message mangler eller er tom", () => {
    expect(sanitizeErrorPayload({ message: "" }).message).toBe("Ukendt fejl");
    // @ts-expect-error — tester runtime-adfærd for ugyldigt input
    expect(sanitizeErrorPayload({ message: undefined }).message).toBe("Ukendt fejl");
  });

  it("afkorter message til maks 500 tegn", () => {
    const long = "x".repeat(900);
    const result = sanitizeErrorPayload({ message: long });
    expect(result.message.length).toBe(500);
  });

  it("afkorter component til maks 100 tegn", () => {
    const long = "C".repeat(300);
    const result = sanitizeErrorPayload({ message: "fejl", component: long });
    expect(result.component?.length).toBe(100);
  });

  it("sætter component til null hvis den ikke er angivet", () => {
    expect(sanitizeErrorPayload({ message: "fejl" }).component).toBeNull();
  });

  it("sætter age_skin til null ved ugyldig eller manglende værdi", () => {
    expect(sanitizeErrorPayload({ message: "fejl" }).age_skin).toBeNull();
    expect(
      // @ts-expect-error — tester runtime-adfærd for ugyldigt input
      sanitizeErrorPayload({ message: "fejl", ageSkin: "grown_up" }).age_skin,
    ).toBeNull();
  });

  it("accepterer alle tre gyldige aldersskind", () => {
    expect(sanitizeErrorPayload({ message: "fejl", ageSkin: "soft" }).age_skin).toBe("soft");
    expect(sanitizeErrorPayload({ message: "fejl", ageSkin: "mid" }).age_skin).toBe("mid");
    expect(sanitizeErrorPayload({ message: "fejl", ageSkin: "teen" }).age_skin).toBe("teen");
  });
});

describe("reportError — fail-soft-adfærd", () => {
  it("kalder sender med det sanitized payload, ikke det rå input", async () => {
    const sender: ErrorLogSender = vi.fn().mockResolvedValue({ error: null });

    await reportError(
      { message: "boom", component: "TegnBogstavetGame", ageSkin: "soft" },
      sender,
    );

    expect(sender).toHaveBeenCalledWith({
      message: "boom",
      component: "TegnBogstavetGame",
      age_skin: "soft",
    });
  });

  it("kaster ALDRIG videre når sender resolver med en fejl", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sender: ErrorLogSender = vi
      .fn()
      .mockResolvedValue({ error: { message: "RLS afviste indsættelsen" } });

    await expect(reportError({ message: "boom" }, sender)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("kaster ALDRIG videre når sender selv smider en exception (netværk nede)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sender: ErrorLogSender = vi.fn().mockRejectedValue(new Error("network down"));

    await expect(reportError({ message: "boom" }, sender)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("kaster ALDRIG videre når sender smider synkront", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sender: ErrorLogSender = vi.fn().mockImplementation(() => {
      throw new Error("synkron fejl i sender");
    });

    await expect(reportError({ message: "boom" }, sender)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
