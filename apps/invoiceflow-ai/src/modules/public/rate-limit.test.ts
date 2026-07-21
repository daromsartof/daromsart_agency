import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimit } from "./rate-limit";

beforeEach(() => {
  resetRateLimit();
});

describe("checkRateLimit", () => {
  it("autorise jusqu'à 30 requêtes dans la fenêtre, refuse la 31e", () => {
    const now = Date.now();
    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit("1.2.3.4", now)).toBe(true);
    }
    expect(checkRateLimit("1.2.3.4", now)).toBe(false);
  });

  it("réinitialise le compteur après la fenêtre de 60 s", () => {
    const now = Date.now();
    for (let i = 0; i < 30; i++) {
      checkRateLimit("1.2.3.4", now);
    }
    expect(checkRateLimit("1.2.3.4", now)).toBe(false);
    expect(checkRateLimit("1.2.3.4", now + 60_000)).toBe(true);
  });

  it("compte séparément par clé", () => {
    const now = Date.now();
    for (let i = 0; i < 30; i++) {
      checkRateLimit("1.2.3.4", now);
    }
    expect(checkRateLimit("1.2.3.4", now)).toBe(false);
    expect(checkRateLimit("5.6.7.8", now)).toBe(true);
  });
});
