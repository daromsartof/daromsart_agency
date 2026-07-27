"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Menu, PanelLeft, PanelLeftClose } from "lucide-react";

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

const SIDEBAR_STORAGE_KEY = "daromsart-sidebar-open";

const DefaultLink = ({
  href,
  className,
  onClick,
  title,
  children,
}: {
  href: string;
  className?: string;
  onClick?: () => void;
  title?: string;
  children?: React.ReactNode;
}) => (
  <a href={href} className={className} onClick={onClick} title={title}>
    {children}
  </a>
);

export interface AppShellProps {
  sections: NavSection[];
  activeHref?: string;
  logo?: React.ReactNode;
  /** Logo compact (icône seule) quand la sidebar est réduite. */
  logoCollapsed?: React.ReactNode;
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
  collapsed,
}: {
  sections: NavSection[];
  activeHref?: string;
  linkComponent: LinkComponent;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  return (
    <nav className={cn("flex flex-col py-4", collapsed ? "gap-4 px-2" : "gap-6 px-3")}>
      {sections.map((section, index) => (
        <div key={section.label ?? index} className="space-y-1">
          {section.label && !collapsed ? (
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
                title={collapsed ? item.label : undefined}
                aria-label={item.label}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-colors",
                  collapsed
                    ? "justify-center px-0 py-2.5"
                    : "gap-3 px-3 py-2",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/70 hover:bg-accent hover:text-foreground",
                )}
              >
                {Icon ? <Icon className="h-5 w-5 shrink-0" /> : null}
                {!collapsed ? <span className="truncate">{item.label}</span> : null}
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
  logoCollapsed,
  user,
  userMenu,
  topbarActions,
  linkComponent = DefaultLink,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [sidebarReady, setSidebarReady] = React.useState(false);

  React.useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_STORAGE_KEY) === "0") {
        setSidebarOpen(false);
      }
    } catch {
      // localStorage indisponible (mode privé strict, etc.)
    }
    setSidebarReady(true);
  }, []);

  React.useEffect(() => {
    if (!sidebarReady) return;
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarOpen ? "1" : "0");
    } catch {
      // ignore
    }
  }, [sidebarOpen, sidebarReady]);

  const collapsedLogo = logoCollapsed ?? logo;

  return (
    // h-svh + overflow-hidden : sidebar et topbar restent fixes ; seul <main> scroll.
    <div className="flex h-svh overflow-hidden bg-background">
      {/* Sidebar desktop — réduite = rail d'icônes cliquables */}
      <aside
        className={cn(
          "hidden h-full shrink-0 flex-col border-r bg-card transition-[width] duration-200 lg:flex",
          sidebarOpen ? "w-64" : "w-16",
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center",
            sidebarOpen ? "px-5" : "justify-center px-2",
          )}
        >
          {sidebarOpen
            ? (logo ?? <span className="text-lg font-semibold">Daromsart Système</span>)
            : collapsedLogo}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <SidebarNav
            sections={sections}
            activeHref={activeHref}
            linkComponent={linkComponent}
            collapsed={!sidebarOpen}
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

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            aria-label={sidebarOpen ? "Réduire le menu" : "Agrandir le menu"}
            aria-pressed={sidebarOpen}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeft className="h-5 w-5" />
            )}
          </Button>

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
