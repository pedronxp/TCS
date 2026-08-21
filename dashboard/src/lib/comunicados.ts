import { supabase } from '@/lib/supabase';

// Comunicados municipais: acesso exclusivo por RPCs SECURITY DEFINER.
// O servidor decide escopo (organização do usuário) e papel; o cliente
// apenas tipa o contrato devolvido por portal_list_comunicados/bairros.

type RpcResult = { data: unknown; error: { message: string } | null };
type PortalRpc = (name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;

const rpc = supabase.rpc.bind(supabase) as unknown as PortalRpc;

export type ComunicadoSeveridade = 'informacao' | 'alerta' | 'emergencia';
export type ComunicadoStatus = 'rascunho' | 'publicado' | 'arquivado';

export interface ComunicadoDestino {
  bairroId: string | null;
  bairroNome: string | null;
  todoMunicipio: boolean;
}

export interface Comunicado {
  id: string;
  titulo: string;
  conteudo: string;
  severidade: ComunicadoSeveridade;
  status: ComunicadoStatus;
  autorNome: string | null;
  publicadoEm: string | null;
  expiraEm: string | null;
  criadoEm: string | null;
  destinos: ComunicadoDestino[];
  totalLeituras: number;
  lido: boolean;
  podeEditar: boolean;
}

export interface Bairro {
  id: string;
  nome: string;
  ativo: boolean;
  emUso: boolean;
  podeGerenciar: boolean;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

const severidades = new Set<ComunicadoSeveridade>(['informacao', 'alerta', 'emergencia']);
const statuses = new Set<ComunicadoStatus>(['rascunho', 'publicado', 'arquivado']);

function parseComunicado(value: unknown): Comunicado | null {
  const source = record(value);
  if (!source || !string(source.id) || !string(source.titulo)) return null;
  const severidade = string(source.severidade);
  const status = string(source.status);
  return {
    id: source.id as string,
    titulo: source.titulo as string,
    conteudo: typeof source.conteudo === 'string' ? source.conteudo : '',
    severidade: severidades.has(severidade as ComunicadoSeveridade) ? severidade as ComunicadoSeveridade : 'informacao',
    status: statuses.has(status as ComunicadoStatus) ? status as ComunicadoStatus : 'rascunho',
    autorNome: string(source.autor_nome),
    publicadoEm: string(source.publicado_em),
    expiraEm: string(source.expira_em),
    criadoEm: string(source.criado_em),
    destinos: Array.isArray(source.destinos)
      ? source.destinos
        .map((item): ComunicadoDestino | null => {
          const destino = record(item);
          if (!destino) return null;
          return {
            bairroId: string(destino.bairro_id),
            bairroNome: string(destino.bairro_nome),
            todoMunicipio: destino.todo_municipio === true,
          };
        })
        .filter((item): item is ComunicadoDestino => item !== null)
      : [],
    totalLeituras: typeof source.total_leituras === 'number' ? source.total_leituras : 0,
    lido: source.lido === true,
    podeEditar: source.pode_editar === true,
  };
}

function parseBairro(value: unknown): Bairro | null {
  const source = record(value);
  if (!source || !string(source.id) || !string(source.nome)) return null;
  return {
    id: source.id as string,
    nome: source.nome as string,
    ativo: source.ativo === true,
    emUso: source.em_uso === true,
    podeGerenciar: source.pode_gerenciar === true,
  };
}

function parseArray<T>(data: unknown, parse: (value: unknown) => T | null): T[] {
  if (!Array.isArray(data)) return [];
  return data.map(parse).filter((item): item is T => item !== null);
}

export async function fetchComunicados(): Promise<Comunicado[]> {
  const { data, error } = await rpc('portal_list_comunicados');
  if (error) throw new Error(error.message);
  return parseArray(data, parseComunicado);
}

export async function fetchBairros(): Promise<Bairro[]> {
  const { data, error } = await rpc('portal_list_bairros');
  if (error) throw new Error(error.message);
  return parseArray(data, parseBairro);
}

export interface ComunicadoDraft {
  id?: string;
  titulo: string;
  conteudo: string;
  severidade: ComunicadoSeveridade;
  expiraEm?: string | null;
  destinos: Array<{ bairroId?: string; todoMunicipio?: boolean }>;
}

export async function saveComunicado(draft: ComunicadoDraft): Promise<string> {
  const { data, error } = await rpc('portal_upsert_comunicado', {
    p_payload: {
      id: draft.id ?? null,
      titulo: draft.titulo,
      conteudo: draft.conteudo,
      severidade: draft.severidade,
      expira_em: draft.expiraEm ?? null,
      destinos: draft.destinos,
    },
  });
  if (error) throw new Error(error.message);
  const id = string(data);
  if (!id) throw new Error('Resposta inválida do servidor.');
  return id;
}

export async function setComunicadoStatus(id: string, status: 'publicado' | 'arquivado'): Promise<void> {
  const { error } = await rpc('portal_set_comunicado_status', { p_comunicado_id: id, p_status: status });
  if (error) throw new Error(error.message);
}

export async function deleteComunicado(id: string): Promise<void> {
  const { error } = await rpc('portal_delete_comunicado', { p_comunicado_id: id });
  if (error) throw new Error(error.message);
}

export async function registerComunicadoLeitura(id: string): Promise<void> {
  const { error } = await rpc('portal_register_comunicado_leitura', { p_comunicado_id: id });
  if (error) throw new Error(error.message);
}

export async function saveBairro(nome: string, id?: string): Promise<void> {
  const { error } = await rpc('portal_upsert_bairro', { p_nome: nome, p_bairro_id: id ?? null });
  if (error) throw new Error(error.message);
}

export async function deleteBairro(id: string): Promise<void> {
  const { error } = await rpc('portal_delete_bairro', { p_bairro_id: id });
  if (error) throw new Error(error.message);
}

export const comunicadoSeverityLabels: Record<ComunicadoSeveridade, string> = {
  informacao: 'Informação',
  alerta: 'Alerta',
  emergencia: 'Emergência',
};

export const comunicadoStatusLabels: Record<ComunicadoStatus, string> = {
  rascunho: 'Rascunho',
  publicado: 'Publicado',
  arquivado: 'Arquivado',
};

export function comunicadoDestinosLabel(destinos: ComunicadoDestino[]): string {
  if (destinos.some((destino) => destino.todoMunicipio)) return 'Todo o município';
  const nomes = destinos
    .map((destino) => destino.bairroNome)
    .filter((nome): nome is string => nome !== null);
  if (nomes.length === 0) return 'Todo o município';
  return nomes.length <= 3 ? nomes.join(', ') : `${nomes.slice(0, 3).join(', ')} +${nomes.length - 3}`;
}
