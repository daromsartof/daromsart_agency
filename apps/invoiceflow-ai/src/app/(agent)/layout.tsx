import { requireSession } from "@/modules/auth/session";

/**
 * Mode agent (story 26) — plein écran, SANS AppShell : le chat occupe toute la
 * fenêtre (façon ChatGPT). Le layout racine (html/body/thème/polices) reste
 * appliqué ; seul le chrome applicatif (sidebar/topbar) disparaît.
 */
export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return <>{children}</>;
}
