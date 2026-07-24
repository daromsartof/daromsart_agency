"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type RenderTask,
} from "pdfjs-dist";
import { Button, cn } from "@daromsart/ui";
import {
  STAMP_HEIGHT,
  STAMP_WIDTH,
  type SignaturePlacement,
} from "@/modules/signable-documents/signature-placement";

GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const MIN_STAMP = 40;

function isRenderCancelled(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: string }).name === "RenderingCancelledException"
  );
}

type DragMode = "move" | "nw" | "ne" | "sw" | "se";

export interface PdfSignatureViewerProps {
  pdfUrl: string;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  signatureUrl: string | null;
  placement: SignaturePlacement | null;
  onPlacementChange: (placement: SignaturePlacement) => void;
}

function defaultPlacement(pageWidth: number, pageHeight: number): SignaturePlacement {
  return {
    x: Math.max(24, pageWidth - STAMP_WIDTH - 24),
    y: 24,
    width: STAMP_WIDTH,
    height: STAMP_HEIGHT,
  };
}

function clampPlacement(
  p: SignaturePlacement,
  pageWidth: number,
  pageHeight: number,
): SignaturePlacement {
  const width = Math.min(Math.max(p.width, MIN_STAMP), pageWidth);
  const height = Math.min(Math.max(p.height, MIN_STAMP), pageHeight);
  return {
    width,
    height,
    x: Math.max(0, Math.min(p.x, pageWidth - width)),
    y: Math.max(0, Math.min(p.y, pageHeight - height)),
  };
}

export function PdfSignatureViewer({
  pdfUrl,
  page,
  pageCount,
  onPageChange,
  signatureUrl,
  placement,
  onPlacementChange,
}: PdfSignatureViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const renderGenRef = useRef(0);
  const pageSizeRef = useRef({ width: 595, height: 842 });
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    origin: SignaturePlacement;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  const cancelRender = useCallback(() => {
    if (!renderTaskRef.current) return;
    try {
      renderTaskRef.current.cancel();
    } catch {
      // déjà terminé / annulé
    }
    renderTaskRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    cancelRender();

    (async () => {
      try {
        pdfRef.current?.destroy();
        pdfRef.current = null;
        const task = getDocument({ url: pdfUrl, withCredentials: true });
        const pdf = await task.promise;
        if (cancelled) {
          pdf.destroy();
          return;
        }
        pdfRef.current = pdf;
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Impossible de charger le PDF.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      cancelRender();
      pdfRef.current?.destroy();
      pdfRef.current = null;
    };
  }, [pdfUrl, cancelRender]);

  const renderPage = useCallback(async () => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!pdf || !canvas || !container) return;

    const gen = ++renderGenRef.current;
    cancelRender();

    const pdfPage = await pdf.getPage(page);
    if (gen !== renderGenRef.current) return;

    const base = pdfPage.getViewport({ scale: 1 });
    pageSizeRef.current = { width: base.width, height: base.height };

    const maxWidth = container.clientWidth || 800;
    const scale = maxWidth / base.width;
    const viewport = pdfPage.getViewport({ scale });

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (gen !== renderGenRef.current) return;

    const task = pdfPage.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;

    try {
      await task.promise;
      if (gen !== renderGenRef.current) return;
      setDisplaySize({ width: viewport.width, height: viewport.height });
    } catch (err) {
      if (!isRenderCancelled(err)) {
        console.error(err);
        setError("Impossible d’afficher le PDF.");
      }
    } finally {
      if (renderTaskRef.current === task) {
        renderTaskRef.current = null;
      }
    }
  }, [page, cancelRender]);

  useEffect(() => {
    if (loading || error) return;

    void renderPage();

    const container = containerRef.current;
    if (!container) return;

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        void renderPage();
      }, 100);
    });
    observer.observe(container);

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      observer.disconnect();
      cancelRender();
    };
  }, [loading, error, renderPage, cancelRender]);

  // Première apparition de la signature → placement par défaut bas-droite
  useEffect(() => {
    if (!signatureUrl || placement) return;
    const { width, height } = pageSizeRef.current;
    onPlacementChange(defaultPlacement(width, height));
  }, [signatureUrl, placement, onPlacementChange]);

  const scaleX = displaySize.width / pageSizeRef.current.width;
  const scaleY = displaySize.height / pageSizeRef.current.height;

  function screenRect(p: SignaturePlacement) {
    return {
      left: p.x * scaleX,
      top: (pageSizeRef.current.height - p.y - p.height) * scaleY,
      width: p.width * scaleX,
      height: p.height * scaleY,
    };
  }

  function onPointerDown(mode: DragMode, e: React.PointerEvent) {
    if (!placement) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origin: { ...placement },
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || scaleX <= 0 || scaleY <= 0) return;

    const dx = (e.clientX - drag.startX) / scaleX;
    const dy = (e.clientY - drag.startY) / scaleY;
    const o = drag.origin;
    const { width: pw, height: ph } = pageSizeRef.current;
    let next: SignaturePlacement = { ...o };

    if (drag.mode === "move") {
      // Écran Y↓ → PDF Y↑
      next = { ...o, x: o.x + dx, y: o.y - dy };
    } else if (drag.mode === "se") {
      next = { x: o.x, y: o.y - dy, width: o.width + dx, height: o.height + dy };
    } else if (drag.mode === "sw") {
      next = { x: o.x + dx, y: o.y - dy, width: o.width - dx, height: o.height + dy };
    } else if (drag.mode === "ne") {
      next = { x: o.x, y: o.y, width: o.width + dx, height: o.height - dy };
    } else {
      next = { x: o.x + dx, y: o.y, width: o.width - dx, height: o.height - dy };
    }

    if (next.width < 0) {
      next.x += next.width;
      next.width = Math.abs(next.width);
    }
    if (next.height < 0) {
      next.y += next.height;
      next.height = Math.abs(next.height);
    }

    onPlacementChange(clampPlacement(next, pw, ph));
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  const rect = placement && scaleX > 0 ? screenRect(placement) : null;

  return (
    <div className="flex flex-col gap-3">
      {pageCount > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Page précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[7rem] text-center text-sm text-muted-foreground">
            Page {page} / {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
            aria-label="Page suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div ref={containerRef} className="relative overflow-auto rounded-lg border bg-muted/30">
        {loading ? (
          <div className="flex h-[min(70vh,720px)] items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement du PDF…
          </div>
        ) : error ? (
          <div className="flex h-[min(40vh,320px)] items-center justify-center text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div className="relative mx-auto w-fit max-w-full">
            <canvas ref={canvasRef} className="block max-w-full" />

            {!signatureUrl ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-6 mx-auto max-w-sm rounded-lg bg-background/90 px-4 py-2 text-center text-xs text-muted-foreground shadow-sm ring-1 ring-border">
                Tracez votre signature à droite — elle apparaîtra ici pour être
                déplacée et redimensionnée.
              </div>
            ) : null}

            {signatureUrl && rect ? (
              <div
                role="img"
                aria-label="Aperçu de la signature — glisser pour déplacer, coins pour redimensionner"
                className={cn(
                  "absolute touch-none select-none",
                  "rounded-sm border-2 border-primary bg-white/40 shadow-md",
                  "cursor-grab active:cursor-grabbing",
                )}
                style={{
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                }}
                onPointerDown={(e) => onPointerDown("move", e)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signatureUrl}
                  alt=""
                  draggable={false}
                  className="pointer-events-none h-full w-full object-contain p-0.5"
                />
                {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                  <span
                    key={corner}
                    className={cn(
                      "absolute z-10 h-3 w-3 rounded-sm border-2 border-primary bg-background",
                      corner === "nw" && "-left-1.5 -top-1.5 cursor-nwse-resize",
                      corner === "ne" && "-right-1.5 -top-1.5 cursor-nesw-resize",
                      corner === "sw" && "-bottom-1.5 -left-1.5 cursor-nesw-resize",
                      corner === "se" && "-bottom-1.5 -right-1.5 cursor-nwse-resize",
                    )}
                    onPointerDown={(e) => onPointerDown(corner, e)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
