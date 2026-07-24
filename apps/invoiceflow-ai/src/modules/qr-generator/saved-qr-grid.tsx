"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@daromsart/ui";
import { QR_TYPE_META } from "./types";
import type { QrCodeRow } from "./queries";
import { QrThumbnail } from "./qr-thumbnail";

export interface SavedQrGridProps {
  items: QrCodeRow[];
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function SavedQrGrid({ items }: SavedQrGridProps) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => {
        const typeLabel =
          QR_TYPE_META.find((t) => t.id === item.contentType)?.label ?? item.contentType;
        return (
          <li key={item.id}>
            <Card className="overflow-hidden transition-shadow hover:shadow-md">
              <Link href={`/qrcode/${item.id}`} className="block">
                <div className="border-b bg-muted/20 p-4">
                  <QrThumbnail
                    payload={item.payload}
                    design={item.design}
                    size={160}
                  />
                </div>
                <CardHeader className="space-y-1 pb-2 pt-4">
                  <CardTitle className="truncate text-base">{item.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {typeLabel} · {formatDate(item.updatedAt)}
                  </p>
                </CardHeader>
                <CardContent className="pb-4 pt-0">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                    <Eye className="h-3.5 w-3.5" />
                    Voir / télécharger
                  </span>
                </CardContent>
              </Link>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
