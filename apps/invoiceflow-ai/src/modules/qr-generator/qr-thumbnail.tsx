"use client";

import * as React from "react";
import QRCodeStyling from "qr-code-styling";
import type { QrDesignJson } from "@/db/schema/qr-codes";

export interface QrThumbnailProps {
  payload: string;
  design: QrDesignJson;
  size?: number;
}

/** Mini aperçu QR pour la grille (canvas léger). */
export function QrThumbnail({ payload, design, size = 160 }: QrThumbnailProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!ref.current || !payload) return;
    ref.current.innerHTML = "";
    const qr = new QRCodeStyling({
      width: size,
      height: size,
      type: "canvas",
      data: payload,
      margin: Math.min(design.margin, 8),
      qrOptions: {
        errorCorrectionLevel: design.logoDataUrl ? "H" : "M",
      },
      image: design.logoDataUrl || "",
      imageOptions: {
        hideBackgroundDots: true,
        imageSize: 0.35,
        margin: 2,
      },
      dotsOptions: { type: "rounded", color: design.dotsColor },
      cornersSquareOptions: { type: "extra-rounded", color: design.dotsColor },
      cornersDotOptions: { type: "dot", color: design.dotsColor },
      backgroundOptions: { color: design.backgroundColor },
    });
    qr.append(ref.current);
    return () => {
      if (ref.current) ref.current.innerHTML = "";
    };
  }, [payload, design, size]);

  return (
    <div
      ref={ref}
      className="mx-auto flex items-center justify-center [&_canvas]:max-h-full [&_canvas]:max-w-full"
      style={{ width: size, height: size }}
    />
  );
}
