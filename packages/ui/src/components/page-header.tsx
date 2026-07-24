import * as React from "react";

import { cn } from "../lib/utils";

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Contrôle à gauche du titre (ex. bouton retour). */
  back?: React.ReactNode;
  /** Actions alignées à droite (boutons…). */
  children?: React.ReactNode;
  className?: string;
}

function PageHeader({
  title,
  description,
  back,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        {back ? <div className="mt-0.5 shrink-0">{back}</div> : null}
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {children ? (
        <div className="flex items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}

export { PageHeader };
