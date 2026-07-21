import { describe, expect, it } from "vitest";
import { isQuoteExpired } from "./expiry";

describe("isQuoteExpired", () => {
  it("n'est pas expiré sans date de validité", () => {
    expect(isQuoteExpired(null)).toBe(false);
  });

  it("n'est pas expiré avant la fin de la journée de validité", () => {
    const validUntil = new Date("2026-08-20T00:00:00.000Z");
    const now = new Date("2026-08-20T23:59:00.000Z");
    expect(isQuoteExpired(validUntil, now)).toBe(false);
  });

  it("est expiré juste après la fin de la journée de validité", () => {
    const validUntil = new Date("2026-08-20T00:00:00.000Z");
    const now = new Date("2026-08-21T00:00:01.000Z");
    expect(isQuoteExpired(validUntil, now)).toBe(true);
  });

  it("n'est pas expiré exactement à la limite (23:59:59.999)", () => {
    const validUntil = new Date("2026-08-20T00:00:00.000Z");
    const now = new Date("2026-08-20T23:59:59.999Z");
    expect(isQuoteExpired(validUntil, now)).toBe(false);
  });
});
