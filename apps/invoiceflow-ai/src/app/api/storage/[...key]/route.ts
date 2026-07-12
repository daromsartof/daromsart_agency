import { readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { NextResponse, type NextRequest } from "next/server";

const BASE_PATH = resolve(".storage");

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  svg: "image/svg+xml",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

/**
 * Sert les fichiers du driver `fs` en développement (le driver `s3` ne passe
 * pas par cette route — il renvoie une URL signée directement).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { key: string[] } },
) {
  const key = params.key.join("/");
  const target = resolve(join(BASE_PATH, key));
  if (target !== BASE_PATH && !target.startsWith(BASE_PATH + sep)) {
    return NextResponse.json({ error: "Clé invalide" }, { status: 400 });
  }

  try {
    const buffer = await readFile(target);
    const ext = key.split(".").pop()?.toLowerCase() ?? "";
    const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": contentType },
    });
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}
