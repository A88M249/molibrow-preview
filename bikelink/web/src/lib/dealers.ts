// Source: bikelink.no/pages/service-locations (22 Nov 2026).
export type Service = "showroom" | "service" | "pickup";
export type Dealer = {
  id: string; name: string; city: string; street: string; postcode: string; email: string; services: Service[]; note?: string;
};

export const SERVICE_LABEL: Record<Service, string> = { showroom: "Showroom", service: "Verksted og service", pickup: "Utlevering" };

export const DEALERS: Dealer[] = [
  { id: "candy-mountain", name: "Candy Mountain Cyclery", city: "Oslo", street: "Waldemar Thranes gate 51", postcode: "0173", email: "cyclery@candymountain.no", services: ["showroom", "service", "pickup"] },
  { id: "bike2work", name: "Bike2Work", city: "Oslo", street: "Enebakkveien 203", postcode: "0680", email: "tore@bike2work.no", services: ["service", "pickup"] },
  { id: "sportienda", name: "Sportienda", city: "Oslo", street: "Husebybakken 28b", postcode: "0379", email: "team@sportienda.com", services: ["service", "pickup"], note: "Også BikeLinks partner for innbytte av brukte sykler." },
  { id: "sporten-eidsvoll", name: "Sporten Eidsvoll", city: "Eidsvoll", street: "Rådhusgata 8", postcode: "2080", email: "sporten@sporteneidsvoll.no", services: ["showroom", "service", "pickup"] },
  { id: "bici-bergen", name: "Bici Bergen Sykkelverksted", city: "Bergen", street: "Nye Sandviksveien 73B", postcode: "5032", email: "daniel@bicibergen.no", services: ["showroom", "service", "pickup"] },
  { id: "ladeverket", name: "Ladeverket Sykkelverksted", city: "Trondheim", street: "Haakon VII's gate 17", postcode: "7041", email: "kontakt@ladeverket.no", services: ["showroom", "service", "pickup"] },
  { id: "happy-bikes", name: "Happy Bikes", city: "Stavanger", street: "Haugåsstubben 10", postcode: "4016", email: "post@happybike.no", services: ["showroom", "service", "pickup"] },
];

export const CITIES = [...new Set(DEALERS.map((d) => d.city))];
export const PICKUP_DEALERS = DEALERS.filter((d) => d.services.includes("pickup"));
export const mapUrl = (d: Dealer) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.street}, ${d.postcode} ${d.city}`)}`;
