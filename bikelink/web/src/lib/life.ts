// Lifestyle photography: frames from BikeLink's own MMR hero film (1920x1080).
// Add new photos to public/life/ and register them here.
export type Photo = { src: string; alt: string; w: number; h: number };
const p = (file: string, alt: string): Photo => ({ src: `/life/${file}.webp`, alt, w: 1920, h: 1080 });

export const LIFE = {
  mountains: p("mountains", "Syklist i MMR-drakt står med sykkelen foran snødekte fjell"),
  hilltop: p("hilltop", "Syklist på MMR landeveissykkel i motbakke langs kysten"),
  curve: p("curve", "Syklist legger MMR-sykkelen inn i en sving på fjellvei"),
  face: p("face", "Syklist i sterk fart på en rett landevei omgitt av trær"),
  frameDetail: p("frame-detail", "Nærbilde av MMR-ramme og felg"),
  aelionDetail: p("aelion-detail", "Nærbilde av Aelion SL-rammen i grønn og sølv"),
};
