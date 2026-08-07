/**
 * welcome-email
 *
 * Envia um e-mail de boas-vindas personalizado assim que o usuário
 * confirma o cadastro no TCS — Relatório de Risco.
 *
 * Pode ser chamado:
 *   1. Diretamente pela app após `supabase.auth.getSession()` retornar
 *      sessão válida pela primeira vez (primeiro login pós-confirmação).
 *   2. Via Supabase Database Webhook na tabela `auth.users`
 *      (event: INSERT, filter: email_confirmed_at IS NOT NULL).
 *
 * Body esperado (POST JSON):
 *   { "email": "usuario@example.com", "name": "Nome do Usuário" }
 *   — ou —
 *   Payload de Database Webhook do Supabase (record.email / record.raw_user_meta_data)
 */

import { DEFESA_CIVIL_LOGO_BASE64 } from '../_shared/defesaCivilLogo.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_NAME = 'TCS – Relatório de Risco';
const FROM_EMAIL = 'onboarding@resend.dev'; // Trocar pelo domínio verificado quando disponível

// ─── CORS ─────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── Template de Boas-vindas ──────────────────────────────────────────────────

function templateWelcome(email: string, name: string): string {
  const firstName = name.split(' ')[0] ?? name;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bem-vindo ao TCS</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header com gradiente e logo -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a3a5c 0%,#0d2137 100%);padding:36px 40px;text-align:center;">
              <img src="${DEFESA_CIVIL_LOGO_BASE64}" alt="Defesa Civil" height="72" style="display:block;margin:0 auto 16px;" />
              <h1 style="margin:0 0 4px;color:#ffffff;font-size:24px;font-weight:700;">TCS — Relatório de Risco</h1>
              <p style="margin:0;color:#a8c4e0;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;">Sistema de Gestão de Risco Municipal</p>
            </td>
          </tr>

          <!-- Hero banner -->
          <tr>
            <td style="background:linear-gradient(135deg,#1565c0 0%,#0d47a1 100%);padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#bbdefb;font-size:18px;font-weight:600;">🎉 Cadastro confirmado com sucesso!</p>
            </td>
          </tr>

          <!-- Conteúdo principal -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="margin:0 0 12px;color:#1a3a5c;font-size:22px;font-weight:700;">
                Olá, ${firstName}! 👋
              </h2>
              <p style="margin:0 0 20px;color:#4a5568;font-size:15px;line-height:1.7;">
                Seja bem-vindo ao <strong>TCS — Relatório de Risco</strong>, o sistema de gestão de
                vistorias e relatórios de risco da Defesa Civil Municipal. Sua conta
                (<strong style="color:#1a3a5c;">${email}</strong>) está ativa e pronta para uso.
              </p>

              <!-- Recursos em destaque -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td style="padding:0 0 12px;">
                    <table width="100%" cellpadding="16" cellspacing="0" style="background:#f0f7ff;border-radius:10px;border-left:4px solid #1a73e8;">
                      <tr>
                        <td style="padding:14px 18px;">
                          <p style="margin:0 0 4px;color:#1a3a5c;font-size:14px;font-weight:700;">📋 Relatórios de Vistoria</p>
                          <p style="margin:0;color:#4a5568;font-size:13px;line-height:1.5;">Registre e acompanhe vistorias de risco em campo com formulários estruturados.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 12px;">
                    <table width="100%" cellpadding="16" cellspacing="0" style="background:#f0fff4;border-radius:10px;border-left:4px solid #2e7d32;">
                      <tr>
                        <td style="padding:14px 18px;">
                          <p style="margin:0 0 4px;color:#1a3a5c;font-size:14px;font-weight:700;">🗺️ Mapeamento de Áreas</p>
                          <p style="margin:0;color:#4a5568;font-size:13px;line-height:1.5;">Identifique e monitore áreas de risco no município com geolocalização.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table width="100%" cellpadding="16" cellspacing="0" style="background:#fff8e1;border-radius:10px;border-left:4px solid #f57f17;">
                      <tr>
                        <td style="padding:14px 18px;">
                          <p style="margin:0 0 4px;color:#1a3a5c;font-size:14px;font-weight:700;">📊 Laudos e Relatórios</p>
                          <p style="margin:0;color:#4a5568;font-size:13px;line-height:1.5;">Gere laudos técnicos em PDF automaticamente com base nos dados coletados.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <div style="text-align:center;margin:32px 0 24px;">
                <a href="https://tcs.defesacivil.app"
                   style="display:inline-block;background:linear-gradient(135deg,#1a73e8,#0d5cbf);color:#ffffff;font-size:16px;font-weight:700;padding:16px 40px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;">
                  🚀 Acessar o Sistema
                </a>
              </div>

              <p style="margin:0;color:#8a94a6;font-size:13px;line-height:1.6;text-align:center;">
                Em caso de dúvidas, entre em contato com seu supervisor ou administrador do sistema.
              </p>
            </td>
          </tr>

          <!-- Divisor -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #e8ecf0;margin:0;" />
            </td>
          </tr>

          <!-- Informações de segurança -->
          <tr>
            <td style="padding:20px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafbfc;border-radius:8px;padding:16px;">
                <tr>
                  <td style="padding:12px 16px;">
                    <p style="margin:0 0 8px;color:#4a5568;font-size:13px;font-weight:600;">🔒 Dicas de Segurança</p>
                    <p style="margin:0;color:#718096;font-size:12px;line-height:1.7;">
                      • Nunca compartilhe sua senha com outras pessoas<br/>
                      • O sistema jamais solicitará sua senha por e-mail ou telefone<br/>
                      • Em caso de acesso suspeito, altere sua senha imediatamente
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8f9fb;border-top:1px solid #e8ecf0;padding:20px 40px;text-align:center;">
              <p style="margin:0 0 4px;color:#8a94a6;font-size:12px;">
                TCS — Relatório de Risco &nbsp;·&nbsp; Defesa Civil Municipal
              </p>
              <p style="margin:0;color:#b0b8c4;font-size:11px;">
                Este e-mail foi enviado automaticamente. Por favor, não responda.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Envio via Resend ─────────────────────────────────────────────────────────

async function sendViaResend(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error ${res.status}: ${err}`);
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Suporta tanto payload direto { email, name }
    // quanto Database Webhook do Supabase { type, record: { email, raw_user_meta_data } }
    let email: string;
    let name: string;

    if (body.record) {
      // Database Webhook format
      email = body.record.email ?? '';
      const meta = body.record.raw_user_meta_data ?? {};
      name = meta.full_name ?? meta.name ?? email.split('@')[0];
    } else {
      // Chamada direta
      email = body.email ?? '';
      name = body.name ?? email.split('@')[0];
    }

    if (!email) {
      return new Response(JSON.stringify({ error: 'email é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = templateWelcome(email, name);
    await sendViaResend(email, '🎉 Bem-vindo ao TCS — Relatório de Risco!', html);

    console.log(`[welcome-email] ✅ Enviado para ${email}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[welcome-email] ❌ Erro: ${message}`);

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
