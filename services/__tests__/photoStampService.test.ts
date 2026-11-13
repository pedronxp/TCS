jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true, default: { fetch: jest.fn() },
}));
jest.mock('expo-location', () => ({ reverseGeocodeAsync: jest.fn() }));

import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { criarCarimboFoto } from '../photoStampService';

const position = { latitude: -21.31, longitude: -42.86, accuracy: 8, altitude: null };
const instant = new Date('2026-11-11T15:30:00Z');

describe('carimbo da foto', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true, isInternetReachable: true });
  });
  afterEach(() => jest.useRealTimers());

  it('ignora o número estimado pelo geocodificador, mantendo rua, bairro, cidade e GPS', async () => {
    (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([{
      street: 'Rua das Flores', streetNumber: '25', district: 'Centro',
      city: 'Astolfo Dutra', subregion: 'Zona da Mata', region: 'MG', country: 'Brasil',
    }]);
    const stamp = await criarCarimboFoto(position, instant);
    expect(stamp.endereco).toBe('Rua das Flores · Centro · Astolfo Dutra · MG · Brasil');
    expect(stamp.linhas.join('\n')).toContain('-21.310000, -42.860000');
    expect(stamp.linhas.join('\n')).toContain('±8 m');
    expect(stamp.linhas.join('\n')).toContain('2026');
  });

  it('preserva números que fazem parte do nome oficial da rua', async () => {
    (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([{
      street: 'Rua 15 de Novembro', streetNumber: '511', city: 'Cataguases', region: 'MG',
    }]);
    expect((await criarCarimboFoto(position, instant)).endereco).toBe('Rua 15 de Novembro · Cataguases · MG');
  });

  it('sem internet mantém GPS e não consulta endereço', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false, isInternetReachable: false });
    const stamp = await criarCarimboFoto(position, instant);
    expect(stamp.endereco).toBeNull();
    expect(stamp.linhas.join('\n')).toContain('-21.310000, -42.860000');
    expect(Location.reverseGeocodeAsync).not.toHaveBeenCalled();
  });

  it('falha de endereço não impede a foto com GPS', async () => {
    (Location.reverseGeocodeAsync as jest.Mock).mockRejectedValue(new Error('rede'));
    const stamp = await criarCarimboFoto(position, instant);
    expect(stamp.endereco).toBeNull();
    expect(stamp.linhas.join('\n')).toContain('-21.310000, -42.860000');
  });

  it('não inventa rua ou número em endereço parcial', async () => {
    (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([{ city: 'Astolfo Dutra', region: 'MG' }]);
    expect((await criarCarimboFoto(position, instant)).endereco).toBe('Astolfo Dutra · MG');
  });

  it('sem GPS declara localização indisponível', async () => {
    const stamp = await criarCarimboFoto(null, instant);
    expect(stamp.linhas.join('\n')).toContain('Localização indisponível');
    expect(Location.reverseGeocodeAsync).not.toHaveBeenCalled();
  });

  it('consulta travada tem prazo limite e retorna apenas GPS', async () => {
    jest.useFakeTimers();
    (Location.reverseGeocodeAsync as jest.Mock).mockImplementation(() => new Promise(() => {}));
    const promise = criarCarimboFoto(position, instant);
    await jest.advanceTimersByTimeAsync(5000);
    expect((await promise).endereco).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });
});
