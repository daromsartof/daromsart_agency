"use client";

import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@daromsart/ui";
import type { QrContentType, QrFormValues } from "./types";

export interface ContentFormProps {
  type: QrContentType;
  values: QrFormValues;
  onChange: (patch: Partial<QrFormValues>) => void;
}

function Field({
  id,
  label,
  children,
  hint,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ContentForm({ type, values, onChange }: ContentFormProps) {
  const set = (patch: Partial<QrFormValues>) => onChange(patch);

  if (type === "url" || type === "pdf" || type === "images" || type === "video" || type === "menu") {
    const labels: Record<string, { label: string; hint: string; placeholder: string }> = {
      url: {
        label: "URL du site",
        hint: "https:// sera ajouté automatiquement si besoin.",
        placeholder: "https://exemple.fr",
      },
      pdf: {
        label: "URL du PDF",
        hint: "Lien public vers le fichier PDF.",
        placeholder: "https://exemple.fr/doc.pdf",
      },
      images: {
        label: "URL de la galerie / image",
        hint: "Lien vers une image ou une galerie.",
        placeholder: "https://exemple.fr/galerie",
      },
      video: {
        label: "URL de la vidéo",
        hint: "YouTube, Vimeo ou lien direct.",
        placeholder: "https://youtube.com/watch?v=…",
      },
      menu: {
        label: "URL du menu",
        hint: "Lien vers le menu digital.",
        placeholder: "https://exemple.fr/menu",
      },
    };
    const meta = labels[type];
    return (
      <Field id="qr-url" label={meta.label} hint={meta.hint}>
        <Input
          id="qr-url"
          type="url"
          value={values.url}
          placeholder={meta.placeholder}
          onChange={(e) => set({ url: e.target.value })}
        />
      </Field>
    );
  }

  if (type === "text") {
    return (
      <Field id="qr-text" label="Texte" hint="Affiché tel quel lors du scan.">
        <Textarea
          id="qr-text"
          rows={5}
          value={values.text}
          placeholder="Votre message…"
          onChange={(e) => set({ text: e.target.value })}
        />
      </Field>
    );
  }

  if (type === "wifi") {
    return (
      <div className="space-y-4">
        <Field id="wifi-ssid" label="Nom du réseau (SSID)">
          <Input
            id="wifi-ssid"
            value={values.wifiSsid}
            placeholder="MonWiFi"
            onChange={(e) => set({ wifiSsid: e.target.value })}
          />
        </Field>
        <Field id="wifi-encryption" label="Sécurité">
          <Select
            value={values.wifiEncryption}
            onValueChange={(v) =>
              set({ wifiEncryption: v as QrFormValues["wifiEncryption"] })
            }
          >
            <SelectTrigger id="wifi-encryption">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WPA">WPA / WPA2</SelectItem>
              <SelectItem value="WEP">WEP</SelectItem>
              <SelectItem value="nopass">Ouvert (sans mot de passe)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {values.wifiEncryption !== "nopass" ? (
          <Field id="wifi-password" label="Mot de passe">
            <Input
              id="wifi-password"
              type="text"
              autoComplete="off"
              value={values.wifiPassword}
              onChange={(e) => set({ wifiPassword: e.target.value })}
            />
          </Field>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="wifi-hidden">Réseau masqué</Label>
          <Switch
            id="wifi-hidden"
            checked={values.wifiHidden}
            onCheckedChange={(checked) => set({ wifiHidden: checked })}
          />
        </div>
      </div>
    );
  }

  if (type === "vcard") {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="vcard-first" label="Prénom">
            <Input
              id="vcard-first"
              value={values.vcardFirstName}
              onChange={(e) => set({ vcardFirstName: e.target.value })}
            />
          </Field>
          <Field id="vcard-last" label="Nom">
            <Input
              id="vcard-last"
              value={values.vcardLastName}
              onChange={(e) => set({ vcardLastName: e.target.value })}
            />
          </Field>
        </div>
        <Field id="vcard-org" label="Organisation">
          <Input
            id="vcard-org"
            value={values.vcardOrganization}
            onChange={(e) => set({ vcardOrganization: e.target.value })}
          />
        </Field>
        <Field id="vcard-phone" label="Téléphone">
          <Input
            id="vcard-phone"
            type="tel"
            value={values.vcardPhone}
            onChange={(e) => set({ vcardPhone: e.target.value })}
          />
        </Field>
        <Field id="vcard-email" label="Email">
          <Input
            id="vcard-email"
            type="email"
            value={values.vcardEmail}
            onChange={(e) => set({ vcardEmail: e.target.value })}
          />
        </Field>
        <Field id="vcard-url" label="Site web">
          <Input
            id="vcard-url"
            value={values.vcardUrl}
            placeholder="https://…"
            onChange={(e) => set({ vcardUrl: e.target.value })}
          />
        </Field>
      </div>
    );
  }

  if (type === "social") {
    return (
      <div className="space-y-4">
        <Field id="social-platform" label="Plateforme">
          <Select
            value={values.socialPlatform}
            onValueChange={(v) =>
              set({ socialPlatform: v as QrFormValues["socialPlatform"] })
            }
          >
            <SelectTrigger id="social-platform">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="x">X (Twitter)</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field
          id="social-handle"
          label="Identifiant ou URL"
          hint="Ex. @moncompte ou URL complète."
        >
          <Input
            id="social-handle"
            value={values.socialHandle}
            placeholder="@moncompte"
            onChange={(e) => set({ socialHandle: e.target.value })}
          />
        </Field>
      </div>
    );
  }

  if (type === "facebook") {
    return (
      <Field
        id="facebook"
        label="Page Facebook"
        hint="URL ou identifiant de page."
      >
        <Input
          id="facebook"
          value={values.facebook}
          placeholder="https://facebook.com/…"
          onChange={(e) => set({ facebook: e.target.value })}
        />
      </Field>
    );
  }

  if (type === "app") {
    return (
      <div className="space-y-4">
        <Field id="app-ios" label="URL App Store" hint="Au moins un store est requis.">
          <Input
            id="app-ios"
            value={values.appIosUrl}
            placeholder="https://apps.apple.com/…"
            onChange={(e) => set({ appIosUrl: e.target.value })}
          />
        </Field>
        <Field id="app-android" label="URL Google Play">
          <Input
            id="app-android"
            value={values.appAndroidUrl}
            placeholder="https://play.google.com/…"
            onChange={(e) => set({ appAndroidUrl: e.target.value })}
          />
        </Field>
      </div>
    );
  }

  if (type === "business") {
    return (
      <div className="space-y-4">
        <Field id="biz-name" label="Nom">
          <Input
            id="biz-name"
            value={values.businessName}
            onChange={(e) => set({ businessName: e.target.value })}
          />
        </Field>
        <Field id="biz-phone" label="Téléphone">
          <Input
            id="biz-phone"
            type="tel"
            value={values.businessPhone}
            onChange={(e) => set({ businessPhone: e.target.value })}
          />
        </Field>
        <Field id="biz-email" label="Email">
          <Input
            id="biz-email"
            type="email"
            value={values.businessEmail}
            onChange={(e) => set({ businessEmail: e.target.value })}
          />
        </Field>
        <Field id="biz-web" label="Site web">
          <Input
            id="biz-web"
            value={values.businessWebsite}
            onChange={(e) => set({ businessWebsite: e.target.value })}
          />
        </Field>
        <Field id="biz-address" label="Adresse">
          <Textarea
            id="biz-address"
            rows={2}
            value={values.businessAddress}
            onChange={(e) => set({ businessAddress: e.target.value })}
          />
        </Field>
      </div>
    );
  }

  return null;
}
