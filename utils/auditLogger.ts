import { supabase } from './supabase';

// ─── Tipos de ação auditável ────────────────────────────────────────────────

export type AuditAction =
  | 'usuario_aprovado'
  | 'usuario_bloqueado'
  | 'token_gerado'
  | 'token_revogado'
  | 'formulario_publicado'
  | 'formulario_despublicado'
  | 'formulario_excluido'
  | 'formulario_criado'
  | 'formulario_duplicado'
  // Ações de campo (18-05)
  | 'laudo_gerado'
  | 'vistoria_acessada'
  | 'vistoria_criada'
  | 'login_falhou'
  | 'agendamento_criado'
  | 'token_usado';

export interface AuditEntry {
  acao: AuditAction;
  adminUid: string;
  adminNome: string;
  adminRole?: string;
  municipio: string;
  alvoId?: string;
  alvoNome?: string;
  detalhes?: Record<string, any>;
}

// ─── Registro de auditoria (fire-and-forget — nunca bloqueia o fluxo) ───────

export function registrarAuditoria(entry: AuditEntry): void {
  supabase.from('audit_logs').insert({
    acao: entry.acao,
    ator_uid: entry.adminUid,
    ator_nome: entry.adminNome,
    ator_role: entry.adminRole ?? null,
    alvo_id: entry.alvoId ?? null,
    alvo_tipo: entry.alvoNome ?? null,
    detalhes: {
      ...(entry.detalhes ?? {}),
      municipio: entry.municipio,
    },
    criado_em: new Date().toISOString(),
  }).then(({ error }) => {
    if (error) {
      // Falha silenciosa — audit log não deve quebrar a operação principal
      console.warn('[audit] Falha ao registrar auditoria:', error.message);
    }
  });
}
