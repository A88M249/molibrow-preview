// Lifestyle photography from BikeLink's own site and MMR's media (see public/life). Add new photos here.
import type { CategoryId } from "./products";

export type Photo = { src: string; alt: string; w: number; h: number };
const p = (file: string, alt: string, w = 2000, h = 1125): Photo => ({ src: `/life/${file}.webp`, alt, w, h });

export const LIFE = {
  // film frames
  mountains: p("mountains", "Syklist i MMR-drakt står med sykkelen foran snødekte fjell", 1920, 1080),
  hilltop: p("hilltop", "Syklist på MMR landeveissykkel i motbakke langs kysten", 1920, 1080),
  curve: p("curve", "Syklist legger MMR-sykkelen inn i en sving på fjellvei", 1920, 1080),
  face: p("face", "Syklist i sterk fart på en rett landevei omgitt av trær", 1920, 1080),
  frameDetail: p("frame-detail", "Nærbilde av MMR-ramme og felg", 1920, 1080),
  aelionDetail: p("aelion-detail", "Nærbilde av Aelion SL-rammen i grønn og sølv", 1920, 1080),
  // photography
  roadRidge: p("road-ridge", "Syklist på landeveissykkel i fart foran fjellandskap", 2000, 1334),
  roadMountain: p("road-mountain", "To syklister på en fjellvei i solnedgang", 2000, 1125),
  roadMist: p("road-mist", "Syklist på våt fjellvei i tåke", 2000, 1333),
  roadBlur: p("road-blur", "Syklist i stor fart forbi grønne enger", 2000, 1333),
  gravelTrail: p("gravel-trail", "Syklist på gravelsykkel følger en svingete grusvei", 2000, 1333),
  gravelRider: p("gravel-rider", "Syklist på gravelsykkel på en steinete grusvei", 2000, 1333),
  gravelSunset: p("gravel-sunset", "Syklist på gravelsykkel i kveldslys med fjell bak", 2000, 1125),
  gravelNight: p("gravel-night", "Syklist i rød jakke på gravelsykkel i skumringen", 1983, 1983),
  mtbHardtail: p("mtb-hardtail", "Hvit hardtail terrengsykkel i et gresskledd landskap", 2000, 1125),
  mtbForest: p("mtb-forest", "Fulldempet terrengsykkel i skogen om høsten", 2000, 1429),
  ebikeAutumn: p("ebike-autumn", "Elektrisk terrengsykkel i varmt høstlys", 2000, 1125),
  beach: p("beach", "Syklist på sykkel langs en tåkete strand", 2000, 1125),
  detailStem: p("detail-stem", "Nærbilde av stem og styre i rød og grå", 2000, 1333),
  detailBrake: p("detail-brake", "Nærbilde av skivebremse og gaffel", 2000, 1333),
  detailDark: p("detail-dark", "Nærbilde av MMR-ramme i dempet lys", 2000, 1333),
  showroom: p("showroom", "MMR-sykler montert på veggen i et verksted med fjellmotiv", 1920, 1277),
  carbonRepair: p("carbon-repair", "Reparasjon av en karbonramme på verkstedbenk", 1500, 2000),
} satisfies Record<string, Photo>;

/** Hero photo per bike type (kids' bikes have no photography yet). */
export const CATEGORY_PHOTO: Partial<Record<CategoryId, { hero: Photo; position?: string }>> = {
  landevei: { hero: LIFE.roadRidge, position: "50% 40%" },
  gravel: { hero: LIFE.gravelTrail, position: "50% 55%" },
  terreng: { hero: LIFE.mtbForest, position: "50% 60%" },
  elsykkel: { hero: LIFE.ebikeAutumn, position: "50% 55%" },
};

/** Mood photo shown at the bottom of product pages in that category. */
export const CATEGORY_MOOD: Partial<Record<CategoryId, Photo>> = {
  landevei: LIFE.roadMist, gravel: LIFE.gravelSunset, terreng: LIFE.mtbHardtail, elsykkel: LIFE.ebikeAutumn,
};
