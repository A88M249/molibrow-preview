import raw from "../../data/products.json";

export type Variant = { sku: string; size: string | null; priceOre: number; compareAtOre: number | null; available: boolean };
export type Product = {
  handle: string;
  title: string;
  category: CategoryId;
  family: string;
  description: string;
  needsReview: boolean;
  updatedAt: string;
  colour: string | null;
  images: { src: string; width: number; height: number; alt: string | null }[];
  variants: Variant[];
};

export type CategoryId = "landevei" | "gravel" | "terreng" | "elsykkel" | "barn";

export const CATEGORIES: Record<CategoryId, { name: string; noun: string; title: string; intro: string; guide: string }> = {
  landevei: {
    noun: "landeveissykkel",
    name: "Landevei",
    title: "Landeveissykler og racersykler",
    intro: "Lette karbon- og aluminiumssykler for asfalt, fra konkurranse til komfortable langturer.",
    guide: "Velg etter hvordan du sykler: aerodynamiske racere for fart, lette klatresykler for bakker og endurance-geometri for lange dager i sadelen. Riktig rammestørrelse betyr mer enn utstyrsnivå.",
  },
  gravel: {
    noun: "gravelsykkel",
    name: "Gravel",
    title: "Gravelsykler og grussykler",
    intro: "Allsidige sykler for grus, skogsveier og asfalt, med plass til brede dekk.",
    guide: "Gravelsykler kombinerer landeveiens effektivitet med bredere dekk og stabil geometri. De passer både til lange turer, pendling og bikepacking.",
  },
  terreng: {
    noun: "terrengsykkel",
    name: "Terreng",
    title: "Terrengsykler (MTB)",
    intro: "Hardtail og fulldempede terrengsykler for cross-country, stisykling og eventyr.",
    guide: "Hardtail er lett og effektiv, fulldempet gir mer kontroll og komfort på tekniske stier. Velg etter terrenget du faktisk sykler i.",
  },
  elsykkel: {
    noun: "elsykkel",
    name: "Elsykkel",
    title: "Elsykler",
    intro: "Elektriske terreng-, gravel- og landeveissykler med naturlig kjørefølelse.",
    guide: "Motoren gir drahjelp, ikke erstatning for pedalene. Tenk på batterikapasitet, rekkevidde og hvor du skal sykle når du velger modell.",
  },
  barn: {
    noun: "barnesykkel",
    name: "Barn",
    title: "Barnesykler",
    intro: "Robuste barnesykler i aluminium, tilpasset barnets høyde og alder.",
    guide: "Velg sykkel etter barnets høyde, ikke alder. Hjulstørrelsen (20 eller 24 tommer) følger høyden.",
  },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[];

export const products = raw as Product[];

export const byHandle = (h: string) => products.find((p) => p.handle === h);
export const inCategory = (c: CategoryId) => products.filter((p) => p.category === c);
export const familiesIn = (c: CategoryId) => [...new Set(inCategory(c).map((p) => p.family))].sort();

export const priceRange = (p: Product) => {
  const prices = p.variants.map((v) => v.priceOre);
  return { low: Math.min(...prices), high: Math.max(...prices) };
};
export const isAvailable = (p: Product) => p.variants.some((v) => v.available);
export const compareAt = (p: Product) => {
  const v = p.variants.find((x) => x.compareAtOre && x.compareAtOre > x.priceOre);
  return v?.compareAtOre ?? null;
};

/** 84990 kr -> "84 990 kr" (Norwegian style, no decimals). */
export const kr = (ore: number) => `${new Intl.NumberFormat("nb-NO").format(Math.round(ore / 100)).replace(/ /g, " ")} kr`;

/** Facts we can state without inventing anything. */
export const productSummary = (p: Product) => {
  const sizes = p.variants.filter((v) => v.available && v.size).map((v) => v.size);
  return `${p.title} er en ${CATEGORIES[p.category].noun} fra MMR, solgt av BikeLink, offisiell importør i Norge.` +
    (p.colour ? ` Farge: ${p.colour}.` : "") +
    (sizes.length ? ` På lager i størrelse ${sizes.join(", ")}.` : " Er for tiden utsolgt.");
};
