export interface AgendamentoLocal {
  id: string;
  titulo: string;
  endereco?: string;
  municipio: string;
  data_agendada: string;
  criado_por_uid: string;
  criado_por_nome?: string;
  agente_uid?: string;
  agente_nome?: string;
  lat?: number;
  lng?: number;
  observacoes?: string;
  status: 'pendente' | 'concluido' | 'cancelado' | 'deletado';
  vistoria_id?: string | null;
  origem?: 'app' | 'web';
  criado_em?: string;
  sincronizado?: number;
}
