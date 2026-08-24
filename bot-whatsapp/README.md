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

1. O editor em `/app/comunicacoes` prepara e publica o alerta; a operação do
   canal fica em `/app/whatsapp` e no módulo WhatsApp da organização.
2. O painel enfileira
   disparos em `canal_envios` com status `pendente` (botão "Disparar pelo bot").
3. Este bot retira cada item da fila de forma atômica e envia a mensagem formatada no chat vinculado a
   cada comunidade, gravando `enviado` ou `falhou` (com erro) — mesma tabela de
   auditoria do envio manual, com trilha de fallback entre números. Se o worker
   cair no meio do envio, o item vira `incerto` e nunca é repetido automaticamente.
4. O bot sincroniza os grupos que cada número enxerga (com contagem de
   admins/membros) para `bot_chats`; no painel, cada comunidade é vinculada ao
   chat correspondente. As credenciais Baileys ficam criptografadas no esquema
   privado do Supabase e sobrevivem aos reinícios do Render.

## Requisitos

- Node 22+; Baileys não precisa de Chromium.
- Variáveis de ambiente:

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `SUPABASE_URL` | sim | URL do projeto Supabase |
| `SUPABASE_SECRET_KEY` | sim | Chave secreta do backend, **somente no Render** |
| `BOT_SESSION_ENCRYPTION_KEY` | sim | Segredo com 24+ caracteres usado para AES-256-GCM; trocar exige novo pareamento |
| `DASHBOARD_ORIGIN` | não | Origem autorizada no CORS (padrão `https://tcsvisto.netlify.app`) |
| `PORT` | não | porta da tela de QR (padrão 8787) |
| `POLL_MS` | não | intervalo da fila (padrão 5000) |

## Execução

```bash
cd bot-whatsapp
npm install
SUPABASE_URL=... SUPABASE_SECRET_KEY=... BOT_SESSION_ENCRYPTION_KEY=... npm start
```

Abra `http://localhost:8787`, escaneie o QR Code (WhatsApp → Aparelhos
conectados → Conectar aparelho) e deixe rodando. A sessão criptografada fica no
Supabase; o filesystem local é descartável.

## Implantação piloto no Render

- O `render.yaml` cria um Web Service Docker gratuito e usa `/healthz`.
- Informe `SUPABASE_URL` e `SUPABASE_SECRET_KEY` no painel do Render; a chave de
  criptografia é gerada no primeiro Blueprint.
- No plano gratuito, um monitor HTTP pode consultar `/healthz`; períodos de
  suspensão ainda podem ocorrer conforme as regras do provedor.
- Para o monitor gratuito, crie no UptimeRobot um monitor do tipo **HTTP(s)**,
  use `https://SEU-SERVICO.onrender.com/healthz` e intervalo de **5 minutos**.
  O endpoint não recebe dados pessoais e responde apenas o estado do processo.
- Número banido: marque no painel e conecte outro. O estado antigo é removido
  automaticamente quando o WhatsApp encerra a sessão.

## Avisos

- Uso não oficial: viola os termos da Meta e o número **pode ser banido**.
  Decisão de risco do dono do produto, registrada em `docs/decisions/`.
- Sem SLA: se o WhatsApp Web mudar, o bot para até atualização da biblioteca.
- Mantenha a chave secreta e a chave de criptografia apenas no Render.
