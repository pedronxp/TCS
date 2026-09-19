/**
 * send-monthly-report (F8 — Retenção)
 *
 * Chamada pelo cron `send-monthly-report` (pg_cron → net.http_post) nos dias 1-3
 * do mês. Busca relatórios gerados (org_monthly_reports.enviado_em IS NULL),
 * monta o HTML com o resumo do mês e o comparativo, e envia por e-mail (Resend)
 * para os admins/master de cada organização.
 *
 * Segurança: exige header x-cron-secret igual a ai_cron_settings.cron_secret.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_NAME = 'TCS — Relatório de Risco';
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

interface Relatorio {
  id: string;
  organization_id: string;
  competencia: string; // 'YYYY-MM'
  resumo: {
    vistorias?: number;
    vistorias_mes_anterior?: number;
    alto_risco?: number;
    risco_medio?: number;
    agentes_ativos?: number;
    top_agentes?: { agente: string; vistorias: number }[];
    qe?: { avaliadas?: number; aprovadas?: number; nota_media?: number | null };
  };
  organizations?: { display_name: string } | null;
}

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const competenciaLabel = (c: string) => {
  const [y, m] = c.split('-');
  return `${MESES[Number(m) - 1]} de ${y}`;
};

function variacao(atual: number, anterior: number): string {
  if (anterior === 0) return atual > 0 ? '↑ novo' : '—';
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct === 0) return 'estável';
  return pct > 0 ? `↑ ${pct}% vs mês anterior` : `↓ ${Math.abs(pct)}% vs mês anterior`;
}

function buildHtml(org: string, competencia: string, r: Relatorio['resumo']): string {
  const topAgentes = (r.top_agentes ?? [])
    .map(a => `<li><strong>${a.agente}</strong> — ${a.vistorias} vistoria(s)</li>`).join('');
  const qe = r.qe ?? {};
  const aprovPct = qe.avaliadas ? Math.round((qe.aprovadas ?? 0) / qe.avaliadas * 100) : null;

  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
    <h2 style="color:#0f5132">Resumo de ${competenciaLabel(competencia)}</h2>
    <p style="color:#6b7280">${org}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Vistorias no mês</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right"><strong>${r.vistorias ?? 0}</strong></td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Comparativo</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${variacao(r.vistorias ?? 0, r.vistorias_mes_anterior ?? 0)}</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Alto risco (R3/R4)</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right"><strong>${r.alto_risco ?? 0}</strong></td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Agentes ativos</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${r.agentes_ativos ?? 0}</td></tr>
      ${aprovPct !== null ? `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Qualidade (QE): aprovação</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${aprovPct}%${qe.nota_media != null ? ` · nota média ${qe.nota_media}` : ''}</td></tr>` : ''}
    </table>
    ${topAgentes ? `<h3 style="margin-top:20px;font-size:15px">Top agentes</h3><ul style="font-size:14px;padding-left:18px">${topAgentes}</ul>` : ''}
    <p style="margin-top:24px;font-size:12px;color:#9ca3af">
      Gerado automaticamente pelo sistema TCS. Responda este e-mail se algo parecer estranho.
    </p>
  </div>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!RESEND_API_KEY) return new Response(JSON.stringify({ error: 'resend_not_configured' }), { status: 500 });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return new Response(JSON.stringify({ error: 'supabase_not_configured' }), { status: 500 });

  const cronSecret = req.headers.get('x-cron-secret') ?? '';
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: cfg } = await supabase
    .from('ai_cron_settings').select('cron_secret').eq('id', true).maybeSingle();
  if (!cfg?.cron_secret || cronSecret !== cfg.cron_secret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const { data: relatorios, error } = await supabase
    .from('org_monthly_reports')
    .select('id, organization_id, competencia, resumo, organizations(display_name)')
    .is('enviado_em', null)
    .limit(50);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let enviados = 0;
  const falhas: string[] = [];

  for (const rel of (relatorios ?? []) as Relatorio[]) {
    const { data: admins } = await supabase
      .from('organization_members')
      .select('users: user_id (email, name)')
      .eq('organization_id', rel.organization_id)
      .eq('status', 'active')
      .in('role', ['admin', 'master']);

    const destinatarios = (admins ?? [])
      .map((a: any) => a.users?.email)
      .filter((e: string | undefined): e is string => !!e);

    if (destinatarios.length === 0) {
      falhas.push(`${rel.id}:sem_admins`);
      continue;
    }

    const orgNome = rel.organizations?.display_name ?? 'Sua organização';
    const html = buildHtml(orgNome, rel.competencia, rel.resumo);

    try {
      for (const to of new Set(destinatarios)) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to: [to],
            subject: `Relatório mensal — ${competenciaLabel(rel.competencia)} · ${orgNome}`,
            html,
          }),
        });
        if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
      }
      await supabase.from('org_monthly_reports').update({ enviado_em: new Date().toISOString() }).eq('id', rel.id);
      enviados += 1;
    } catch (e) {
      falhas.push(`${rel.id}:${String(e)}`);
    }
  }

  return new Response(JSON.stringify({ relatorios_enviados: enviados, falhas }), {
    headers: { 'Content-Type': 'application/json', 'Connection': 'keep-alive' },
  });
});
