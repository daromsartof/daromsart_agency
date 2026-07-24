/** Builders de payloads QR (générateur app) — formats standards scannables. */

export type QrContentType =
  | "url"
  | "vcard"
  | "pdf"
  | "images"
  | "social"
  | "video"
  | "text"
  | "business"
  | "facebook"
  | "wifi"
  | "app"
  | "menu";

export type SocialPlatform = "linkedin" | "instagram" | "x" | "youtube" | "tiktok";

export type WifiEncryption = "WPA" | "WEP" | "nopass";

/** Préfixe `https://` si le schéma est absent ; trim ; `null` si vide. */
export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function buildUrlPayload(url: string): string | null {
  return normalizeUrl(url);
}

export function buildTextPayload(text: string): string | null {
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export interface WifiPayloadInput {
  ssid: string;
  password?: string;
  encryption?: WifiEncryption;
  hidden?: boolean;
}

/** Format WIFI:T:…;S:…;P:…;H:…;; (échappement `;`, `,`, `\`, `"`). */
export function buildWifiPayload(input: WifiPayloadInput): string | null {
  const ssid = input.ssid.trim();
  if (!ssid) return null;
  const encryption: WifiEncryption =
    input.encryption ?? (input.password?.trim() ? "WPA" : "nopass");
  const password = encryption === "nopass" ? "" : (input.password ?? "").trim();
  if (encryption !== "nopass" && !password) return null;

  const escape = (value: string) =>
    value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/"/g, '\\"');

  const hidden = input.hidden ? "true" : "false";
  return `WIFI:T:${encryption};S:${escape(ssid)};P:${escape(password)};H:${hidden};;`;
}

export interface VCardPayloadInput {
  firstName?: string;
  lastName?: string;
  organization?: string;
  phone?: string;
  email?: string;
  url?: string;
}

/** vCard 3.0 minimale (FN obligatoire via first+last ou organization). */
export function buildVCardPayload(input: VCardPayloadInput): string | null {
  const first = (input.firstName ?? "").trim();
  const last = (input.lastName ?? "").trim();
  const org = (input.organization ?? "").trim();
  const fn = [first, last].filter(Boolean).join(" ") || org;
  if (!fn) return null;

  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${last};${first};;;`, `FN:${fn}`];
  if (org) lines.push(`ORG:${org}`);
  const phone = (input.phone ?? "").trim();
  if (phone) lines.push(`TEL;TYPE=CELL:${phone}`);
  const email = (input.email ?? "").trim();
  if (email) lines.push(`EMAIL:${email}`);
  const url = normalizeUrl(input.url ?? "");
  if (url) lines.push(`URL:${url}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

const SOCIAL_BASE: Record<SocialPlatform, string> = {
  linkedin: "https://www.linkedin.com/in/",
  instagram: "https://www.instagram.com/",
  x: "https://x.com/",
  youtube: "https://www.youtube.com/@",
  tiktok: "https://www.tiktok.com/@",
};

/** Handle (`@user` / `user`) ou URL complète → URL profil. */
export function buildSocialPayload(
  platform: SocialPlatform,
  handleOrUrl: string,
): string | null {
  const raw = handleOrUrl.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, "");
  if (!handle) return null;
  return `${SOCIAL_BASE[platform]}${encodeURIComponent(handle).replace(/%40/g, "@")}`;
}

export function buildFacebookPayload(pageUrlOrId: string): string | null {
  const raw = pageUrlOrId.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://www.facebook.com/${encodeURIComponent(raw)}`;
}

export interface AppPayloadInput {
  iosUrl?: string;
  androidUrl?: string;
}

/** Une URL store, ou les deux séparées par un saut de ligne. */
export function buildAppPayload(input: AppPayloadInput): string | null {
  const ios = normalizeUrl(input.iosUrl ?? "");
  const android = normalizeUrl(input.androidUrl ?? "");
  if (ios && android) return `${ios}\n${android}`;
  return ios ?? android;
}

export interface BusinessPayloadInput {
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
}

/** Texte multi-lignes page pro (scan → affichage brut). */
export function buildBusinessPayload(input: BusinessPayloadInput): string | null {
  const name = input.name.trim();
  if (!name) return null;
  const lines = [name];
  const phone = (input.phone ?? "").trim();
  if (phone) lines.push(`Tél : ${phone}`);
  const email = (input.email ?? "").trim();
  if (email) lines.push(`Email : ${email}`);
  const website = normalizeUrl(input.website ?? "");
  if (website) lines.push(website);
  const address = (input.address ?? "").trim();
  if (address) lines.push(address);
  return lines.join("\n");
}
