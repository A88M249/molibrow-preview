export type CartLine = { sku: string; handle: string; title: string; size: string | null; priceOre: number; image: string | null; quantity: number };
export const CART_KEY = "bikelink-cart-v1";
export const cartTotal = (lines: CartLine[]) => lines.reduce((s, l) => s + l.priceOre * l.quantity, 0);
export const cartCount = (lines: CartLine[]) => lines.reduce((s, l) => s + l.quantity, 0);
