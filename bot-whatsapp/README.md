# TCS — Bot WhatsApp (externo, opcional)

Componente isolado que dispara comunicados do TCS em grupos e em grupos de
anúncios de Comunidades do WhatsApp, com **QR Code** para vincular cada número
por prefeitura. Núcleo em **Baileys** (protocolo direto do WhatsApp, sem
navegador) — migramos do whatsapp-web.js, que quebrou com a atualização do
WhatsApp Web (falha de injeção `Store`). **Decisão e riscos registrados em
`docs/decisions/bot-whatsapp-externo.md`** (banimento aceito pelo dono:
número caiu → marque banido no painel → vincule outro).

O TCS **não depende** deste bot: o comunicado oficial continua publicado no
app/portal, e o disparo assistido (copiar/abrir/colar) segue disponível no
painel como contingência.

## Como funciona

1. O painel (console `/app/comunicacoes` ou portal municipal) enfileira
   disparos em `canal_envios` com status `pendente` (botão "Disparar pelo bot").
2. Este bot consome a fila e envia a mensagem formatada no chat vinculado a
   cada comunidade, gravando `enviado` ou `falhou` (com erro) — mesma tabela de
   auditoria do envio manual, com trilha de fallback entre números.
3. O bot sincroniza os grupos que cada número enxerga (com contagem de
   admins/membros) para `bot_chats`; no painel, cada comunidade é vinculada ao
   chat correspondente. Sessões ficam em `./sessao-wa/<id>` (não versione).

## Requisitos

- Node 20+ (o `whatsapp-web.js` baixa um Chromium na instalação).
- Variáveis de ambiente:

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `SUPABASE_URL` | sim | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | **somente aqui** — nunca no app/painel/repo |
| `PORT` | não | porta da tela de QR (padrão 8787) |
| `POLL_MS` | não | intervalo da fila (padrão 5000) |

## Execução

```bash
cd bot-whatsapp
npm install
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm start
```

Abra `http://localhost:8787`, escaneie o QR Code (WhatsApp → Aparelhos
conectados → Conectar aparelho) e deixe rodando. A sessão fica em `./sessao`
(não versione esta pasta).

## Implantação sugerida (outra hospedagem, como decidido)

- VPS pequena (1 vCPU/1 GB dá conta), Docker ou systemd; porta exposta apenas
  para você (firewall/VPN) — a tela de QR é acesso administrativo.
- Reinício automático (`Restart=always`); o bot retoma a sessão salva.
- Número banido: pare o bot, apague `./sessao`, inicie e escaneie com o novo
  número; os vínculos de chat em `canais_externos.chat_id` continuam válidos
  se a nova conta for administradora das mesmas comunidades.

## Avisos

- Uso não oficial: viola os termos da Meta e o número **pode ser banido**.
  Decisão de risco do dono do produto, registrada em `docs/decisions/`.
- Sem SLA: se o WhatsApp Web mudar, o bot para até atualização da biblioteca.
- Mantenha `service_role` apenas neste ambiente e proteja a pasta `./sessao`
  (quem a tiver, controla a conta).
