import * as DocumentPicker from 'expo-document-picker';
import { supabase } from './supabase';

// ─── Cobrança manual (Fase 3) ────────────────────────────────────────────────
// Cliente vê faturas da org e anexa comprovante (imagem ou PDF).
// Aprovação acontece no console web pelo owner (approve_invoice_payment).

export type InvoiceStatus = 'aberta' | 'em_analise' | 'paga' | 'vencida' | 'cancelada';

export interface BillingInvoice {
  id: string;
  subscription_id: string;
  organization_id: string;
  competencia: string;               // 'YYYY-MM'
  valor_centavos: number;
  vencimento: string;                // 'YYYY-MM-DD'
  status: InvoiceStatus;
  comprovante_path: string | null;
  comprovante_enviado_em: string | null;
  pago_em: string | null;
  motivo_rejeicao: string | null;
  criado_em: string;
}

export async function fetchMinhasFaturas(): Promise<BillingInvoice[]> {
  const { data, error } = await supabase.rpc('my_billing_invoices');
  if (error) throw error;
  return (data ?? []) as BillingInvoice[];
}

/** Dias até o vencimento (negativo = já venceu). */
export function diasParaVencimento(vencimento: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(`${vencimento}T00:00:00`);
  return Math.round((venc.getTime() - hoje.getTime()) / 86400000);
}

export function formatarMoeda(centavos: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);
}

export function formatarData(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

/**
 * Abre o seletor de arquivos (imagem ou PDF), sobe para o bucket privado
 * "comprovantes" e registra na fatura via RPC.
 */
export async function enviarComprovante(invoice: BillingInvoice): Promise<'ok' | 'cancelado'> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) return 'cancelado';

  const asset = result.assets[0];
  const ext = (asset.name?.split('.').pop() || 'jpg').toLowerCase();
  const path = `${invoice.organization_id}/${invoice.id}-${Date.now()}.${ext}`;

  const response = await fetch(asset.uri);
  const bytes = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('comprovantes')
    .upload(path, bytes, {
      contentType: asset.mimeType || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg'),
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { error } = await supabase.rpc('submit_invoice_receipt', {
    p_invoice_id: invoice.id,
    p_comprovante_path: path,
  });
  if (error) throw error;
  return 'ok';
}
