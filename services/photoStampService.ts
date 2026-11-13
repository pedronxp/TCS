import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import type { PosicaoGps } from './georeferencedPhotoService';

export interface CarimboFoto {
  endereco: string | null;
  linhas: string[];
}

async function comPrazo<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Tempo de processamento excedido')), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Consulta limitada: perda de rede nunca impede registrar as coordenadas. */
export async function criarCarimboFoto(posicao: PosicaoGps | null, capturedAt: Date): Promise<CarimboFoto> {
  let endereco: string | null = null;
  if (posicao) {
    try {
      endereco = await comPrazo((async () => {
        const network = await NetInfo.fetch();
        if (!network.isConnected || network.isInternetReachable === false) return null;
        const [address] = await Location.reverseGeocodeAsync(posicao);
        if (!address) return null;
        // Geocodificação reversa não confirma o número do imóvel fotografado.
        // Preservar apenas o logradouro, inclusive números no seu próprio nome.
        const street = address.street;
        return [street, address.district, address.city || address.subregion, address.region, address.country]
          .filter(part => typeof part === 'string' && part.trim())
          .join(' · ') || null;
      })(), 4000);
    } catch { /* GPS continua disponível mesmo sem endereço. */ }
  }
  const offsetMinutes = -capturedAt.getTimezoneOffset();
  const offset = `${offsetMinutes >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0')}:${String(Math.abs(offsetMinutes) % 60).padStart(2, '0')}`;
  const date = `${capturedAt.toLocaleString('pt-BR', { hour12: false })} (UTC${offset})`;
  const coordinates = posicao
    ? `GPS ${posicao.latitude.toFixed(6)}, ${posicao.longitude.toFixed(6)}${posicao.accuracy === null ? '' : ` · ±${Math.round(posicao.accuracy)} m`}`
    : 'Localização indisponível';
  return { endereco, linhas: [...(endereco ? [endereco] : []), coordinates, date] };
}

export interface PedidoCarimbo {
  uri: string;
  carimbo: CarimboFoto;
}
type Renderizador = (pedido: PedidoCarimbo) => Promise<string>;
let renderizador: Renderizador | null = null;
let fila: Promise<unknown> = Promise.resolve();

export function registrarRenderizadorCarimbo(renderer: Renderizador): () => void {
  renderizador = renderer;
  return () => { if (renderizador === renderer) renderizador = null; };
}

/** Serializa capturas para não misturar o texto de duas fotografias. */
export function aplicarCarimboFoto(pedido: PedidoCarimbo): Promise<string> {
  const operation = fila.then(async () => {
    if (!renderizador) throw new Error('Compositor da foto indisponível. Tente novamente.');
    return renderizador(pedido);
  });
  fila = operation.catch(() => undefined);
  return operation;
}
