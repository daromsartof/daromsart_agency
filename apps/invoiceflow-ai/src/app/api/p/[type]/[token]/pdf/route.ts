import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { storage } from "@/lib/storage";
import { checkRateLimit } from "@/modules/public/rate-limit";
import { resolvePublicQuotePdfBuffer } from "@/modules/public/pdf";

// @react-pdf/renderer utilise des API Node indisponibles en edge runtime.
export const runtime = "nodejs";

const SUPPORTED_TYPES = new Set(["devis"]);

export async function GET(
  _request: NextRequest,
  { params }: { params: { type: string; token: string } },
) {
  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  if (!SUPPORTED_TYPES.has(params.type)) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const file = await resolvePublicQuotePdfBuffer(db, storage, params.token);
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
