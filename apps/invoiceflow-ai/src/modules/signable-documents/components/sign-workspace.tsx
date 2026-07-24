"use client";

import { useCallback, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@daromsart/ui";
import { PdfSignatureViewer } from "@/modules/signable-documents/components/pdf-signature-viewer";
import { SignPanel } from "@/modules/signable-documents/components/sign-panel";
import type { SignaturePlacement } from "@/modules/signable-documents/signature-placement";

export interface SignWorkspaceProps {
  documentId: string;
  pageCount: number;
  pdfUrl: string;
  title: string;
}

export function SignWorkspace({
  documentId,
  pageCount,
  pdfUrl,
  title,
}: SignWorkspaceProps) {
  const [page, setPage] = useState(1);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [placement, setPlacement] = useState<SignaturePlacement | null>(null);

  const handleSignaturePreview = useCallback((dataUrl: string | null) => {
    setSignatureUrl(dataUrl);
    if (!dataUrl) setPlacement(null);
  }, []);

  const handlePlacementChange = useCallback((next: SignaturePlacement) => {
    setPlacement(next);
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card className="overflow-hidden">
          <CardContent className="p-3 sm:p-4">
            <PdfSignatureViewer
              pdfUrl={pdfUrl}
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              signatureUrl={signatureUrl}
              placement={placement}
              onPlacementChange={handlePlacementChange}
            />
            <span className="sr-only">{title}</span>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <CardTitle className="text-base">Signer ce document</CardTitle>
            <p className="text-sm text-muted-foreground">
              Indiquez votre nom, tracez la signature, puis placez-la sur le PDF.
            </p>
          </CardHeader>
          <CardContent className="pt-5">
            <SignPanel
              documentId={documentId}
              page={page}
              placement={placement}
              onSignaturePreview={handleSignaturePreview}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
