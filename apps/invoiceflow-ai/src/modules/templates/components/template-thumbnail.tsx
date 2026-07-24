import { cn } from "@daromsart/ui";
import type { TemplateOptions } from "@daromsart/core";

/**
 * Mini-aperçu A4 d'un modèle : HTML fidèle au layout PDF (bandeau, logo,
 * parties, tableau, totaux, QR), branché sur `options`.
 * Pas de rendu `@react-pdf` ici — trop coûteux en grille (story 09) ; l'éditeur
 * garde l'iframe PDF live via `/api/templates/preview`.
 */
export function TemplateThumbnail({
  options,
  className,
}: {
  options: TemplateOptions;
  className?: string;
}) {
  const accent = options.accentColor;
  const serif = options.font === "serif";
  const logoLeft = options.logoPosition !== "right";
  const { unit, vatPerLine, discountPerLine } = options.columns;

  return (
    <div
      className={cn(
        "relative aspect-[3/4] overflow-hidden rounded-md border bg-white text-[0] shadow-sm dark:bg-zinc-50",
        className,
      )}
      aria-hidden
    >
      {/* Échelle du « document » : largeur logique 210 → conteneur 100 %. */}
      <div
        className={cn(
          "absolute inset-0 origin-top-left",
          serif ? "font-serif" : "font-sans",
        )}
        style={{ width: "210%", height: "210%", transform: "scale(0.476)" }}
      >
        {/* Bandeau accent */}
        <div className="h-2.5 w-full" style={{ backgroundColor: accent }} />

        <div className="space-y-3 px-4 pb-4 pt-3 text-[11px] leading-tight text-zinc-800">
          {/* En-tête : logo + titre */}
          <div
            className={cn(
              "flex items-start justify-between gap-3",
              !logoLeft && "flex-row-reverse",
            )}
          >
            {options.showLogo ? (
              <div
                className="flex h-8 w-20 items-center justify-center rounded border border-dashed text-[9px] font-semibold tracking-wide"
                style={{ borderColor: accent, color: accent }}
              >
                LOGO
              </div>
            ) : (
              <div className="h-8 w-20" />
            )}
            <div className={cn("min-w-0", logoLeft ? "text-right" : "text-left")}>
              <div className="text-base font-bold" style={{ color: accent }}>
                Devis
              </div>
              <div className="text-[10px] text-zinc-500">DEV-2026-0001</div>
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-0.5 text-[8px] font-medium uppercase tracking-wide text-zinc-400">
                Émetteur
              </div>
              <div className="font-semibold">Votre Entreprise SAS</div>
              <div className="text-zinc-500">12 rue de l&apos;Exemple</div>
              <div className="text-zinc-500">75000 Paris</div>
            </div>
            <div>
              <div className="mb-0.5 text-[8px] font-medium uppercase tracking-wide text-zinc-400">
                Client
              </div>
              <div className="font-semibold">Client Démo SARL</div>
              <div className="text-zinc-500">4 avenue Démonstration</div>
              <div className="text-zinc-500">69000 Lyon</div>
            </div>
          </div>

          {/* Méta */}
          <div className="flex gap-4 rounded bg-zinc-100 px-2 py-1.5 text-[9px]">
            <div>
              <div className="uppercase text-zinc-400">Émission</div>
              <div className="font-semibold">15/06/2026</div>
            </div>
            <div>
              <div className="uppercase text-zinc-400">Validité</div>
              <div className="font-semibold">15/07/2026</div>
            </div>
          </div>

          <div>
            <div className="mb-1 font-semibold">Prestation de conseil</div>
            {options.headerNote ? (
              <div className="mb-2 line-clamp-1 text-[9px] text-zinc-500">
                {options.headerNote}
              </div>
            ) : (
              <div className="mb-2 text-[9px] text-zinc-500">Merci de votre confiance.</div>
            )}
          </div>

          {/* Tableau lignes */}
          <div>
            <div
              className="mb-1 grid gap-1 border-b border-zinc-200 pb-1 text-[8px] font-medium uppercase text-zinc-400"
              style={{
                gridTemplateColumns: [
                  "1fr",
                  unit ? "28px" : null,
                  "28px",
                  "40px",
                  vatPerLine ? "28px" : null,
                  discountPerLine ? "28px" : null,
                  "44px",
                ]
                  .filter(Boolean)
                  .join(" "),
              }}
            >
              <span>Description</span>
              {unit ? <span className="text-right">Unité</span> : null}
              <span className="text-right">Qté</span>
              <span className="text-right">PU HT</span>
              {vatPerLine ? <span className="text-right">TVA</span> : null}
              {discountPerLine ? <span className="text-right">Rem.</span> : null}
              <span className="text-right">Total</span>
            </div>
            {[
              { d: "Développement — facturation", q: "3", pu: "550 €", t: "1 650 €" },
              { d: "Formation équipe", q: "1", pu: "450 €", t: "405 €" },
            ].map((line) => (
              <div
                key={line.d}
                className="grid gap-1 border-b border-zinc-100 py-1 text-[9px]"
                style={{
                  gridTemplateColumns: [
                    "1fr",
                    unit ? "28px" : null,
                    "28px",
                    "40px",
                    vatPerLine ? "28px" : null,
                    discountPerLine ? "28px" : null,
                    "44px",
                  ]
                    .filter(Boolean)
                    .join(" "),
                }}
              >
                <span className="truncate">{line.d}</span>
                {unit ? <span className="text-right text-zinc-500">j</span> : null}
                <span className="text-right">{line.q}</span>
                <span className="text-right">{line.pu}</span>
                {vatPerLine ? <span className="text-right text-zinc-500">20%</span> : null}
                {discountPerLine ? <span className="text-right text-zinc-500">—</span> : null}
                <span className="text-right font-medium">{line.t}</span>
              </div>
            ))}
          </div>

          {/* Totaux */}
          <div className="ml-auto w-36 space-y-0.5 text-[9px]">
            <div className="flex justify-between text-zinc-500">
              <span>Sous-total HT</span>
              <span>2 055,00 €</span>
            </div>
            <div className="flex justify-between text-zinc-500">
              <span>TVA</span>
              <span>370,50 €</span>
            </div>
            <div
              className="flex justify-between border-t pt-1 text-[11px] font-bold"
              style={{ borderColor: accent, color: accent }}
            >
              <span>Total TTC</span>
              <span>2 380,50 €</span>
            </div>
          </div>

          {/* QR optionnels */}
          {(options.showPaymentQr || options.showPublicLinkQr) && (
            <div className="flex gap-3 pt-1">
              {options.showPaymentQr ? (
                <div className="flex flex-col items-center gap-0.5">
                  <div
                    className="grid h-10 w-10 grid-cols-3 gap-px rounded-sm p-1"
                    style={{ backgroundColor: `${accent}22` }}
                  >
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-[1px]"
                        style={{ backgroundColor: i % 2 === 0 ? accent : `${accent}55` }}
                      />
                    ))}
                  </div>
                  <span className="text-[7px] text-zinc-400">Paiement</span>
                </div>
              ) : null}
              {options.showPublicLinkQr ? (
                <div className="flex flex-col items-center gap-0.5">
                  <div className="grid h-10 w-10 grid-cols-3 gap-px rounded-sm bg-zinc-100 p-1">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "rounded-[1px]",
                          i % 2 === 0 ? "bg-zinc-700" : "bg-zinc-300",
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-[7px] text-zinc-400">Lien</span>
                </div>
              ) : null}
            </div>
          )}

          {(options.footerNote || options.paymentTermsText) && (
            <div className="line-clamp-2 border-t border-zinc-100 pt-2 text-[8px] text-zinc-400">
              {[options.footerNote, options.paymentTermsText].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
