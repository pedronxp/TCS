# PDR — Plano de Desenvolvimento e Roadmap
## App Defesa Civil · TCS — Sistema de Vistoria Técnica de Risco
**Versão 1.0 | Gerado em: Março 2026**
**Análise por: security-engineer · backend-architect · frontend-developer · code-reviewer · security-auditor**

---

## ÍNDICE

1. [Estado Atual do Sistema](#1-estado-atual-do-sistema)
2. [Diagnóstico Técnico Completo](#2-diagnóstico-técnico-completo)
3. [Bugs Críticos a Corrigir Agora](#3-bugs-críticos-a-corrigir-agora)
4. [Roadmap por Fases](#4-roadmap-por-fases)
5. [Padrões Técnicos Obrigatórios](#5-padrões-técnicos-obrigatórios)
6. [Segurança e Compliance](#6-segurança-e-compliance)
7. [Performance e Escalabilidade](#7-performance-e-escalabilidade)
8. [Qualidade e Testes](#8-qualidade-e-testes)
9. [Checklist de Entrega por Fase](#9-checklist-de-entrega-por-fase)

---

## 1. ESTADO ATUAL DO SISTEMA

### 1.1 Visão Geral

| Dimensão | Avaliação | Nota |
|---|---|---|
| Arquitetura geral | Modular com contexts, offline-first bem estruturado | 3.5/5 |
| Segurança | Tokens frágeis, sem rate-limit, XSS potencial no mapa | 2.5/5 |
| Performance | Sem índices SQLite, sem paginação, sem cache | 2.5/5 |
| UX/UI | Consistente com temas dark/light, design limpo | 3.5/5 |
| Offline | Sincronização funcional com retry limit e logs | 4/5 |
| Testes | Zero cobertura — nenhum teste automatizado | 0/5 |
| **MÉDIA GERAL** | | **3.2/5** |

### 1.2 Stack Confirmada

```
React Native 0.81.5 + Expo SDK 54
expo-router 6.0.23 (file-based routing)
Supabase 2.45 (Auth + Postgres + Storage)
expo-sqlite 16 (offline SQLite)
React 19.1.0 + TypeScript 5.9
expo-notifications 55 · expo-print 55 · expo-location 19
```

### 1.3 Fluxo de Vistoria (como está hoje)

```
Agente abre app
  └─ Login (/auth/login)
       └─ Dashboard (/panel/dashboard)
            └─ Nova Vistoria
                 ├─ Passo 1: Endereço + GPS (/inspecoes/dados-iniciais)
                 ├─ Passo 2: Tipo de formulário (/inspecoes/selecao-formulario)
                 ├─ Passo 3: Formulário dinâmico (/inspecoes/wizard)
                 ├─ Resultado + Risco (/inspecoes/resultado)
                 └─ Fotos (/inspecoes/foto)

Offline: salva SQLite → SyncService sincroniza quando volta internet
PDF/Laudo: gerado localmente via expo-print (HTML → PDF)
```

### 1.4 Papéis e Permissões (RBAC)

| Role | O que faz |
|---|---|
| `agent` | Cria vistorias, vê as próprias, foto, laudo |
| `supervisor` | Vê equipe, atribui tarefas, vê vistorias do município |
| `admin` | Gestão completa do município (usuários, tokens, forms, stats) |
| `master_admin` | Acesso total — todos os municípios, logs globais |

---

## 2. DIAGNÓSTICO TÉCNICO COMPLETO

### 2.1 Mapa de Problemas por Severidade

#### 🔴 CRÍTICO — Bloqueia produção ou representa risco real

| # | Arquivo | Problema | Impacto |
|---|---|---|---|
| C1 | `mapas.tsx` | XSS potencial: dados de endereço injetados no HTML Leaflet sem sanitização HTML completa | Execução de JS no WebView |
| C2 | `wizard.tsx` | UUID fraco no fallback: `Date.now() + Math.random()` pode colidir | Duplicação de vistorias |
| C3 | `database.ts` | Sem índices nas tabelas — queries ficam O(n) com volume | Travamento com >500 vistorias |
| C4 | `admin/usuarios.tsx` | Sem paginação — carrega TODOS usuários (pode ser milhares) | Crash em municípios grandes |
| C5 | `resultado.tsx` | HTML do laudo não escapa `respostas_json` — XSS via resposta maliciosa | Injeção no PDF |

#### 🟠 ALTO — Degrada experiência ou representa risco médio

| # | Arquivo | Problema | Impacto |
|---|---|---|---|
| A1 | `risco-config.tsx` | Configuração de risco persiste só em AsyncStorage local — não sincroniza entre admins | Configs diferentes por dispositivo |
| A2 | `SyncService.ts` | Sem batch API — 100 vistorias pendentes = 100 requests separados | Lentidão em reconexão |
| A3 | `inspecoes/foto.tsx` | URI local quebra após reinstalação do app — foto perdida | Perda de evidências |
| A4 | `gerar-token.tsx` | Sem rate-limiting — admin pode criar 1000 tokens em loop | Flood de tokens |
| A5 | `admin/estatisticas.tsx` | Gráfico sempre mostra últimos 7 dias, ignorando filtro de período | Métricas enganosas |
| A6 | `ConnectivityContext.tsx` | Timeout de 5s na verificação real — redes 2G/3G falham como offline | Usuários em campo sem sync |
| A7 | `dados-iniciais.tsx` | GPS sem timeout definido — usuário pode ficar preso em "detectando..." | UX quebrada em campo |
| A8 | `dados-iniciais.tsx` | Nominatim API pública: limite 1 req/s — pode ser bloqueado por IP | Reverse geocoding falha em uso intenso |

#### 🟡 MÉDIO — Reduz qualidade mas não bloqueia

| # | Arquivo | Problema | Impacto |
|---|---|---|---|
| M1 | `dashboard.tsx` | Sem cache de métricas — refetch a cada foco na tela | Lentidão perceptível |
| M2 | `wizard.tsx` | Sem persistência de rascunho — crash = perde tudo | Frustração do agente |
| M3 | `admin/relatorios.tsx` | Sem exportação (CSV/PDF) | Admin não consegue reportar |
| M4 | `admin/form-editor.tsx` | Sem editor visual de perguntas — formulários começam vazios | Feature incompleta |
| M5 | `mapas.tsx` | Sem clustering de markers — 500+ markers = mapa lento | Performance |
| M6 | `(panel)/_layout.tsx` | 23 telas em uma única Stack — sem limite de histórico | Uso de memória cresce |
| M7 | `database.ts` | Sem VACUUM periódico — banco fragmenta com uso | Performance SQLite |
| M8 | `supabase.ts` | Sem validação de URL/KEY ao inicializar — falha silenciosa | Hard to debug |
| M9 | `inspecoes/index.tsx` | fotos_urls não exibidas na listagem | Contexto incompleto para supervisor |
| M10 | `AuthContext.tsx` | Sem timeout no fetchProfile — se Supabase cair, app trava em loading | UX quebrada |

#### 🔵 BAIXO — Melhorias de qualidade

| # | Problema |
|---|---|
| B1 | Sem testes automatizados (0% coverage) |
| B2 | Sem CI/CD pipeline |
| B3 | EAS Build project ID é placeholder |
| B4 | ThemeContext sem animação de transição |
| B5 | `logger.ts` MAX_LOGS=500 — perde histórico rápido |
| B6 | Sem documentação inline (JSDoc) nas funções críticas |
| B7 | `console.log` ainda presentes em produção (deveriam usar logger) |
| B8 | Sem deep link handling para notificações push |

---

## 3. BUGS CRÍTICOS A CORRIGIR AGORA

> **Regra:** Antes de iniciar qualquer nova feature, estes bugs devem ser resolvidos.

### BUG-C1 · XSS no Mapa Leaflet

**Arquivo:** `app/(panel)/mapas.tsx`
**Problema:** Endereços e nomes de agentes são injetados diretamente no HTML do Leaflet. A função `safeStr()` atual escapa apenas aspas simples/duplas, mas não tags HTML.
**Correção:** Implementar escape HTML completo antes de injetar qualquer dado do banco no HTML.

```typescript
// ADICIONAR em mapas.tsx:
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
// Usar: escapeHtml(v.endereco_rua) em todos os dados inseridos no HTML
```

---

### BUG-C2 · UUID Fraco no Wizard

**Arquivo:** `app/(panel)/inspecoes/wizard.tsx` linha ~201
**Problema:** `Date.now() + Math.random()` não garante unicidade global.
**Correção:** Hermes/React Native tem `crypto.randomUUID()` — usar sempre, sem fallback fraco.

```typescript
// SUBSTITUIR:
const id = typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// POR:
const id = crypto.randomUUID(); // Hermes suporta desde RN 0.73+
```

---

### BUG-C3 · Índices SQLite Faltando

**Arquivo:** `utils/database.ts`
**Problema:** Sem índices — busca por `agente_uid` ou `municipio` é full table scan.
**Correção:** Adicionar na migration v4.

```sql
-- Adicionar na migration v4:
CREATE INDEX IF NOT EXISTS idx_vistorias_agente ON vistorias_offline(agente_uid);
CREATE INDEX IF NOT EXISTS idx_vistorias_municipio ON vistorias_offline(municipio);
CREATE INDEX IF NOT EXISTS idx_vistorias_sincronizado ON vistorias_offline(sincronizado);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_category ON logs(category);
```

---

### BUG-A6 · GPS Sem Timeout

**Arquivo:** `app/(panel)/inspecoes/dados-iniciais.tsx`
**Problema:** `Location.getCurrentPositionAsync()` sem timeout — usuário pode ficar preso.
**Correção:**

```typescript
// ADICIONAR timeout e fallback:
const location = await Promise.race([
  Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
  new Promise((_, reject) => setTimeout(() => reject(new Error('GPS timeout')), 15000))
]) as Location.LocationObject;
```

---

### BUG-A7 · fetchProfile Sem Timeout

**Arquivo:** `context/AuthContext.tsx`
**Problema:** Se Supabase estiver lento, app trava em loading sem resposta ao usuário.
**Correção:**

```typescript
// ADICIONAR timeout de 10s com AbortController:
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000);
try {
  const { data } = await supabase
    .from('users').select('*').eq('uid', uid).single()
    .abortSignal(controller.signal);
  return data;
} finally {
  clearTimeout(timeout);
}
```

---

## 4. ROADMAP POR FASES

> **Convenção de prioridade:** 🔴 Bloqueante · 🟠 Alta · 🟡 Média · 🔵 Melhoria

---

### FASE 0 — Estabilização (Resolver Antes de Qualquer Feature)
**Prazo:** 1 semana
**Critério de conclusão:** Zero bugs críticos abertos, app estável em campo

| # | Tarefa | Prioridade | Arquivo(s) |
|---|---|---|---|
| 0.1 | Corrigir XSS no mapa Leaflet (BUG-C1) | 🔴 | `mapas.tsx` |
| 0.2 | Corrigir UUID fraco no wizard (BUG-C2) | 🔴 | `wizard.tsx` |
| 0.3 | Adicionar índices SQLite — migration v4 (BUG-C3) | 🔴 | `database.ts` |
| 0.4 | Adicionar timeout no GPS (BUG-A6) | 🟠 | `dados-iniciais.tsx` |
| 0.5 | Adicionar timeout no fetchProfile (BUG-A7) | 🟠 | `AuthContext.tsx` |
| 0.6 | Validar URL/KEY do Supabase ao inicializar | 🟠 | `supabase.ts` |
| 0.7 | Substituir todos os `console.log` por `logger.*` | 🟡 | Todos os arquivos |
| 0.8 | Configurar EAS Build project ID real no app.json | 🟠 | `app.json` |

---

### FASE 1 — Núcleo Funcional Completo
**Prazo:** 2-3 semanas
**Critério de conclusão:** Todas as telas existentes funcionam corretamente, sem dados faltando

| # | Tarefa | Prioridade | Arquivo(s) |
|---|---|---|---|
| 1.1 | **Paginação em usuários** — cursor-based, 20 por página | 🟠 | `admin/usuarios.tsx` |
| 1.2 | **Persistência de rascunho no wizard** — AsyncStorage salva respostas parciais | 🟠 | `wizard.tsx` |
| 1.3 | **Sincronizar risco-config no Supabase** — tabela `risk_configs` | 🟠 | `risco-config.tsx` |
| 1.4 | **Cache de métricas no dashboard** — TTL 60 segundos, invalidar no foco | 🟡 | `dashboard.tsx` |
| 1.5 | **Corrigir gráfico de estatísticas** — respeitar filtro de período selecionado | 🟠 | `estatisticas.tsx` |
| 1.6 | **Exportação de relatórios** — CSV compartilhável via Share API | 🟠 | `relatorios.tsx` |
| 1.7 | **Re-upload de fotos falhas** — botão "Tentar novamente" por foto | 🟡 | `foto.tsx` |
| 1.8 | **Timeout real no ConnectivityContext** — aumentar para 8s, adicionar retry | 🟡 | `ConnectivityContext.tsx` |
| 1.9 | **Sanitização HTML no laudo PDF** — escapar dados das respostas | 🔴 | `resultado.tsx` |
| 1.10 | **Pull-to-refresh no dashboard** — RefreshControl + refetch manual | 🟡 | `dashboard.tsx` |
| 1.11 | **Paginação em relatórios** — cursor-based, LIMIT 50 com "Carregar mais" | 🟡 | `relatorios.tsx` |
| 1.12 | **Rate-limit na geração de tokens** — máximo 10 tokens por hora por admin | 🟠 | `gerar-token.tsx` |

---

### FASE 2 — Editor de Formulários Completo
**Prazo:** 3-4 semanas
**Critério de conclusão:** Admin consegue criar formulário personalizado completo do zero

| # | Tarefa | Prioridade | Arquivo(s) |
|---|---|---|---|
| 2.1 | **Editor visual de perguntas** — CRUD de perguntas dentro do formulário | 🟠 | `form-editor.tsx` (reescrever) |
| 2.2 | **Suporte a tipos de pergunta** — cards, texto livre, múltipla escolha, foto | 🟠 | `form-editor.tsx` |
| 2.3 | **Preview de formulário** — simular antes de publicar | 🟡 | `form-editor.tsx` |
| 2.4 | **Duplicar template** — clonar formulário existente | 🟡 | `form-editor.tsx` |
| 2.5 | **Versionamento automático** — ao publicar nova versão, v+1 | 🟡 | `form-editor.tsx` |
| 2.6 | **Weights visuais** — slider para pesoRisco de cada opção | 🟡 | `form-editor.tsx` |
| 2.7 | **Formulários por categoria** — tag/label para organização | 🔵 | `selecao-formulario.tsx` |
| 2.8 | **Offline de formulários customizados** — cachear no SQLite | 🟠 | `selecao-formulario.tsx` |

---

### FASE 3 — Mapa Tático Avançado
**Prazo:** 2-3 semanas
**Critério de conclusão:** Mapa funcional, performático e sem vulnerabilidades

| # | Tarefa | Prioridade | Arquivo(s) |
|---|---|---|---|
| 3.1 | **Corrigir XSS definitivamente** — sanitização completa no buildHtml | 🔴 | `mapas.tsx` |
| 3.2 | **Clustering de markers** — Leaflet.markercluster para 500+ pins | 🟠 | `mapas.tsx` |
| 3.3 | **Carregar vistorias offline** — buscar SQLite quando sem internet | 🟠 | `mapas.tsx` |
| 3.4 | **Heatmap opcional** — toggle para ver densidade de vistorias | 🟡 | `mapas.tsx` |
| 3.5 | **Filtro por data no mapa** — período 7d/30d/todos | 🟡 | `mapas.tsx` |
| 3.6 | **Exportar mapa como imagem** — screenshot + compartilhar | 🔵 | `mapas.tsx` |
| 3.7 | **Deep link de mapa** — notificação leva direto à vistoria no mapa | 🔵 | `_layout.tsx` |

---

### FASE 4 — Performance e Escalabilidade
**Prazo:** 2 semanas
**Critério de conclusão:** App mantém performance com 10.000 vistorias, 500 usuários

| # | Tarefa | Prioridade | Arquivo(s) |
|---|---|---|---|
| 4.1 | **Batch sync** — agrupar vistorias pendentes em 1 request (RPC Supabase) | 🟠 | `SyncService.ts` |
| 4.2 | **SQLite VACUUM periódico** — executar após sync bem-sucedido | 🟡 | `database.ts` |
| 4.3 | **React.memo + useMemo** — evitar re-renders desnecessários em listas | 🟡 | `inspecoes/index.tsx`, `relatorios.tsx` |
| 4.4 | **FlatList vs ScrollView** — migrar ScrollViews longas para FlatList virtualizadas | 🟡 | `admin/*.tsx` |
| 4.5 | **Image lazy loading** — fotos do mapa e lista sob demanda | 🟡 | `mapas.tsx`, `foto.tsx` |
| 4.6 | **Supabase RLS audit** — garantir que políticas bloqueiam cross-municipio | 🔴 | Supabase dashboard |
| 4.7 | **Query aggregation** — usar funções RPC do Supabase para KPIs ao invés de COUNT no cliente | 🟡 | `dashboard.tsx`, `admin/index.tsx` |
| 4.8 | **Compressão de payload sync** — reduzir tamanho da vistoria enviada | 🔵 | `SyncService.ts` |

---

### FASE 5 — Segurança Reforçada
**Prazo:** 2 semanas
**Critério de conclusão:** Auditoria de segurança passa sem ALTO ou CRÍTICO

| # | Tarefa | Prioridade | Arquivo(s) |
|---|---|---|---|
| 5.1 | **SQLite encryption** — expo-sqlite-encrypted para dados sensíveis | 🟠 | `database.ts` |
| 5.2 | **Token de convite mais forte** — UUID v4 ao invés de 8-char alfanumérico | 🟠 | `gerar-token.tsx` |
| 5.3 | **Rate-limit de login** — bloquear após 5 tentativas (Supabase Auth config) | 🟠 | Supabase dashboard |
| 5.4 | **Validação de email corporativo** — aceitar só domínios autorizados por município | 🟡 | `register.tsx` |
| 5.5 | **Auditoria de ações admin** — tabela `audit_log` no Supabase | 🟡 | `admin/usuarios.tsx`, `admin/tokens.tsx` |
| 5.6 | **CSP no WebView do mapa** — Content-Security-Policy para isolar Leaflet | 🟠 | `mapas.tsx` |
| 5.7 | **Certificate pinning** — para APKs distribuídos em produção | 🔵 | `supabase.ts` |
| 5.8 | **Remover dados sensíveis dos logs** — senhas, tokens não devem aparecer em `logger` | 🟠 | `logger.ts` |

---

### FASE 6 — Testes e CI/CD
**Prazo:** 3 semanas
**Critério de conclusão:** 60%+ coverage, CI passa antes de merge

| # | Tarefa | Prioridade | Arquivo(s) |
|---|---|---|---|
| 6.1 | **Setup Jest + React Native Testing Library** | 🟠 | `package.json` |
| 6.2 | **Testes unitários: database.ts** — todas funções CRUD | 🟠 | `utils/database.test.ts` |
| 6.3 | **Testes unitários: logger.ts** — write, read, clear | 🟠 | `utils/logger.test.ts` |
| 6.4 | **Testes unitários: SyncService.ts** — sucesso, falha, retry, batch | 🟠 | `services/SyncService.test.ts` |
| 6.5 | **Testes unitários: cálculo de risco** — wizard calcularNivelRisco | 🟠 | `wizard.test.ts` |
| 6.6 | **Testes de integração: fluxo de login** | 🟡 | `(auth)/login.test.tsx` |
| 6.7 | **Testes de integração: fluxo de vistoria** | 🟡 | `inspecoes/wizard.test.tsx` |
| 6.8 | **GitHub Actions CI** — TypeScript check + Jest + Expo build check | 🟠 | `.github/workflows/ci.yml` |
| 6.9 | **EAS Build automatizado** — build APK em main branch | 🟡 | `.github/workflows/build.yml` |
| 6.10 | **Pre-commit hooks (husky)** — TypeScript, lint, tests antes de commit | 🔵 | `.husky/` |

---

### FASE 7 — Features Novas (Pós-Estabilização)
**Prazo:** A definir
**Critério de entrada:** Fases 0-3 concluídas

| # | Tarefa | Descrição |
|---|---|---|
| 7.1 | **Notificações push reais** | Backend envia push quando supervisor atribui vistoria |
| 7.2 | **Assinatura digital no laudo** | Agente assina PDF com traço digital |
| 7.3 | **Câmera com anotações** | Setas e texto sobre fotos no campo |
| 7.4 | **Relatório comparativo** | Histórico de vistorias no mesmo endereço |
| 7.5 | **Dashboard supervisor offline** | Ver equipe sem internet via SQLite |
| 7.6 | **Modo escuro automático** | Seguir horário (diurno/noturno) |
| 7.7 | **QR Code de vistoria** | Gerar QR no laudo para rastreabilidade |
| 7.8 | **Exportação XLSX** | Planilha com todas vistorias do período |
| 7.9 | **Biometria no login** | TouchID/FaceID para agentes em campo |
| 7.10 | **Formulário adaptativo** | Perguntas que aparecem baseadas em respostas anteriores |

---

## 5. PADRÕES TÉCNICOS OBRIGATÓRIOS

> **Regra de ouro:** Nenhum PR aprovado que viole estas regras.

### 5.1 Nomenclatura

```typescript
// ✅ Arquivos e componentes: PascalCase
WizardAvaliacaoScreen.tsx

// ✅ Funções e variáveis: camelCase
const calcularNivelRisco = () => {}

// ✅ Constantes globais: SCREAMING_SNAKE_CASE
const MAX_FOTOS = 8;
const DB_VERSION = 4;

// ✅ Tipos e interfaces: PascalCase
interface VistoriaLocal {}
type LogLevel = 'info' | 'warn' | 'error';

// ✅ Supabase columns: camelCase (padrão já adotado)
// ✅ SQLite columns: snake_case (padrão já adotado)
// ❌ NUNCA misturar nas queries
```

### 5.2 Tratamento de Erros

```typescript
// ✅ PADRÃO OBRIGATÓRIO — sempre logar com contexto
try {
  const result = await operacaoCritica();
  logger.info('categoria', 'Operação concluída', { resultado: result.id });
} catch (e: any) {
  logger.error('categoria', 'Falha na operação', {
    erro: e.message,
    stack: __DEV__ ? e.stack : undefined,
    contexto: { userId, vistoriaId },
  });
  // Nunca re-throw sem logar
}

// ❌ PROIBIDO
} catch { } // silencioso
} catch (e) { console.log(e); } // console.log direto
```

### 5.3 Queries Supabase

```typescript
// ✅ SEMPRE desestruturar e verificar error
const { data, error } = await supabase.from('vistorias').select('*');
if (error) {
  logger.error('sync', 'Falha na query', { erro: error.message, code: error.code });
  throw error;
}

// ✅ SEMPRE usar .limit() em listagens
const { data } = await supabase.from('vistorias').select('*').limit(50);

// ✅ SEMPRE tipar o retorno
const { data } = await supabase.from('users').select('*').returns<UserProfile[]>();

// ❌ PROIBIDO sem limit
supabase.from('vistorias').select('*') // pode retornar 100k linhas
```

### 5.4 SQLite

```typescript
// ✅ SEMPRE usar transactions para multi-update
database.withTransactionSync(() => {
  database.runSync(`UPDATE ...`, [...]);
  database.runSync(`INSERT ...`, [...]);
});

// ✅ SEMPRE usar parâmetros posicionais — nunca string interpolation
database.runSync(`SELECT * WHERE id = ?`, [id]); // ✅
database.runSync(`SELECT * WHERE id = '${id}'`); // ❌ SQL INJECTION

// ✅ Usar logger para erros de banco
try {
  database.runSync(...);
} catch (e: any) {
  logger.error('system', 'Erro SQLite', { query: 'nome_da_query', erro: e.message });
}
```

### 5.5 Navegação

```typescript
// ✅ SEMPRE usar router.replace() ao retornar para root screens
router.replace('/(panel)/dashboard'); // ✅ — não empilha

// ✅ SEMPRE usar router.push() para screens filhas
router.push('/(panel)/inspecoes/wizard'); // ✅

// ✅ SEMPRE limpar stack quando necessário
router.dismissAll(); // Expo Router 6
router.replace('/'); // Se precisa resetar

// ❌ NUNCA navegar manualmente após signOut (o _layout cuida)
await signOut();
router.replace('/(auth)'); // ❌ duplica redirect
```

### 5.6 Logging

```typescript
// ✅ PADRÃO: sempre usar logger — nunca console.log em produção
logger.info('vistoria', 'Mensagem clara de o que aconteceu', { dados: relevantes });
logger.warn('sync', 'Situação não-ideal mas não fatal', { contexto });
logger.error('auth', 'Falha grave', { erro: e.message });

// ❌ PROIBIDO em código de produção
console.log('debug temp'); // Remover antes de commitar
```

---

## 6. SEGURANÇA E COMPLIANCE

### 6.1 Regras de Segurança Invioláveis

```
REGRA-SEC-01: NUNCA armazenar senhas, tokens de API ou chaves privadas no código fonte
REGRA-SEC-02: NUNCA inserir dados não-sanitizados em HTML (WebView, laudo PDF)
REGRA-SEC-03: NUNCA usar queries SQLite com concatenação de strings — sempre parâmetros
REGRA-SEC-04: NUNCA logar dados sensíveis (tokens, senhas, CPF, dados pessoais)
REGRA-SEC-05: SEMPRE verificar `isApproved === true` antes de permitir acesso ao painel
REGRA-SEC-06: SEMPRE verificar session no servidor (RLS no Supabase), não só no cliente
REGRA-SEC-07: Tokens de convite são de uso único — deletar IMEDIATAMENTE após registro
REGRA-SEC-08: Sessões inativas por 30 dias devem ser invalidadas (Supabase Auth config)
```

### 6.2 Variáveis de Ambiente

```bash
# .env (NUNCA commitar — está no .gitignore)
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Verificar ao inicializar supabase.ts:
if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL não configurada');
}
```

### 6.3 Supabase RLS (Row Level Security)

Políticas obrigatórias a verificar/criar:

```sql
-- vistorias: agent só vê as próprias
CREATE POLICY "agent_own_vistorias" ON vistorias
  FOR ALL USING (
    auth.uid()::text = "agenteUid"
    OR EXISTS (
      SELECT 1 FROM users
      WHERE uid = auth.uid()::text
      AND role IN ('admin', 'supervisor', 'master_admin')
      AND (municipio = vistorias.municipio OR role = 'master_admin')
    )
  );

-- invite_tokens: admin só vê do próprio município
CREATE POLICY "admin_own_tokens" ON invite_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE uid = auth.uid()::text
      AND (municipio = invite_tokens.municipio OR role = 'master_admin')
    )
  );

-- users: isApproved deve ser gerenciado pelo admin, não pelo próprio user
CREATE POLICY "user_read_own" ON users
  FOR SELECT USING (uid = auth.uid()::text);
CREATE POLICY "admin_manage_users" ON users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE uid = auth.uid()::text AND role IN ('admin', 'master_admin')
    )
  );
```

### 6.4 CSP para WebView do Mapa

```typescript
// mapas.tsx — adicionar no <WebView>:
<WebView
  originWhitelist={['*']}
  mixedContentMode="compatibility"
  // Content Security Policy — bloqueia scripts externos não autorizados
  injectedJavaScriptBeforeContentLoaded={`
    const meta = document.createElement('meta');
    meta.setAttribute('http-equiv', 'Content-Security-Policy');
    meta.setAttribute('content', "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.tile.openstreetmap.org https://*.arcgisonline.com https://*.basemaps.cartocdn.com; img-src * data:;");
    document.head.appendChild(meta);
  `}
  // ...
/>
```

---

## 7. PERFORMANCE E ESCALABILIDADE

### 7.1 Metas de Performance

| Métrica | Meta | Como medir |
|---|---|---|
| Cold start (login → dashboard) | < 3 segundos | Cronômetro manual |
| Lista de vistorias (50 itens) | < 500ms de render | React DevTools |
| Sync de 50 vistorias pendentes | < 10 segundos em 4G | Logger timestamp |
| Geração de laudo PDF | < 2 segundos | Logger timestamp |
| SQLite query (por agente) | < 100ms | Medir com `Date.now()` |
| GPS detection | < 10 segundos (com timeout) | Logger timestamp |

### 7.2 Índices SQLite Obrigatórios (Fase 0.3)

```sql
-- Migration v4 — criar ANTES de ir para produção com volume
CREATE INDEX IF NOT EXISTS idx_offline_agente ON vistorias_offline(agente_uid);
CREATE INDEX IF NOT EXISTS idx_offline_municipio ON vistorias_offline(municipio);
CREATE INDEX IF NOT EXISTS idx_offline_sync ON vistorias_offline(sincronizado);
CREATE INDEX IF NOT EXISTS idx_offline_data ON vistorias_offline(data_vistoria DESC);
CREATE INDEX IF NOT EXISTS idx_offline_risco ON vistorias_offline(nivel_risco);
CREATE INDEX IF NOT EXISTS idx_logs_level_date ON logs(level, criado_em DESC);
```

### 7.3 Batch Sync (Fase 4.1)

```typescript
// SyncService.ts — ao invés de 1 request por vistoria:
// Usar Supabase RPC com batch upsert

// No Supabase, criar função:
// create or replace function batch_upsert_vistorias(data jsonb[]) ...

// No app:
const { error } = await supabase.rpc('batch_upsert_vistorias', {
  data: pendentes.slice(0, 50).map(buildSupabasePayload)
});
// Máximo 50 por batch, iterar se mais
```

### 7.4 Cache de Métricas (Fase 1.4)

```typescript
// Padrão de cache a implementar no dashboard:
const CACHE_TTL_MS = 60 * 1000; // 60 segundos
let metricsCache: { data: KPIs; timestamp: number } | null = null;

const getMetrics = async () => {
  if (metricsCache && Date.now() - metricsCache.timestamp < CACHE_TTL_MS) {
    return metricsCache.data; // Cache válido
  }
  const data = await fetchFromSupabase();
  metricsCache = { data, timestamp: Date.now() };
  return data;
};
```

---

## 8. QUALIDADE E TESTES

### 8.1 Cobertura Mínima por Módulo

| Módulo | Cobertura Mínima | Tipo de Teste |
|---|---|---|
| `utils/database.ts` | 90% | Unitário (in-memory SQLite) |
| `utils/logger.ts` | 80% | Unitário |
| `services/SyncService.ts` | 80% | Unitário (mock Supabase) |
| `wizard.tsx` — calcularNivelRisco | 100% | Unitário (lógica crítica) |
| `gerar-token.tsx` — gerarCodigo | 100% | Unitário |
| `context/AuthContext.tsx` | 70% | Integração |
| Fluxo completo de vistoria | 1 E2E | End-to-end |

### 8.2 Casos de Teste Obrigatórios

```typescript
// database.ts
describe('insertVistoria', () => {
  it('insere e recupera corretamente')
  it('não duplica em INSERT OR REPLACE')
  it('marca como sincronizado corretamente')
  it('incrementa tentativas de sync')
})

// wizard.tsx — calcularNivelRisco
describe('calcularNivelRisco', () => {
  it('retorna r1 para pontuação 0')
  it('retorna r4 para pontuação 100')
  it('usa limites customizados do JSON')
  it('fallback para hardcoded se sem limites')
})

// SyncService.ts
describe('syncPendentes', () => {
  it('pula registros com 5+ tentativas')
  it('incrementa tentativas em falha')
  it('marca como sincronizado em sucesso')
  it('não executa se já em progresso')
  it('retorna { sucesso: 0, falha: 0 } sem pendentes')
})
```

### 8.3 Setup de Testes (Fase 6.1)

```json
// package.json — adicionar:
{
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterFramework": ["@testing-library/jest-native/extend-expect"],
    "transformIgnorePatterns": [
      "node_modules/(?!(jest-)?react-native|@react-native|expo|@expo|@unimodules)"
    ],
    "coverageThreshold": {
      "global": { "lines": 60 }
    }
  },
  "devDependencies": {
    "jest-expo": "~54.0.0",
    "@testing-library/react-native": "^12.0.0",
    "@testing-library/jest-native": "^5.0.0"
  }
}
```

---

## 9. CHECKLIST DE ENTREGA POR FASE

### ✅ FASE 0 — Pronto quando:
- [ ] Nenhum bug CRÍTICO aberto
- [ ] Índices SQLite criados (migration v4 executada)
- [ ] UUID usa crypto.randomUUID() sem fallback fraco
- [ ] XSS corrigido no mapa (escapeHtml implementado)
- [ ] GPS tem timeout de 15 segundos
- [ ] fetchProfile tem timeout de 10 segundos
- [ ] EAS project ID configurado
- [ ] Zero `console.log` no código de produção

### ✅ FASE 1 — Pronto quando:
- [ ] Paginação funcionando em usuários (tela não trava com 1000+ users)
- [ ] Rascunho de vistoria sobrevive a crash do app
- [ ] Config de risco sincroniza entre 2 dispositivos admin
- [ ] Exportação CSV de relatórios funciona
- [ ] Gráfico de estatísticas respeita filtro de período
- [ ] Rate-limit de tokens implementado

### ✅ FASE 2 — Pronto quando:
- [ ] Admin cria formulário com pelo menos 5 perguntas sem código
- [ ] Preview funciona antes de publicar
- [ ] Formulário customizado funciona offline (SQLite cache)

### ✅ FASE 3 — Pronto quando:
- [ ] Mapa passa audit de XSS (nenhum dado do usuário injetado sem escape)
- [ ] Clustering ativo com 100+ markers
- [ ] Mapa carrega vistorias offline do SQLite

### ✅ FASE 4 — Pronto quando:
- [ ] 50 vistorias pendentes sincronizam em < 10s (batch)
- [ ] Dashboard abre em < 3s com 10k vistorias no banco
- [ ] Supabase RLS auditado e aprovado

### ✅ FASE 5 — Pronto quando:
- [ ] Auditoria de segurança sem issues ALTO ou CRÍTICO
- [ ] Dados sensíveis não aparecem nos logs
- [ ] SQLite criptografado em produção

### ✅ FASE 6 — Pronto quando:
- [ ] Coverage ≥ 60%
- [ ] CI passa antes de merge (TypeScript + Jest + build check)
- [ ] EAS Build automatizado na branch main

---

## APÊNDICE A — Tabela Resumo de Qualidade Atual

| Componente | Nota | Principal Problema |
|---|---|---|
| mapas.tsx | 2.5/5 | XSS + sem clustering |
| admin/form-editor.tsx | 2/5 | Sem editor de perguntas |
| admin/estatisticas.tsx | 2.5/5 | Gráfico ignora filtro |
| admin/relatorios.tsx | 2.5/5 | Sem exportação |
| supabase.ts | 2.5/5 | Sem validação |
| (auth)/_layout.tsx | 2.5/5 | Sem rate-limit |
| dashboard.tsx | 3/5 | Sem cache |
| database.ts | 3/5 | Sem índices |
| dados-iniciais.tsx | 3/5 | GPS sem timeout |
| resultado.tsx | 3/5 | HTML não sanitizado |
| foto.tsx | 3/5 | Sem retry |
| AuthContext.tsx | 3.5/5 | Sem timeout |
| SyncService.ts | 3.5/5 | Sem batch |
| wizard.tsx | 3.5/5 | UUID fraco |
| NotificationService.ts | 3.5/5 | Funcional |
| logger.ts | 4/5 | Bom |
| app.json | 4/5 | Falta EAS ID |
| **MÉDIA** | **3.2/5** | |

---

## APÊNDICE B — Sequência de Implementação Recomendada

```
SEMANA 1:   Fase 0 (bugs críticos) ← COMEÇAR AQUI
SEMANA 2-3: Fase 1 (núcleo completo)
SEMANA 4-6: Fase 2 (editor de formulários)
SEMANA 7-8: Fase 3 (mapa avançado)
SEMANA 9-10: Fase 4 (performance)
SEMANA 11-12: Fase 5 (segurança)
SEMANA 13-15: Fase 6 (testes e CI/CD)
SEMANA 16+: Fase 7 (features novas)
```

---

*PDR gerado por análise automatizada de 29 arquivos do projeto.*
*Agentes utilizados: security-engineer · debugger · backend-architect · frontend-developer · code-reviewer · security-auditor*
*Atualizar este documento a cada Sprint ou quando houver mudança arquitetural significativa.*
