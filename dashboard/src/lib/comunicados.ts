import { supabase } from '@/lib/supabase';

// Comunicados municipais: acesso exclusivo por RPCs SECURITY DEFINER.
// O servidor decide escopo (organização do usuário) e papel; o cliente
// apenas tipa o contrato devolvido por portal_list_comunicados/bairros.

type RpcResult = { data: unknown; error: { message: string } | null };
type PortalRpc = (name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;

const rpc = supabase.rpc.bind(supabase) as unknown as PortalRpc;

export type ComunicadoSeveridade = 'informacao' | 'alerta' | 'emergencia';
export type ComunicadoStatus = 'rascunho' | 'agendado' | 'publicado' | 'arquivado';

export interface ComunicadoDestino {
  bairroId: string | null;
  bairroNome: string | null;
  todoMunicipio: boolean;
}

export type ComunicadoEnvioStatus = 'pendente' | 'enviado' | 'falhou';

export interface ComunicadoEnvio {
  canalId: string;
  canalNome: string | null;
  status: ComunicadoEnvioStatus;
  origem: 'manual' | 'bot' | null;
  erro: string | null;
  enviadoEm: string | null;
  registradoPorNome: string | null;
}

export interface Comunicado {
  id: string;
  titulo: string;
  conteudo: string;
  severidade: ComunicadoSeveridade;
  status: ComunicadoStatus;
  autorNome: string | null;
  publicadoEm: string | null;
  publicarEm: string | null;
  expiraEm: string | null;
  criadoEm: string | null;
  destinos: ComunicadoDestino[];
  totalLeituras: number;
  lido: boolean;
  podeEditar: boolean;
  envios: ComunicadoEnvio[];
}

export interface CanalComunitario {
  id: string;
  nome: string;
  tipo: string;
  chatId: string | null;
  linkConvite: string | null;
  telefoneAdmin: string | null;
  ativo: boolean;
  totalEnvios: number;
  podeGerenciar: boolean;
}

export interface BotChat {
  chatId: string;
  nome: string;
  tipo: string;
  sessaoTelefone: string | null;
  vistoEm: string | null;
}

export type SessaoBotStatus = 'aguardando_qr' | 'vinculado' | 'desconectado' | 'banido';

export interface SessaoBot {
  id: string;
  telefone: string | null;
  status: SessaoBotStatus;
  vinculadoPorNome: string | null;
  criadoEm: string | null;
  vinculadoEm: string | null;
  totalChats: number;
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
const statuses = new Set<ComunicadoStatus>(['rascunho', 'agendado', 'publicado', 'arquivado']);

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
    publicarEm: string(source.publicar_em),
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
    envios: Array.isArray(source.envios)
      ? source.envios
        .map((item): ComunicadoEnvio | null => {
          const envio = record(item);
          if (!envio) return null;
          const status = string(envio.status);
          const origem = string(envio.origem);
          return {
            canalId: string(envio.canal_id) ?? '',
            canalNome: string(envio.canal_nome),
            status: (status === 'pendente' || status === 'falhou' || status === 'enviado'
              ? status
              : 'enviado') as ComunicadoEnvioStatus,
            origem: origem === 'bot' ? 'bot' : origem === 'manual' ? 'manual' : null,
            erro: string(envio.erro),
            enviadoEm: string(envio.enviado_em),
            registradoPorNome: string(envio.registrado_por_nome),
          };
        })
        .filter((item): item is ComunicadoEnvio => item !== null && item.canalId !== '')
      : [],
  };
}

function parseCanal(value: unknown): CanalComunitario | null {
  const source = record(value);
  if (!source || !string(source.id) || !string(source.nome)) return null;
  return {
    id: source.id as string,
    nome: source.nome as string,
    tipo: string(source.tipo) ?? 'whatsapp_comunidade',
    chatId: string(source.chat_id),
    linkConvite: string(source.link_convite),
    telefoneAdmin: string(source.telefone_admin),
    ativo: source.ativo === true,
    totalEnvios: typeof source.total_envios === 'number' ? source.total_envios : 0,
    podeGerenciar: source.pode_gerenciar === true,
  };
}

function parseBotChat(value: unknown): BotChat | null {
  const source = record(value);
  if (!source || !string(source.chat_id) || !string(source.nome)) return null;
  return {
    chatId: source.chat_id as string,
    nome: source.nome as string,
    tipo: string(source.tipo) ?? 'grupo',
    sessaoTelefone: string(source.sessao_telefone),
    vistoEm: string(source.visto_em),
  };
}

function parseSessaoBot(value: unknown): SessaoBot | null {
  const source = record(value);
  if (!source || !string(source.id)) return null;
  const status = string(source.status);
  return {
    id: source.id as string,
    telefone: string(source.telefone),
    status: (['aguardando_qr', 'vinculado', 'desconectado', 'banido'].includes(status ?? '')
      ? status
      : 'desconectado') as SessaoBotStatus,
    vinculadoPorNome: string(source.vinculado_por_nome),
    criadoEm: string(source.criado_em),
    vinculadoEm: string(source.vinculado_em),
    totalChats: typeof source.total_chats === 'number' ? source.total_chats : 0,
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

export async function fetchCanais(): Promise<CanalComunitario[]> {
  const { data, error } = await rpc('portal_list_canais_externos');
  if (error) throw new Error(error.message);
  return parseArray(data, parseCanal);
}

export async function fetchBotChats(): Promise<BotChat[]> {
  const { data, error } = await rpc('portal_list_bot_chats');
  if (error) throw new Error(error.message);
  return parseArray(data, parseBotChat);
}

export async function fetchSessoesBot(): Promise<SessaoBot[]> {
  const { data, error } = await rpc('portal_listar_sessoes_bot');
  if (error) throw new Error(error.message);
  return parseArray(data, parseSessaoBot);
}

// Cria a sessão no banco; o QR aparece no painel do bot (/sessao/<id>).
export async function criarSessaoBot(): Promise<string> {
  const { data, error } = await rpc('portal_criar_sessao_bot');
  if (error) throw new Error(error.message);
  const id = string(data);
  if (!id) throw new Error('Resposta inválida do servidor.');
  return id;
}

export async function definirStatusSessaoBot(id: string, status: 'banido' | 'desconectado'): Promise<void> {
  const { error } = await rpc('portal_definir_status_sessao_bot', { p_sessao_id: id, p_status: status });
  if (error) throw new Error(error.message);
}

export async function vincularCanalChat(canalId: string, chatId: string | null): Promise<void> {
  const { error } = await rpc('portal_vincular_canal_chat', {
    p_canal_id: canalId,
    p_chat_id: chatId ?? '',
  });
  if (error) throw new Error(error.message);
}

// Enfileira disparo pelo bot externo; retorna quantas comunidades entraram na fila.
export async function dispararBot(comunicadoId: string, canalId?: string): Promise<number> {
  const { data, error } = await rpc('portal_disparar_envio_bot', {
    p_comunicado_id: comunicadoId,
    p_canal_id: canalId ?? null,
  });
  if (error) throw new Error(error.message);
  return typeof data === 'number' ? data : 0;
}

export interface ComunicadoDraft {
  id?: string;
  titulo: string;
  conteudo: string;
  severidade: ComunicadoSeveridade;
  expiraEm?: string | null;
  publicarEm?: string | null;
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
      publicar_em: draft.publicarEm ?? null,
      destinos: draft.destinos,
    },
  });
  if (error) throw new Error(error.message);
  const id = string(data);
  if (!id) throw new Error('Resposta inválida do servidor.');
  return id;
}

export async function setComunicadoStatus(
  id: string,
  status: 'agendado' | 'publicado' | 'arquivado' | 'rascunho',
  publicarEm?: string | null,
): Promise<void> {
  const { error } = await rpc('portal_set_comunicado_status', {
    p_comunicado_id: id,
    p_status: status,
    p_publicar_em: publicarEm ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function registrarEnvioCanal(canalId: string, comunicadoId: string): Promise<void> {
  const { error } = await rpc('portal_registrar_envio_canal', {
    p_canal_id: canalId,
    p_comunicado_id: comunicadoId,
  });
  if (error) throw new Error(error.message);
}

export interface CanalDraft {
  id?: string;
  nome: string;
  linkConvite?: string | null;
  telefoneAdmin?: string | null;
}

export async function saveCanal(draft: CanalDraft): Promise<void> {
  const { error } = await rpc('portal_upsert_canal_externo', {
    p_payload: {
      id: draft.id ?? null,
      nome: draft.nome,
      tipo: 'whatsapp_comunidade',
      link_convite: draft.linkConvite ?? null,
      telefone_admin: draft.telefoneAdmin ?? null,
    },
  });
  if (error) throw new Error(error.message);
}

export async function setCanalAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await rpc('portal_set_canal_ativo', { p_canal_id: id, p_ativo: ativo });
  if (error) throw new Error(error.message);
}

export async function deleteCanal(id: string): Promise<void> {
  const { error } = await rpc('portal_delete_canal_externo', { p_canal_id: id });
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
  agendado: 'Agendado',
  publicado: 'Publicado',
  arquivado: 'Arquivado',
};

// Mensagem pronta para replicação manual na Comunidade WhatsApp:
// o TCS publica nos canais oficiais; a comunidade recebe o mesmo texto.
export function mensagemWhatsApp(comunicado: Comunicado, organizacao: string | null): string {
  const linhas = [
    `*${comunicado.titulo}*`,
    `_${comunicadoSeverityLabels[comunicado.severidade]} — ${comunicadoDestinosLabel(comunicado.destinos)}_`,
    '',
    comunicado.conteudo,
  ];
  if (comunicado.expiraEm) {
    linhas.push('', `Válido até ${new Date(comunicado.expiraEm).toLocaleDateString('pt-BR')}.`);
  }
  linhas.push('', organizacao ? `— ${organizacao} · via TCS` : '— via TCS');
  return linhas.join('\n');
}

export function whatsappShareUrl(mensagem: string): string {
  return `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
}

export function comunicadoDestinosLabel(destinos: ComunicadoDestino[]): string {
  if (destinos.some((destino) => destino.todoMunicipio)) return 'Todo o município';
  const nomes = destinos
    .map((destino) => destino.bairroNome)
    .filter((nome): nome is string => nome !== null);
  if (nomes.length === 0) return 'Todo o município';
  return nomes.length <= 3 ? nomes.join(', ') : `${nomes.slice(0, 3).join(', ')} +${nomes.length - 3}`;
}
