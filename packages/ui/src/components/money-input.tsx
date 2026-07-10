"use client";

import * as React from "react";

import { cn } from "../lib/utils";
import { formatCentsToInput, parseAmountToCents } from "../lib/money";
import { Input } from "./ui/input";

export interface MoneyInputProps
  extends Omit<
    React.ComponentProps<"input">,
    "value" | "onChange" | "type" | "inputMode"
  > {
  /** Valeur en centimes (integer) ou `null` si vide. */
  value: number | null;
  onValueChange: (cents: number | null) => void;
}

const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, className, onBlur, onFocus, ...props }, ref) => {
    const [focused, setFocused] = React.useState(false);
    const [text, setText] = React.useState(() =>
      value == null ? "" : formatCentsToInput(value),
    );

    React.useEffect(() => {
      if (!focused) {
        setText(value == null ? "" : formatCentsToInput(value));
      }
    }, [value, focused]);

    return (
      <Input
        ref={ref}
        inputMode="decimal"
        className={cn("text-right tabular-nums", className)}
        value={text}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onChange={(e) => {
          setText(e.target.value);
          onValueChange(parseAmountToCents(e.target.value));
        }}
        onBlur={(e) => {
          setFocused(false);
          const cents = parseAmountToCents(e.target.value);
          setText(cents == null ? "" : formatCentsToInput(cents));
          onBlur?.(e);
        }}
        {...props}
      />
    );
  },
);
MoneyInput.displayName = "MoneyInput";

export { MoneyInput };
