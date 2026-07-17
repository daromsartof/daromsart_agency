"use client";

import { useState } from "react";
import { useFieldArray, useWatch, type Control } from "react-hook-form";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import {
  Button,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Input,
  MoneyInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@daromsart/ui";
import {
  EMPTY_LINE,
  type DocumentFormValues,
} from "../document-form-schema";

export interface LineEditorProps {
  control: Control<DocumentFormValues>;
  vatRateOptions: number[];
}

/**
 * Tableau de lignes éditable : réordonnancement par glisser-déposer natif
 * (aucune dépendance externe) qui appelle `move()` de `useFieldArray` — la
 * position affichée EST l'index du tableau, persistée telle quelle en base
 * (`quote_lines.position`). Chaque poignée est aussi navigable au clavier via
 * les boutons haut/bas (parade accessibilité).
 */
export function LineEditor({ control, vatRateOptions }: LineEditorProps) {
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "lines",
  });
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {fields.map((fieldItem, index) => (
        <div
          key={fieldItem.id}
          draggable
          onDragStart={() => setDragIndex(index)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (dragIndex !== null && dragIndex !== index) {
              move(dragIndex, index);
            }
            setDragIndex(null);
          }}
          className="rounded-lg border p-3"
        >
          <div className="flex items-start gap-2">
            <div className="flex flex-col items-center gap-1 pt-2 text-muted-foreground">
              <GripVertical className="h-4 w-4 cursor-grab" aria-hidden />
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  aria-label="Monter la ligne"
                  disabled={index === 0}
                  className="disabled:opacity-30"
                  onClick={() => move(index, index - 1)}
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label="Descendre la ligne"
                  disabled={index === fields.length - 1}
                  className="disabled:opacity-30"
                  onClick={() => move(index, index + 1)}
                >
                  ▼
                </button>
              </div>
            </div>

            <div className="grid flex-1 gap-2">
              <FormField
                control={control}
                name={`lines.${index}.description`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="Description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <FormField
                  control={control}
                  name={`lines.${index}.quantity`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          inputMode="decimal"
                          placeholder="Qté"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`lines.${index}.unitPriceCents`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <MoneyInput
                          value={field.value}
                          onValueChange={(cents) => field.onChange(cents ?? 0)}
                          placeholder="Prix unitaire"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`lines.${index}.vatRate`}
                  render={({ field }) => (
                    <FormItem>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="TVA" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vatRateOptions.map((rate) => (
                            <SelectItem key={rate} value={String(rate)}>
                              {rate} %
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`lines.${index}.discountType`}
                  render={({ field }) => (
                    <FormItem>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Remise" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Aucune remise</SelectItem>
                          <SelectItem value="percent">Remise %</SelectItem>
                          <SelectItem value="amount">Remise €</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <LineDiscountValue control={control} index={index} />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Supprimer la ligne"
              onClick={() => remove(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ ...EMPTY_LINE })}
      >
        <Plus className="mr-2 h-4 w-4" />
        Ajouter une ligne
      </Button>
    </div>
  );
}

function LineDiscountValue({
  control,
  index,
}: {
  control: Control<DocumentFormValues>;
  index: number;
}) {
  const discountType = useWatch({ control, name: `lines.${index}.discountType` });
  if (!discountType) return null;

  return (
    <FormField
      control={control}
      name={`lines.${index}.discountValue`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            {discountType === "amount" ? (
              <MoneyInput
                value={field.value ? Number(field.value) : null}
                onValueChange={(cents) => field.onChange(cents != null ? String(cents) : "")}
                placeholder="Montant de la remise"
              />
            ) : (
              <Input
                inputMode="decimal"
                placeholder="Pourcentage de remise"
                {...field}
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
