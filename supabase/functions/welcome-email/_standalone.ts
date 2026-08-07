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

const DEFESA_CIVIL_LOGO_BASE64 =
  "data:image/jpeg;base64,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";

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
