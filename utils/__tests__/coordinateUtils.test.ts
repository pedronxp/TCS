import { hasValidCoordinates, normalizeCoordinatePair } from '../coordinateUtils';

describe('coordinateUtils', () => {
  it('normaliza coordenadas validas', () => {
    expect(normalizeCoordinatePair('-23.55', '-46.63')).toEqual({
      latitude: -23.55,
      longitude: -46.63,
    });
    expect(hasValidCoordinates(-23.55, -46.63)).toBe(true);
  });

  it('rejeita coordenadas ausentes, invalidas, fora de faixa ou 0,0', () => {
    expect(normalizeCoordinatePair(null, -46.63)).toBeNull();
    expect(normalizeCoordinatePair(-23.55, undefined)).toBeNull();
    expect(normalizeCoordinatePair('abc', -46.63)).toBeNull();
    expect(normalizeCoordinatePair(-91, -46.63)).toBeNull();
    expect(normalizeCoordinatePair(-23.55, -181)).toBeNull();
    expect(normalizeCoordinatePair(0, 0)).toBeNull();
  });
});
