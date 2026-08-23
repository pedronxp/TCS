import { supabase } from '@/lib/supabase';

// Endereço do bot WhatsApp externo: mesmo host em desenvolvimento, VPS em produção.
const BOT_WHATSAPP_URL = (import.meta.env.VITE_BOT_WHATSAPP_URL as string | undefined) ?? 'http://localhost:8787';

export function botQrUrl(sessaoId: string): string {
  return `${BOT_WHATSAPP_URL}/qr/${sessaoId}`;
}

// O servidor já devolve telefones mascarados; valores ao vivo (bot) passam por aqui.
export function mascararTelefone(telefone: string | null | undefined): string {
  const digitos = (telefone ?? '').replace(/\D/g, '');
  if (digitos.length >= 8) return `${digitos.slice(0, 2)}****${digitos.slice(-4)}`;
  return '****';
}

export interface BotSessaoStatus {
  fase: string;
  telefone: string | null;
  qrPresente: boolean;
  qrGeradoEm: string | null;
  ultimoErro: string | null;
}

async function fetchComTimeout(url: string, ms = 6000): Promise<Response> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), ms);
  try {
    return await fetch(url, { signal: controle.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchBotOnline(): Promise<boolean> {
  try {
    const resposta = await fetchComTimeout(`${BOT_WHATSAPP_URL}/healthz`);
    return resposta.ok;
  } catch {
    return false;
  }
}

export async function fetchBotSessaoStatus(sessaoId: string): Promise<BotSessaoStatus | null> {
  try {
    const resposta = await fetchComTimeout(`${BOT_WHATSAPP_URL}/sessao/${sessaoId}/status`);
    if (!resposta.ok) return null;
    const dados = record(await resposta.json());
    if (!dados) return null;
    return {
      fase: typeof dados.fase === 'string' ? dados.fase : 'desconhecida',
      telefone: string(dados.telefone),
      qrPresente: dados.qrPresente === true,
      qrGeradoEm: string(dados.qrGeradoEm),
      ultimoErro: string(dados.ultimoErro),
    };
  } catch {
    return null;
  }
}

export interface BotVerificacao {
  conectado: boolean;
  estado: string | null;
  telefone: string | null;
  totalChats: number;
  motivo: string | null;
}

// Verificação sem falso positivo: o bot pergunta ao próprio WhatsApp (getState).
export async function fetchBotVerificacao(sessaoId: string): Promise<BotVerificacao | null> {
  try {
    const resposta = await fetchComTimeout(`${BOT_WHATSAPP_URL}/sessao/${sessaoId}/verify`);
    const dados = record(await resposta.json());
    if (!dados) return null;
    return {
      conectado: dados.conectado === true,
      estado: string(dados.estado),
      telefone: string(dados.telefone),
      totalChats: typeof dados.totalChats === 'number' ? dados.totalChats : 0,
      motivo: string(dados.motivo),
    };
  } catch {
    return null;
  }
}

// Cria um grupo pela web; com comunidadeId tenta criar DENTRO da Comunidade
// (o bot responde 501 com orientação quando a versão não suportar sub-grupo).
export async function criarGrupoPeloBot(sessaoId: string, nome: string, comunidadeId?: string | null): Promise<string | null> {
  try {
    const params = new URLSearchParams({ nome });
    if (comunidadeId) params.set('comunidade', comunidadeId);
    const resposta = await fetchComTimeout(
      `${BOT_WHATSAPP_URL}/sessao/${sessaoId}/criar-grupo?${params.toString()}`,
      30_000,
    );
    const dados = record(await resposta.json());
    if (!resposta.ok || !dados || dados.ok !== true) {
      throw new Error(string(dados?.motivo) ?? 'O bot não conseguiu criar o grupo.');
    }
    return string(dados.chat_id);
  } catch (erro) {
    throw erro instanceof Error ? erro : new Error('Falha ao criar o grupo pelo bot.');
  }
}

export async function sincronizarChatsBot(sessaoId: string): Promise<boolean> {
  try {
    const resposta = await fetchComTimeout(`${BOT_WHATSAPP_URL}/sessao/${sessaoId}/sincronizar`, 30_000);
    const dados = record(await resposta.json());
    return resposta.ok && dados?.ok === true;
  } catch {
    return false;
  }
}

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

export interface EnvioTentativa {
  telefone: string;
  erro: string;
}

export interface ComunicadoEnvio {
  canalId: string;
  canalNome: string | null;
  status: ComunicadoEnvioStatus;
  origem: 'manual' | 'bot' | null;
  erro: string | null;
  enviadoEm: string | null;
  registradoPorNome: string | null;
  sessaoTelefone: string | null;
  tentativas: EnvioTentativa[];
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
  comunidadeId: string | null;
  comunidadeNome: string | null;
  sessaoTelefone: string | null;
  totalAdmins: number;
  totalParticipantes: number;
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
            sessaoTelefone: string(envio.sessao_telefone),
            tentativas: parseTentativas(envio.tentativas),
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

function parseTentativas(value: unknown): EnvioTentativa[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): EnvioTentativa | null => {
      const tentativa = record(item);
      if (!tentativa) return null;
      return {
        telefone: string(tentativa.telefone) ?? '—',
        erro: string(tentativa.erro) ?? 'erro desconhecido',
      };
    })
    .filter((item): item is EnvioTentativa => item !== null);
}

function parseBotChat(value: unknown): BotChat | null {
  const source = record(value);
  if (!source || !string(source.chat_id) || !string(source.nome)) return null;
  return {
    chatId: source.chat_id as string,
    nome: source.nome as string,
    tipo: string(source.tipo) ?? 'grupo',
    comunidadeId: string(source.comunidade_id),
    comunidadeNome: string(source.comunidade_nome),
    sessaoTelefone: string(source.sessao_telefone),
    totalAdmins: typeof source.total_admins === 'number' ? source.total_admins : 0,
    totalParticipantes: typeof source.total_participantes === 'number' ? source.total_participantes : 0,
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

// ---------------------------------------------------------------------------
// Console interno (/app): equipe TCS opera qualquer prefeitura (communication.manage).
// ---------------------------------------------------------------------------

export interface OrgComunicadosResumo {
  organizationId: string;
  organizationName: string;
  municipality: string | null;
  comunicadosPublicados: number;
  comunidadesAtivas: number;
  numerosVinculados: number;
  enviosPendentes: number;
  enviosFalhas: number;
}

export interface ConsoleComunicadosOrg {
  organization: { id: string; name: string; municipality: string | null };
  sessoes: Array<{ id: string; telefone: string | null; status: SessaoBotStatus; vinculadoPorNome: string | null; vinculadoEm: string | null; totalChats: number }>;
  chats: BotChat[];
  canais: Array<{ id: string; nome: string; chatId: string | null; ativo: boolean; totalEnvios: number }>;
  comunicados: Array<{
    id: string;
    titulo: string;
    severidade: ComunicadoSeveridade;
    status: ComunicadoStatus;
    publicadoEm: string | null;
    publicarEm: string | null;
    expiraEm: string | null;
    criadoEm: string | null;
    envios: ComunicadoEnvio[];
  }>;
}

export async function fetchOrgsComunicadosConsole(): Promise<OrgComunicadosResumo[]> {
  const { data, error } = await rpc('internal_list_orgs_comunicados');
  if (error) throw new Error(error.message);
  return parseArray(data, (value) => {
    const source = record(value);
    if (!source || !string(source.organization_id) || !string(source.organization_name)) return null;
    return {
      organizationId: source.organization_id as string,
      organizationName: source.organization_name as string,
      municipality: string(source.municipality),
      comunicadosPublicados: typeof source.comunicados_publicados === 'number' ? source.comunicados_publicados : 0,
      comunidadesAtivas: typeof source.comunidades_ativas === 'number' ? source.comunidades_ativas : 0,
      numerosVinculados: typeof source.numeros_vinculados === 'number' ? source.numeros_vinculados : 0,
      enviosPendentes: typeof source.envios_pendentes === 'number' ? source.envios_pendentes : 0,
      enviosFalhas: typeof source.envios_falhas === 'number' ? source.envios_falhas : 0,
    };
  });
}

export async function fetchComunicadosOrgConsole(organizationId: string): Promise<ConsoleComunicadosOrg | null> {
  const { data, error } = await rpc('internal_comunicados_org', { p_organization_id: organizationId });
  if (error) throw new Error(error.message);
  const source = record(data);
  if (!source) return null;
  const org = record(source.organization);
  const severidade = (value: unknown) => (severidades.has(value as ComunicadoSeveridade) ? value as ComunicadoSeveridade : 'informacao');
  const status = (value: unknown) => (statuses.has(value as ComunicadoStatus) ? value as ComunicadoStatus : 'rascunho');
  return {
    organization: {
      id: string(org?.id) ?? organizationId,
      name: string(org?.name) ?? 'Prefeitura',
      municipality: string(org?.municipality),
    },
    sessoes: parseArray(source.sessoes, (value) => {
      const sessao = record(value);
      if (!sessao || !string(sessao.id)) return null;
      const sessaoStatus = string(sessao.status);
      return {
        id: sessao.id as string,
        telefone: string(sessao.telefone),
        status: (['aguardando_qr', 'vinculado', 'desconectado', 'banido'].includes(sessaoStatus ?? '')
          ? sessaoStatus
          : 'desconectado') as SessaoBotStatus,
        vinculadoPorNome: string(sessao.vinculado_por_nome),
        vinculadoEm: string(sessao.vinculado_em),
        totalChats: typeof sessao.total_chats === 'number' ? sessao.total_chats : 0,
      };
    }),
    chats: parseArray(source.chats, parseBotChat),
    canais: parseArray(source.canais, (value) => {
      const canal = record(value);
      if (!canal || !string(canal.id) || !string(canal.nome)) return null;
      return {
        id: canal.id as string,
        nome: canal.nome as string,
        chatId: string(canal.chat_id),
        ativo: canal.ativo === true,
        totalEnvios: typeof canal.total_envios === 'number' ? canal.total_envios : 0,
      };
    }),
    comunicados: parseArray(source.comunicados, (value) => {
      const item = record(value);
      if (!item || !string(item.id) || !string(item.titulo)) return null;
      return {
        id: item.id as string,
        titulo: item.titulo as string,
        severidade: severidade(string(item.severidade)),
        status: status(string(item.status)),
        publicadoEm: string(item.publicado_em),
        publicarEm: string(item.publicar_em),
        expiraEm: string(item.expira_em),
        criadoEm: string(item.criado_em),
        envios: Array.isArray(item.envios)
          ? item.envios.map((envio): ComunicadoEnvio | null => {
            const e = record(envio);
            if (!e) return null;
            const eStatus = string(e.status);
            const eOrigem = string(e.origem);
            return {
              canalId: string(e.canal_id) ?? '',
              canalNome: string(e.canal_nome),
              status: (['pendente', 'falhou', 'enviado'].includes(eStatus ?? '') ? eStatus : 'enviado') as ComunicadoEnvioStatus,
              origem: eOrigem === 'bot' ? 'bot' : eOrigem === 'manual' ? 'manual' : null,
              erro: string(e.erro),
              enviadoEm: string(e.enviado_em),
              registradoPorNome: null,
              sessaoTelefone: string(e.sessao_telefone),
              tentativas: parseTentativas(e.tentativas),
            };
          }).filter((envio): envio is ComunicadoEnvio => envio !== null && envio.canalId !== '')
          : [],
      };
    }),
  };
}

export async function criarSessaoBotConsole(organizationId: string): Promise<string> {
  const { data, error } = await rpc('internal_criar_sessao_bot', { p_organization_id: organizationId });
  if (error) throw new Error(error.message);
  const id = string(data);
  if (!id) throw new Error('Resposta inválida do servidor.');
  return id;
}

export async function definirStatusSessaoBotConsole(id: string, status: 'banido' | 'desconectado'): Promise<void> {
  const { error } = await rpc('internal_definir_status_sessao_bot', { p_sessao_id: id, p_status: status });
  if (error) throw new Error(error.message);
}

export async function salvarCanalConsole(organizationId: string, nome: string, id?: string): Promise<string> {
  const { data, error } = await rpc('internal_upsert_canal_externo', {
    p_payload: { organization_id: organizationId, id: id ?? null, nome },
  });
  if (error) throw new Error(error.message);
  const canalId = string(data);
  if (!canalId) throw new Error('Resposta inválida do servidor.');
  return canalId;
}

export async function vincularCanalChatConsole(canalId: string, chatId: string | null): Promise<void> {
  const { error } = await rpc('internal_vincular_canal_chat', {
    p_canal_id: canalId,
    p_chat_id: chatId ?? '',
  });
  if (error) throw new Error(error.message);
}

export async function dispararBotConsole(comunicadoId: string, canalId?: string): Promise<number> {
  const { data, error } = await rpc('internal_disparar_envio_bot', {
    p_comunicado_id: comunicadoId,
    p_canal_id: canalId ?? null,
  });
  if (error) throw new Error(error.message);
  return typeof data === 'number' ? data : 0;
}

export interface ComunicadoDraftConsole {
  organizationId: string;
  id?: string;
  titulo: string;
  conteudo: string;
  severidade: ComunicadoSeveridade;
  expiraEm?: string | null;
  publicarEm?: string | null;
}

export async function salvarComunicadoConsole(draft: ComunicadoDraftConsole): Promise<string> {
  const { data, error } = await rpc('internal_upsert_comunicado', {
    p_payload: {
      organization_id: draft.organizationId,
      id: draft.id ?? null,
      titulo: draft.titulo,
      conteudo: draft.conteudo,
      severidade: draft.severidade,
      expira_em: draft.expiraEm ?? null,
      publicar_em: draft.publicarEm ?? null,
      destinos: [{ todo_municipio: true }],
    },
  });
  if (error) throw new Error(error.message);
  const id = string(data);
  if (!id) throw new Error('Resposta inválida do servidor.');
  return id;
}

export async function definirStatusComunicadoConsole(
  comunicadoId: string,
  status: 'agendado' | 'publicado' | 'arquivado' | 'rascunho',
  publicarEm?: string | null,
): Promise<void> {
  const { error } = await rpc('internal_set_comunicado_status', {
    p_comunicado_id: comunicadoId,
    p_status: status,
    p_publicar_em: publicarEm ?? null,
  });
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
