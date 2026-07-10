"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell } from "@daromsart/ui";
import { navSections, titleForPath } from "@/config/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

export interface AppShellClientProps {
  user?: { name?: string | null; email?: string | null };
  children: React.ReactNode;
}

export function AppShellClient({ user, children }: AppShellClientProps) {
  const pathname = usePathname() ?? "/";

  return (
    <AppShell
      sections={navSections}
      activeHref={pathname}
      title={titleForPath(pathname)}
      linkComponent={Link}
      logo={
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Invoice<span className="text-primary">Flow</span>
        </Link>
      }
      topbarActions={<ThemeToggle />}
      userMenu={<UserMenu name={user?.name} email={user?.email} />}
    >
      {children}
    </AppShell>
  );
}
