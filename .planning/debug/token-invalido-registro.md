---
status: diagnosed
trigger: "Da erro 'Token inválido ou já utilizado.' mesmo acabando de criar o token agora"
created: 2026-04-02T00:00:00Z
updated: 2026-04-02T00:10:00Z
---

## Current Focus

hypothesis: A função SQL `validate_invite_token` nunca foi criada no Supabase. O RPC retorna um erro (função inexistente), e o código em register.tsx trata qualquer `validationError` truthy como "Token inválido ou já utilizado."
test: Confirmar que o 06-02-SUMMARY.md explicita que o SQL do RPC ainda estava pendente de aplicação manual humana (checkpoint não concluído).
expecting: Evidência direta de que o SQL foi entregue mas não aplicado.
next_action: DIAGNOSED — root cause confirmado por evidência documental

## Symptoms

expected: Gerar um token de convite e imediatamente registrar com ele. O registro deve ser aceito sem rejeição por fuso horário. A função validate_invite_token RPC no Supabase deve validar o token server-side.
actual: Da erro 'Token inválido ou já utilizado.' mesmo acabando de criar o token agora.
errors: "Token inválido ou já utilizado."
reproduction: Test 4 in UAT — gerar token de convite no painel admin, imediatamente tentar registrar com ele no fluxo de registro
started: Descoberto durante UAT da fase 06

## Eliminated

- hypothesis: Bug no código que marca o token como "usado" antes do registro ser completado
  evidence: O passo 4 de handleRegister (marcar token como usado) só executa DEPOIS da criação de conta (passo 2) e do insert em users (passo 3). A falha ocorre no passo 1 (validação), antes de qualquer escrita. Impossível o token ser marcado como usado antes da validação.
  timestamp: 2026-04-02T00:08:00Z

- hypothesis: Lógica no register.tsx trata token expirado como inválido por conta de comparação de data client-side
  evidence: O plano 06-02 foi executado com sucesso (commits a86c226 e 8709a40). O código atual em register.tsx já usa supabase.rpc('validate_invite_token') — a comparação client-side foi removida. O problema não é mais fuso horário.
  timestamp: 2026-04-02T00:08:30Z

## Evidence

- timestamp: 2026-04-02T00:06:00Z
  checked: app/(auth)/register.tsx linha 71-76
  found: O código chama supabase.rpc('validate_invite_token', { p_codigo: codigoNorm }).single(). Na linha 75: `if (validationError || !tokenValidation) throw new Error('Token inválido ou já utilizado.');`
  implication: Qualquer erro retornado pelo RPC — incluindo erro PostgreSQL "function does not exist" — dispara exatamente a mensagem que o usuário está vendo.

- timestamp: 2026-04-02T00:07:00Z
  checked: .planning/phases/06-mapa-autentica-o/06-02-SUMMARY.md — seção "Checkpoint Pendente"
  found: "Task 3 (checkpoint:human-verify) — aguardando ação humana: 1. Aplicar SQL da função validate_invite_token no Supabase Dashboard (SQL Editor)"
  implication: O plano 06-02 foi executado apenas parcialmente. O código do app foi atualizado (tasks 1 e 2), mas o SQL da função no Supabase nunca foi aplicado. O checkpoint humano (task 3) ficou pendente.

- timestamp: 2026-04-02T00:07:30Z
  checked: .planning/phases/06-mapa-autentica-o/06-02-SUMMARY.md — campo tasks_completed vs tasks_total
  found: tasks_completed: 2, tasks_total: 3
  implication: Confirmação quantitativa: apenas 2 de 3 tasks foram concluídas. A task 3 (aplicar SQL no Supabase) não foi executada.

- timestamp: 2026-04-02T00:08:00Z
  checked: .planning/phases/06-mapa-autentica-o/06-02-PLAN.md — Task 3, seção how-to-verify
  found: SQL da função validate_invite_token está documentado e pronto para aplicação. Inclui também nota sobre possível necessidade de converter coluna expiraEm de TIMESTAMP para TIMESTAMPTZ.
  implication: O SQL correto existe e está disponível — só não foi executado no Supabase.

- timestamp: 2026-04-02T00:09:00Z
  checked: SQL da função no 06-02-PLAN.md — cláusula WHERE
  found: `WHERE t.codigo = p_codigo AND t.usado = false` — a função busca token onde usado=false. Se o token foi criado e não foi usado, deveria retornar. Porém, se a função não existe, o RPC retorna um erro de "function does not exist" com validationError truthy.
  implication: Mesmo que o token seja válido, se a função não existe no Supabase, o erro de RPC é capturado pela linha 75 como "Token inválido ou já utilizado." — mascarando o erro real.

## Resolution

root_cause: A função PostgreSQL `validate_invite_token` não foi criada no Supabase. O plano 06-02 atualizou o código do app (register.tsx agora chama o RPC) mas a Task 3 — aplicar o SQL no Supabase Dashboard — era um checkpoint humano que ficou pendente sem ser executado. Quando o app chama supabase.rpc('validate_invite_token'), o Supabase retorna erro "function does not exist", que o código trata como validationError truthy, disparando o throw na linha 75 com a mensagem "Token inválido ou já utilizado." — independente do token ser válido.
fix: Aplicar o SQL da função validate_invite_token no Supabase SQL Editor. O SQL completo está em .planning/phases/06-mapa-autentica-o/06-02-PLAN.md na Task 3. Opcionalmente também converter a coluna expiraEm para TIMESTAMPTZ.
verification: []
files_changed: []
