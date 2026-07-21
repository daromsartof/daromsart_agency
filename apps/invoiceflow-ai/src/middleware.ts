import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/** Routes d'authentification, accessibles sans session mais redirigées si déjà connecté. */
const AUTH_PREFIXES = [
  "/connexion",
  "/mot-de-passe-oublie",
  "/reinitialiser",
];

/**
 * Accès public par token (story 11) : toujours accessible, session ou non —
 * ne redirige JAMAIS (un admin qui suit son propre lien public doit pouvoir
 * le consulter tel qu'un client le verrait).
 */
const ALWAYS_ACCESSIBLE_PREFIXES = ["/p"];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Garde optimiste basée sur le cookie de session (pas d'appel DB ici — la
 * vérification forte est faite côté serveur via `requireSession`). Redirige
 * les visiteurs non connectés vers /connexion et renvoie les utilisateurs
 * déjà connectés hors des pages d'authentification.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (matchesPrefix(pathname, ALWAYS_ACCESSIBLE_PREFIXES)) {
    return NextResponse.next();
  }

  const hasSession = Boolean(getSessionCookie(request));
  const authRoute = matchesPrefix(pathname, AUTH_PREFIXES);

  if (!hasSession && !authRoute) {
    const url = new URL("/connexion", request.url);
    if (pathname !== "/") {
      url.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(url);
  }

  if (hasSession && authRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Exclut les routes API, les assets Next et les fichiers statiques.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
