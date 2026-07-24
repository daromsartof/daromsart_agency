import { describe, expect, it } from "vitest";
import {
  buildAppPayload,
  buildBusinessPayload,
  buildFacebookPayload,
  buildSocialPayload,
  buildTextPayload,
  buildUrlPayload,
  buildVCardPayload,
  buildWifiPayload,
  normalizeUrl,
} from "./payloads";

describe("normalizeUrl", () => {
  it("préfixe https:// si besoin", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
  });
  it("conserve le schéma existant", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
  });
  it("null si vide", () => {
    expect(normalizeUrl("  ")).toBeNull();
  });
});

describe("buildUrlPayload", () => {
  it("normalise une URL", () => {
    expect(buildUrlPayload("daromsart.fr/menu")).toBe("https://daromsart.fr/menu");
  });
});

describe("buildTextPayload", () => {
  it("trim le texte", () => {
    expect(buildTextPayload("  hello  ")).toBe("hello");
  });
  it("null si vide", () => {
    expect(buildTextPayload("")).toBeNull();
  });
});

describe("buildWifiPayload", () => {
  it("encode WPA avec SSID/mot de passe", () => {
    expect(buildWifiPayload({ ssid: "Maison", password: "secret" })).toBe(
      "WIFI:T:WPA;S:Maison;P:secret;H:false;;",
    );
  });
  it("échappe ; dans le SSID", () => {
    expect(buildWifiPayload({ ssid: "Foo;Bar", password: "x", encryption: "WPA" })).toBe(
      "WIFI:T:WPA;S:Foo\\;Bar;P:x;H:false;;",
    );
  });
  it("nopass sans mot de passe", () => {
    expect(buildWifiPayload({ ssid: "Open", encryption: "nopass" })).toBe(
      "WIFI:T:nopass;S:Open;P:;H:false;;",
    );
  });
  it("null sans SSID", () => {
    expect(buildWifiPayload({ ssid: "" })).toBeNull();
  });
});

describe("buildVCardPayload", () => {
  it("construit une vCard 3.0", () => {
    const vcard = buildVCardPayload({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: "+33123456789",
      organization: "Analytical Engines",
      url: "analytical.example",
    });
    expect(vcard).toContain("BEGIN:VCARD");
    expect(vcard).toContain("FN:Ada Lovelace");
    expect(vcard).toContain("N:Lovelace;Ada;;;");
    expect(vcard).toContain("EMAIL:ada@example.com");
    expect(vcard).toContain("URL:https://analytical.example");
    expect(vcard).toContain("END:VCARD");
  });
  it("accepte org seule comme FN", () => {
    expect(buildVCardPayload({ organization: "Acme" })).toContain("FN:Acme");
  });
  it("null sans identité", () => {
    expect(buildVCardPayload({})).toBeNull();
  });
});

describe("buildSocialPayload", () => {
  it("construit une URL Instagram depuis un handle", () => {
    expect(buildSocialPayload("instagram", "@daromsart")).toBe(
      "https://www.instagram.com/daromsart",
    );
  });
  it("conserve une URL complète", () => {
    expect(buildSocialPayload("x", "https://x.com/foo")).toBe("https://x.com/foo");
  });
});

describe("buildFacebookPayload", () => {
  it("préfixe facebook.com", () => {
    expect(buildFacebookPayload("daromsart")).toBe("https://www.facebook.com/daromsart");
  });
});

describe("buildAppPayload", () => {
  it("une seule URL iOS", () => {
    expect(buildAppPayload({ iosUrl: "apps.apple.com/app/id1" })).toBe(
      "https://apps.apple.com/app/id1",
    );
  });
  it("deux stores sur deux lignes", () => {
    expect(
      buildAppPayload({
        iosUrl: "https://apps.apple.com/a",
        androidUrl: "https://play.google.com/b",
      }),
    ).toBe("https://apps.apple.com/a\nhttps://play.google.com/b");
  });
});

describe("buildBusinessPayload", () => {
  it("compose un texte multi-lignes", () => {
    const text = buildBusinessPayload({
      name: "Daroms'Art",
      phone: "01 23 45 67 89",
      website: "daromsart.fr",
    });
    expect(text).toBe("Daroms'Art\nTél : 01 23 45 67 89\nhttps://daromsart.fr");
  });
});
