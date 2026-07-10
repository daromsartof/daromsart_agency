import { AppShellClient } from "@/components/app-shell-client";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // La session sera injectée en story 03 (Better Auth) ; placeholder pour l'instant.
  return (
    <AppShellClient user={{ name: "Daromsart", email: "admin@daromsart.test" }}>
      {children}
    </AppShellClient>
  );
}
