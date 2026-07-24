"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { Button, Card, CardContent, Stepper } from "@daromsart/ui";
import { buildPayloadFromForm } from "./build-payload";
import { ContentForm } from "./content-form";
import { DesignPanel } from "./design-panel";
import { DownloadActions } from "./download-actions";
import { QrPreview, type QrPreviewHandle } from "./qr-preview";
import { SaveQrDialog } from "./save-qr-dialog";
import { TypePicker } from "./type-picker";
import {
  DEFAULT_DESIGN,
  DEFAULT_FORM,
  QR_TYPE_META,
  type QrContentType,
  type QrDesignOptions,
  type QrFormValues,
} from "./types";

const STEPS = [
  { id: "type", label: "Type" },
  { id: "content", label: "Contenu" },
  { id: "design", label: "Design" },
] as const;

/** Wizard séquentiel : une seule étape visible à la fois. */
export function QrGenerator() {
  const [step, setStep] = React.useState(0);
  const [type, setType] = React.useState<QrContentType>("url");
  const [values, setValues] = React.useState<QrFormValues>(DEFAULT_FORM);
  const [design, setDesign] = React.useState<QrDesignOptions>(DEFAULT_DESIGN);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const previewRef = React.useRef<QrPreviewHandle>(null);

  const payload = React.useMemo(
    () => buildPayloadFromForm(type, values),
    [type, values],
  );

  const typeMeta = QR_TYPE_META.find((t) => t.id === type)!;
  const canGoNext =
    step === 0 ? true : step === 1 ? Boolean(payload) : false;

  function goNext() {
    if (step >= STEPS.length - 1) return;
    if (step === 1 && !payload) return;
    setStep((s) => s + 1);
  }

  function goBack() {
    if (step <= 0) return;
    setStep((s) => s - 1);
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <Stepper
        steps={[...STEPS]}
        current={step}
        className="mx-auto w-full max-w-4xl"
        onStepClick={(index) => {
          // Retour libre ; avance uniquement si le contenu est déjà valide.
          if (index <= step) setStep(index);
          else if (index === 2 && payload) setStep(2);
          else if (index === 1) setStep(1);
        }}
      />

      <Card className="flex min-h-[calc(100vh-14rem)] flex-col overflow-hidden">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-6 p-5 sm:p-6">
          {step === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight">
                  Quel type de QR code ?
                </h2>
                <p className="text-sm text-muted-foreground">
                  Choisissez le format de contenu à encoder.
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-muted/20 p-2 sm:p-3">
                <TypePicker
                  value={type}
                  onChange={(next) => {
                    setType(next);
                  }}
                  layout="grid"
                />
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {typeMeta.label}
                </p>
                <h2 className="text-lg font-semibold tracking-tight">
                  Renseignez le contenu
                </h2>
                <p className="text-sm text-muted-foreground">
                  {typeMeta.description}. Ces informations seront gravées dans le QR.
                </p>
              </div>
              <div className="mx-auto w-full max-w-2xl space-y-4">
                <ContentForm
                  type={type}
                  values={values}
                  onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
                />
                {!payload ? (
                  <p className="text-xs text-muted-foreground">
                    Complétez les champs requis pour continuer.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:items-start">
              <div className="min-w-0 flex-1 space-y-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold tracking-tight">
                    Personnalisez le design
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Couleurs, marge et logo — puis téléchargez votre QR.
                  </p>
                </div>
                <DesignPanel
                  value={design}
                  onChange={(patch) => setDesign((prev) => ({ ...prev, ...patch }))}
                />
              </div>
              <div className="mx-auto w-full max-w-[320px] shrink-0 space-y-4 lg:mx-0 lg:sticky lg:top-2">
                <QrPreview ref={previewRef} payload={payload} design={design} />
                <DownloadActions
                  disabled={!payload}
                  onDownloadPng={() => void previewRef.current?.downloadPng()}
                  onDownloadSvg={() => void previewRef.current?.downloadSvg()}
                />
                <Button
                  type="button"
                  className="w-full"
                  disabled={!payload}
                  onClick={() => setSaveOpen(true)}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Sauvegarder
                </Button>
                <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                  QR statique — prêt à imprimer, partager ou retrouver plus tard.
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>

        <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-5 py-3 sm:px-6">
          <Button
            type="button"
            variant="ghost"
            onClick={goBack}
            disabled={step === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>

          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={goNext} disabled={!canGoNext}>
              Suivant
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!payload}
              onClick={() => setSaveOpen(true)}
            >
              <Save className="mr-2 h-4 w-4" />
              Sauvegarder
            </Button>
          )}
        </div>
      </Card>

      {payload ? (
        <SaveQrDialog
          open={saveOpen}
          onOpenChange={setSaveOpen}
          contentType={type}
          formValues={values}
          design={design}
          payload={payload}
        />
      ) : null}
    </div>
  );
}
