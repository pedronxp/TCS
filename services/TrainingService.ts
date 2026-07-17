import { supabase } from '../utils/supabase';

export const TRAINING_ALLOWED_FORMS = [
  'vistoria_deslizamento_v3',
  'risco_estrutural_novo_v2',
  'avaliacao_arvore_cbmmg_v1',
] as const;

export type TrainingStatus =
  | 'accepted'
  | 'invalid_input'
  | 'invalid_token'
  | 'not_started'
  | 'expired'
  | 'ended'
  | 'full'
  | 'error';

export interface TrainingEntryResult {
  ok: boolean;
  status: TrainingStatus;
  message?: string;
  classId?: string;
  className?: string;
  token?: string;
  participantId?: string;
  participantName?: string;
  participantCount?: number;
  participantLimit?: number;
  startsAt?: string;
  endsAt?: string;
  allowedForms?: string[];
}

export interface TrainingClass {
  id: string;
  nome: string;
  token: string;
  limite_participantes: number;
  inicio_em: string;
  fim_em: string;
  ativo: boolean;
  encerrado_em: string | null;
  formularios_permitidos: string[];
  criado_por: string | null;
  criado_por_nome: string | null;
  criado_em: string;
  atualizado_em: string;
  participant_count?: number;
}

export interface TrainingParticipant {
  id: string;
  training_class_id: string;
  nome: string;
  device_id: string;
  status: 'ativo' | 'expirado' | 'encerrado';
  entrou_em: string;
  ultimo_acesso_em: string;
}

export function normalizeTrainingToken(value: string): string {
  return value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

export function formatTrainingToken(value: string): string {
  const raw = normalizeTrainingToken(value).slice(0, 12);
  return (raw.match(/.{1,4}/g) || []).join('-');
}

export function generateTrainingToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = typeof crypto !== 'undefined' && crypto.getRandomValues
    ? crypto.getRandomValues(new Uint8Array(12))
    : new Uint8Array(12).map(() => Math.floor(Math.random() * 256));
  const raw = Array.from(bytes, b => chars[b % chars.length]).join('');
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

export function parseDateTimePtBr(date: string, time: string): Date | null {
  const [day, month, year] = date.split('/').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if ([day, month, year, hour, minute].some(Number.isNaN)) return null;
  const parsed = new Date(year, month - 1, day, hour, minute, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDatePtBr(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export function formatTimePtBr(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function isTrainingClassEnded(item: Pick<TrainingClass, 'ativo' | 'encerrado_em' | 'fim_em'>): boolean {
  return !item.ativo || !!item.encerrado_em || Date.now() > new Date(item.fim_em).getTime();
}

export function trainingEntryMessage(result: Pick<TrainingEntryResult, 'status' | 'message' | 'participantCount' | 'participantLimit' | 'endsAt' | 'startsAt'>): string {
  if (result.status === 'full') {
    const count = result.participantCount ?? result.participantLimit;
    const limit = result.participantLimit ?? count;
    return `Limite de participantes atingido. ${count ?? limit} de ${limit} alunos ja acessaram este treinamento.`;
  }
  if (result.status === 'expired' || result.status === 'ended') {
    const end = result.endsAt
      ? new Date(result.endsAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : null;
    return end
      ? `Treinamento encerrado. O prazo de acesso terminou em ${end}.`
      : 'Treinamento encerrado.';
  }
  if (result.status === 'not_started') {
    const start = result.startsAt
      ? new Date(result.startsAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : null;
    return start
      ? `Este treinamento ainda nao iniciou. O acesso começa em ${start}.`
      : 'Este treinamento ainda nao iniciou.';
  }
  if (result.status === 'invalid_token') return 'Token de treinamento invalido, expirado ou encerrado.';
  return result.message || 'Nao foi possivel acessar o treinamento.';
}

export async function expireElapsedTrainingClasses(): Promise<void> {
  await supabase.rpc('training_expire_elapsed_classes');
}

export async function enterTrainingClass(input: {
  token: string;
  nome: string;
  deviceId: string;
}): Promise<TrainingEntryResult> {
  try {
    const { data, error } = await supabase.rpc('training_class_entry', {
      p_token: input.token.trim().toUpperCase(),
      p_nome: input.nome.trim(),
      p_device_id: input.deviceId,
    });
    if (error) throw error;
    return data as TrainingEntryResult;
  } catch (e: any) {
    return { ok: false, status: 'error', message: e?.message || 'Falha ao validar treinamento.' };
  }
}

export async function leaveTrainingClass(input: {
  classId: string;
  deviceId: string;
}): Promise<void> {
  await supabase.rpc('training_class_leave', {
    p_class_id: input.classId,
    p_device_id: input.deviceId,
  });
}

export async function listTrainingClasses(): Promise<TrainingClass[]> {
  await expireElapsedTrainingClasses().catch(() => null);

  const { data, error } = await supabase
    .from('training_classes')
    .select('*')
    .order('criado_em', { ascending: false });
  if (error) throw error;

  const rows = (data || []) as TrainingClass[];
  if (rows.length === 0) return [];

  const { data: participants } = await supabase
    .from('training_participants')
    .select('training_class_id, status, ultimo_acesso_em')
    .in('training_class_id', rows.map(r => r.id));

  const counts = new Map<string, number>();
  const connectedCutoff = Date.now() - 5 * 60 * 1000;
  (participants || []).forEach((p: any) => {
    const lastSeen = p.ultimo_acesso_em ? new Date(p.ultimo_acesso_em).getTime() : 0;
    if (p.status === 'ativo' && lastSeen >= connectedCutoff) {
      counts.set(p.training_class_id, (counts.get(p.training_class_id) || 0) + 1);
    }
  });

  return rows.map(r => ({ ...r, participant_count: counts.get(r.id) || 0 }));
}

export async function listTrainingParticipants(classId: string): Promise<TrainingParticipant[]> {
  await expireElapsedTrainingClasses().catch(() => null);

  const { data, error } = await supabase
    .from('training_participants')
    .select('*')
    .eq('training_class_id', classId)
    .eq('status', 'ativo')
    .order('entrou_em', { ascending: false });
  if (error) throw error;
  return (data || []) as TrainingParticipant[];
}

export async function createTrainingClass(input: {
  nome: string;
  token: string;
  limiteParticipantes: number;
  inicioEm: string;
  fimEm: string;
  criadoPor?: string | null;
  criadoPorNome?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('training_classes').insert({
    nome: input.nome.trim(),
    token: input.token.trim().toUpperCase(),
    limite_participantes: input.limiteParticipantes,
    inicio_em: input.inicioEm,
    fim_em: input.fimEm,
    ativo: true,
    formularios_permitidos: [...TRAINING_ALLOWED_FORMS],
    criado_por: input.criadoPor ?? null,
    criado_por_nome: input.criadoPorNome ?? null,
  });
  if (error) throw error;
}

export async function closeTrainingClass(classId: string): Promise<void> {
  const { error } = await supabase
    .from('training_classes')
    .update({ ativo: false, encerrado_em: new Date().toISOString() })
    .eq('id', classId);
  if (error) throw error;
  await expireElapsedTrainingClasses().catch(() => null);
}
