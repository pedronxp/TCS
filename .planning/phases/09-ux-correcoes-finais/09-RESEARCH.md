# Phase 09: UX + Correções Finais — Research

**Pesquisado em:** 2026-04-03
**Domínio:** React Native / Expo — internacionalização de mensagens de erro + debug de tela de logs administrativos
**Confiança geral:** HIGH (todos os achados baseados em leitura direta do código-fonte)

---

## Resumo Executivo

Esta fase cobre dois problemas distintos e independentes:

**UX-01 — Mensagens em pt-br:** A esmagadora maioria das mensagens visíveis ao usuário já está em português. Existe um conjunto pequeno e bem delimitado de problemas reais: (a) `e.message` de erros do Supabase Auth é exibido cru — o Supabase retorna mensagens em inglês como "Invalid login credentials", "Email not confirmed", "User already registered"; (b) um placeholder "John Doe" no campo de nome na tela de registro; (c) o título "System Logs" na tela `master/logs.tsx`; e (d) a string `tokenValidation.motivo` no fluxo de registro vem de uma RPC do Supabase que pode retornar texto em qualquer idioma.

**UX-02 — Logs do admin:** Há **dois sistemas de logs completamente diferentes** que estão sendo confundidos:
1. `audit_logs` (Supabase PostgreSQL) — onde `registrarAuditoria()` persiste ações admin. A tela `app/(panel)/admin/logs.tsx` lê desta tabela. Parece funcionalmente correto, mas pode estar vazia se nenhuma ação admin ocorreu, e há um filtro por `municipio` que pode esconder registros.
2. `system_logs` (Supabase PostgreSQL) — tabela que a tela `app/(panel)/master/logs.tsx` tenta ler. **Esta tabela provavelmente não existe no Supabase.** O sistema de logs do app (`utils/logger.ts`) grava exclusivamente no SQLite local (tabela `logs`). Não há mecanismo de sync desses logs locais para o Supabase. A query `supabase.from('system_logs')` vai retornar sempre vazia (ou errar silenciosamente), porque a tabela `system_logs` nunca foi criada no banco.

**Recomendação principal:** Dois planos separados — um para as mensagens de erro (UX-01) e um para o bug dos logs (UX-02, que é o mais crítico por envolver decisão arquitetural).

---

## UX-01: Mensagens de Erro em Português

### Achados: Strings Inglesas Encontradas

| Arquivo | Linha | Problema | Exposição ao usuário |
|---------|-------|----------|---------------------|
| `app/(auth)/register.tsx` | 230 | `placeholder="John Doe"` no campo Nome | Sim — placeholder visível |
| `app/(auth)/login.tsx` | 57 | `setError(e.message \|\| 'Erro ao realizar login.')` | Sim — e.message do Supabase em inglês |
| `app/(auth)/register.tsx` | 158 | `setError(e.message \|\| 'Erro ao registrar.')` | Sim — e.message do Supabase em inglês |
| `app/(auth)/register.tsx` | 76 | `throw new Error(tokenValidation.motivo)` | Sim — motivo vem de RPC não verificada |
| `app/(panel)/admin/usuarios.tsx` | 159 | `Alert.alert('Erro', e.message \|\| '...')` | Sim — e.message pode ser inglês |
| `app/(panel)/admin/editor-perguntas.tsx` | 187 | `Alert.alert('Erro', e.message \|\| '...')` | Sim |
| `app/(panel)/admin/form-editor.tsx` | 89, 159 | `Alert.alert('Erro', e.message \|\| '...')` | Sim |
| `app/(panel)/inspecoes/wizard.tsx` | 202 | `` Alert.alert('Erro', `...perguntas: ${e.message}`) `` | Sim — concatenação expõe e.message |
| `app/(panel)/inspecoes/wizard.tsx` | 442 | `Alert.alert('Erro ao salvar', e.message \|\| '...')` | Sim |
| `app/(panel)/master/logs.tsx` | 168 | `<Text>System Logs</Text>` — UI label em inglês | Sim |
| `context/ThemeContext.tsx` | 55, 65 | `logger.warn('Failed to load/save...')` | Não — vai só para console/SQLite |
| `context/AuthContext.tsx` | 67 | `console.warn('Auth session error:', ...)` | Não — só console |
| `app/_layout.tsx` | 16 | `LogBox.ignoreLogs(['Unable to activate keep awake'])` | Não — só suprime log interno |

### Mensagens do Supabase Auth que aparecem em inglês

Quando `supabase.auth.signInWithPassword()` falha, o Supabase retorna `AuthApiError` com `.message` em inglês. Exemplos conhecidos:

| Supabase error.message (inglês) | Tradução adequada pt-br |
|----------------------------------|------------------------|
| `Invalid login credentials` | `E-mail ou senha inválidos.` |
| `Email not confirmed` | `E-mail ainda não confirmado. Verifique sua caixa de entrada.` |
| `User already registered` | `Este e-mail já está cadastrado. Tente fazer login.` |
| `Password should be at least 6 characters` | `A senha deve ter no mínimo 6 caracteres.` |
| `signup_disabled` | `Novos cadastros estão temporariamente desativados.` |
| `over_email_send_rate_limit` | `Muitas tentativas. Aguarde alguns minutos.` |
| `Invalid email` | `Endereço de e-mail inválido.` |
| `Token has expired or is invalid` | Não se aplica ao fluxo atual |

### Padrão de exibição de erros no projeto

O projeto usa **dois mecanismos**:
1. **Inline error state** — `setError(string)` renderizado como `<Text style={{ color: '#EF4444' }}>{error}</Text>` dentro de um card vermelho. Usado nas telas de auth (`login.tsx`, `register.tsx`).
2. **Alert.alert nativo** — `Alert.alert('Título', 'Mensagem')` para feedback em telas do panel.

Não há nenhum Toast customizado nem sistema de i18n. Todas as correções são substituições diretas de string.

### Utilitário de tradução de erros de auth

Não existe nenhum mapa de tradução de erros no projeto. A abordagem recomendada é criar uma função de utilidade simples em `utils/authErrors.ts`:

```typescript
// utils/authErrors.ts
export function traduzirErroAuth(message: string): string {
  if (message.includes('Invalid login credentials')) return 'E-mail ou senha inválidos.';
  if (message.includes('Email not confirmed')) return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
  if (message.includes('User already registered')) return 'Este e-mail já está cadastrado. Tente fazer login.';
  if (message.includes('Password should be at least')) return 'A senha deve ter no mínimo 6 caracteres.';
  if (message.includes('signup_disabled')) return 'Novos cadastros estão temporariamente desativados.';
  if (message.includes('over_email_send_rate_limit') || message.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (message.includes('Invalid email')) return 'Endereço de e-mail inválido.';
  return message; // fallback — melhor que silêncio
}
```

Uso em `login.tsx` e `register.tsx`: `setError(traduzirErroAuth(e.message) || 'Erro ao realizar login.')`.

Para os `Alert.alert` com `e.message` no panel (admin, wizard), o `e.message` vem de erros do Supabase PostgREST ou erros de RPC — esses já costumam ser mais técnicos. A abordagem correta é NÃO mostrar `e.message` diretamente, usando apenas o fallback já existente em português (que já está presente como segundo argumento do `||`). A correção é remover a passagem de `e.message` como primeiro operando quando ele seria exibido ao usuário.

---

## UX-02: Admin Logs — Análise e Bug

### Arquitetura atual dos sistemas de log

```
Sistema A: utils/logger.ts
  └─ Grava em: SQLite local (tabela 'logs')
  └─ Schema: id, level, category, message, data, criado_em
  └─ Colunas: level (inglês: 'info'/'warn'/'error'), category, message
  └─ Lido por: ninguém na UI atualmente (sem tela que usa getLogs())

Sistema B: utils/auditLogger.ts
  └─ Grava em: Supabase PostgreSQL (tabela 'audit_logs')
  └─ Schema: acao, ator_uid, ator_nome, ator_role, alvo_id, alvo_tipo, detalhes, criado_em
  └─ Lido por: app/(panel)/admin/logs.tsx

Sistema C (inexistente)
  └─ app/(panel)/master/logs.tsx tenta ler: Supabase PostgreSQL tabela 'system_logs'
  └─ Esta tabela NÃO existe no código local (sem migration, sem referência de criação)
  └─ utils/logger.ts grava em SQLite, nunca em Supabase
  └─ RESULTADO: a query sempre retorna array vazio ou erro silenciado
```

### Bug crítico em `app/(panel)/master/logs.tsx`

**O problema central:** A tela `master/logs.tsx` faz `supabase.from('system_logs').select('*').order('criadoEm', { ascending: false })`. A tabela `system_logs` não existe no Supabase. O catch da função `carregar()` silencia o erro com `setLogs([])`. O resultado é uma lista sempre vazia.

**Evidências:**
- `utils/database.ts` cria `CREATE TABLE IF NOT EXISTS logs (...)` no SQLite local — nunca no Supabase
- `utils/logger.ts` usa `getDb().runSync('INSERT INTO logs ...')` — SQLite, não Supabase
- Não há migration SQL para `system_logs`
- `app/(panel)/master/logs.tsx` linha 51: `catch (e) { logger.error(...); setLogs([]); }` — erro silenciado

**Comportamento do admin/logs.tsx:** Esta tela lê `audit_logs` no Supabase e está arquiteturalmente correta. Os possíveis problemas:
1. Filtro `query.eq('detalhes->>municipio', profile.municipio)` em linha 61 — usa operador JSON path. Se `profile.municipio` é null/undefined (ex: admin sem municipio definido), o filtro pode excluir todos os registros.
2. A tabela `audit_logs` pode estar vazia se as ações admin (aprovação de usuários, geração de tokens) não estão registrando auditoria corretamente.
3. RLS policies no Supabase podem bloquear o SELECT para admins — não verificável sem acesso ao dashboard.

### Mismatch de nomes de colunas em `master/logs.tsx`

A tela renderiza `log.criadoEm` mas o schema SQLite usa `criado_em`. No Supabase, se a tabela existisse, o nome da coluna seria o definido na criação. A tela tenta `criadoEm` (camelCase), o que sugere a tabela foi concebida com convenção camelCase no Supabase (consistente com outras tabelas do projeto como `users` que têm `isApproved`, `createdAt`).

### Campo "System Logs" em inglês

`master/logs.tsx` linha 168: `<Text>System Logs</Text>` — deve ser "Logs do Sistema".

### Decisão arquitetural necessária para UX-02

Há duas opções para corrigir o master/logs.tsx:

**Opção A — Redirecionar para SQLite local (leitura via getLogs()):**
- Usar a função `getLogs()` de `utils/logger.ts` que lê o SQLite local
- Vantagem: dados reais já existem, sem infra nova
- Desvantagem: master_admin vê apenas logs do dispositivo local, não de outros agentes

**Opção B — Criar tabela `system_logs` no Supabase e sincronizar:**
- Criar migration SQL para `system_logs`
- Adicionar sync de logs para o Supabase no logger (ou no SyncService)
- Vantagem: visão centralizada de todos os dispositivos
- Desvantagem: escopo muito maior (nova tabela, novo RLS, novo sync)

**Recomendação:** Para esta fase de correções, Opção A é correta — substitui a query Supabase por leitura do SQLite local via `getLogs()`. Isso corrige o bug imediatamente sem escopo adicional. A Opção B pode ser uma fase futura.

---

## Não Construir do Zero

| Problema | Não construir | Usar |
|----------|--------------|------|
| Tradução de erros de auth | Sistema i18n completo | Mapa de strings simples em `utils/authErrors.ts` |
| Exibição de erros inline | Componente novo | Padrão já existente no projeto (View + Feather + Text vermelho) |
| Leitura de logs locais | Nova query | `getLogs()` já existe em `utils/logger.ts` |

---

## Armadilhas Comuns

### Armadilha 1: Remover `e.message` e esconder erros úteis
**O que dá errado:** Substituir `e.message` por string fixa pode ocultar erros novos e dificultar debug.
**Como evitar:** Para telas de auth, usar `traduzirErroAuth(e.message)` com fallback. Para telas admin (Alert.alert), o fallback já está em pt-br — basta não concatenar `e.message` na string visível ao usuário. Manter `e.message` no log interno (`logger.error`).

### Armadilha 2: Filtro de municipio no admin/logs.tsx excluindo tudo
**O que dá errado:** Linha 60-62: `if (profile?.municipio) { query = query.eq('detalhes->>municipio', profile.municipio) }`. Se `profile.municipio` é uma string vazia `""` isso avalia como falsy e não aplica o filtro. Mas se for `null` ou `undefined` também é falsy. Em casos edge onde o admin tem municipio definido mas os logs foram inseridos com `detalhes.municipio` diferente, lista fica vazia.
**Como detectar:** Verificar se há registros na `audit_logs` removendo o filtro temporariamente.

### Armadilha 3: `criadoEm` vs `criado_em` — convenção mista de nomes
**O que dá errado:** O projeto usa camelCase em algumas tabelas Supabase (`isApproved`, `createdAt`) e snake_case em outras (`criado_em` no `audit_logs`). A tela `master/logs.tsx` usa `log.criadoEm` mas `audit_logs` usa `criado_em`.
**Como evitar:** A tela usa `log.criadoEm` consistentemente — se conectar ao `audit_logs`, as colunas não vão bater. Ao usar `getLogs()` do SQLite, o schema tem `criado_em` (snake_case). Ajustar os acessos de propriedade na tela.

### Armadilha 4: `motivo` da RPC `validate_invite_token` pode estar em inglês
**O que dá errado:** `tokenValidation.motivo` é exibido diretamente como `throw new Error(tokenValidation.motivo)` que vira `setError(e.message)`. Se a RPC foi escrita com motivos em inglês, aparece em inglês na UI.
**Como evitar:** A RPC `validate_invite_token` não está no código local — foi criada diretamente no Supabase. É necessário verificar no dashboard o texto dos `motivo` retornados, ou adicionar um mapa de tradução também para esses motivos. Como não há acesso ao dashboard neste contexto, incluir um fallback seguro.

---

## Exemplos de Código (padrões verificados)

### Padrão atual de exibição inline de erro (login.tsx, linha 125-140)
```tsx
// Padrão existente — reutilizar sem alteração estrutural
{error !== null && (
  <View style={{ flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)', borderRadius: 12,
    padding: 12, gap: 8, marginBottom: 12 }}>
    <Feather name="alert-circle" size={16} color="#EF4444" />
    <Text style={{ color: '#EF4444', fontSize: 14, flex: 1 }}>{error}</Text>
  </View>
)}
```

### Leitura de logs do SQLite (utils/logger.ts, linha 100-130)
```typescript
// getLogs() já existe — retorna LogEntry[]
// Schema: { id, level, category, message, data, criado_em }
import { getLogs } from '../../../utils/logger';
const entries = getLogs({ limit: 500 });
// Adaptar render: level ('info'/'warn'/'error'), message (não 'descricao'), criado_em (não 'criadoEm')
```

---

## Validação

### Framework de Testes
O projeto não possui testes automatizados de UI detectados. Validação desta fase é manual.

| Req ID | Comportamento | Tipo | Comando | Existe? |
|--------|--------------|------|---------|---------|
| UX-01 | Login com credenciais erradas exibe mensagem pt-br | Manual | Testar no device/emulador | N/A |
| UX-01 | Registro com token inválido exibe mensagem pt-br | Manual | Testar no device/emulador | N/A |
| UX-01 | Campo nome sem "John Doe" como placeholder | Visual | Abrir tela de registro | N/A |
| UX-02 | Tela master/logs exibe registros (não lista vazia) | Manual | Login como master_admin | N/A |
| UX-02 | Tela admin/logs exibe registros de auditoria | Manual | Login como admin e realizar ação auditável | N/A |

---

## Estrutura de Planos Recomendada

### Plano 1 — UX-01: Mensagens de erro em pt-br
**Escopo:** Tradução de erros de auth + placeholder + label inglês
**Arquivos afetados:**
- Criar: `utils/authErrors.ts` (mapa de tradução de erros Supabase)
- Editar: `app/(auth)/login.tsx` — usar `traduzirErroAuth(e.message)`
- Editar: `app/(auth)/register.tsx` — usar `traduzirErroAuth(e.message)` + fix placeholder "John Doe"
- Editar: `app/(panel)/master/logs.tsx` — fix "System Logs" → "Logs do Sistema"
- Editar: `app/(panel)/admin/usuarios.tsx`, `editor-perguntas.tsx`, `form-editor.tsx`, `inspecoes/wizard.tsx` — remover `e.message` da parte visível ao usuário em Alert.alert (manter fallback pt-br já existente)

**Risco:** BAIXO — são substituições de string isoladas

### Plano 2 — UX-02: Correção de master/logs.tsx
**Escopo:** Substituir query Supabase `system_logs` por leitura do SQLite local
**Arquivos afetados:**
- Editar: `app/(panel)/master/logs.tsx`:
  - Remover import de supabase
  - Importar `getLogs, LogEntry` de `utils/logger`
  - Substituir função `carregar()` — trocar query Supabase por `getLogs({ limit: 500 })`
  - Adaptar render: `log.level` (não `log.nivel`), `log.message` (não `log.descricao`/`log.mensagem`), `log.criado_em` (não `log.criadoEm`)
  - Remover filtros por município (logs locais não têm município)
  - Remover botão de export CSV se dados locais não têm os mesmos campos (ou adaptar o mapeamento)
  - Fix "System Logs" → "Logs do Sistema"

**Risco:** MÉDIO — mudança de fonte de dados requer validar o render de todos os campos

### Plano 3 (opcional) — UX-02: Investigar admin/logs.tsx
**Escopo:** Verificar se `audit_logs` tem dados e se filtro de município funciona
**Decisão:** Só incluir se a tela admin/logs ainda mostrar lista vazia após os planos acima. Pode ser problema de RLS ou dados ausentes, não de código.

---

## Questões em Aberto

1. **RPC `validate_invite_token` — idioma do campo `motivo`**
   - O que sabemos: A RPC existe no Supabase (não no código local). Ela retorna `{ valido: boolean, motivo: string }`.
   - O que não sabemos: Se os valores de `motivo` estão em pt-br ou inglês.
   - Recomendação: Verificar no Supabase Dashboard a definição da função antes de codificar. Se não for possível, adicionar tradução defensiva dos motivos mais prováveis.

2. **RLS em `audit_logs` no Supabase**
   - O que sabemos: A tabela é consultada por `admin` e `master_admin`, mas as políticas RLS não estão no código local (só há uma migration que não cria `audit_logs`).
   - O que não sabemos: Se a policy de SELECT está correta para admins.
   - Recomendação: Se admin/logs.tsx continua vazia após correções, verificar RLS no dashboard.

3. **`system_logs` — existe no Supabase?**
   - O que sabemos: Não há migration local que cria essa tabela.
   - O que não sabemos: Se ela foi criada manualmente no dashboard.
   - Recomendação: Independentemente, a solução correta é usar SQLite local (`getLogs()`) para a tela master — é onde os dados realmente existem.

---

## Ambiente

| Dependência | Necessária para | Disponível | Versão | Fallback |
|-------------|----------------|-----------|--------|----------|
| Expo SDK | Rodar o app | Conforme projeto | ~53 | — |
| expo-sqlite | getLogs() no master/logs | Já no projeto | Integrado | — |
| @supabase/supabase-js | audit_logs no admin/logs | Já no projeto | Configurado | — |
| Supabase Dashboard | Verificar RLS e `validate_invite_token` | Requer acesso manual | — | Tratar como caixa-preta |

---

## Fontes

### Primárias (HIGH — leitura direta do código-fonte)
- `app/(panel)/admin/logs.tsx` — implementação completa da tela de auditoria admin
- `app/(panel)/master/logs.tsx` — implementação completa da tela de logs master (bug confirmado)
- `utils/logger.ts` — sistema de log SQLite local
- `utils/auditLogger.ts` — sistema de auditoria Supabase
- `utils/database.ts` — schema SQLite (confirmação de tabela `logs`, ausência de `system_logs`)
- `app/(auth)/login.tsx` e `app/(auth)/register.tsx` — exposição de `e.message`
- `supabase/migrations/20260402_token_tracking_and_namechanged.sql` — única migration (sem `system_logs`)

### Secundárias (MEDIUM)
- Conhecimento da API de erros do Supabase Auth — mensagens em inglês são comportamento documentado da biblioteca `@supabase/supabase-js`. Verificável em https://supabase.com/docs/reference/javascript/auth-signinwithpassword

---

## Metadata

**Confiança por área:**
- UX-01 (strings inglesas encontradas): HIGH — grep direto no código-fonte
- UX-01 (mensagens Supabase Auth em inglês): HIGH — comportamento documentado do SDK
- UX-02 (bug system_logs): HIGH — confirmado por leitura de database.ts + logger.ts + master/logs.tsx
- UX-02 (admin/logs funcionalidade): MEDIUM — arquiteturalmente correto, mas RLS não verificável sem dashboard
- `validate_invite_token.motivo` idioma: LOW — RPC não está no código local

**Data da pesquisa:** 2026-04-03
**Válido até:** 2026-05-03 (código estável, sem dependências de versão)
