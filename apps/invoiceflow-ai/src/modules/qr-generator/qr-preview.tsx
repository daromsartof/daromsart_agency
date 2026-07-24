"use client";

import * as React from "react";
import QRCodeStyling from "qr-code-styling";
import { QrCode } from "lucide-react";
import { cn } from "@daromsart/ui";
import type { QrDesignOptions } from "./types";

export interface QrPreviewHandle {
  downloadPng: () => Promise<void>;
  downloadSvg: () => Promise<void>;
}

export interface QrPreviewProps {
  payload: string | null;
  design: QrDesignOptions;
  className?: string;
}

function toOptions(payload: string | null, design: QrDesignOptions) {
  return {
    width: 260,
    height: 260,
    type: "canvas" as const,
    data: payload || " ",
    margin: design.margin,
    qrOptions: {
      errorCorrectionLevel: (design.logoDataUrl ? "H" : "M") as "H" | "M",
    },
    image: design.logoDataUrl || "",
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: 0.35,
      margin: 4,
    },
    dotsOptions: {
      type: "rounded" as const,
      color: design.dotsColor,
    },
    cornersSquareOptions: {
      type: "extra-rounded" as const,
      color: design.dotsColor,
    },
    cornersDotOptions: {
      type: "dot" as const,
      color: design.dotsColor,
    },
    backgroundOptions: {
      color: design.backgroundColor,
    },
  };
}

export const QrPreview = React.forwardRef<QrPreviewHandle, QrPreviewProps>(
  function QrPreview({ payload, design, className }, ref) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const qrRef = React.useRef<QRCodeStyling | null>(null);

    React.useEffect(() => {
      if (!containerRef.current) return;

      containerRef.current.innerHTML = "";
      const instance = new QRCodeStyling(toOptions(payload, design));
      instance.append(containerRef.current);
      qrRef.current = instance;

      return () => {
        qrRef.current = null;
        if (containerRef.current) containerRef.current.innerHTML = "";
      };
      // Mount once; updates go through the effect below.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useEffect(() => {
      qrRef.current?.update(toOptions(payload, design));
    }, [payload, design]);

    React.useImperativeHandle(ref, () => ({
      async downloadPng() {
        await qrRef.current?.download({ name: "qrcode", extension: "png" });
      },
      async downloadSvg() {
        await qrRef.current?.download({ name: "qrcode", extension: "svg" });
      },
    }));

    const ready = Boolean(payload);

    return (
      <div className={cn("relative", className)}>
        <div
          className={cn(
            "relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border transition-all duration-300",
            ready ? "shadow-md" : "opacity-60",
          )}
          style={{
            backgroundColor: design.backgroundColor,
            backgroundImage: ready
              ? undefined
              : "radial-gradient(hsl(var(--muted-foreground) / 0.12) 1px, transparent 1px)",
            backgroundSize: ready ? undefined : "12px 12px",
          }}
        >
          <div
            ref={containerRef}
            data-testid="qr-preview"
            className={cn(
              "flex items-center justify-center transition-opacity duration-300 [&_canvas]:max-h-full [&_canvas]:max-w-full",
              ready ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            aria-hidden={!ready}
          />
          {!ready ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <QrCode className="h-6 w-6" />
              </span>
              <p className="text-sm font-medium text-foreground">Aperçu du QR</p>
              <p className="max-w-[14rem] text-xs text-muted-foreground">
                Le QR apparaîtra ici une fois le contenu renseigné.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    );
  },
);
