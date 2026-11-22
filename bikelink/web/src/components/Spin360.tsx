"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Drag / swipe / arrow-key 360° viewer over a numbered frame sequence. */
export function Spin360({ frames, alt }: { frames: string[]; alt: string }) {
  const [i, setI] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const drag = useRef<{ x: number; start: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const n = frames.length;
  const wrap = useCallback((k: number) => ((k % n) + n) % n, [n]);

  useEffect(() => {
    let done = 0;
    frames.forEach((src) => { const im = new Image(); im.onload = im.onerror = () => setLoaded(++done); im.src = src; });
  }, [frames]);

  // One slow intro turn so people notice it is interactive (skipped for reduced motion).
  useEffect(() => {
    if (loaded < n || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let k = 0;
    const t = setInterval(() => { k++; setI(wrap(k)); if (k >= n) clearInterval(t); }, 45);
    return () => clearInterval(t);
  }, [loaded, n, wrap]);

  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, start: i }; e.currentTarget.setPointerCapture(e.pointerId); };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !box.current) return;
    const pxPerFrame = Math.max(5, box.current.clientWidth / n);
    setI(wrap(drag.current.start - Math.round((e.clientX - drag.current.x) / pxPerFrame)));
  };
  const onUp = () => { drag.current = null; };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); setI((v) => wrap(v + 1)); }
    if (e.key === "ArrowLeft") { e.preventDefault(); setI((v) => wrap(v - 1)); }
  };

  return (
    <div className="spin" ref={box}>
      <div className="spin-stage" role="group" aria-label={`${alt} – 360° visning. Bruk piltastene for å rotere.`} tabIndex={0}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={frames[i]} alt={`${alt}, vinkel ${i + 1} av ${n}`} draggable={false} />
        {loaded < n && <span className="spin-load">Laster 360° ({Math.round((loaded / n) * 100)} %)</span>}
        <span className="spin-badge">360°</span>
      </div>
      <div className="spin-ctrl">
        <button type="button" className="icon-btn" onClick={() => setI(wrap(i - 1))} aria-label="Roter til venstre">‹</button>
        <input type="range" min={0} max={n - 1} value={i} onChange={(e) => setI(Number(e.target.value))} aria-label="Rotasjon" />
        <button type="button" className="icon-btn" onClick={() => setI(wrap(i + 1))} aria-label="Roter til høyre">›</button>
      </div>
      <p className="small muted spin-hint">Dra i bildet for å rotere sykkelen</p>
    </div>
  );
}
