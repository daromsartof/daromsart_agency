"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Menu } from "lucide-react";

import { cn } from "../lib/utils";
import { initials } from "../lib/format";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";

export interface NavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

type LinkComponent = React.ComponentType<{
  href: string;
  className?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}>;

const DefaultLink: LinkComponent = ({ href, className, onClick, children }) => (
  <a href={href} className={className} onClick={onClick}>
    {children}
  </a>
);

export interface AppShellProps {
  sections: NavSection[];
  activeHref?: string;
  logo?: React.ReactNode;
  title?: React.ReactNode;
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
  title,
  user,
  userMenu,
  topbarActions,
  linkComponent = DefaultLink,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="flex h-16 items-center px-5">
          {logo ?? <span className="text-lg font-semibold">InvoiceFlow</span>}
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav
            sections={sections}
            activeHref={activeHref}
            linkComponent={linkComponent}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex h-16 items-center gap-3 border-b bg-card px-4 sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Ouvrir le menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex h-16 items-center px-5">
                {logo ?? (
                  <span className="text-lg font-semibold">InvoiceFlow</span>
                )}
              </div>
              <SidebarNav
                sections={sections}
                activeHref={activeHref}
                linkComponent={linkComponent}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1 truncate text-base font-semibold">
            {title}
          </div>

          <div className="flex items-center gap-2">
            {topbarActions}
            {userMenu ?? (
              <Avatar>
                <AvatarFallback>{initials(user?.name)}</AvatarFallback>
              </Avatar>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

export { AppShell };
