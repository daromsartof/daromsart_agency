"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@daromsart/ui";

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
}

export const SignatureCanvas = forwardRef<SignatureCanvasHandle, SignatureCanvasProps>(
  function SignatureCanvas({ onChange }, ref) {
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
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#1f1f29";
    }, []);

    function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
      const rect = canvasRef.current!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
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
    }

    function clear() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawnRef.current = false;
      setIsEmpty(true);
      onChange?.(true);
    }

    useImperativeHandle(ref, () => ({
      clear,
      toDataUrl: () => (hasDrawnRef.current ? canvasRef.current!.toDataURL("image/png") : null),
    }));

    return (
      <div className="space-y-2">
        <canvas
          ref={canvasRef}
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, touchAction: "none" }}
          className="rounded-md border bg-white"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Tracez votre signature ci-dessus.</p>
          <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={isEmpty}>
            Effacer
          </Button>
        </div>
      </div>
    );
  },
);
