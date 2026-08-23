# Decisão: bot WhatsApp externo para disparo em comunidades

**Data:** 2026-08-21
**Estado:** aceita pelo dono do produto (Pedro), com risco registrado
**Escopo:** substitui, para o disparo em Comunidades, a restrição "sem automação de WhatsApp" do plano `2026-08-13-producao-gradual-e-comunidades-whatsapp.md` (Task 6).

## Contexto

A Meta não oferece API oficial para publicar em Comunidades WhatsApp. O disparo assistido
(copiar + abrir WhatsApp + registrar envio) estava implementado, mas a operação pediu
disparo direto pelo sistema, com tela de QR Code para vincular a conta que envia.

## Decisão

1. **O dono do produto assume explicitamente o risco de banimento do número vinculado**
   ("não tem problema a conta cair, basta vincular outra"). O bot é um componente opcional,
   isolado e substituível — número caiu, troca-se o número e re-vincula.
2. O bot **não faz parte do core do TCS**: roda em hospedagem separada (pasta
   `bot-whatsapp/`, implantável em qualquer VPS), conversa com o Supabase apenas por uma
   fila (`canal_envios` com status `pendente`) usando chave `service_role` que existe
   somente no ambiente do bot — nunca no app, no painel ou no repositório.
3. **Os canais oficiais continuam sendo a fonte da verdade**: comunicado publicado no
   TCS (app + portal, com agendamento) vale por si; o WhatsApp é espelho. Se o bot cair
   ou o número for banido, nada do produto para — o fluxo assistido (copiar/abrir/colar)
   permanece disponível como contingência.
4. Limitação técnica assumida: o bot publica em **grupos e no grupo de anúncios da
   Comunidade** (é assim que o WhatsApp Web expõe a Comunidade). O vínculo é por
   `chat_id`, listado pelo próprio bot e vinculado à comunidade no painel.

## Atualização (2026-08-22): multi-sessão por prefeitura com fallback

Correção de desenho do dono do produto: **cada número vinculado pertence a uma organização**.

- A sessão só nasce no portal municipal (master/admin da prefeitura, RPC `portal_criar_sessao_bot`) —
  conta individual sem vínculo (ex.: Pedro) não registra número nem enxerga comunidades de outro
  município (ex.: Cataguases, cujos disparos saem pelo número do Paulo, admin da prefeitura).
- A Comunidade é criada no WhatsApp por um número da prefeitura e um **segundo número da mesma
  prefeitura também é admin** — o dispatcher tenta todos os números vinculados que enxergam o chat,
  em sequência: um caiu/baniu, o outro envia (auditoria por tentativa em `canal_envios.tentativas`).
- Números banidos são marcados no painel (`portal_definir_status_sessao_bot`) e substituídos por
  outros — operação já prevista na decisão original.

## Consequências e riscos registrados

- Banimento do número é esperado e aceito; a mitigação é trocar o número (re-escanear QR).
- Sem SLA: bibliotecas não-oficiais quebram com mudanças do WhatsApp Web; o bot é
  versionado à parte e pode ficar offline sem impactar o produto.
- Auditoria preservada: todo disparo do bot grava `origem`, `status` e `erro` em
  `canal_envios`; o envio manual continua registrado igual.
- O plano de produção gradual mantém todas as demais restrições (RLS, buckets privados,
  Supabase Pro antes do piloto etc.).
