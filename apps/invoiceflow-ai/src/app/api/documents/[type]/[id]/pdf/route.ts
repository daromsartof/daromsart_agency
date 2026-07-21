import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { storage } from "@/lib/storage";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { resolveQuotePdfBuffer } from "@/modules/documents/pdf";

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

  // Sert l'archive signée si elle existe (jamais reconstruite), sinon un
  // rendu à la volée (story 11).
  const file = await resolveQuotePdfBuffer(db, storage, organizationId, params.id);
  if (!file) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${file.filename}"`,
    },
  });
}
