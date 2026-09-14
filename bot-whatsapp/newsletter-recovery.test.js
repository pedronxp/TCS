const test = require('node:test');
const assert = require('node:assert/strict');
const { selecionarCanalRecemCriado, lerCanalDeNotificacaoMex } = require('./newsletter-recovery');

test('recupera o canal recém-criado por nome e data', () => {
  const startedAt = Date.now();
  const canal = selecionarCanalRecemCriado([
    { id: '120@newsletter', name: 'Comunicados', creation_time: Math.floor((startedAt - 1_000) / 1000) },
    { id: '121@newsletter', name: 'Outro', creation_time: Math.floor(startedAt / 1000) },
  ], ' comunicados ', startedAt);
  assert.equal(canal.id, '120@newsletter');
});

test('não recupera canal antigo com o mesmo nome', () => {
  const startedAt = Date.now();
  const canal = selecionarCanalRecemCriado([
    { id: '120@newsletter', name: 'Comunicados', creation_time: Math.floor((startedAt - 600_000) / 1000) },
  ], 'Comunicados', startedAt);
  assert.equal(canal, null);
});

test('lê a confirmação MEX que o WhatsApp envia ao criar um canal', () => {
  const node = { attrs: { type: 'mex' }, content: [{ tag: 'update', content: Buffer.from(JSON.stringify({ data: { xwa2_notify_new_newsletter_on_join: { id: '120363429887483519@newsletter', thread_metadata: { name: { text: 'TESTE' }, description: { text: 'Descrição' }, creation_time: '1789401528', invite: 'abc', subscribers_count: '0' } } } })) }] };
  assert.deepEqual(lerCanalDeNotificacaoMex(node), {
    id: '120363429887483519@newsletter', name: 'TESTE', description: 'Descrição', creation_time: '1789401528', invite: 'abc', subscribers: 0,
  });
});
