// Edge Function: send-whatsapp-otp
// Envia código OTP de recuperação de senha via WhatsApp Business API (Meta Cloud API)
//
// STATUS: Desativado — aguardando configuração do WhatsApp Business API
//
// Pré-requisitos para ativar:
//   1. Conta aprovada no Meta Business Manager
//   2. WhatsApp Business API configurada
//   3. Template "codigo_recuperacao" aprovado pela Meta (pt_BR)
//   4. Variáveis de ambiente no Supabase:
//      - WHATSAPP_TOKEN      → Token permanente da Meta
//      - WHATSAPP_PHONE_ID   → ID do número de telefone no Meta
//
// Template esperado (criar no Meta Business Manager):
//   Nome: codigo_recuperacao
//   Idioma: pt_BR
//   Corpo: "TCS - Relatório de Risco: seu código de recuperação é *{{1}}*. Válido por 10 minutos. Não compartilhe."

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v19.0';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { telefone, codigo } = await req.json();

    if (!telefone || !codigo) {
      return new Response(
        JSON.stringify({ error: 'telefone e codigo são obrigatórios' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN');
    const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID');

    if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp Business API não configurado' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Normaliza número: remove não dígitos e adiciona +55 se necessário
    const numero = telefone.replace(/\D/g, '');
    const numeroFormatado = numero.startsWith('55') ? `+${numero}` : `+55${numero}`;

    const response = await fetch(`${WHATSAPP_API_URL}/${WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: numeroFormatado,
        type: 'template',
        template: {
          name: 'codigo_recuperacao',
          language: { code: 'pt_BR' },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: codigo }],
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('WhatsApp API error:', err);
      return new Response(
        JSON.stringify({ error: 'Falha ao enviar mensagem WhatsApp' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('send-whatsapp-otp error:', e);
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
