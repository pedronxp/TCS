/**
 * types/vistoria.ts
 * Interfaces TypeScript compartilhadas para o domínio de vistorias.
 * Elimina o uso de `any` nos estados das telas.
 */

/** Vistoria retornada pelo Supabase (camelCase) */
export interface VistoriaSupabase {
  id: string;
  agenteUid: string;
  agenteNome: string;
  municipio: string;
  endereco: string;
  enderecoRua: string;
  enderecoNumero: string;
  enderecoBairro: string;
  enderecoCep?: string | null;
  responsavelNome?: string | null;
  latitude?: number;
  longitude?: number;
  dataVistoria: string;
  formularioId: string;
  formularioVersao?: number;
  respostasJson: string;
  calculoRisco?: unknown;
  nivelRisco: string;
  pontuacaoTotal: number;
  fotoUrl?: string | null;
  fotosUrls?: string[];
  status?: string;
  createdAt?: string;
}

/** Vistoria normalizada para uso nas telas (aceita tanto camelCase quanto snake_case) */
export interface VistoriaNormalizada {
  id: string;
  nivelRisco: string;
  pontuacaoTotal: number;
  endereco: string;
  municipio: string;
  dataVistoria: string | null;
  agenteNome: string;
  agenteUid?: string;
  respostasJson: string;
  calculoRisco?: unknown;
  formularioId: string;
  status?: string;
  responsavelNome?: string | null;
  enderecoRua?: string;
  enderecoNumero?: string;
  enderecoBairro?: string;
  latitude?: number | null;
  longitude?: number | null;
  fotosUrls?: string[] | null;
}

/** Item de atividade recente (admin/supervisor dashboard) */
export interface AtividadeItem {
  id: string;
  nivelRisco: string;
  endereco?: string;
  enderecoRua?: string;
  enderecoNumero?: string;
  enderecoBairro?: string;
  municipio?: string;
  dataVistoria: string | null;
  agenteNome?: string;
  pontuacaoTotal?: number;
  status?: string;
}

/** Parâmetros de navegação tipados para o wizard */
export interface WizardParams {
  formularioId: string;
  formularioTitulo: string;
  formularioVersao?: string;
  isBuiltin?: string;
  rua: string;
  numero: string;
  bairro: string;
  cep?: string;
  municipio?: string;
  responsavelNome?: string;
  lat?: string;
  lng?: string;
  agendamentoId?: string;
}
