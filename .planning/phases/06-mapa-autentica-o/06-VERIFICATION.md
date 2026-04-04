---
phase: 06-mapa-autentica-o
verified: 2026-04-02T03:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
human_verification:
  - test: "Mapa nativo renderiza sem tela branca em Android físico"
    expected: "Mapa abre instantaneamente com tiles Google Maps/Apple Maps sem tela branca"
    why_human: "Requer dispositivo físico — rendering de mapa nativo não é testável com jest. UAT teste 1 reportou: pass."
  - test: "Mapa nativo renderiza sem tela branca em iOS físico"
    expected: "Mapa renderiza corretamente usando Apple Maps (PROVIDER_DEFAULT)"
    why_human: "Requer dispositivo iOS físico. UAT teste 2 reportou: pass."
  - test: "Banner offline não tapa o header de navegação"
    expected: "Pill aparece abaixo do header, não sobrepõe os botões de navegação"
    why_human: "Verificação visual aprovada pelo usuário durante UAT teste 3 (após gap closure 06-05)."
  - test: "Função validate_invite_token existe e é chamável no Supabase"
    expected: "SELECT routine_name FROM information_schema.routines WHERE routine_name = 'validate_invite_token' retorna uma linha"
    why_human: "Não há acesso direto ao Supabase. UAT 06-04 confirma: função criada com SECURITY DEFINER, GRANT para anon e authenticated. Fluxo end-to-end aprovado pelo usuário."
  - test: "RLS policies corretas para tabela municipios"
    expected: "Master admin insere, outros autenticados apenas leem"
    why_human: "Verificação de RLS no Supabase Dashboard. UAT teste 9 (criação de município) passou. Teste 7 (usuário sem permissão) foi skipped por falta de conta alternativa — sem blocker confirmado."
---

# Phase 06: Mapa + Autenticação — Verification Report

**Phase Goal:** Agentes conseguem visualizar o mapa funcional e admins conseguem gerenciar tokens de convite e municípios sem erros
**Verified:** 2026-04-02T03:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Context: Significativa Evolução da Abordagem do Mapa

O plano original (06-01) corrigia problemas da WebView+Leaflet (retry loop, onLoadEnd, postMessage CDN). Após a execução do plano e durante o UAT, o mapa foi **completamente migrado** para `react-native-maps` nativo (commit `4c46efb`). Isso supersedeu a implementação WebView inteiramente e resolveu MAPA-01 e MAPA-02 por uma abordagem fundamentalmente superior. As acceptance criteria do plano 06-01 (presença de `_initRetry`, `handleLoadEnd`, etc.) não se aplicam ao arquivo atual — o WebView não existe mais em `mapas.tsx`. Isso é correta evolução do produto, não uma lacuna.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Agente abre tela de mapa e vê mapa renderizado sem tela branca (Android e iOS) | VERIFIED (human) | UAT testes 1 e 2 passaram. `mapas.tsx` usa `react-native-maps` nativo com `PROVIDER_GOOGLE` (Android) e `PROVIDER_DEFAULT` (iOS). Elimina toda a fragilidade de CDN/WebView. |
| 2 | Mapa exibe marcadores de vistoria com dados reais do banco | VERIFIED | `loadMarkers()` em `mapas.tsx` faz query em `supabase.from('vistorias')` com filtros por role/municipio. Fallback offline via `getVistoriasByAgente`/`getVistoriasByMunicipio` (SQLite). Estado `markers` é renderizado via `filteredMarkers.map(m => <Marker .../>)`. |
| 3 | Registro com token recém-criado é aceito sem erro de fuso horário (AUTH-01) | VERIFIED | `register.tsx` linha 72 usa `supabase.rpc('validate_invite_token', { p_codigo: codigoNorm })`. Comparação client-side `new Date(expiraEm) < new Date()` removida. Função SQL criada no Supabase (human-verified 06-04). UAT teste 4 re-executado após 06-04: aprovado pelo usuário. |
| 4 | Token expirado ou já utilizado retorna mensagem em português com motivo correto | VERIFIED | `register.tsx` linha 76: `throw new Error(tokenValidation.motivo)` — motivo vem do PostgreSQL. Cobertura por 3 testes unitários em `tokenExpiry.test.ts` (cenários: expirado, já utilizado, null). |
| 5 | Master admin cadastra município sem erros; erros de RLS exibem mensagem em português | VERIFIED | `municipios.tsx` tem tratamento para `e?.code === '42501'` em 3 catch blocks (criarMunicipio, adicionarDominio, removerDominio). Mensagem: `'Permissão negada. Verifique se você tem perfil de master admin.'`. UAT teste 9 (criação de município) passou. |
| 6 | Banner offline é pill flutuante integrado ao design system, não tapa o header | VERIFIED (human) | `ConnectivityBanner.tsx` usa `theme.warning`/`theme.success` do `ThemeContext`. Sem cores hardcoded. `alignSelf: 'center'`, `borderRadius: 20`, `top: pillTop = insets.top + HEADER_HEIGHT + 8`. Aprovado visualmente pelo usuário após 06-05. |

**Score:** 6/6 truths verified (4 automated + 2 human-verified)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/(panel)/mapas.tsx` | Mapa funcional sem tela branca | VERIFIED | Migrado para `react-native-maps` nativo. `ClusteredMapView` + `MapView` com `PROVIDER_GOOGLE`/`PROVIDER_DEFAULT`. Query real ao Supabase. Loading state presente. Offline fallback via SQLite. |
| `app/(auth)/register.tsx` | Validação de token via RPC server-side | VERIFIED | Linha 72: `supabase.rpc('validate_invite_token', { p_codigo: codigoNorm })`. Hífens preservados: `.replace(/\s/g, '')`. Sem comparação client-side de data. |
| `utils/__tests__/tokenExpiry.test.ts` | 5 testes cobrindo cenários de validação de token | VERIFIED | Arquivo existe. Contém `describe('processTokenValidation (AUTH-01)')` com 5 `it()` blocks: token válido, expirado, já utilizado, erro RPC, null. |
| `app/(panel)/master/municipios.tsx` | Tratamento de erro RLS código 42501 em português | VERIFIED | 3 occurrences de `e?.code === '42501'` (linhas 139, 168, 194). Mensagem `'Permissão negada...'` presente. Código `23505` tratado em `criarMunicipio` com 'Este município já está cadastrado.' |
| `components/ConnectivityBanner.tsx` | Pill flutuante com design system colors e dark mode | VERIFIED | `theme.warning`/`theme.success` usados. `alignSelf: 'center'`, `borderRadius: 20`, sem `left`/`right: 0`. Sem `#F59E0B` ou `#10B981` hardcoded. `pointerEvents="none"` garante que não bloqueia touches. |
| `supabase/functions/validate_invite_token (PostgreSQL)` | Função SQL server-side existente e chamável | VERIFIED (human) | Criada via Supabase SQL Editor durante 06-04. `SECURITY DEFINER` com `GRANT EXECUTE` para `anon` e `authenticated`. Confirmado por `SELECT routine_name FROM information_schema.routines` e pelo fluxo de registro funcionando end-to-end. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `mapas.tsx (loadMarkers)` | `supabase.from('vistorias')` | query com filtros + `setMarkers(loaded)` | WIRED | Query executada em `useEffect([profile, isOnlineReal])`. Resultado mapeado e persistido em estado `markers`. Renderizado como `<Marker>` no `ClusteredMapView`. |
| `mapas.tsx (filteredMarkers)` | `<ClusteredMapView>` / `<Marker>` | `filteredMarkers.map(m => <Marker key={m.id} .../>)` | WIRED | Marcadores filtrados renderizados condicionalmente com `!showHeatmap`. Heatmap alternativo para Android. |
| `register.tsx (handleRegister)` | `supabase.rpc('validate_invite_token', { p_codigo: codigoNorm })` | substituição da query direta + comparação client-side | WIRED | RPC chamado, resposta usada: `tokenValidation.valido`, `tokenValidation.motivo`, `tokenValidation.municipio`, `tokenValidation.role`. |
| `register.tsx` | `supabase.rpc('mark_token_used', { p_codigo: codigoNorm })` | linha 126 após insert bem-sucedido | WIRED | Token marcado como usado após criação da conta. Usa `codigoNorm` com hífens preservados. |
| `municipios.tsx (criarMunicipio)` | `Alert.alert` com mensagem para código 42501 | `e?.code === '42501'` | WIRED | Três catch blocks verificados. Erro do Supabase propagado corretamente via `throw error` antes do catch. |
| `ConnectivityBanner.tsx` | `theme.warning` / `theme.success` | `const { theme } = useTheme()` | WIRED | `backgroundColor` do pill definido como `isOffline ? theme.warning : theme.success`. Não usa `Colors[scheme]` diretamente — usa `ThemeContext` que encapsula os tokens. Funciona em dark mode automaticamente. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `mapas.tsx` | `markers` / `filteredMarkers` | `supabase.from('vistorias').select(...)` + SQLite offline | Sim — query real com filtros por role/municipio, limit 500 | FLOWING |
| `register.tsx` | `tokenValidation` | `supabase.rpc('validate_invite_token', ...)` | Sim — função PostgreSQL com SECURITY DEFINER verificada end-to-end | FLOWING |
| `municipios.tsx` | Lista de municípios | `supabase.from('municipios').select(...)` | Sim — query direta à tabela; insert/upsert reais | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — verificações comportamentais chave requerem dispositivo físico ou conexão Supabase ativa. Substituídas por UAT que foi executado e documentado em `06-UAT.md` com aprovação do usuário.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MAPA-01 | 06-01 | Agente visualiza mapa sem tela branca em Android/iOS | SATISFIED | `mapas.tsx` usa `react-native-maps` nativo — elimina toda dependência de WebView/CDN. UAT testes 1 e 2 passaram. |
| MAPA-02 | 06-01, 06-05 | Tiles carregam corretamente; CDN não é mais fator de risco | SATISFIED | Migração para mapa nativo elimina o risco de CDN Leaflet. ConnectivityBanner refatorado resolve gap cosmético do UAT teste 3. |
| AUTH-01 | 06-02, 06-04 | Token recém-criado aceito sem erro "Token expirado" | SATISFIED | RPC server-side implementado (06-02), SQL function criada (06-04), bug de hífens corrigido (06-04 desvio), fluxo aprovado pelo usuário. `REQUIREMENTS.md` marcado como `[x] AUTH-01`. |
| AUTH-02 | 06-03 | Master admin cadastra município sem erros | SATISFIED | `municipios.tsx` com tratamento 42501/23505. RLS policies aplicadas no Supabase. UAT teste 9 passou. |

**Orphaned requirements check:** Nenhum ID mapeado para Phase 06 em `REQUIREMENTS.md` sem plano correspondente.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/ConnectivityBanner.tsx` | 80 | `color="#fff"` hardcoded no ícone Feather | Info | Texto e ícone sempre brancos. Com `theme.warning` como fundo (âmbar), branco tem contraste adequado. Em dark mode o fundo é `theme.warning` (mais saturado), branco ainda legível. Não bloqueia o requisito. |
| `components/ConnectivityBanner.tsx` | 110 | `color: '#fff'` no estilo do texto | Info | Mesma análise acima — baixo impacto, fundo sempre colorido garante contraste suficiente. |

Nenhum blocker encontrado. Sem `TODO`/`FIXME`/`placeholder` nos arquivos verificados. Sem `return null` prematuro ou handlers vazios nos fluxos críticos.

---

### Human Verification Required

#### 1. Mapa Nativo — Dispositivo Android Físico

**Test:** Abrir app em dispositivo Android físico, navegar para aba Mapa.
**Expected:** Mapa Google Maps renderiza com tiles visíveis, marcadores de vistoria aparecem como pins coloridos.
**Why human:** Rendering de mapa nativo não é testável com jest. UAT reportou: **pass** (teste 1).

#### 2. Mapa Nativo — Dispositivo iOS Físico

**Test:** Abrir app em dispositivo iOS físico, navegar para aba Mapa.
**Expected:** Mapa Apple Maps renderiza sem distorção, fit automático nas vistorias funciona.
**Why human:** Requer hardware iOS. UAT reportou: **pass** (teste 2).

#### 3. Banner Offline — Verificação Visual

**Test:** Ativar modo avião com o app aberto em qualquer tela.
**Expected:** Pill âmbar aparece abaixo do header (não sobre ele), não bloqueia a navegação.
**Why human:** Layout visual não é testável programaticamente. Aprovado pelo usuário após 06-05.

#### 4. Função SQL validate_invite_token — Supabase

**Test:** Executar `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'validate_invite_token'` no Supabase SQL Editor.
**Expected:** Retorna uma linha com `validate_invite_token`.
**Why human:** Sem acesso programático ao Supabase. Confirmado durante execução de 06-04.

#### 5. RLS Policy para Municípios — Erro 42501

**Test:** Tentar criar município com usuário que NÃO tem `role = 'master_admin'`.
**Expected:** Alert com "Permissão negada. Verifique se você tem perfil de master admin."
**Why human:** UAT teste 7 foi skipped (usuário só tem conta master_admin). O código que trataria o erro está correto e verificado — apenas o cenário de erro real não foi induzido manualmente.

---

### Gaps Summary

Nenhum gap encontrado. Todos os 6 truths verificados.

O item mais notável desta fase é a **migração do mapa** de WebView+Leaflet para `react-native-maps` nativo, que ocorreu durante a fase e supersedeu a implementação inicial. O resultado final satisfaz MAPA-01 e MAPA-02 por uma abordagem mais robusta do que a planejada originalmente. O artefato `mapas.tsx` atual é substancialmente diferente do que os planos 06-01 descrevem, mas o objetivo da fase está completamente atingido.

O único item sem cobertura de teste automatizado é AUTH-02 em condição de erro RLS real (necessitaria de conta sem permissão) — este é um cenário NEEDS HUMAN que não bloqueia o status geral pois o código de tratamento foi verificado no codebase e o fluxo de sucesso foi testado.

---

_Verified: 2026-04-02T03:00:00Z_
_Verifier: Claude (gsd-verifier)_
