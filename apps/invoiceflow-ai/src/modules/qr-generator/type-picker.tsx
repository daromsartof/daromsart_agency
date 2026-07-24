"use client";

import {
  FileText,
  Globe,
  Image as ImageIcon,
  Link2,
  Menu,
  Share2,
  Smartphone,
  Type,
  Video,
  Wifi,
  Building2,
  Contact,
  Facebook,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@daromsart/ui";
import { QR_TYPE_META, type QrContentType } from "./types";

const ICONS: Record<QrContentType, LucideIcon> = {
  url: Globe,
  vcard: Contact,
  pdf: FileText,
  images: ImageIcon,
  social: Share2,
  video: Video,
  text: Type,
  business: Building2,
  facebook: Facebook,
  wifi: Wifi,
  app: Smartphone,
  menu: Menu,
};

export interface TypePickerProps {
  value: QrContentType;
  onChange: (type: QrContentType) => void;
  /** `list` (colonne) ou `grid` (wizard plein largeur). */
  layout?: "list" | "grid";
}

export function TypePicker({ value, onChange, layout = "list" }: TypePickerProps) {
  return (
    <nav
      aria-label="Type de QR code"
      className={cn(
        layout === "grid"
          ? "grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
          : "flex flex-col gap-0.5",
      )}
    >
      {QR_TYPE_META.map((item) => {
        const Icon = ICONS[item.id] ?? Link2;
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-current={active ? "true" : undefined}
            className={cn(
              "group flex items-center gap-2.5 text-left transition-all duration-150",
              layout === "grid"
                ? "rounded-xl border px-3 py-3"
                : "rounded-lg px-2.5 py-2",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : layout === "grid"
                  ? "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
                  : "text-foreground hover:bg-muted/70",
            )}
          >
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-md transition-colors",
                layout === "grid" ? "h-10 w-10" : "h-8 w-8",
                active
                  ? "bg-primary-foreground/15 text-primary-foreground"
                  : "bg-muted text-muted-foreground group-hover:text-foreground",
              )}
            >
              <Icon className={layout === "grid" ? "h-5 w-5" : "h-4 w-4"} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium leading-tight">
                {item.label}
              </span>
              <span
                className={cn(
                  "block truncate text-[11px] leading-tight",
                  active ? "text-primary-foreground/75" : "text-muted-foreground",
                )}
              >
                {item.description}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
