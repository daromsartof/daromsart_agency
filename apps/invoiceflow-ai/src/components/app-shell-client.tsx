"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell, Button } from "@daromsart/ui";
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
      logoCollapsed={
        <Link
          href="/"
          aria-label="Daroms'Art Systems"
          className="inline-flex items-center justify-center"
          title="Daroms'Art Systems"
        >
          <Image
            src="/logo/qr-default-icon.png"
            alt="Daroms'Art Systems"
            width={128}
            height={128}
            priority
            className="h-8 w-8"
          />
        </Link>
      }
      topbarActions={
        <>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/agent">
              <Image
                src="/logo/qr-default-icon.png"
                alt=""
                width={64}
                height={64}
                className="h-4 w-4"
              />
              <span className="hidden sm:inline">Daroms Chat</span>
            </Link>
          </Button>
          <ThemeToggle />
        </>
      }
      userMenu={<UserMenu name={user?.name} email={user?.email} />}
    >
      {children}
    </AppShell>
  );
}
