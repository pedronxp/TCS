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

function normalizarCanal(dados) {
  if (!dados || typeof dados !== 'object' || !dados.id || !dados.thread_metadata?.name?.text) return null;
  return {
    id: dados.id,
    name: dados.thread_metadata.name.text,
    description: dados.thread_metadata.description?.text || '',
    creation_time: dados.thread_metadata.creation_time,
    invite: dados.thread_metadata.invite,
    subscribers: Number(dados.thread_metadata.subscribers_count || 0),
  };
}

function encontrarCanalNosDados(dados, vistos = new Set()) {
  if (!dados || typeof dados !== 'object' || Buffer.isBuffer(dados) || vistos.has(dados)) return null;
  vistos.add(dados);

  const direto = normalizarCanal(dados);
  if (direto) return direto;

  for (const [chave, valor] of Object.entries(dados)) {
    if (!valor || typeof valor !== 'object') continue;
    // O WhatsApp muda o envelope MEX ocasionalmente. Procuramos o payload do
    // Canal dentro dele, sem assumir que sempre será filho direto de `data`.
    if (chave.includes('newsletter')) {
      const canal = normalizarCanal(valor) || encontrarCanalNosDados(valor, vistos);
      if (canal) return canal;
    }
    const canal = encontrarCanalNosDados(valor, vistos);
    if (canal) return canal;
  }
  return null;
}

function normalizarRespostaCriacaoCanal(resposta) {
  return encontrarCanalNosDados(resposta);
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
    return encontrarCanalNosDados(dados);
  } catch {
    return null;
  }
}

module.exports = { selecionarCanalRecemCriado, lerCanalDeNotificacaoMex, normalizarRespostaCriacaoCanal };
