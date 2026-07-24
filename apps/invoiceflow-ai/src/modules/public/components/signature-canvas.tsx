"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eraser, PenLine } from "lucide-react";
import { Button, cn } from "@daromsart/ui";

const CANVAS_WIDTH = 560;
const CANVAS_HEIGHT = 180;

export interface SignatureCanvasHandle {
  /** `null` si rien n'a été tracé. */
  toDataUrl: () => string | null;
  clear: () => void;
}

/**
 * Canvas de signature maison (pointer events, trait lissé, pas de lib — cf.
 * plans/story-11.md). Le canvas physique est en résolution ×2 (devicePixelRatio
 * plafonné) pour un tracé net, mais reste petit (560×180 logique) : le PNG
 * exporté tient largement sous la garde serveur de 500 Ko.
 */
export interface SignatureCanvasProps {
  onChange?: (isEmpty: boolean) => void;
  className?: string;
}

export const SignatureCanvas = forwardRef<SignatureCanvasHandle, SignatureCanvasProps>(
  function SignatureCanvas({ onChange, className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const hasDrawnRef = useRef(false);
    const [isEmpty, setIsEmpty] = useState(true);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = CANVAS_WIDTH * scale;
      canvas.height = CANVAS_HEIGHT * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.25;
      ctx.strokeStyle = "#1e293b";
    }, []);

    function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }

    function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      lastPointRef.current = getPoint(e);
    }

    function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!drawingRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const last = lastPointRef.current;
      if (!canvas || !ctx || !last) return;
      const point = getPoint(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      lastPointRef.current = point;
      if (!hasDrawnRef.current) {
        hasDrawnRef.current = true;
        setIsEmpty(false);
        onChange?.(false);
      }
    }

    function handlePointerUp() {
      drawingRef.current = false;
      lastPointRef.current = null;
      if (hasDrawnRef.current) onChange?.(false);
    }

    function clear() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      // clearRect doit utiliser la taille buffer (après scale du contexte,
      // on reset via setTransform pour couvrir tout le bitmap).
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.25;
      ctx.strokeStyle = "#1e293b";
      hasDrawnRef.current = false;
      setIsEmpty(true);
      onChange?.(true);
    }

    useImperativeHandle(ref, () => ({
      clear,
      toDataUrl: () => (hasDrawnRef.current ? canvasRef.current!.toDataURL("image/png") : null),
    }));

    return (
      <div className={cn("space-y-2.5", className)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <PenLine className="h-4 w-4 text-muted-foreground" />
            Signature manuscrite
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-muted-foreground"
            onClick={clear}
            disabled={isEmpty}
          >
            <Eraser className="h-3.5 w-3.5" />
            Effacer
          </Button>
        </div>

        <div
          className={cn(
            "relative overflow-hidden rounded-xl border bg-white shadow-inner",
            "ring-1 ring-black/5 dark:ring-white/10",
            "transition-[box-shadow,ring-color]",
            isEmpty
              ? "border-dashed border-muted-foreground/30"
              : "border-solid border-border",
          )}
        >
          {/* Fond « papier » subtil */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, #0f172a 1px, transparent 0)",
              backgroundSize: "14px 14px",
            }}
          />

          {/* Ligne-guide de signature */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 bottom-[28%] border-t border-dashed border-slate-300/80"
          />

          {isEmpty ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center">
              <p className="text-sm font-medium text-slate-400">
                Signez ici
              </p>
              <p className="text-xs text-slate-400/80">
                Souris, stylet ou doigt
              </p>
            </div>
          ) : null}

          <canvas
            ref={canvasRef}
            aria-label="Zone de signature"
            className="relative z-[1] block h-auto w-full cursor-crosshair touch-none"
            style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {isEmpty
            ? "Tracez votre signature dans le cadre ci-dessus."
            : "Signature prête — vous pouvez encore l’effacer ou la modifier."}
        </p>
      </div>
    );
  },
);
