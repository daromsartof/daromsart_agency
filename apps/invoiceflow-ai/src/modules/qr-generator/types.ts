import type { QrContentType, SocialPlatform, WifiEncryption } from "@daromsart/qr";

export type { QrContentType, SocialPlatform, WifiEncryption };

export interface QrDesignOptions {
  dotsColor: string;
  backgroundColor: string;
  logoDataUrl: string | null;
  margin: number;
}

/** Logo centré par défaut (icône ID Daroms'Art). */
export const DEFAULT_QR_LOGO = "/logo/qr-default-icon.png";

export const DEFAULT_DESIGN: QrDesignOptions = {
  dotsColor: "#0f172a",
  backgroundColor: "#ffffff",
  logoDataUrl: DEFAULT_QR_LOGO,
  margin: 8,
};

export interface QrFormValues {
  url: string;
  text: string;
  wifiSsid: string;
  wifiPassword: string;
  wifiEncryption: WifiEncryption;
  wifiHidden: boolean;
  vcardFirstName: string;
  vcardLastName: string;
  vcardOrganization: string;
  vcardPhone: string;
  vcardEmail: string;
  vcardUrl: string;
  socialPlatform: SocialPlatform;
  socialHandle: string;
  facebook: string;
  appIosUrl: string;
  appAndroidUrl: string;
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  businessWebsite: string;
  businessAddress: string;
}

export const DEFAULT_FORM: QrFormValues = {
  url: "",
  text: "",
  wifiSsid: "",
  wifiPassword: "",
  wifiEncryption: "WPA",
  wifiHidden: false,
  vcardFirstName: "",
  vcardLastName: "",
  vcardOrganization: "",
  vcardPhone: "",
  vcardEmail: "",
  vcardUrl: "",
  socialPlatform: "instagram",
  socialHandle: "",
  facebook: "",
  appIosUrl: "",
  appAndroidUrl: "",
  businessName: "",
  businessPhone: "",
  businessEmail: "",
  businessWebsite: "",
  businessAddress: "",
};

export const QR_TYPE_META: {
  id: QrContentType;
  label: string;
  description: string;
}[] = [
  { id: "url", label: "Site web", description: "Lien vers une page" },
  { id: "vcard", label: "vCard", description: "Carte de visite" },
  { id: "pdf", label: "PDF", description: "Lien vers un PDF" },
  { id: "images", label: "Images", description: "Galerie ou image" },
  { id: "social", label: "Réseaux sociaux", description: "Profil social" },
  { id: "video", label: "Vidéo", description: "Lien vidéo" },
  { id: "text", label: "Texte", description: "Texte libre" },
  { id: "business", label: "Page pro", description: "Infos entreprise" },
  { id: "facebook", label: "Facebook", description: "Page Facebook" },
  { id: "wifi", label: "Wi‑Fi", description: "Connexion réseau" },
  { id: "app", label: "App", description: "App Store / Play" },
  { id: "menu", label: "Menu", description: "Menu digital" },
];
