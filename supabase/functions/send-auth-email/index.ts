/**
 * send-auth-email
 *
 * Supabase Auth Hook — intercepta TODOS os e-mails de autenticação
 * (confirmação de cadastro, reset de senha, OTP/MFA) e os envia via
 * Resend com templates HTML personalizados TCS — Relatório de Risco.
 *
 * Configuração no Supabase Dashboard:
 *   Authentication → Hooks → Send Email Hook
 *   URL: https://<project-ref>.supabase.co/functions/v1/send-auth-email
 */

import { DEFESA_CIVIL_LOGO_BASE64 } from '../_shared/defesaCivilLogo.ts';
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const AUTH_HOOK_SECRET = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? '')
  .replace(/^v1,whsec_/, '');
const FROM_NAME = 'TCS – Relatório de Risco';
// Use um domínio verificado no Resend (ex.: notificacoes@tcs.app).
// O padrão onboarding@resend.dev é sandbox: SÓ entrega para destinatários
// pré-autorizados — qualquer outro e-mail (recuperação de senha, cadastro
// de terceiros) é rejeitado, quebrando o fluxo de auth.
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AuthHookPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    token?: string;           // OTP / Magic-link token
    token_hash?: string;      // Hash para link de confirmação
    redirect_to?: string;
    email_action_type: 'signup' | 'recovery' | 'invite' | 'email_change' | 'magiclink' | 'reauthentication';
    site_url?: string;
    verification_url?: string; // URL completa pré-montada pelo Supabase (quando disponível)
  };
}

// ─── CORS ─────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── Utilitários HTML ─────────────────────────────────────────────────────────

function baseLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 0;">
    <tr>
      <td align="center">
        <!-- Card -->
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a3a5c 0%,#0d2137 100%);padding:28px 40px;text-align:center;">
              <img src="${DEFESA_CIVIL_LOGO_BASE64}" alt="Defesa Civil" height="64" style="display:block;margin:0 auto 12px;" />
              <p style="margin:0;color:#a8c4e0;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">Sistema de Gestão de Risco</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              ${body}
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

// ─── Templates ────────────────────────────────────────────────────────────────

function templateSignup(email: string, confirmationUrl: string): { subject: string; html: string } {
  return {
    subject: 'Confirme seu cadastro — TCS Relatório de Risco',
    html: baseLayout('Confirmar Cadastro', `
      <h2 style="margin:0 0 16px;color:#1a3a5c;font-size:20px;font-weight:600;">Bem-vindo ao TCS</h2>
      <p style="margin:0 0 24px;color:#4a5568;font-size:14px;line-height:1.6;">
        Sua conta foi criada com o endereço <strong style="color:#1a3a5c;">${email}</strong>.
        Para ativar sua conta e acessar o sistema, clique no botão abaixo.
      </p>

      <div style="text-align:center;margin:32px 0;">
        <a href="${confirmationUrl}"
           style="display:inline-block;background:#1a73e8;color:#ffffff;font-size:14px;font-weight:600;padding:12px 32px;border-radius:6px;text-decoration:none;">
          Confirmar Cadastro
        </a>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-top:1px solid #e8ecf0;padding-top:20px;">
        <tr>
          <td style="padding:0;">
            <p style="margin:0 0 12px;color:#64748b;font-size:13px;line-height:1.5;">
              <strong>Não reconhece este cadastro?</strong><br/>
              Se você não criou esta conta, ignore este e-mail com segurança.
            </p>
            <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">
              <strong>Importante:</strong> Este link expira em 24 horas.
            </p>
          </td>
        </tr>
      </table>

      <p style="margin:24px 0 0;color:#8a94a6;font-size:12px;line-height:1.6;">
        Caso o botão não funcione, copie e cole o link abaixo no seu navegador:<br/>
        <a href="${confirmationUrl}" style="color:#1a73e8;word-break:break-all;font-size:11px;">${confirmationUrl}</a>
      </p>
    `),
  };
}

function templatePasswordReset(email: string, resetUrl: string): { subject: string; html: string } {
  return {
    subject: 'Redefinição de senha — TCS Relatório de Risco',
    html: baseLayout('Redefinir Senha', `
      <h2 style="margin:0 0 16px;color:#1a3a5c;font-size:20px;font-weight:600;">Redefinir sua senha</h2>
      <p style="margin:0 0 24px;color:#4a5568;font-size:14px;line-height:1.6;">
        Recebemos uma solicitação para redefinir a senha da conta associada ao endereço <strong style="color:#1a3a5c;">${email}</strong>.
        Clique no botão abaixo para criar uma nova senha.
      </p>

      <div style="text-align:center;margin:32px 0;">
        <a href="${resetUrl}"
           style="display:inline-block;background:#1a73e8;color:#ffffff;font-size:14px;font-weight:600;padding:12px 32px;border-radius:6px;text-decoration:none;">
          Redefinir Senha
        </a>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-top:1px solid #e8ecf0;padding-top:20px;">
        <tr>
          <td style="padding:0;">
            <p style="margin:0 0 12px;color:#64748b;font-size:13px;line-height:1.5;">
              <strong>Não solicitou esta alteração?</strong><br/>
              Ignore este e-mail. Sua senha permanecerá inalterada.
            </p>
            <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">
              <strong>Importante:</strong> Este link expira em 1 hora por motivos de segurança.
            </p>
          </td>
        </tr>
      </table>

      <p style="margin:24px 0 0;color:#8a94a6;font-size:12px;line-height:1.6;">
        Caso o botão não funcione, copie e cole o link abaixo no seu navegador:<br/>
        <a href="${resetUrl}" style="color:#1a73e8;word-break:break-all;font-size:11px;">${resetUrl}</a>
      </p>
    `),
  };
}

function templateOtp(email: string, otp: string, actionType: string): { subject: string; html: string } {
  const actionLabel = actionType === 'reauthentication' ? 'Reautenticação' : 'Verificação';
  return {
    subject: `Código de ${actionLabel} — TCS Relatório de Risco`,
    html: baseLayout(`Código de ${actionLabel}`, `
      <h2 style="margin:0 0 16px;color:#1a3a5c;font-size:20px;font-weight:600;">Código de ${actionLabel}</h2>
      <p style="margin:0 0 24px;color:#4a5568;font-size:14px;line-height:1.6;">
        Use o código abaixo para ${actionLabel.toLowerCase()} em <strong style="color:#1a3a5c;">${email}</strong>:
      </p>

      <div style="text-align:center;margin:28px 0;">
        <div style="display:inline-block;background:#1a3a5c;border-radius:8px;padding:20px 40px;">
          <span style="color:#ffffff;font-size:36px;font-weight:700;letter-spacing:12px;font-family:'Courier New',monospace;">${otp}</span>
        </div>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-top:1px solid #e8ecf0;padding-top:20px;">
        <tr>
          <td style="padding:0;">
            <p style="margin:0 0 12px;color:#64748b;font-size:13px;line-height:1.5;">
              <strong>Importante:</strong> Este código expira em 10 minutos.
            </p>
            <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">
              <strong>Segurança:</strong> Nunca compartilhe este código com outras pessoas.
            </p>
          </td>
        </tr>
      </table>

      <p style="margin:0;color:#8a94a6;font-size:12px;">
        Se você não solicitou este código, entre em contato com o administrador do sistema imediatamente.
      </p>
    `),
  };
}

function templateMagicLink(email: string, magicUrl: string): { subject: string; html: string } {
  return {
    subject: 'Link de acesso — TCS Relatório de Risco',
    html: baseLayout('Link de Acesso', `
      <h2 style="margin:0 0 16px;color:#1a3a5c;font-size:20px;font-weight:600;">Acesso via link</h2>
      <p style="margin:0 0 24px;color:#4a5568;font-size:14px;line-height:1.6;">
        Clique no botão abaixo para acessar o TCS com o endereço <strong style="color:#1a3a5c;">${email}</strong> sem precisar de senha.
      </p>

      <div style="text-align:center;margin:32px 0;">
        <a href="${magicUrl}"
           style="display:inline-block;background:#1a73e8;color:#ffffff;font-size:14px;font-weight:600;padding:12px 32px;border-radius:6px;text-decoration:none;">
          Acessar Agora
        </a>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-top:1px solid #e8ecf0;padding-top:20px;">
        <tr>
          <td style="padding:0;">
            <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">
              <strong>Importante:</strong> Este link expira em 1 hora e pode ser usado apenas uma vez.
            </p>
          </td>
        </tr>
      </table>

      <p style="margin:24px 0 0;color:#8a94a6;font-size:12px;line-height:1.6;">
        Caso o botão não funcione, copie e cole o link abaixo no seu navegador:<br/>
        <a href="${magicUrl}" style="color:#1a73e8;word-break:break-all;font-size:11px;">${magicUrl}</a>
      </p>
    `),
  };
}

function templateEmailChange(email: string, confirmationUrl: string): { subject: string; html: string } {
  return {
    subject: 'Confirme a alteração de e-mail — TCS Relatório de Risco',
    html: baseLayout('Alteração de E-mail', `
      <h2 style="margin:0 0 16px;color:#1a3a5c;font-size:20px;font-weight:600;">Confirmar novo endereço de e-mail</h2>
      <p style="margin:0 0 24px;color:#4a5568;font-size:14px;line-height:1.6;">
        Foi solicitada a alteração do endereço de e-mail da sua conta para <strong style="color:#1a3a5c;">${email}</strong>.
        Clique no botão abaixo para confirmar esta alteração.
      </p>

      <div style="text-align:center;margin:32px 0;">
        <a href="${confirmationUrl}"
           style="display:inline-block;background:#1a73e8;color:#ffffff;font-size:14px;font-weight:600;padding:12px 32px;border-radius:6px;text-decoration:none;">
          Confirmar Alteração
        </a>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-top:1px solid #e8ecf0;padding-top:20px;">
        <tr>
          <td style="padding:0;">
            <p style="margin:0 0 12px;color:#64748b;font-size:13px;line-height:1.5;">
              <strong>Não solicitou esta alteração?</strong><br/>
              Ignore este e-mail. Seu endereço de e-mail permanecerá inalterado.
            </p>
            <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">
              <strong>Importante:</strong> Este link expira em 24 horas.
            </p>
          </td>
        </tr>
      </table>
    `),
  };
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

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // This function is intentionally JWT-free because it is called by Supabase
  // Auth. Every request must instead carry a valid Standard Webhooks signature.
  if (!AUTH_HOOK_SECRET) {
    console.error('[send-auth-email] SEND_EMAIL_HOOK_SECRET is not configured');
    return new Response(JSON.stringify({ success: false, error: 'service_unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: AuthHookPayload;
  try {
    const rawPayload = await req.text();
    payload = new Webhook(AUTH_HOOK_SECRET).verify(
      rawPayload,
      Object.fromEntries(req.headers),
    ) as AuthHookPayload;
  } catch {
    console.warn('[send-auth-email] rejected request with invalid webhook signature');
    return new Response(JSON.stringify({ success: false, error: 'invalid_webhook_signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { user, email_data } = payload;
    const email = user.email;
    const actionType = email_data.email_action_type;

    console.log(`[send-auth-email] action=${actionType} email=${email}`);

    let subject: string;
    let html: string;

    switch (actionType) {
      case 'signup': {
        // URL de confirmação — usa verification_url se disponível, senão monta com token_hash
        const confirmUrl = email_data.verification_url ??
          `${email_data.site_url}/auth/confirm?token_hash=${email_data.token_hash}&type=signup&next=${encodeURIComponent(email_data.redirect_to ?? '/')}`;
        ({ subject, html } = templateSignup(email, confirmUrl));
        break;
      }

      case 'invite': {
        const confirmUrl = email_data.verification_url ??
          `${email_data.site_url}/auth/confirm?token_hash=${email_data.token_hash}&type=invite&next=${encodeURIComponent(email_data.redirect_to ?? '/')}`;
        ({ subject, html } = templateSignup(email, confirmUrl));
        break;
      }

      case 'recovery': {
        const resetUrl = email_data.verification_url ??
          `${email_data.site_url}/auth/confirm?token_hash=${email_data.token_hash}&type=recovery&next=${encodeURIComponent(email_data.redirect_to ?? '/')}`;
        ({ subject, html } = templatePasswordReset(email, resetUrl));
        break;
      }

      case 'magiclink': {
        const magicUrl = email_data.verification_url ??
          `${email_data.site_url}/auth/confirm?token_hash=${email_data.token_hash}&type=magiclink`;
        ({ subject, html } = templateMagicLink(email, magicUrl));
        break;
      }

      case 'email_change': {
        const changeUrl = email_data.verification_url ??
          `${email_data.site_url}/auth/confirm?token_hash=${email_data.token_hash}&type=email_change`;
        ({ subject, html } = templateEmailChange(email, changeUrl));
        break;
      }

      case 'reauthentication':
      default: {
        // OTP numérico de 6 dígitos
        const otp = email_data.token ?? '------';
        ({ subject, html } = templateOtp(email, otp, actionType));
        break;
      }
    }

    await sendViaResend(email, subject, html);

    console.log(`[send-auth-email] ✅ Enviado para ${email} (${actionType})`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[send-auth-email] ❌ Erro: ${message}`);

    // Send Email Hook: non-2xx aborta a operação de authORIGINAL (ex.:
    // resetPasswordForEmail devolve erro → portal mostra "Não foi possível
    // solicitar a recuperação"). Responder 200 mesmo em falha evita quebrar
    // o fluxo do usuário; o erro fica visível nos logs para depuração.
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
