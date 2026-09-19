import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Tokens que expiram em até 2 horas, ainda não usados e ainda não notificados
  const agora = new Date();
  const em2h = new Date(agora.getTime() + 2 * 3600 * 1000);

  const { data: tokens, error } = await supabase
    .from('invite_tokens')
    .select('codigo, municipio, role, "criadoPor", "expiraEm"')
    .eq('usado', false)
    .eq('notificadoExpirando', false)
    .lte('expiraEm', em2h.toISOString())
    .gt('expiraEm', agora.toISOString());

  if (error) {
    console.error('Erro ao buscar tokens expirando:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!tokens || tokens.length === 0) {
    return new Response(JSON.stringify({ enviadas: 0 }), { status: 200 });
  }

  let enviadas = 0;

  const EXPO_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[^\]\r\n]{10,255}\]$/;

  const pushTokensFor = async (userId: string): Promise<string[]> => {
    const [endpoints, profiles] = await Promise.all([
      supabase.from('notification_endpoints')
        .select('endpoint')
        .eq('user_id', userId)
        .eq('provider', 'expo')
        .eq('active', true),
      supabase.from('users')
        .select('fcmToken')
        .eq('uid', userId)
        .not('fcmToken', 'is', null),
    ]);
    const tokens = new Set<string>();
    for (const row of endpoints.data ?? []) {
      if (EXPO_TOKEN_PATTERN.test(row.endpoint)) tokens.add(row.endpoint);
    }
    for (const row of profiles.data ?? []) {
      if (typeof row.fcmToken === 'string' && EXPO_TOKEN_PATTERN.test(row.fcmToken)) tokens.add(row.fcmToken);
    }
    return [...tokens];
  };

  for (const token of tokens) {
    if (!token.criadoPor) continue;

    const pushTokens = await pushTokensFor(token.criadoPor);

    if (pushTokens.length > 0) {
      const minutosRestantes = Math.round(
        (new Date(token.expiraEm).getTime() - agora.getTime()) / 60000
      );
      const tempoTexto = minutosRestantes >= 60
        ? `${Math.round(minutosRestantes / 60)}h`
        : `${minutosRestantes}min`;

      await Promise.all(pushTokens.map(async (to) => {
        await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to,
            title: '⏰ Token expirando',
            body: `Token de ${token.municipio} expira em ${tempoTexto}. Gere um novo se necessário.`,
            data: { tipo: 'token_expirando', municipio: token.municipio, codigo: token.codigo },
            sound: 'default',
            channelId: 'tokens',
            priority: 'normal',
            ttl: 7200,
          }),
        });
      }));

      enviadas += pushTokens.length;
    }

    // Marcar como notificado para não enviar de novo
    await supabase
      .from('invite_tokens')
      .update({ notificadoExpirando: true })
      .eq('codigo', token.codigo);
  }

  return new Response(JSON.stringify({ enviadas }), { status: 200 });
});
