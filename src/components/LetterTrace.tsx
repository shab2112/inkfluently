"use client";

import { useEffect, useRef } from "react";

/**
 * Freehand tracing practice: a word rendered as a low-opacity guide in the
 * Playwrite Guides font (which bakes in its own baseline/height marks per
 * letter — see the font import in globals.css), with a transparent canvas on
 * top capturing pointer input so a child can trace over it with a finger,
 * stylus, or mouse (Pointer Events cover all three, not just touch devices).
 * No stroke-accuracy scoring — judging HOW WELL a trace matches the glyph
 * outline is a meaningfully bigger problem than the tracing surface itself;
 * this is self-correction by eye, same as a paper dotted-letter worksheet.
 */
export function LetterTrace({ word, onClose }: { word: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = 7;
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#bd4416";
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = getPos(e);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !lastPointRef.current) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPointRef.current = pos;
  }

  function handlePointerUp() {
    drawingRef.current = false;
    lastPointRef.current = null;
  }

  function clear() {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas || !container) return;
    const rect = container.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--paper)" }}>
      <div
        className="flex items-center justify-between gap-2.5 px-4 py-3.5 border-b flex-none"
        style={{ borderColor: "var(--rule)" }}
      >
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full border text-base"
          style={{ background: "var(--paper-2)", borderColor: "var(--rule)", color: "var(--ink-soft)" }}
        >
          ✕
        </button>
        <span
          className="text-xs uppercase tracking-wide rounded-full border px-3 py-1.5"
          style={{ background: "var(--paper-2)", borderColor: "var(--rule)", color: "var(--ink-soft)" }}
        >
          Trace &quot;{word}&quot;
        </span>
        <button
          type="button"
          onClick={clear}
          className="rounded-full border px-3.5 py-2 text-xs font-semibold"
          style={{ background: "var(--paper-2)", borderColor: "var(--rule)" }}
        >
          Clear
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-4 min-h-0">
        <div
          ref={containerRef}
          className="relative w-full max-w-xl rounded-2xl border overflow-hidden"
          style={{ background: "var(--paper-2)", borderColor: "var(--rule)", aspectRatio: "4 / 3", touchAction: "none" }}
        >
          <div className="absolute inset-0 flex items-center justify-center px-4 pointer-events-none select-none">
            <span
              className="text-center break-words"
              style={{
                fontFamily: "'Playwrite US Modern Guides', cursive",
                fontSize: "clamp(48px, 16vw, 120px)",
                color: "var(--ink-faint)",
                opacity: 0.55,
              }}
            >
              {word}
            </span>
          </div>
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ touchAction: "none" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </div>
      </div>

      <div className="px-4 pb-5 text-center text-xs flex-none" style={{ color: "var(--ink-soft)" }}>
        Trace over the faint letters with a finger, stylus, or mouse — there&apos;s no scoring here, just practice.
      </div>
    </div>
  );
}
