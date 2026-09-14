function normalizarNomeCanal(valor) {
  return String(valor || '').trim().normalize('NFKC').toLocaleLowerCase('pt-BR');
}

function paraMs(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;
  return numero < 10_000_000_000 ? numero * 1000 : numero;
}

function selecionarCanalRecemCriado(canais, nome, iniciadoEm, janelaMs = 5 * 60 * 1000) {
  const esperado = normalizarNomeCanal(nome);
  if (!esperado || !Array.isArray(canais)) return null;

  return canais
    .filter((canal) => canal && normalizarNomeCanal(canal.name || canal.nome) === esperado)
    .filter((canal) => {
      const criadoEm = paraMs(canal.creation_time || canal.creationTime || canal.created_at);
      return criadoEm === null || (criadoEm >= iniciadoEm - janelaMs && criadoEm <= Date.now() + 60_000);
    })
    .sort((a, b) => paraMs(b.creation_time || b.creationTime || b.created_at || 0) - paraMs(a.creation_time || a.creationTime || a.created_at || 0))[0] || null;
}

function itensDeConteudo(node) {
  if (Array.isArray(node?.content)) return node.content;
  return node?.content ? [node.content] : [];
}

function lerCanalDeNotificacaoMex(node) {
  if (node?.attrs?.type !== 'mex') return null;
  const update = itensDeConteudo(node).find((item) => item?.tag === 'update');
  if (!update?.content) return null;
  try {
    const conteudo = Buffer.isBuffer(update.content)
      ? update.content.toString('utf8')
      : Buffer.from(update.content).toString('utf8');
    const dados = JSON.parse(conteudo);
    const canal = dados?.data?.xwa2_notify_new_newsletter_on_join;
    return canal?.id && canal?.thread_metadata?.name?.text ? {
      id: canal.id,
      name: canal.thread_metadata.name.text,
      description: canal.thread_metadata.description?.text || '',
      creation_time: canal.thread_metadata.creation_time,
      invite: canal.thread_metadata.invite,
      subscribers: Number(canal.thread_metadata.subscribers_count || 0),
    } : null;
  } catch {
    return null;
  }
}

module.exports = { selecionarCanalRecemCriado, lerCanalDeNotificacaoMex };
