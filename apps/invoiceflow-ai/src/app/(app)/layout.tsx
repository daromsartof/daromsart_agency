import { AppShellClient } from "@/components/app-shell-client";
import { requireSession } from "@/modules/auth/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  return (
    <AppShellClient
      user={{ name: session.user.name, email: session.user.email }}
    >
      {children}
    </AppShellClient>
  );
}
