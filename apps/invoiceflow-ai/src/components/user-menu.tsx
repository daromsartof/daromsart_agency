"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  initials,
} from "@daromsart/ui";
import { signOut } from "@/modules/auth/client";

export interface UserMenuProps {
  name?: string | null;
  email?: string | null;
}

export function UserMenu({ name, email }: UserMenuProps) {
  const router = useRouter();

  async function onSignOut() {
    await signOut();
    router.replace("/connexion");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Menu utilisateur"
        >
          <Avatar>
            <AvatarFallback>{initials(name ?? "Utilisateur")}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{name ?? "Utilisateur"}</span>
            {email ? (
              <span className="text-xs font-normal text-muted-foreground">
                {email}
              </span>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/parametres/compte">
            <UserRound className="h-4 w-4" />
            Mon compte
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onSignOut}>
          <LogOut className="h-4 w-4" />
          Déconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
