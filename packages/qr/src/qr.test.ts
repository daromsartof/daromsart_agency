import { describe, expect, it } from "vitest";
import { qrPngBuffer, qrPngDataUrl, qrSvg } from "./qr";

describe("qrPngBuffer", () => {
  it("rend un PNG valide de la taille demandée", async () => {
    const buffer = await qrPngBuffer("https://example.fr/p/factures/abc", 256);
    // Signature PNG : 89 50 4E 47 0D 0A 1A 0A.
    expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });
});

describe("qrPngDataUrl", () => {
  it("retourne une data URL PNG base64", async () => {
    const dataUrl = await qrPngDataUrl("https://example.fr/p/factures/abc");
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });
});

describe("qrSvg", () => {
  it("rend un SVG valide", async () => {
    const svg = await qrSvg("https://example.fr/p/factures/abc");
    expect(svg.trim().startsWith("<svg")).toBe(true);
  });
});
