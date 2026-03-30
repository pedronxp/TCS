# CONTEXT.md — Defesa Civil App (Expo)
# Versão 3.0 | Março 2026
# ⚠️ LEIA ESTE ARQUIVO NO INÍCIO DE CADA SESSÃO

---

## O QUE É ESTE PROJETO

App Android de **Vistoria Técnica de Risco Estrutural** para agentes da Defesa Civil.
- Agentes de campo preenchem formulários de risco (estrutural, deslizamento, inundação)
- Sistema calcula nível de risco R1-R4 automaticamente
- Admins gerenciam equipes e visualizam dados no mapa

**Dono:** Pedro
**Stack:** Expo 54 + React Native 0.81 + Supabase
**Distribuição:** APK direto (sem Play Store) — testando via Expo Go
**Design:** Moderno/livre — SEM padrão Gov Brasil

---

## REGRAS ABSOLUTAS (nunca violar)

1. **NUNCA** usar CPF em nenhuma tela, model ou banco
2. **Município** vem sempre do perfil do agente logado — nunca pedir no formulário
3. **Token de convite** é single-use — deletar imediatamente após consumo
4. **isApproved** deve ser verificado logo após login antes de qualquer navegação
5. **ConnectivityBanner** quando offline — nunca bloquear o app, mostrar dados locais
6. **Fotos** comprimidas JPEG 72% / 1280px max width antes de salvar (`expo-image-manipulator`)
7. **Mapas** via OpenStreetMap (Leaflet.js + react-native-webview) — NUNCA Google Maps
8. **Logs:** `system_logs` (só master_admin) e `activity_logs` (admin municipal)
9. **Nunca inventar pacotes** — consultar a tabela de mapeamento Flutter→Expo
10. **Sempre mostrar plano** antes de implementar. Confirmar com Pedro antes de avançar

---

## STACK DEFINITIVO (todos instalados)

```
expo: ~54.0.0
react: 19.1.0
react-native: 0.81.5
expo-router: ~6.0.23
@supabase/supabase-js: ^2.45.0
@react-native-async-storage/async-storage: ^2.2.0
expo-sqlite                   # Offline SQLite (openDatabaseSync, runSync, getAllSync)
expo-location: ~19.0.8
expo-image-picker             # Câmera + galeria
expo-image-manipulator        # Compressão JPEG 72%, 1280px max
expo-print                    # HTML→PDF
expo-sharing                  # Compartilhar PDF
expo-notifications            # Push + local notifications
expo-device                   # isDevice check
expo-constants                # EAS projectId
expo-task-manager             # Background sync task
expo-background-fetch         # Background fetch
expo-build-properties         # compileSdk 35, targetSdk 35, minSdk 24
@expo/vector-icons: ^15.1.1   # Feather icons
react-native-webview          # Mapa OSM (Leaflet.js)
@react-native-community/netinfo  # Conectividade
```

**NÃO USAR:** `react-native-reanimated` — incompatível com Expo Go (TurboModule crash)
**NÃO USAR:** `react-native-maps` — requer Google Maps API key (pago)

---

## ESTRUTURA DE PASTAS ATUAL (COMPLETA)

```
app_defesa_civil_expo/
├── app/
│   ├── _layout.tsx                    ✅ Root layout + auth redirect (SEM segments nas deps)
│   ├── onboarding.tsx                 ✅ 4 slides — exibe 1x via AsyncStorage @onboarding_done
│   ├── (auth)/
│   │   ├── _layout.tsx                ✅ Auth stack
│   │   ├── index.tsx                  ✅ Splash/landing
│   │   ├── login.tsx                  ✅ Login Supabase + isApproved check
│   │   ├── register.tsx               ✅ Registro com token (token deletado pós-uso)
│   │   └── forgot-password.tsx        ✅ Reset via Supabase email
│   └── (panel)/
│       ├── _layout.tsx                ✅ Panel stack — SEM redirect auth (root faz isso)
│       ├── dashboard.tsx              ✅ KPIs reais + redirect por role
│       ├── perfil.tsx                 ✅ Edição nome, stats, reset senha, logout
│       ├── mapas.tsx                  ✅ OSM + Leaflet — Padrão/Satélite/Relevo/Escuro
│       ├── inspecoes/
│       │   ├── index.tsx              ✅ Lista offline-first, filtros, busca
│       │   ├── dados-iniciais.tsx     ✅ GPS + CEP + endereço
│       │   ├── selecao-formulario.tsx ✅ Seleção de formulário JSON/Supabase
│       │   ├── wizard.tsx             ✅ Motor completo — risco via classificacao.limites[]
│       │   ├── risco.tsx              ✅ Resultado risco + salvar offline-first + notificação
│       │   ├── resultado.tsx          ✅ Tela de resultado pós-salvar + initReport() + btn relatorio
│       │   ├── relatorio.tsx          ✅ Relatório técnico editável + PDF (ReportContext)
│       │   ├── foto.tsx               ✅ Câmera real + compressão JPEG + upload Supabase Storage
│       │   ├── [id].tsx               ✅ Detalhe da vistoria (campos camelCase)
│       │   └── laudo.tsx              ✅ Laudo técnico PDF (expo-print + expo-sharing)
│       ├── supervisor/
│       │   ├── index.tsx              ✅ Dashboard supervisor
│       │   ├── equipe.tsx             ✅ Lista agentes com stats
│       │   ├── agente.tsx             ✅ Vistorias por agente
│       │   └── atribuicao.tsx         ✅ Criar atribuição (observacao, criada_em)
│       ├── admin/
│       │   ├── index.tsx              ✅ 9 módulos no menu (+ Logs)
│       │   ├── usuarios.tsx           ✅ Gerenciar usuários (aprovar/suspender)
│       │   ├── tokens.tsx             ✅ Tokens — ativos/expirados separados, limpar bulk
│       │   ├── gerar-token.tsx        ✅ Gerar token — 24h/48h/7d/30d, datetime exato
│       │   ├── logs.tsx               ✅ Viewer logs locais (KPIs, filtros, FlatList)
│       │   ├── estatisticas.tsx       ✅ Stats (7d/30d/90d, barras, ranking agentes)
│       │   ├── relatorios.tsx         ✅ Lista vistorias com filtros, abre laudo
│       │   ├── form-editor.tsx        ✅ Criar/publicar/excluir formulários Supabase
│       │   └── risco-config.tsx       ✅ Editar limiares R1-R4 (AsyncStorage @risco_config_v1)
│       └── master/
│           ├── index.tsx              ✅ 10 módulos — KPIs globais, top municípios
│           ├── municipios.tsx         ✅ Ranking municípios com stats
│           └── logs.tsx               ✅ System logs — colunas: criadoEm, nomeUsuario, mensagem
├── assets/
│   ├── formularios/
│   │   ├── estrutural.json            ✅ 7 fases, soma_total, classificacao.limites[]
│   │   ├── estrutural_avancado.json   ✅ Multi-fase, pontuacao_por_item
│   │   ├── deslizamento_campo.json    ✅ 10 fases, soma_total
│   │   └── inundacao.json             ✅ 8 fases, soma_total
│   ├── logo.png                       ✅
│   └── notification-icon.png          ✅
├── components/
│   └── ConnectivityBanner.tsx         ✅ Banner laranja — Animated nativo (não reanimated)
├── constants/
│   └── Colors.ts                      ✅ Light/dark tokens
├── context/
│   ├── AuthContext.tsx                ✅ session, profile (uid, name, role, municipio, isApproved)
│   ├── ThemeContext.tsx               ✅ isDark + AsyncStorage
│   ├── ConnectivityContext.tsx        ✅ isConnected, isOnlineReal
│   ├── NotificationContext.tsx        ✅ hasPermission, badgeCount, lastResponse, atualizarBadge
│   └── ReportContext.tsx              ✅ draft ReportDraft, initReport(), updateField(), clearReport()
├── services/
│   ├── NotificationService.ts         ✅ Push token, canais Android (default/alertas), notificações locais
│   └── SyncService.ts                 ✅ Sync background + AppState fallback + MAX_TENTATIVAS=5
├── utils/
│   ├── supabase.ts                    ✅ Client Supabase — lança erro se env vars ausentes
│   ├── database.ts                    ✅ SQLite v4: schema + CRUD + 6 índices + tentativas_sync
│   ├── logger.ts                      ✅ Logger estruturado (info/warn/error) → SQLite + console
│   ├── uuid.ts                        ✅ generateUUID() via expo-crypto (Hermes-safe)
│   └── auditLogger.ts                 ✅ registrarAuditoria() fire-and-forget → audit_logs Supabase
├── CONTEXT.md                         ← ESTE ARQUIVO
├── app.json                           ✅ Permissões Android + iOS + plugins
├── package.json
└── .env                               (EXPO_PUBLIC_SUPABASE_URL, KEY)
```

---

## BANCO DE DADOS SUPABASE — SCHEMA REAL (confirmado via MCP)

⚠️ **USAR EXATAMENTE ESSES NOMES** — divergem do que estava no CONTEXT anterior

### users
```sql
uid UUID PRIMARY KEY,       -- = auth.uid()
email TEXT,
name TEXT,                  -- NÃO full_name
username TEXT NOT NULL,
role TEXT,                  -- 'agent' | 'supervisor' | 'admin' | 'master_admin'
municipio TEXT,
"isApproved" BOOLEAN,       -- camelCase!
"lastLogin" TIMESTAMPTZ,
"fcmToken" TEXT,
"createdAt" TIMESTAMPTZ
-- NÃO EXISTE: full_name, is_active, is_approved, push_token, created_at
```

### vistorias (tudo camelCase!)
```sql
id UUID PRIMARY KEY,        -- ⚠️ UUID (app usa generateUUID() → compatível)
"agenteUid" TEXT,           -- = auth.uid()
"agenteNome" TEXT,
municipio TEXT,
endereco TEXT,              -- campo composto
"enderecoRua" TEXT,
"enderecoNumero" TEXT,
"enderecoBairro" TEXT,
"responsavelNome" TEXT,
latitude FLOAT,
longitude FLOAT,
"dataVistoria" TIMESTAMPTZ,
"formularioId" TEXT,
"respostasJson" JSONB,      -- ⚠️ JSONB, não TEXT
"nivelRisco" TEXT,          -- 'r1' | 'r2' | 'r3' | 'r4'
"pontuacaoTotal" INT,
"fotoUrl" TEXT,
status TEXT,                -- CHECK: 'pendente' | 'em_andamento' | 'concluida' (NULL ok)
sincronizado BOOLEAN,
"criadoEm" TIMESTAMPTZ,
"formularioVersao" INT,
"fotoPath" TEXT,
"fotosUrls" TEXT[],
"enderecoCep" TEXT
```

### invite_tokens (camelCase!)
```sql
codigo TEXT PRIMARY KEY,    -- NÃO "token"
role TEXT,
municipio TEXT,
"criadoPor" TEXT,           -- NÃO criado_por
usado BOOLEAN,
"expiraEm" TIMESTAMPTZ,     -- NÃO expira_em
"criadoEm" TIMESTAMPTZ      -- NÃO created_at
```

### atribuicoes (snake_case!)
```sql
id UUID PRIMARY KEY,
supervisor_uid TEXT,
agente_uid TEXT,
agente_nome TEXT,
endereco_completo TEXT,
observacao TEXT,            -- NÃO observacoes
prioridade TEXT,            -- 'baixa' | 'media' | 'alta'
status TEXT,
criada_em TIMESTAMPTZ       -- NÃO created_at
```

### formularios (misto)
```sql
id UUID PRIMARY KEY,         -- ⚠️ UUID (form-editor usa gen_random_uuid())
titulo TEXT,
descricao TEXT,
perguntas JSONB,
"criadoEm" TIMESTAMPTZ,
ativo BOOLEAN,
municipio TEXT,
"criadoPorNome" TEXT,
"criadoPorUid" TEXT,         -- camelCase! (migração renomeou criado_por_uid → criadoPorUid)
"publicadoEm" TIMESTAMPTZ,
"atualizadoEm" TIMESTAMPTZ,
status TEXT,
versao INT,
classificacao JSONB,         -- {limites:[{max,nivel},...]} (adicionado na migração fix_formularios)
"tipoCalculo" TEXT,          -- 'soma_total' | 'pontuacao_por_item'
fases JSONB                  -- estrutura de fases (espelha JSON assets quando clonado)
-- NÃO EXISTE: criado_por_uid (foi renomeado para criadoPorUid)
```

### system_logs (camelCase!)
```sql
id UUID,
modulo TEXT,
mensagem TEXT,              -- NÃO message
"criadoEm" TIMESTAMPTZ,    -- NÃO created_at
"uidUsuario" TEXT,
"nomeUsuario" TEXT,         -- NÃO usuario_nome
municipio TEXT,
descricao TEXT,
nivel TEXT
```

---

## LÓGICA DE NEGÓCIO CHAVE

### Cálculo de Risco
```typescript
// wizard.tsx lê classificacao.limites[] do JSON do formulário
// limites: [{max: 24, nivel: 'sem_risco'}, {max: 49, nivel: 'medio'}, ...]
// nivelMap: sem_risco→r1, medio→r2, alto→r3, iminente→r4
// Fallback hardcoded: R1(0-24) R2(25-49) R3(50-74) R4(75+)
```

### Config de Risco Customizável
```typescript
// AsyncStorage key: @risco_config_v1
// Padrão: [{nivel:'R1',minPontos:0,maxPontos:24}, {nivel:'R2',minPontos:25,maxPontos:49},
//          {nivel:'R3',minPontos:50,maxPontos:74}, {nivel:'R4',minPontos:75,maxPontos:999}]
// Editável em admin/risco-config.tsx
```

### Onboarding
```typescript
// AsyncStorage key: @onboarding_done
// Valor '1' = já viu — vai direto para auth
// onboarding.tsx: 4 slides com FlatList + dots animados
```

### Roteamento Auth (app/_layout.tsx)
```typescript
// IMPORTANTE: segments NÃO está nas deps do useEffect — evita loop infinito
// Fluxo: loading? → wait | !onboardingDone? → /onboarding
//        authenticated? → /(panel)/dashboard | else → /(auth)
// Panel _layout NÃO faz redirect — root layout controla tudo
```

### Hierarquia de Roles
```typescript
// dashboard.tsx faz redirect automático:
if (role === 'master_admin') router.replace('/(panel)/master');
if (role === 'admin')        router.replace('/(panel)/admin');
if (role === 'supervisor')   router.replace('/(panel)/supervisor');
// agent: fica no dashboard normal
```

### Offline-First (SQLite)
```typescript
// utils/database.ts — openDatabaseSync (expo-sqlite v16 API síncrona)
// DB_VERSION = 4: schema + tentativas_sync + 6 índices de performance
// VistoriaLocal campos snake_case: agente_uid, nivel_risco, pontuacao_total, tentativas_sync, etc.
// SyncService: syncPendentes() — pula registros com tentativas_sync >= 5
// Background: expo-task-manager (APK) + AppState listener (Expo Go)
// utils/logger.ts: LogLevel=info|warn|error, LogCategory=auth|sync|vistoria|network|token|form|system
//   → Persiste em SQLite tabela 'logs' (MAX 500 entradas, auto-cleanup)
//   → Viewer: admin/logs.tsx (KPIs + filtros + FlatList)
```

### Mapa (mapas.tsx)
```typescript
// WebView + Leaflet.js — 100% gratuito, sem API key
// Tiles: CartoDB Voyager (Padrão), Esri Imagery (Satélite),
//        Esri Topo (Relevo), CartoDB Dark (Escuro)
// postMessage: clique em popup → router.push('/(panel)/inspecoes/:id')
// key={mapStyle+filter} força re-render ao trocar estilo/filtro

// ⚠️ REGRA CRÍTICA — WebView source para HTML gerado:
// NUNCA: source={{ html, baseUrl: '...' }}
//   → chama loadDataWithBaseURL() no Android → falha silenciosa = TELA BRANCA
// SEMPRE: source={{ uri: `data:text/html;charset=utf-8,${encodeURIComponent(html)}` }}
//   → chama loadUrl() → funciona em todas as versões Android

// ⚠️ react-native-webview NÃO deve estar no array plugins do app.json
//   → o pacote não tem app.plugin.js → PluginError na inicialização do Expo
//   → instalação: npm install react-native-webview@13.16.1 --legacy-peer-deps
//     (--legacy-peer-deps necessário por expo-crypto@55.0.11-canary vs expo@54)
```

---

## SERVIÇOS EXTERNOS

| Serviço | Uso |
|---------|-----|
| ViaCEP `https://viacep.com.br/ws/{cep}/json/` | Lookup por CEP |
| Nominatim OSM `https://nominatim.openstreetmap.org/reverse` | Geocoding reverso |
| CartoDB tiles | Mapa Padrão + Escuro (gratuito) |
| Esri ArcGIS tiles | Mapa Satélite + Relevo (gratuito) |
| Supabase Auth/DB/Storage | Backend completo |

---

## STATUS ATUAL

**Projeto ~99% concluído.** Testando via Expo Go. PDR Fases 0–5 concluídas.

### Pendências conhecidas:
- EAS `projectId` em `app.json` está como placeholder — configurar antes do build APK
- `eas.json` criado ✅ (development/preview/production — todos APK direto)
- Build APK com EAS: pausado por decisão de Pedro
- `activity_logs`: tabela órfã com 35 registros — zero uso no frontend; decidir: deletar ou integrar em logs.tsx
- `risk_configs`: tabela vazia, nunca usada — conflita com `formularios.classificacao` e `configuracoes`; remover
- Fase 7 (features): assinatura digital, QR code, biometria
- Formulários: clonar JSON asset → Supabase com municipio (feature "Clonar formulário built-in" no admin)
- Editor de perguntas: adicionar UI para editar limiares de classificacao (atualmente editável só via wizard)

### Decisões técnicas fixadas:
- `react-native-reanimated` **REMOVIDO** — crashava no Expo Go (TurboModule)
- `react-native-maps` **NÃO USAR** — requer Google Maps API key
- `ConnectivityBanner` usa `Animated` nativo do RN
- Mapa usa WebView + Leaflet (gratuito, sem key)
- `segments` **NÃO** entra nas deps do useEffect de roteamento

---

## NOTAS DE SESSÃO

> Sessão 3 (Março 2026): Migração completa Flutter → Expo. Todas as telas.

> Sessão 4 (Março 2026): Fixes Expo Go. ConnectivityBanner migrado para Animated nativo.

> Sessão 5 (Março 2026): Schema real Supabase descoberto via MCP. 19 arquivos corrigidos.

> Sessão 7 (Março 2026): Phase 0 do PDR — Estabilização crítica.
> - Fix BUG-C1: XSS no Leaflet (mapas.tsx) — escapeHtml() substituindo safeStr() incompleto
> - Fix BUG-C2: UUID fraco (wizard.tsx) — crypto.randomUUID() incondicional
> - Fix BUG-C3: SQLite sem índices (database.ts v4) — 6 índices adicionados
> - Fix BUG-A6: GPS sem timeout (dados-iniciais.tsx) — Promise.race() 15s
> - Fix BUG-A7: fetchProfile sem timeout (AuthContext.tsx) — Promise.race() 10s
> - Fix BUG-C5: HTML injection no laudo (resultado.tsx) — escapeHtml() em todos os campos
> - Fix 0.6: supabase.ts lança erro explícito se env vars ausentes
> - Fix 0.7: 21 arquivos — todos console.log/warn/error substituídos por logger.*
> - Novo: utils/logger.ts — logs estruturados SQLite + console (max 500 entradas)
> - Novo: admin/logs.tsx — viewer de logs com KPIs e filtros
> - Novo: tokens.tsx reescrito — ativos/expirados separados, limpar bulk
> - Novo: gerar-token.tsx — seletor 24h/48h/7d/30d
> - Novo: SyncService — MAX_TENTATIVAS=5, tentativas_sync counter
> - Novo: wizard.tsx — câmera real (expo-image-picker), tirarFoto()
> - Novo: AuthContext.tsx — TOKEN_REFRESHED re-valida perfil em tempo real

> Sessão 6 (Março 2026): Bug fixes e novas telas.
> - Fix: Maximum update depth (segments nas deps + redirect duplo no panel layout)
> - Fix: gerar-token.tsx → criadoPor (camelCase), tokens.tsx → codigo/expiraEm
> - Fix: logs.tsx → criadoEm/nomeUsuario/mensagem
> - Fix: atribuicao.tsx → observacao/criada_em
> - Fix: [id].tsx → query limpa select('*'), agenteNome, nivelRisco
> - Fix: wizard.tsx → risco via classificacao.limites[] do JSON
> - Novo: onboarding.tsx (4 slides, AsyncStorage @onboarding_done)
> - Novo: laudo.tsx (laudo técnico PDF expo-print + expo-sharing)
> - Novo: admin/relatorios.tsx (lista vistorias + filtros)
> - Novo: admin/form-editor.tsx (criar/publicar/excluir formulários)
> - Novo: admin/risco-config.tsx (limiares R1-R4 via AsyncStorage)
> - Mapa reescrito: WebView + Leaflet, 4 estilos gratuitos (Padrão/Satélite/Relevo/Escuro)
> - Admin index: 8 módulos | Master index: 10 módulos

> Sessão 8 (Março 2026): Phases 1 final + 2 + 3 + 4 do PDR.
> **Phase 1 final:**
> - Phase 1.4: dashboard.tsx — cache 60s TTL (useRef), pull-to-refresh (RefreshControl)
> - Phase 1.5: estatisticas.tsx — gráfico dinâmico diasGrafico = min(getDias, 14)
> - Phase 1.6: relatorios.tsx — CSV export via Share.share()
> - Phase 1.8: ConnectivityContext.tsx — timeout 8s, 2 retries com 1s delay
> - Phase 1.11: relatorios.tsx — paginação cursor-based LIMIT 50 + "Carregar mais"
> - Phase 1.12: gerar-token.tsx — rate-limit 10 tokens/hora por admin
>
> **Phase 2 — Editor de Formulários:**
> - editor-perguntas.tsx — NOVO: editor visual de perguntas (CRUD, 4 tipos, pesos, preview)
> - _layout.tsx — rota admin/editor-perguntas registrada
> - form-editor.tsx — botão "Editar" navega para editor-perguntas, "Duplicar" copia perguntas
> - database.ts v5 — tabela formularios_cache + índice municipio
> - selecao-formulario.tsx — online: salva cache SQLite; offline: lê cache SQLite
>
> **Phase 3 — Mapa Tático Avançado:**
> - mapas.tsx — Leaflet.markercluster (clustering de pins) + leaflet.heat (heatmap toggle)
> - mapas.tsx — filtro por período (7d/30d/todos) nos chips flutuantes
> - mapas.tsx — FAB heatmap toggle (ícone "zap", azul quando ativo)
>
> **Phase 4 — Performance e Escalabilidade:**
> - SyncService.ts — batch sync em lotes de 20 (BATCH_SIZE=20), fallback individual por registro
> - SyncService.ts — VACUUM SQLite após sync bem-sucedido
> - relatorios.tsx — migrado de ScrollView para FlatList virtualizado + React.memo (VistoriaCard)
> - relatorios.tsx — useMemo em filtradas e stats
> - inspecoes/index.tsx — useCallback no renderItem + React.memo (InspecaoCard)
> - inspecoes/index.tsx — FlatList com removeClippedSubviews, maxToRenderPerBatch=10
>
> Sessão 11 (Março 2026): Schema fixes + Mapa branco + Segurança Supabase + Dados de teste.
> **Correções de schema:**
> - form-editor.tsx — criado_por_uid → criadoPorUid (2 lugares: criar + duplicar)
> - editor-perguntas.tsx — round-trip classificacao + tipoCalculo (SELECT + save preserva ambos)
> - wizard.tsx — SELECT inclui fases + tipoCalculo; prefere fases[] quando presente
>
> **Bug mapa tela branca (CORRIGIDO):**
> - Causa raiz: `source={{ html, baseUrl }}` chama `loadDataWithBaseURL()` no Android → falha silenciosa com HTML longo ou Unicode
> - Fix: `source={{ uri: 'data:text/html;charset=utf-8,' + encodeURIComponent(html) }}` usa `loadUrl()` internamente
> - Adicionado: startInLoadingState + spinner renderLoading, backgroundColor no style
> - Scripts Leaflet carregam dinamicamente com onload/onerror; window.onerror captura erros JS
> - react-native-webview REMOVIDO do plugins array (não tem app.plugin.js → PluginError)
> - react-native-webview@13.16.1 reinstalado com --legacy-peer-deps (canary peer conflict)
>
> **Segurança Supabase (migração fix_security_advisors aplicada):**
> - `notifications` view: SECURITY DEFINER → security_invoker = true
> - `notif_update_lida` RLS: WITH CHECK(true) → WITH CHECK(destinatario_uid = auth.uid())
> - `is_approved()` function: adicionado SET search_path = public
>
> **Dados de teste inseridos:**
> - 15 vistorias em Cataguases-MG com coordenadas reais
> - Distribuição: R4×3, R3×4, R2×5, R1×3 — datas entre 1-28 dias atrás
> - formularioId: estrutural_v1, deslizamento_campo_v1, inundacao_v1 (built-in assets)

> Sessão 9 (Março 2026): Phase 5 (Segurança) + Phase 6 (Testes/CI) do PDR.
> **Phase 5 — Segurança Reforçada:**
> - gerar-token.tsx — token 12 chars XXXX-XXXX-XXXX (32^12 ≈ 1.2×10^18 combos, sem ambiguidades 0/O/1/I)
> - register.tsx — normaliza token (remove espaços), regex email, senha 8+ chars com letras+números
> - logger.ts — sanitize(): SENSITIVE_KEYS redactados, tokens XXXX-XXXX-XXXX mascarados em strings
> - mapas.tsx — CSP meta tag no HTML do Leaflet (restringe script-src, img-src, default-src)
> - utils/auditLogger.ts — NOVO: fire-and-forget para tabela audit_logs no Supabase
> - usuarios.tsx — registrarAuditoria() em aprovar/bloquear usuário
> - gerar-token.tsx — registrarAuditoria() ao gerar token
> - form-editor.tsx — registrarAuditoria() em criar/publicar/despublicar/excluir formulário
> **Phase 6 — Testes e CI/CD:**
> - package.json — jest-expo, @testing-library/react-native, scripts test/test:watch/test:coverage
> - utils/__tests__/database.test.ts — testes: singleton getDb, VistoriaLocal shape, FormularioCache
> - utils/__tests__/logger.test.ts — testes: sanitização (password/token redactados, dados normais preservados)
> - utils/__tests__/risco.test.ts — testes: calcularNivelRisco() fallback + limites do JSON (18 casos)
> - services/__tests__/SyncService.test.ts — testes: sem pendentes, sucesso, tentativas esgotadas, concorrência
> - .github/workflows/ci.yml — GitHub Actions: tsc --noEmit + jest --coverage
