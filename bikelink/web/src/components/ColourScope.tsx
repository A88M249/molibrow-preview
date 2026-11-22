"use client";
import Image from "next/image";
import { createContext, useContext, useMemo, useState } from "react";
import { Spin360 } from "./Spin360";

type Ctx = { colour: string | null; setColour: (c: string) => void };
const ColourCtx = createContext<Ctx>({ colour: null, setColour: () => {} });
export const useColour = () => useContext(ColourCtx);

/** Shares the selected colourway between the photo gallery and the buy panel (most MMR products list 2 colours as variants). */
export function ColourScope({ initial, children }: { initial: string | null; children: React.ReactNode }) {
  const [colour, setColour] = useState<string | null>(initial);
  return <ColourCtx.Provider value={{ colour, setColour }}>{children}</ColourCtx.Provider>;
}

type Img = { src: string; width: number; height: number; alt: string | null; colour?: string | null };

/** All photos stay in the page; the ones that belong to the chosen colour come first. */
export function Gallery({ images, frames, title }: { images: Img[]; frames: string[]; title: string }) {
  const { colour } = useColour();
  const ordered = useMemo(() => (colour ? [...images.filter((i) => i.colour === colour), ...images.filter((i) => i.colour !== colour)] : images), [images, colour]);
  const spin = frames.length >= 8;
  return (
    <div className="gallery">
      {spin && <div className="gallery-spin"><Spin360 frames={frames} alt={title} /></div>}
      {ordered.map((img, i) => (
        <Image key={img.src} src={img.src} alt={img.alt ?? `${title} – bilde ${i + 1}`} width={img.width} height={img.height} priority={i === 0 && !spin} sizes="(max-width:900px) 100vw, 55vw" className={i === 0 && !spin ? "wide" : ""} />
      ))}
    </div>
  );
}
