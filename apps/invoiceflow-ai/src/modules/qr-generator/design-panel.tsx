"use client";

import { ImagePlus, X } from "lucide-react";
import { Button, Input, Label } from "@daromsart/ui";
import { DEFAULT_QR_LOGO, type QrDesignOptions } from "./types";

export interface DesignPanelProps {
  value: QrDesignOptions;
  onChange: (patch: Partial<QrDesignOptions>) => void;
}

const PRESETS: { label: string; dots: string; bg: string }[] = [
  { label: "Classique", dots: "#0f172a", bg: "#ffffff" },
  { label: "Nuit", dots: "#e2e8f0", bg: "#0f172a" },
  { label: "Marque", dots: "#1d4ed8", bg: "#ffffff" },
  { label: "Sable", dots: "#44403c", bg: "#fafaf9" },
];

export function DesignPanel({ value, onChange }: DesignPanelProps) {
  function onLogoChange(file: File | null) {
    if (!file) {
      onChange({ logoDataUrl: null });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChange({ logoDataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Presets</Label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => {
            const active =
              value.dotsColor.toLowerCase() === preset.dots.toLowerCase() &&
              value.backgroundColor.toLowerCase() === preset.bg.toLowerCase();
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() =>
                  onChange({ dotsColor: preset.dots, backgroundColor: preset.bg })
                }
                className={
                  active
                    ? "inline-flex items-center gap-2 rounded-lg border border-primary bg-primary/5 px-2.5 py-1.5 text-xs font-medium"
                    : "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                }
              >
                <span
                  className="flex h-4 w-4 overflow-hidden rounded-sm border"
                  aria-hidden
                >
                  <span className="w-1/2" style={{ backgroundColor: preset.dots }} />
                  <span className="w-1/2" style={{ backgroundColor: preset.bg }} />
                </span>
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="qr-dots-color">Modules</Label>
          <div className="flex items-center gap-2">
            <Input
              id="qr-dots-color"
              type="color"
              value={value.dotsColor}
              className="h-10 w-12 shrink-0 cursor-pointer p-1"
              onChange={(e) => onChange({ dotsColor: e.target.value })}
            />
            <Input
              type="text"
              value={value.dotsColor}
              className="font-mono text-sm uppercase"
              onChange={(e) => onChange({ dotsColor: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qr-bg-color">Fond</Label>
          <div className="flex items-center gap-2">
            <Input
              id="qr-bg-color"
              type="color"
              value={value.backgroundColor}
              className="h-10 w-12 shrink-0 cursor-pointer p-1"
              onChange={(e) => onChange({ backgroundColor: e.target.value })}
            />
            <Input
              type="text"
              value={value.backgroundColor}
              className="font-mono text-sm uppercase"
              onChange={(e) => onChange({ backgroundColor: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="qr-margin">Marge</Label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {value.margin} px
          </span>
        </div>
        <Input
          id="qr-margin"
          type="range"
          min={0}
          max={40}
          step={1}
          value={value.margin}
          onChange={(e) => onChange({ margin: Number(e.target.value) })}
        />
      </div>

      <div className="space-y-2">
        <Label>Logo centré</Label>
        {value.logoDataUrl ? (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value.logoDataUrl}
              alt="Logo QR"
              className="h-12 w-12 rounded-md border bg-background object-contain"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {value.logoDataUrl === DEFAULT_QR_LOGO
                  ? "Logo Daroms'Art (défaut)"
                  : "Logo ajouté"}
              </p>
              <p className="text-xs text-muted-foreground">
                Correction d&apos;erreur H activée
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Retirer le logo"
              onClick={() => onChange({ logoDataUrl: null })}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/30 hover:text-foreground">
              <ImagePlus className="h-5 w-5" />
              <span>
                Déposer un logo
                <span className="mt-0.5 block text-xs opacity-80">PNG, JPG ou SVG</span>
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="sr-only"
                onChange={(e) => onLogoChange(e.target.files?.[0] ?? null)}
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => onChange({ logoDataUrl: DEFAULT_QR_LOGO })}
            >
              Restaurer le logo par défaut
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
