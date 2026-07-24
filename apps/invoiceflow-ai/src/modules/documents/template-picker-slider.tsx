"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, cn } from "@daromsart/ui";
import { DEFAULT_TEMPLATE_OPTIONS, type TemplateOptions } from "@daromsart/core";
import { TemplateThumbnail } from "@/modules/templates/components/template-thumbnail";

export interface TemplatePickerItem {
  id: string;
  name: string;
  isDefault: boolean;
  options?: TemplateOptions;
}

export interface TemplatePickerSliderProps {
  templates: TemplatePickerItem[];
  /** Id du modèle sélectionné, ou `""` pour le défaut org. */
  value: string;
  onChange: (templateId: string) => void;
  className?: string;
}

/**
 * Sélection de modèles en carrousel horizontal avec vignette d'aperçu.
 */
export function TemplatePickerSlider({
  templates,
  value,
  onChange,
  className,
}: TemplatePickerSliderProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollBy(direction: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(220, el.clientWidth * 0.65), behavior: "smooth" });
  }

  const showArrows = templates.length > 1;

  return (
    <div className={cn("relative", className)}>
      {showArrows ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute -left-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 rounded-full bg-background shadow sm:flex"
            aria-label="Modèles précédents"
            onClick={() => scrollBy(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute -right-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 rounded-full bg-background shadow sm:flex"
            aria-label="Modèles suivants"
            onClick={() => scrollBy(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      ) : null}

      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto scroll-smooth px-1 pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {templates.map((template) => {
          const selected = value === template.id || (!value && template.isDefault);
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onChange(template.id)}
              className={cn(
                "w-[160px] shrink-0 snap-start rounded-xl border p-2.5 text-left transition-colors sm:w-[180px]",
                selected
                  ? "border-primary ring-2 ring-primary/20"
                  : "hover:border-muted-foreground/40",
              )}
            >
              <div className="mb-2 flex items-start justify-between gap-1.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{template.name}</div>
                  {template.isDefault ? (
                    <div className="text-[11px] text-muted-foreground">Par défaut</div>
                  ) : null}
                </div>
                {selected ? (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    ✓
                  </span>
                ) : null}
              </div>
              <TemplateThumbnail
                options={template.options ?? DEFAULT_TEMPLATE_OPTIONS}
                className="aspect-[3/4]"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
