---
phase: 9
reviewers: [gemini]
reviewed_at: 2026-04-03T00:00:00Z
plans_reviewed:
  - 09-01-PLAN.md
  - 09-02-PLAN.md
---

# Cross-AI Plan Review — Phase 09: UX + Correções Finais

## Gemini Review

Esta revisão analisa os planos **09-01-PLAN.md** e **09-02-PLAN.md** destinados a garantir que a interface do usuário seja totalmente em português e que o sistema de logs seja funcional para administradores.

### 1. Summary
Os planos abordam correções críticas de "polimento" final. O Plano 09-01 resolve a pendência de internacionalização de erros de forma centralizada, enquanto o Plano 09-02 corrige uma falha arquitetural onde a interface tentava ler dados de uma tabela inexistente no Supabase. No entanto, existe uma ambiguidade significativa no Plano 09-02 sobre se o administrador deve ver apenas logs locais ou logs globais de auditoria, o que pode impactar a utilidade da ferramenta para o "Master Admin".

### 2. Strengths
- **Centralização da Lógica (09-01):** A criação de `utils/authErrors.ts` evita a repetição de `switch/case` ou `if/else` em múltiplas telas de autenticação, facilitando manutenções futuras.
- **Correção de Root Cause (09-02):** O plano identifica corretamente que a tabela `system_logs` não existe, impedindo que o erro de "lista vazia" persista silenciosamente.
- **Abordagem Cirúrgica:** As alterações são focadas nos pontos de vazamento de strings em inglês (como o placeholder "John Doe"), demonstrando atenção aos detalhes do "Success Criteria".

### 3. Concerns

**Plano 09-01 (Tradução de Erros)**
- **[LOW] Fallback para Inglês:** O plano menciona que, se não houver match, a função retorna a string original. Isso pode violar o critério "nenhuma mensagem em inglês visível na UI" caso apareça um erro do Supabase ainda não mapeado.
- **[MEDIUM] Fragilidade do `includes`:** Erros do Supabase podem mudar levemente entre versões do SDK. Se o match for estrito demais ou vago demais, pode haver traduções incorretas ou falhas na captura.

**Plano 09-02 (Visualização de Logs)**
- **[HIGH] Escopo do Log — apenas dispositivo local:** O plano muda a fonte de dados para o SQLite local (`logger.ts`). Isso significa que um Master Admin **só verá os logs do próprio celular dele**. Em um app de Defesa Civil, o Admin geralmente espera ver a atividade de todos os agentes. O `auditLogger.ts` (Supabase `audit_logs`) seria a fonte global correta.
- **[MEDIUM] Perda de Contexto de Usuário:** Ao mapear para o SQLite, o plano remove `municipio`, `nomeUsuario` e `uid`. Sem isso, o log perde a maior parte de sua utilidade para um Master Admin que precisa auditar quem fez o quê.
- **[LOW] Performance do SQLite:** Se o banco local crescer muito, carregar todos os logs de uma vez sem paginação na UI pode causar travamentos no render da lista.

### 4. Suggestions
- **Refinamento do Fallback (09-01):** Em `traduzirErroAuth`, adicione um fallback genérico como: *"Ocorreu um erro inesperado. Tente novamente mais tarde."* caso a mensagem original não seja reconhecida — garante que inglês nunca chegue ao usuário.
- **Tratar erro de rede (09-01):** Adicionar ao `authErrors.ts` tradução para "Network request failed" → *"Sem conexão com a internet. Tente novamente."*
- **Integração Híbrida de Logs (09-02):** O Master Admin deveria ter acesso à tabela `audit_logs` no Supabase (ações de todos os usuários). Se o objetivo for apenas um log, priorizar `audit_logs` sobre o SQLite local.
- **Preservação de autoria (09-02):** Se optar por manter o SQLite, garantir que o schema local contenha `user_id` ou `email` para rastreabilidade.

### 5. Risk Assessment
**Nível de Risco: MEDIUM**

O risco é médio principalmente pela **decisão funcional no Plano 09-02** — mudar para logs estritamente locais pode não atender à expectativa de negócio de um Master Admin. A dependência de strings exatas para tradução (09-01) também exige testes em múltiplos cenários de erro para garantir 100% de cobertura.

---

## Consensus Summary

Apenas um revisor externo disponível (Gemini) — sem múltipla revisão para consensus.

### Strengths Validados
- Centralização de tradução em `authErrors.ts` é a abordagem correta
- Root cause do bug `system_logs` foi corretamente identificado e atacado
- Mudanças cirúrgicas — sem escopo desnecessário

### Concerns Prioritários
1. **[HIGH] UX-02 — logs locais vs. globais**: Master Admin precisa ver atividade de todos os agentes, não só do dispositivo local. A tabela `audit_logs` (Supabase) é a fonte correta para auditoria global.
2. **[MEDIUM] UX-01 — fallback inglês**: Erros Supabase desconhecidos ainda chegam em inglês. Adicionar fallback genérico em pt-br.
3. **[MEDIUM] UX-01 — erro de rede**: "Network request failed" não está mapeado → adicionar.

### Ações Recomendadas
- Adicionar fallback genérico pt-br e mapeamento de erro de rede em `authErrors.ts`
- Investigar se `audit_logs` é a fonte correta para `master/logs.tsx` (requer verificação de RLS no Supabase Dashboard)
