"use client";
import { useRef } from "react";

/** Horizontal scroll-snap slider with previous / next buttons (polymer-style). */
export function Slider({ title, link, children }: { title: string; link?: React.ReactNode; children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const go = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section className="wrap section slider">
      <div className="slider-head">
        <h2>{title}</h2>
        <div className="slider-ctrl">
          {link}
          <button type="button" className="circle" aria-label="Forrige" onClick={() => go(-1)}>‹</button>
          <button type="button" className="circle" aria-label="Neste" onClick={() => go(1)}>›</button>
        </div>
      </div>
      <div className="slider-track" ref={track} tabIndex={0} aria-label={title}>{children}</div>
    </section>
  );
}
