import * as React from "react";
import { cn } from "../lib/utils";

export interface StepperStep {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: StepperStep[];
  /** Index 0-based de l'étape courante. */
  current: number;
  /** Clique sur une étape déjà atteinte (≤ current). */
  onStepClick?: (index: number) => void;
  className?: string;
}

/**
 * Stepper horizontal (cercles numérotés + connecteurs) — pattern wizard
 * pour les flux multi-étapes (ex. création de facture).
 */
function Stepper({ steps, current, onStepClick, className }: StepperProps) {
  return (
    <nav
      aria-label="Progression"
      className={cn("w-full", className)}
    >
      <ol className="flex items-start justify-between gap-1">
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          const reachable = index <= current;
          const isLast = index === steps.length - 1;

          return (
            <li
              key={step.id}
              className={cn("flex min-w-0 flex-1 flex-col items-center", !isLast && "relative")}
            >
              <div className="flex w-full items-center">
                <div className="flex flex-1 justify-center">
                  <button
                    type="button"
                    disabled={!reachable || !onStepClick}
                    onClick={() => reachable && onStepClick?.(index)}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                      done || active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                      reachable && onStepClick && "cursor-pointer",
                      !reachable && "cursor-default",
                    )}
                  >
                    {index + 1}
                  </button>
                </div>
                {!isLast ? (
                  <div
                    aria-hidden
                    className={cn(
                      "absolute left-[calc(50%+1.125rem)] right-[calc(-50%+1.125rem)] top-[1.125rem] h-0.5 -translate-y-1/2",
                      index < current ? "bg-primary" : "bg-muted",
                    )}
                  />
                ) : null}
              </div>
              <span
                className={cn(
                  "mt-2 max-w-full truncate px-1 text-center text-xs font-medium sm:text-sm",
                  done || active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { Stepper };
