// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPortalFormMarkerSymbol, PortalMap, type PortalMapPoint } from './PortalMap';

const mapMocks = vi.hoisted(() => ({
  construct: vi.fn(),
  fitBounds: vi.fn(),
  jumpTo: vi.fn(),
  removeMap: vi.fn(),
  removeMarker: vi.fn(),
  addMarker: vi.fn(),
}));

vi.mock('maplibre-gl', () => {
  class MapMock {
    constructor() { mapMocks.construct(); }
    addControl() {}
    once(event: string, callback: () => void) { if (event === 'load') callback(); }
    on() {}
    resize() {}
    remove() { mapMocks.removeMap(); }
    fitBounds(...args: unknown[]) { mapMocks.fitBounds(...args); }
    jumpTo(...args: unknown[]) { mapMocks.jumpTo(...args); }
  }
  class MarkerMock {
    setLngLat() { return this; }
    setPopup() { return this; }
    addTo() { mapMocks.addMarker(); return this; }
    remove() { mapMocks.removeMarker(); }
  }
  class PopupMock { setDOMContent() { return this; } }
  class BoundsMock { extend() { return this; } }
  return {
    default: {
      Map: MapMock,
      Marker: MarkerMock,
      Popup: PopupMock,
      LngLatBounds: BoundsMock,
      NavigationControl: class {},
      AttributionControl: class {},
    },
  };
});

const points: PortalMapPoint[] = [
  { id: '1', protocol: 'TCS-001', status: 'concluída', address: 'Rua A', formularioId: null, latitude: -8.1, longitude: -34.9 },
  { id: '2', protocol: 'TCS-002', status: 'pendente', address: 'Rua B', formularioId: null, latitude: -8.2, longitude: -35 },
];

describe('PortalMap', () => {
  beforeEach(() => {
    Object.values(mapMocks).forEach((mock) => mock.mockReset());
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('mantém a instância e atualiza marcadores incrementalmente', () => {
    const { rerender } = render(<PortalMap points={points} />);
    expect(mapMocks.construct).toHaveBeenCalledOnce();
    expect(mapMocks.addMarker).toHaveBeenCalledTimes(2);

    rerender(<PortalMap points={[points[1]]} />);
    expect(mapMocks.construct).toHaveBeenCalledOnce();
    expect(mapMocks.removeMap).not.toHaveBeenCalled();
    expect(mapMocks.removeMarker).toHaveBeenCalledOnce();
  });

  it('enquadra sem animação quando solicitado', () => {
    render(<PortalMap points={points} />);
    mapMocks.fitBounds.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Enquadrar' }));
    expect(mapMocks.fitBounds).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: 0 }));
  });

  it('não inicializa o mapa com coordenadas inválidas', () => {
    render(<PortalMap points={[{ ...points[0], latitude: 91 }]} />);
    expect(screen.getByText('Nenhuma vistoria com coordenadas neste escopo.')).toBeVisible();
    expect(mapMocks.construct).not.toHaveBeenCalled();
  });

  it('identifica os formulários operacionais com os símbolos aprovados', () => {
    expect(getPortalFormMarkerSymbol('inspecao_bueiro_drenagem_v1')).toBe('▦');
    expect(getPortalFormMarkerSymbol('risco_incendio_vegetacao_v1')).toBe('🔥');
    expect(getPortalFormMarkerSymbol('risco_inundacao_v1')).toBe('💧');
    expect(getPortalFormMarkerSymbol('avaliacao_arvore_cbmmg_v1')).toBe('♣');
    expect(getPortalFormMarkerSymbol('risco_edificio_v1')).toBeNull();
  });
});
