"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Menu } from "lucide-react";

import { cn } from "../lib/utils";
import { initials } from "../lib/format";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";

export interface NavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

/**
 * Type de composant de lien accepté. `React.ElementType` reste volontairement
 * permissif pour accepter `next/link` (dont les props sont plus larges) sans
 * friction, tout en tolérant un simple `<a>`.
 */
type LinkComponent = React.ElementType;

const DefaultLink = ({
  href,
  className,
  onClick,
  children,
}: {
  href: string;
  className?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) => (
  <a href={href} className={className} onClick={onClick}>
    {children}
  </a>
);

export interface AppShellProps {
  sections: NavSection[];
  activeHref?: string;
  logo?: React.ReactNode;
  user?: { name?: string | null; email?: string | null };
  /** Contenu du menu utilisateur (dropdown) rendu dans la topbar. */
  userMenu?: React.ReactNode;
  /** Bloc d'actions supplémentaires à droite de la topbar (ex. toggle thème). */
  topbarActions?: React.ReactNode;
  /** Composant de lien (ex. `next/link`). Défaut : `<a>`. */
  linkComponent?: LinkComponent;
  children: React.ReactNode;
}

function isActive(activeHref: string | undefined, href: string): boolean {
  if (!activeHref) return false;
  if (href === "/") return activeHref === "/";
  return activeHref === href || activeHref.startsWith(`${href}/`);
}

function SidebarNav({
  sections,
  activeHref,
  linkComponent: Link,
  onNavigate,
}: {
  sections: NavSection[];
  activeHref?: string;
  linkComponent: LinkComponent;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-6 px-3 py-4">
      {sections.map((section, index) => (
        <div key={section.label ?? index} className="space-y-1">
          {section.label ? (
            <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {section.label}
            </p>
          ) : null}
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = isActive(activeHref, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/70 hover:bg-accent hover:text-foreground",
                )}
              >
                {Icon ? <Icon className="h-5 w-5" /> : null}
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function AppShell({
  sections,
  activeHref,
  logo,
  user,
  userMenu,
  topbarActions,
  linkComponent = DefaultLink,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    // h-svh + overflow-hidden : sidebar et topbar restent fixes ; seul <main> scroll.
    <div className="flex h-svh overflow-hidden bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden h-full w-64 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">
          {logo ?? <span className="text-lg font-semibold">Daromsart Système</span>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav
            sections={sections}
            activeHref={activeHref}
            linkComponent={linkComponent}
          />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Topbar fixe (ne scroll pas avec le contenu) */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-card px-4 sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Ouvrir le menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-64 flex-col p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-16 shrink-0 items-center pr-12 pl-5">
                {logo ?? (
                  <span className="text-lg font-semibold">Daromsart Système</span>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <SidebarNav
                  sections={sections}
                  activeHref={activeHref}
                  linkComponent={linkComponent}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1" />

          <div className="flex shrink-0 items-center gap-2">
            {topbarActions}
            {userMenu ?? (
              <Avatar>
                <AvatarFallback>{initials(user?.name)}</AvatarFallback>
              </Avatar>
            )}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

export { AppShell };
