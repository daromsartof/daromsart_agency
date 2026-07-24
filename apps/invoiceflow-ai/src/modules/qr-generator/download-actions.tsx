"use client";

import { Download, FileImage } from "lucide-react";
import { Button } from "@daromsart/ui";

export interface DownloadActionsProps {
  disabled: boolean;
  onDownloadPng: () => void;
  onDownloadSvg: () => void;
}

export function DownloadActions({
  disabled,
  onDownloadPng,
  onDownloadSvg,
}: DownloadActionsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        className="w-full"
        disabled={disabled}
        onClick={onDownloadPng}
        data-testid="qr-download-png"
      >
        <Download className="mr-2 h-4 w-4" />
        PNG
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={disabled}
        onClick={onDownloadSvg}
        data-testid="qr-download-svg"
      >
        <FileImage className="mr-2 h-4 w-4" />
        SVG
      </Button>
    </div>
  );
}
