// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerMap } from './CustomerMap';
import type { CustomerMapPoint } from '@/types/domain';

const mocks = vi.hoisted(() => ({
  construct: vi.fn(),
  addMarker: vi.fn(),
  removeMarker: vi.fn(),
  removeMap: vi.fn(),
  jumpTo: vi.fn(),
  fitBounds: vi.fn(),
  togglePopup: vi.fn(),
}));

vi.mock('maplibre-gl', () => {
  class MapMock {
    constructor() { mocks.construct(); }
    addControl() {}
    once(event: string, callback: () => void) { if (event === 'load') callback(); }
    on() {}
    resize() {}
    remove() { mocks.removeMap(); }
    jumpTo(...args: unknown[]) { mocks.jumpTo(...args); }
    fitBounds(...args: unknown[]) { mocks.fitBounds(...args); }
  }
  class PopupMock {
    setDOMContent() { return this; }
    isOpen() { return false; }
  }
  class MarkerMock {
    popup = new PopupMock();
    setLngLat() { return this; }
    setPopup(popup: PopupMock) { this.popup = popup; return this; }
    getPopup() { return this.popup; }
    togglePopup() { mocks.togglePopup(); return this; }
    addTo() { mocks.addMarker(); return this; }
    remove() { mocks.removeMarker(); }
  }
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

const points: CustomerMapPoint[] = [
  { id: 'one', protocol: 'AUR-001', risk: 'r3', status: 'completed', occurred_at: '2026-08-09T10:00:00Z', latitude: -1.45, longitude: -48.5, address: 'Praça Central' },
  { id: 'two', protocol: 'AUR-002', risk: 'r1', status: 'completed', occurred_at: '2026-08-09T11:00:00Z', latitude: -1.46, longitude: -48.51, address: null },
];

describe('CustomerMap', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('mantém a instância e atualiza marcadores sem movimento automático', () => {
    const { rerender } = render(<CustomerMap points={points} />);
    expect(mocks.construct).toHaveBeenCalledOnce();
    expect(mocks.addMarker).toHaveBeenCalledTimes(2);

    rerender(<CustomerMap points={[points[1]]} />);
    expect(mocks.construct).toHaveBeenCalledOnce();
    expect(mocks.removeMap).not.toHaveBeenCalled();
    expect(mocks.removeMarker).toHaveBeenCalledOnce();
  });

  it('oferece alternativa textual selecionável ligada ao mapa', async () => {
    const user = userEvent.setup();
    render(<CustomerMap points={points} />);
    const point = screen.getByRole('button', { name: /AUR-001/ });
    await user.click(point);

    expect(point).toHaveAttribute('aria-pressed', 'true');
    expect(mocks.jumpTo).toHaveBeenCalledWith({ center: [-48.5, -1.45] });
    expect(mocks.togglePopup).toHaveBeenCalledOnce();
  });

  it('rejeita e não estima eixos geográficos inválidos', () => {
    render(<CustomerMap points={[{ ...points[0], latitude: 91 }, { ...points[1], longitude: Number.NaN }]} />);
    expect(screen.getByText('Nenhuma vistoria com coordenadas válidas')).toBeVisible();
    expect(mocks.construct).not.toHaveBeenCalled();
  });
});
