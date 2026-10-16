export const TASHKENT = { lat: 41.3111, lng: 69.2797 };
export const DISTRICTS: Record<string, { lat: number; lng: number }> = {
  Yunusobod: { lat: 41.364, lng: 69.288 },
  Chilonzor: { lat: 41.275, lng: 69.204 },
  'Mirzo Ulug‘bek': { lat: 41.338, lng: 69.334 },
  Yakkasaroy: { lat: 41.287, lng: 69.27 },
  Sergeli: { lat: 41.226, lng: 69.218 },
  Olmazor: { lat: 41.345, lng: 69.215 },
  Yashnobod: { lat: 41.29, lng: 69.34 },
  Shayxontohur: { lat: 41.322, lng: 69.235 },
  Mirobod: { lat: 41.292, lng: 69.285 },
  Uchtepa: { lat: 41.29, lng: 69.17 },
  Bektemir: { lat: 41.21, lng: 69.335 },
  Yangihayot: { lat: 41.2, lng: 69.25 },
};
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) * 10) / 10;
}
export const originOf = (district?: string | null, lat?: number, lng?: number) =>
  lat && lng ? { lat, lng } : (district && DISTRICTS[district]) || TASHKENT;
