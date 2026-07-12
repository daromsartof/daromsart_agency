import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/** Routes accessibles sans session (préfixes). */
const PUBLIC_PREFIXES = [
  "/connexion",
  "/mot-de-passe-oublie",
  "/reinitialiser",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Garde optimiste basée sur le cookie de session (pas d'appel DB ici — la
 * vérification forte est faite côté serveur via `requireSession`). Redirige
 * les visiteurs non connectés vers /connexion et renvoie les utilisateurs
 * déjà connectés hors des pages d'authentification.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));
  const publicRoute = isPublic(pathname);

  if (!hasSession && !publicRoute) {
    const url = new URL("/connexion", request.url);
    if (pathname !== "/") {
      url.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(url);
  }

  if (hasSession && publicRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Exclut les routes API, les assets Next et les fichiers statiques.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
