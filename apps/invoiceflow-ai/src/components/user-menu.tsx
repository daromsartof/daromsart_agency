"use client";

import Link from "next/link";
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

export interface UserMenuProps {
  name?: string | null;
  email?: string | null;
}

export function UserMenu({ name, email }: UserMenuProps) {
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
        <DropdownMenuItem asChild>
          <Link href="/connexion">
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
