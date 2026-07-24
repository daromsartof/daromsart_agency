"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell } from "@daromsart/ui";
import { navSections } from "@/config/nav";
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
      linkComponent={Link}
      logo={
        <Link href="/" aria-label="Daroms'Art Systems" className="inline-flex items-center">
          <Image
            src="/logo/lockup-horizontal-couleur.png"
            alt="Daroms'Art Systems"
            width={1200}
            height={300}
            priority
            className="h-11 w-auto max-w-[180px] dark:hidden"
          />
          <Image
            src="/logo/lockup-horizontal-inverse.png"
            alt="Daroms'Art Systems"
            width={1200}
            height={300}
            priority
            className="hidden h-11 w-auto max-w-[180px] dark:block"
          />
        </Link>
      }
      topbarActions={<ThemeToggle />}
      userMenu={<UserMenu name={user?.name} email={user?.email} />}
    >
      {children}
    </AppShell>
  );
}
