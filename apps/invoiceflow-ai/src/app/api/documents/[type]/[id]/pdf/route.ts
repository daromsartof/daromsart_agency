import { NextResponse, type NextRequest } from "next/server";
import { renderDocumentPdf } from "@daromsart/pdf";
import { db } from "@/db";
import { storage } from "@/lib/storage";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { buildQuotePdfInput } from "@/modules/documents/pdf";

// @react-pdf/renderer utilise des API Node (buffers, fontkit) indisponibles
// en edge runtime.
export const runtime = "nodejs";

const SUPPORTED_TYPES = new Set(["devis"]);

export async function GET(
  _request: NextRequest,
  { params }: { params: { type: string; id: string } },
) {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId || !SUPPORTED_TYPES.has(params.type)) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const input = await buildQuotePdfInput(db, storage, organizationId, params.id);
  if (!input) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const buffer = await renderDocumentPdf(input);
  const filename = `devis-${input.meta.number ?? "brouillon"}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
