import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { storage } from "@/lib/storage";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { getSignableDocumentById } from "@/modules/signable-documents/queries";

export const runtime = "nodejs";

/**
 * Sert le PDF original ou signé d'un document uploadé (story 25), org-scopé
 * — mirror auth/streaming de `api/documents/[type]/[id]/pdf/route.ts`.
 * `?variant=signed` n'est servi que si le document est effectivement signé.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const doc = await getSignableDocumentById(db, organizationId, params.id);
  if (!doc) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const variant = request.nextUrl.searchParams.get("variant") === "signed" ? "signed" : "original";
  const key = variant === "signed" ? doc.signedKey : doc.originalKey;
  if (!key) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const buffer = await storage.get(key);
  if (!buffer) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.title}"`,
    },
  });
}
