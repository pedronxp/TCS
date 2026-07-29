const labels: Record<string, string> = {
  active: 'Ativo', inactive: 'Inativo', onboarding: 'Em implantação', pilot: 'Piloto',
  trial: 'Período de teste', trialing: 'Em período de teste', grace: 'Em carência',
  past_due: 'Pagamento atrasado', canceled: 'Cancelado', cancelled: 'Cancelado',
  suspended: 'Suspenso', removed: 'Removido', archived: 'Arquivado', blocked: 'Bloqueado',
  open: 'Aberto', in_progress: 'Em andamento', pending: 'Pendente', approved: 'Aprovado',
  rejected: 'Rejeitado', resolved: 'Resolvido', closed: 'Fechado', executed: 'Executado',
  completed: 'Concluído', concluida: 'Concluída', failed: 'Falhou', error: 'Erro',
  published: 'Publicada', candidate: 'Candidata', building: 'Em execução',
  succeeded: 'Sucesso', queued: 'Na fila', waiting: 'Aguardando',
  draft: 'Rascunho', retired: 'Substituída', rascunho: 'Rascunho',
  publicado: 'Publicado', arquivado: 'Arquivado',
  warning: 'Atenção', critical: 'Crítico', replaced: 'Encerrada por novo acesso',
  revoked: 'Revogada', expired: 'Expirada', individual: 'Cliente individual',
  organization: 'Organização', owner: 'Proprietário', developer: 'Desenvolvedor',
  support: 'Suporte', supervisor: 'Supervisor', coordinator: 'Coordenador', agent: 'Agente',
  master_admin: 'Administrador principal', production: 'Produção', preview: 'Homologação',
  development: 'Desenvolvimento', block: 'Bloquear novo acesso', replace: 'Substituir sessão anterior',
  supabase: 'No Storage', drive: 'No Drive', archiving: 'Arquivando',
  restoring: 'Restaurando', restored: 'Restaurada',
  sync: 'Sincronização', storage: 'Armazenamento', runtime: 'Execução',
  configuration: 'Configuração', build: 'Build', version: 'Versão',
  android: 'Android', ios: 'iOS', web: 'Web', server: 'Servidor', unknown: 'Desconhecida',
  debug: 'Depuração', info: 'Informação',
};

export function ptBrLabel(value: string | null | undefined, fallback = 'Não informado') {
  if (!value) return fallback;
  return labels[value.toLowerCase()] ?? value.replace(/_/g, ' ');
}

export function assuranceLabel(value: string | null | undefined) {
  if (value === 'aal2') return 'Segurança reforçada';
  if (value === 'aal1') return 'Segurança padrão';
  return ptBrLabel(value);
}
