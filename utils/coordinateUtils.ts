export interface ValidCoordinates {
  latitude: number;
  longitude: number;
}

export function normalizeCoordinatePair(lat: unknown, lng: unknown): ValidCoordinates | null {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
  if (lat === '' || lng === '') return null;

  const latitude = Number(lat);
  const longitude = Number(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;
  if (latitude === 0 && longitude === 0) return null;

  return { latitude, longitude };
}

export function hasValidCoordinates(lat: unknown, lng: unknown): boolean {
  return normalizeCoordinatePair(lat, lng) !== null;
}
