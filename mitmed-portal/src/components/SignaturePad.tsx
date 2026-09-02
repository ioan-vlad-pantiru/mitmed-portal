"use client";

import { useRef, useState } from "react";

/** Semnătură pe canvas, stilizată ca o linie de semnat pe un document real —
 * desen liber cu mouse/touch, exportat ca PNG base64. */
export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Canvas-ul e responsive (w-full), dar rezoluția lui internă de desen e
  // fixă (500×130) — fără scalare, coordonatele mouse-ului (în pixeli CSS)
  // nu se potrivesc cu pixelii de desen ori de câte ori dimensiunea afișată
  // diferă de 500×130, ceea ce face linia să "alunece" față de mouse.
  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#242424";
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasDrawn) setHasDrawn(true);
  }

  function finishStroke() {
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas && hasDrawn) onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange(null);
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={500}
        height={130}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerLeave={finishStroke}
        className="relative z-10 w-full touch-none"
      />
      {/* Linia de semnat, ca pe un document tipărit */}
      <div className="pointer-events-none absolute inset-x-0 bottom-8 border-b border-dashed border-zinc-300" />
      {!hasDrawn && (
        <span className="pointer-events-none absolute bottom-9 left-0 text-xs italic text-zinc-300">
          semnează aici ×
        </span>
      )}
      <button
        type="button"
        onClick={clear}
        className="absolute bottom-0 right-0 z-20 text-xs text-zinc-400 hover:text-zinc-600 hover:underline"
      >
        Șterge
      </button>
    </div>
  );
}
