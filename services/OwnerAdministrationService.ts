import { supabase } from '../utils/supabase';
import { generateUUID } from '../utils/uuid';

export type OwnerRecord = Record<string, any>;
export async function ownerRpc(name: string, args: OwnerRecord = {}): Promise<any> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  if (data && typeof data === 'object' && data.ok === false) throw new Error(data.error || 'O servidor não concluiu a ação.');
  return data;
}
export function ownerItems(data: unknown): OwnerRecord[] {
  const source = Array.isArray(data) ? data : data && typeof data === 'object' ? (data as OwnerRecord).items : null;
  return Array.isArray(source) ? source.filter(item => item && typeof item === 'object') : [];
}
export async function listOwnerCustomers(search = '', offset = 0) {
  return ownerRpc('list_internal_customers', { p_search: search || undefined, p_limit: 25, p_offset: offset });
}
export async function ownerMutation(name: string, args: OwnerRecord, reason: string, operationId = generateUUID()) {
  if (reason.trim().length < 8 || reason.trim().length > 500) throw new Error('Informe um motivo entre 8 e 500 caracteres.');
  return ownerRpc(name, { ...args, p_reason: reason.trim(), p_operation_id: operationId });
}

export const OWNER_ADMIN_CAPABILITIES = [
  { key: 'customers', title: 'Clientes e contas', detail: 'Organizações, profissionais, equipe, assinaturas e vistorias', icon: 'users' },
  { key: 'inspections', title: 'Vistorias e documentos', detail: 'Todas as vistorias, laudos, evidências e ciências', icon: 'clipboard' },
  { key: 'archived', title: 'Vistorias arquivadas', detail: 'Consultar e restaurar exclusões reversíveis', icon: 'archive' },
  { key: 'quality', title: 'Revisão de qualidade', detail: 'Aprovar ou devolver vistorias com parecer', icon: 'check-square' },
  { key: 'staff', title: 'Equipe interna e permissões', detail: 'Papéis, situação e permissões da equipe TCS', icon: 'shield' },
  { key: 'tokens', title: 'Tokens de acesso', detail: 'Consulte convites e sua validade', icon: 'key' },
  { key: 'campaigns', title: 'Avisos e campanhas', detail: 'Acompanhe avisos e seu envio', icon: 'bell' },
  { key: 'versions', title: 'Versões do app', detail: 'Veja a versão disponível e o que mudou', icon: 'smartphone' },
  { key: 'plans', title: 'Planos e módulos', detail: 'Catálogo, recursos e limites de cada plano', icon: 'grid' },
  { key: 'forms', title: 'Formulários', detail: 'Consultar e ativar formulários globais e municipais', icon: 'file-text' },
  { key: 'support', title: 'Suporte', detail: 'Chamados abertos e acompanhamento de atendimento', icon: 'help-circle' },
  { key: 'audit', title: 'Auditoria', detail: 'Ações, responsáveis, motivos e resultados', icon: 'list' },
  { key: 'security', title: 'Confirmar acesso administrativo', detail: 'Verificar segundo fator para ações protegidas', icon: 'lock' },
] as const;

export async function listOwnerAdminSection(section: string): Promise<OwnerRecord[]> {
  if (section === 'tokens') return ownerItems(await ownerRpc('list_console_invite_tokens', { p_municipio: null }));
  if (section === 'campaigns') return ownerItems(await ownerRpc('list_notification_campaigns'));
  if (section === 'versions') {
    const catalog = await ownerRpc('get_internal_release_catalog');
    const version = catalog?.settings?.published_version;
    if (!version) return [];
    const release = ownerItems(catalog?.rows).find(item => item.version === version);
    const notes = typeof release?.changelog === 'string' ? release.changelog.trim() : '';
    return [{ version, changelog: /^Versão encontrada no app\.json ao iniciar o catálogo interno\.?$/i.test(notes) ? '' : notes, minimumVersion: catalog.settings.minimum_version }];
  }
  if (section === 'archived') {
    const { data, error } = await supabase.from('vistorias').select('id,protocolo,agenteNome,endereco,owner_archived_at').not('owner_archived_at', 'is', null).order('owner_archived_at', { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return ownerItems(data);
  }
  if (section === 'audit') return ownerItems(await ownerRpc('list_internal_audit_timeline', { p_limit: 100 }));
  if (section === 'forms') return ownerItems(await ownerRpc('list_internal_forms'));
  if (section === 'support') return ownerItems(await ownerRpc('list_internal_support_queue', { p_limit: 100 }));
  if (section === 'staff') {
    const { data, error } = await supabase.from('internal_staff').select('user_id,role,status,display_name,created_at').order('created_at');
    if (error) throw new Error(error.message);
    return ownerItems(data);
  }
  if (section === 'plans') {
    const { data, error } = await supabase.from('plans').select('id,name,description,status,audience,plan_features(feature_code,enabled),plan_limits(resource_code,hard_limit)').order('name');
    if (error) throw new Error(error.message);
    return ownerItems(data);
  }
  return [];
}

export function ownerActionError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause);
  if (message.includes('is ambiguous')) return 'O servidor não conseguiu concluir a consulta. Tente novamente após a correção do serviço.';
  if (message.includes('aal2')) return 'Confirme seu segundo fator em “Confirmar acesso administrativo” e repita a ação.';
  if (message.includes('42501') || message.includes('not_allowed') || message.includes('forbidden')) return 'O servidor não autorizou esta ação. Atualize sua sessão e confirme as permissões da conta.';
  return message;
}
