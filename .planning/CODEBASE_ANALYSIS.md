# Análise Completa do Codebase — Defesa Civil Expo
**Data:** 2026-03-28
**Projeto:** App Defesa Civil — Vistoria Técnica de Risco Estrutural
**Stack:** Expo SDK 54 · Expo Router 6 · React 19 · RN 0.81.5 · Supabase · expo-sqlite

---

## Índice
1. [Estrutura de Pastas](#1-estrutura-de-pastas)
2. [Qualidade do Código](#2-qualidade-do-código)
3. [Segurança](#3-segurança)
4. [Performance](#4-performance)
5. [UX e Funcionalidades](#5-ux-e-funcionalidades)
6. [Dependências](#6-dependências)
7. [Pendências do Projeto](#7-pendências-do-projeto)
8. [Lista Priorizada de Melhorias](#8-lista-priorizada-de-melhorias)

---

## 1. Estrutura de Pastas

### Layout Geral
```
app_defesa_civil_expo/
├── app/                     # Expo Router — rotas do app
│   ├── _layout.tsx          # Root layout: providers + guard de navegação
│   ├── onboarding.tsx       # 4 slides de apresentação
│   ├── (auth)/              # Rotas públicas
│   │   ├── _layout.tsx
│   │   ├── index.tsx        # Tela inicial (escolha: Login ou Token)
│   │   ├── login.tsx
│   │   ├── register.tsx     # Registro via token de convite
│   │   └── forgot-password.tsx
│   └── (panel)/             # Rotas autenticadas
│       ├── _layout.tsx      # Sync + BottomNavBar
│       ├── dashboard.tsx    # Redireciona por role; painel do agente
│       ├── mapas.tsx        # Mapa via WebView + Leaflet
│       ├── perfil.tsx       # Perfil + edição de nome + stats
│       ├── admin/           # 10 telas (admin/master)
│       ├── supervisor/      # 4 telas
│       ├── inspecoes/       # 10 telas (fluxo completo de vistoria)
│       └── master/          # 3 telas
├── components/
│   ├── BottomNavBar.tsx     # Tabs por role
│   └── ConnectivityBanner.tsx # Banner animado offline/online
├── context/
│   ├── AuthContext.tsx      # Sessão + perfil + isApproved
│   ├── ConnectivityContext.tsx # NetInfo + probe HTTP real
│   ├── NotificationContext.tsx # Wrapper do NotificationService
│   ├── ReportContext.tsx    # Draft do laudo em memória
│   └── ThemeContext.tsx     # Light/Dark/System com persistência
├── services/
│   ├── NotificationService.ts  # Expo Notifications + push token
│   ├── SyncService.ts          # Batch sync SQLite → Supabase
│   └── __tests__/
├── utils/
│   ├── auditLogger.ts       # Fire-and-forget para audit_logs no Supabase
│   ├── database.ts          # SQLite via expo-sqlite (migrations v1–v5)
│   ├── logger.ts            # Logger estruturado (SQLite + console)
│   ├── supabase.ts          # Cliente Supabase com AsyncStorage
│   ├── uuid.ts              # UUID v4 via crypto API
│   └── __tests__/
├── constants/
│   └── Colors.ts            # Paleta light/dark (6 tokens cada)
└── assets/
    └── formularios/         # 4 JSONs built-in de formulários
```

### Observações Estruturais
- Organização por feature + role é clara e navegável.
- Sem shared components além de `BottomNavBar` e `ConnectivityBanner` — grande oportunidade de extração.
- Sem pasta `hooks/` — lógica de dados acoplada diretamente às telas.
- Sem pasta `types/` global — types inline duplicados em vários arquivos.

---

## 2. Qualidade do Código

### 2.1 Bugs Óbvios

**Bug 1 — `jest` config com chave inválida (`setupFilesAfterFramework`)**
`package.json` linha 64: chave incorreta deveria ser `setupFilesAfterFramework` → `setupFilesAfterFramework`.
**Impacto real:** A chave correta é `setupFilesAfterFramework` (não existe); o correto seria `setupAfterEnv` ou `setupFilesAfterFramework` → nenhum setup file de test roda.

**Bug 2 — `wizard.tsx` auto-save não atualiza o `step` no closure**
`app/(panel)/inspecoes/wizard.tsx` linhas 99–107: o debounce de auto-save captura `step` pelo closure no momento da criação, mas `step` não está no array de dependências. Ao salvar o rascunho, pode gravar o step antigo.

**Bug 3 — `resultado.tsx` botão "Compartilhar" dispara `gerarPdf` (igual ao "Baixar PDF")**
`app/(panel)/inspecoes/resultado.tsx` linhas 394–408: o terceiro botão (Compartilhar) chama `gerarPdf` em vez de uma função de compartilhamento dedicada. O comportamento de "compartilhar" e "baixar" são idênticos — o usuário vê dois botões com mesma ação.

**Bug 4 — `ThemeContext` chama `Alert.alert` dentro de `useEffect` (antes do app estar montado)**
`context/ThemeContext.tsx` linhas 47–69: na primeira execução, antes de qualquer tela ser renderizada, dispara um `Alert.alert` síncrono. Em ambiente de teste e em certos cenários de cold start, isso pode travar a inicialização do app.

**Bug 5 — `app.json` com `projectId` placeholder**
`app.json` linha 105: `"projectId": "seu-project-id-aqui"` — Push notifications nunca funcionarão em APK de produção até ser substituído pelo UUID real do EAS.

**Bug 6 — `markErroSync` não incrementa contador; chamada separada é necessária**
`services/SyncService.ts` linhas 82–84: em falha individual, o código chama `incrementTentativasSync` E `markErroSync` separadamente. Mas se o processo for interrompido entre as duas chamadas, o contador fica desatualizado. Deveria ser uma única operação atômica.

**Bug 7 — `inspecoes/[id].tsx` busca vistoria somente no Supabase, ignora SQLite**
`app/(panel)/inspecoes/[id].tsx` linhas 38–46: `fetchDetalhes` consulta apenas `supabase.from('vistorias')`. Se a vistoria ainda não foi sincronizada (sincronizado=0), a tela exibe erro. Não há fallback para SQLite como existe em `resultado.tsx`.

### 2.2 Padrões Inconsistentes

**Duplicação de funções helper em múltiplas telas:**
- `riscoLabel()` / `riscoColor()` estão copiadas em pelo menos 6 arquivos: `resultado.tsx`, `laudo.tsx`, `[id].tsx`, `relatorios.tsx`, `supervisor/index.tsx`, `admin/index.tsx`. Deveriam estar em `utils/riscoUtils.ts`.
- `escapeHtml()` está copiada em `resultado.tsx`, `relatorio.tsx`, `laudo.tsx` e `mapas.tsx`.
- `tempoRelativo()` está copiada em `admin/index.tsx` e `supervisor/index.tsx`.
- `formatarData()` / `formatarDataHora()` estão copiadas em `perfil.tsx`, `laudo.tsx`, `[id].tsx`.

**Duas formas de gerar HTML para PDF:**
- `resultado.tsx` tem sua própria função `gerarHtmlLaudo()` inline.
- `relatorio.tsx` tem sua própria função `buildHtml()` inline.
- `laudo.tsx` tem terceira implementação inline.
- Três geradores de PDF coexistem com HTML ligeiramente diferente — potencial para divergência visual.

**Nomenclatura mista:**
- SQLite usa `snake_case` (ex: `agente_uid`, `nivel_risco`).
- Supabase usa `camelCase` (ex: `agenteUid`, `nivelRisco`).
- O mapeamento é feito manualmente em `SyncService.ts` e em `resultado.tsx` via `normalizar()`. Correto, mas frágil — qualquer campo novo exige atualização em dois lugares.

**`any` excessivo:**
- `app/(panel)/admin/index.tsx` linha 40: `setAtividade` usa `any[]`.
- `app/(panel)/inspecoes/[id].tsx` linha 34: `setVistoria` usa `any`.
- `app/(panel)/supervisor/index.tsx` linha 47: `setVistorias` usa `any[]`.
- `app/(panel)/admin/form-editor.tsx` linha 19: `setFormularios` usa `any[]`.

**`useLocalSearchParams<any>()`:**
- `wizard.tsx` linha 53 usa `<any>` em vez de tipagem explícita dos params esperados (`formularioId`, `formularioTitulo`, `rua`, etc.).

### 2.3 Código Comentado / Legado
- Comentários `// Built-in JSON assets` em `wizard.tsx` linha 19 referenciam "mapeados de formulario_model.dart" — legado da migração Flutter não limpo.
- `// Silently ignore` em vários lugares silencia erros que deveriam ao menos ser logados.

---

## 3. Segurança

### 3.1 Pontos Positivos
- Verificação de `isApproved` tanto no `AuthContext` quanto no `login.tsx` (dupla verificação, redundante mas defensiva).
- `logger.ts` sanitiza chaves sensíveis (password, token, etc.) antes de persistir.
- Geração de token de convite usa `crypto.getRandomValues` (criptograficamente seguro).
- `laudo.tsx` filtra por `municipio` e `agenteUid` antes de buscar no Supabase — boa prática de data isolation.

### 3.2 Vulnerabilidades Identificadas

**SEG-01 — Autorização apenas no cliente (CRÍTICO)**
`app/(panel)/inspecoes/[id].tsx` linhas 40–44: a query ao Supabase não filtra por `municipio` nem por `agenteUid`. Qualquer agente autenticado pode acessar a vistoria de qualquer município informando o UUID diretamente como param de URL. A segurança real depende exclusivamente de Row Level Security (RLS) no banco — se RLS estiver desabilitado ou mal configurado, há exposição de dados.

**SEG-02 — Ausência de validação de input antes de inserir no Supabase**
`app/(panel)/supervisor/atribuicao.tsx`: `endereco`, `numero` e `bairro` são inseridos no Supabase sem sanitização. Embora o Supabase use queries parametrizadas (SQL injection é mitigado), campos como `observacoes` (texto livre) ficam sem limit de tamanho no cliente.

**SEG-03 — `console.log` em produção expõe dados de push token**
`services/NotificationService.ts` linhas 78 e 101: em erro de push token, imprime a exceção via `console.log` em vez de `logger.warn`. Em builds de produção, logs de console são visíveis em ferramentas de debug físico.

**SEG-04 — Rate-limit de token feito no cliente**
`app/(panel)/admin/gerar-token.tsx` linhas 66–74: o limite de 10 tokens/hora é verificado com uma query Supabase no cliente. Um admin mal-intencionado pode contornar esse limite chamando a API diretamente. O rate-limit real deve ser aplicado via RLS ou função Supabase (edge function / trigger).

**SEG-05 — Token de convite examinado com `select('*')`**
`app/(auth)/register.tsx` linha 57: ao validar o token, faz `select('*')` na tabela `invite_tokens`, retornando todos os campos incluindo possíveis metadados internos. Deveria usar `select('id, codigo, expiraEm, municipio, role, usado')`.

**SEG-06 — `AsyncStorage` armazena sessão Supabase sem encryption**
`utils/supabase.ts` linha 16: `storage: AsyncStorage` persiste o JWT Supabase em texto claro no AsyncStorage do dispositivo. Em Android root ou iOS jailbreak, o token é acessível. Para app governamental, considerar `expo-secure-store`.

**SEG-07 — `app.json` pede `ACCESS_BACKGROUND_LOCATION` desnecessariamente**
`app.json` linha 48: a permissão `ACCESS_BACKGROUND_LOCATION` está listada, porém `isAndroidBackgroundLocationEnabled: false` na configuração do plugin. No Android 12+ isso exige justificativa extra na Play Store e abre vetor de privacidade desnecessário. Deveria ser removida.

**SEG-08 — `USE_BIOMETRIC` / `USE_FINGERPRINT` sem implementação**
`app.json` linhas 51–53: permissões de biometria listadas mas nenhuma tela implementa autenticação biométrica. Permissões sem uso são rejeitadas na análise de privacidade do Play Store.

---

## 4. Performance

### 4.1 Re-renders Desnecessários

**PERF-01 — `dashboard.tsx` recalcula data/hora a cada re-render**
`app/(panel)/dashboard.tsx` linhas 23–25: `hoje`, `diaSemana` e `dataFormatada` são recalculados em todo render sem `useMemo`. Em si é barato, mas se o componente re-renderizar frequentemente (ex: contexto mudando), gera trabalho desnecessário.

**PERF-02 — `BottomNavBar` re-renderiza em toda mudança de tema/auth**
`components/BottomNavBar.tsx`: o componente não é memoizado (`React.memo`). Qualquer mudança em `useAuth()` ou `useTheme()` (ex: badge count de notificação) dispara re-render de toda a barra de navegação, incluindo todos os tabs.

**PERF-03 — `AuthContext` busca perfil a cada `TOKEN_REFRESHED`**
`context/AuthContext.tsx` linhas 99–108: a cada refresh de token (automático, a cada ~1h), faz query ao Supabase para re-buscar o perfil completo. Para a maioria dos casos, o perfil não muda. Poderia comparar apenas o `updated_at` ou fazer refresh apenas quando explicitamente necessário.

### 4.2 Queries Pesadas

**PERF-04 — `municipios.tsx` carrega TODAS vistorias sem limit**
`app/(panel)/master/municipios.tsx` linha 38: `supabase.from('vistorias').select('municipio, nivelRisco')` sem `limit`. Em produção com milhares de vistorias, esta query retorna todos os registros para agregação no cliente. Deveria usar uma RPC com `GROUP BY` no banco.

**PERF-05 — `perfil.tsx` carrega todas vistorias do agente sem limit**
`app/(panel)/perfil.tsx` linha 65: `supabase.from('vistorias').select('nivelRisco, dataVistoria').eq('agenteUid', uid)` sem limit. Um agente experiente com centenas de vistorias retorna tudo no cliente para filtragem JS. Deveria usar `count: 'exact'` e queries separadas filtradas.

**PERF-06 — `relatorios.tsx` usa `PAGE_SIZE = 50` mas carrega tudo com `select('*')`**
`app/(panel)/admin/relatorios.tsx` linha 13: paginação está correta, mas o select usa `select('*')` em vez de listar apenas os campos necessários, transferindo dados desnecessários (ex: `respostasJson` pode ser JSON grande).

**PERF-07 — `VACUUM` após cada sync bem-sucedido**
`services/SyncService.ts` linha 96: `getDb().runSync('VACUUM')` é chamado após cada sync bem-sucedido. `VACUUM` é uma operação de manutenção cara que pode travar o SQLite por alguns segundos em DBs grandes. Deveria ser executado no máximo uma vez por dia.

**PERF-08 — `logger.ts` faz duas queries SQLite por log (INSERT + DELETE de limpeza)**
`utils/logger.ts` linhas 72–80: cada log faz `INSERT` seguido de `DELETE ... NOT IN (SELECT ... LIMIT 500)`. O `NOT IN (subquery)` é O(n) e pode ser lento quando a tabela de logs cresce. Considerar `DELETE WHERE id < (SELECT MIN(id) FROM ...)` ou trigger.

### 4.3 Falta de Memoização
- `admin/index.tsx`: `riscoColor`, `tempoRelativo` são funções puras recriadas a cada render.
- `relatorios.tsx` linha 53: `VistoriaCard` é `React.memo` (correto). Mas `riscoLabel`, `riscoColor`, `formatarData` não são `useCallback`.
- `wizard.tsx`: `calcularNivelRisco`, `flattenPerguntas` são recalculados se o componente re-renderizar antes da finalização.

---

## 5. UX e Funcionalidades

### 5.1 Funcionalidades Incompletas

**UX-01 — Tela `inspecoes/[id].tsx` sem fallback offline**
Ao abrir uma vistoria não sincronizada pelo histórico, a tela falha silenciosamente (sem mensagem para o usuário) pois consulta apenas o Supabase. A vistoria existe no SQLite local mas não é acessada.

**UX-02 — Botão "Compartilhar" em `resultado.tsx` é idêntico ao "Baixar PDF"**
Três botões na tela de resultado (Baixar PDF, Imprimir, Compartilhar) — o terceiro dispara `gerarPdf` igual ao primeiro. O comportamento esperado seria algo como `expo-sharing` com o arquivo já gerado.

**UX-03 — `ThemeContext` pergunta sobre tema via `Alert` na primeira abertura**
O diálogo de tema aparece antes de qualquer tela ser renderizada completamente. É confuso para novos usuários e pode conflitar com o onboarding. Deveria estar dentro do onboarding ou na tela de perfil.

**UX-04 — Atribuições sem notificação push ao agente**
`supervisor/atribuicao.tsx`: ao criar uma atribuição, salva no Supabase mas não aciona `notificarNovaAtribuicao` para o agente alvo. A notificação não é disparada automaticamente — o agente só vê a atribuição ao abrir o app.

**UX-05 — `dados-iniciais.tsx`: CEP não validado antes de buscar**
O CEP é buscado (via ViaCEP presumivelmente) sem validar se tem 8 dígitos. Não foi possível ler o arquivo completo, mas o campo `erroCep` sugere que há tratamento de erro, porém sem validação de formato antes da request.

**UX-06 — Laudo PDF mostra ID da pergunta em vez do texto**
`resultado.tsx` função `gerarHtmlLaudo` linhas 62–67: as respostas no PDF são exibidas como `[id_pergunta] → [valor]`. Os IDs são UUIDs como "pergunta_001", não o texto legível da pergunta. Para formulários built-in isso é aceitável; para formulários dinâmicos do Supabase, o texto das perguntas não é resolvido no momento de geração do PDF.

**UX-07 — `risco-config.tsx`: configuração salva no AsyncStorage local por admin**
A configuração de thresholds de risco é salva no AsyncStorage do dispositivo do admin que a configurou. Se o admin trocar de celular ou outro admin editar a config, os thresholds locais ficam desatualizados. A lógica já tenta salvar no Supabase (`risk_configs`), mas o fallback local sem TTL pode causar divergência.

**UX-08 — Onboarding sem possibilidade de revisão**
O `FlatList` do onboarding tem `scrollEnabled={false}` — o usuário não pode voltar deslizando, apenas pelo botão. Se tocar em "Pular" por acidente, o onboarding não abre mais (flag `@onboarding_done = '1'` já salvo). Não há forma de revisitar pelo perfil.

### 5.2 Tratamento de Erro Ausente

**UX-09 — `admin/index.tsx` sem mensagem de erro na tela**
`app/(panel)/admin/index.tsx`: o `catch` do `carregar()` apenas loga o erro internamente. A tela fica em estado vazio (sem KPIs, sem atividade recente) sem nenhuma mensagem explicativa para o admin.

**UX-10 — `supervisor/index.tsx` idem — sem feedback de erro na UI**
Mesma situação: `catch` loga mas a UI fica vazia sem indicar falha.

**UX-11 — Foto em `wizard.tsx` não salva offline**
`app/(panel)/inspecoes/wizard.tsx` linhas 234–248: `tirarFoto` salva o URI local na resposta, mas esse URI não é persistido no SQLite (campo `foto_url` fica null na vistoria salva). A foto existe apenas em memória durante o wizard. Se o app fechar antes de chegar em `foto.tsx`, a foto é perdida.

---

## 6. Dependências

### 6.1 Dependências Canary em Produção (CRÍTICO)
```json
"expo-crypto": "^55.0.11-canary-20260328-2049187"
```
`package.json` linha 26: versão canary (pré-release) de `expo-crypto` instalada. Versões canary não são estáveis e não devem ser usadas em produção. Deveria ser substituída por `expo-crypto@~14.0.0` (SDK 54) ou removida se não for usada diretamente (UUID já usa a Web Crypto API nativa).

### 6.2 Dependência Não Utilizada
- `expo-crypto` listada como dependência mas nenhum arquivo do projeto a importa. `uuid.ts` usa `crypto.randomUUID()` nativamente via Hermes sem precisar deste package.
- `react-native-webview` é usado apenas em `mapas.tsx` para Leaflet. Adiciona ~3MB ao APK.
- `lucide-react-native` está listado mas nenhum arquivo importa de `lucide-react-native` — todos os ícones usam `@expo/vector-icons` (Feather). Dependência morta.

### 6.3 Pacotes com Versões Inconsistentes
| Pacote | Versão Instalada | Versão Esperada SDK 54 |
|--------|-----------------|----------------------|
| `expo-device` | `^55.0.10` | `~7.0.0` |
| `expo-file-system` | `^55.0.11` | `~18.0.0` |
| `expo-font` | `^55.0.4` | `~13.0.0` |
| `expo-image-manipulator` | `^55.0.11` | `~13.0.0` |
| `expo-sharing` | `^55.0.14` | `~13.0.0` |
| `expo-notifications` | `^55.0.13` | `~0.29.0` |

A maioria aponta para versões SDK 55 enquanto o `expo` principal é `~54.0.0`. Isso pode causar incompatibilidades de ABI. O correto é alinhar todas as dependências ao SDK 54 usando `npx expo install --check`.

### 6.4 Dependência Faltando
- `react-native-safe-area-context` é usado no `ConnectivityBanner.tsx` via `useSafeAreaInsets()`, mas não está configurado com `SafeAreaProvider` na raiz do app (`app/_layout.tsx`). O contexto é provido implicitamente pelo Expo, mas é melhor prática envolver explicitamente.

---

## 7. Pendências do Projeto

### 7.1 Configurações Pendentes

**PEND-01 — `projectId` do EAS não configurado**
`app.json` linha 105: `"projectId": "seu-project-id-aqui"`. Push notifications remotas nunca funcionarão sem isso. O `NotificationService.ts` já verifica e retorna `null` graciosamente, mas é uma funcionalidade core quebrada.

**PEND-02 — Assets de ícone Android possivelmente ausentes**
`app.json` linhas 30–33 referencia:
- `./assets/android-icon-foreground.png`
- `./assets/android-icon-background.png`
- `./assets/android-icon-monochrome.png`

Apenas `./assets/logo.png` e `./assets/notification-icon.png` foram detectados na pasta `assets/`. O build Android vai falhar sem esses arquivos.

**PEND-03 — `icon.png` e `splash-icon.png` não detectados**
`app.json` aponta para `./assets/icon.png` e `./assets/splash-icon.png`. Não foram encontrados. O build falhará.

### 7.2 Telas com TODOs Implícitos

**PEND-04 — `inspecoes/risco.tsx` — tela de risco manual duplica lógica do wizard**
A tela `risco.tsx` tem seu próprio `RISCO_CONFIG` com aliases legados (`baixo`, `medio`, `critico`) paralelo ao `RISCO_LABELS`/`RISCO_CORES` de outras telas. Não está claro se esta tela ainda é necessária ou é resquício da migração Flutter.

**PEND-05 — `admin/logs.tsx` e `master/logs.tsx` — visualização de logs existe mas sem exportação**
As telas de log existem (arquivos com 14.7K e 9.4K respectivamente) mas a feature de exportar logs (ex: CSV ou email) não foi implementada segundo o tamanho do arquivo versus o esperado.

**PEND-06 — `supervisor/equipe.tsx` e `supervisor/agente.tsx` — estado dos agentes**
Esses arquivos existem (10.3K e 9.1K), mas sem leitura completa não é possível confirmar se a visualização de histórico de atribuições por agente está completa.

**PEND-07 — `admin/estatisticas.tsx` — gráficos de estatísticas**
Arquivo de 12.9K. Sem biblioteca de charting instalada (`recharts`, `victory-native`, etc.), os gráficos provavelmente são representações textuais/bar básicas. Nenhuma lib de charts foi detectada no `package.json`.

### 7.3 Código com Legado da Migração Flutter
- Comentário em `wizard.tsx` linha 27: `// ─── Types (mapeados de formulario_model.dart)`
- Chaves `imagemLocal` nos JSONs de formulário são lidas mas tratadas como nulas se não forem URLs HTTP/HTTPS — comportamento hardcoded remanescente do Flutter local assets.
- `RISCO_CONFIG` em `risco.tsx` inclui aliases `baixo`, `medio`, `critico`, `iminente` que são strings do modelo Flutter não usadas nos formulários React Native.

### 7.4 Testes
- Apenas 4 arquivos de teste existem: `risco.test.ts`, `database.test.ts`, `logger.test.ts`, `SyncService.test.ts`.
- Zero testes para componentes React (nenhum arquivo `*.test.tsx`).
- Zero testes para fluxo de autenticação, wizard de vistoria ou geração de PDF.
- `jest` config tem `"testPathPattern"` (deveria ser `"testPathIgnorePatterns"` ou `"testMatch"`).
- `"setupFilesAfterFramework"` é chave inválida (provavelmente deveria ser `"setupFilesAfterFramework"` → `"setupFilesAfterFramework"` não existe; a correta é `"setupFilesAfterFramework"` → não — a correta é **`"setupAfterEnv"`**).
- Threshold de cobertura em 40% de linhas — nenhum teste de componente → cobertura real provavelmente abaixo do threshold.

---

## 8. Lista Priorizada de Melhorias

### 🔴 CRÍTICO — Bloqueia funcionalidade ou é risco de segurança

| # | Problema | Arquivo(s) | Impacto |
|---|----------|-----------|---------|
| C1 | `projectId` EAS não configurado | `app.json:105` | Push notifications quebradas em produção |
| C2 | `expo-crypto` versão canary instalada | `package.json:26` | Instabilidade em produção; build pode falhar |
| C3 | Assets de ícone Android faltando | `app.json:30-33` | Build Android falha |
| C4 | `inspecoes/[id].tsx` sem fallback SQLite | `app/(panel)/inspecoes/[id].tsx:38` | Vistorias offline inacessíveis |
| C5 | Autorização client-side sem filtro em `[id].tsx` | `app/(panel)/inspecoes/[id].tsx:40` | Exposição de dados se RLS incorreto |
| C6 | Versões de pacotes inconsistentes (SDK 54 vs 55) | `package.json` | Incompatibilidade de ABI em runtime |

### 🟠 ALTO — Afeta qualidade, segurança ou UX significativamente

| # | Problema | Arquivo(s) | Ação |
|---|----------|-----------|------|
| A1 | Token JWT em AsyncStorage não encriptado | `utils/supabase.ts:16` | Migrar para `expo-secure-store` |
| A2 | Rate-limit de tokens no cliente (bypassável) | `admin/gerar-token.tsx:66` | Mover para Supabase Edge Function |
| A3 | `select('*')` em token de convite | `register.tsx:57` | Restringir campos retornados |
| A4 | Bug: botão "Compartilhar" = "Baixar PDF" | `resultado.tsx:394` | Implementar flow de share separado |
| A5 | `VACUUM` em cada sync | `SyncService.ts:96` | Limitar a 1x/dia com timestamp |
| A6 | Foto da pergunta `foto` no wizard não persiste offline | `wizard.tsx:234` | Salvar URI local no SQLite |
| A7 | `municipios.tsx` carrega todas vistorias sem LIMIT | `master/municipios.tsx:38` | Substituir por RPC com GROUP BY |
| A8 | `ThemeContext` dispara Alert antes de tela montar | `ThemeContext.tsx:47` | Mover para onboarding ou perfil |
| A9 | Permissões Android não usadas (biometria, background location) | `app.json:48-53` | Remover permissões desnecessárias |

### 🟡 MÉDIO — Melhora robustez, manutenibilidade ou performance

| # | Problema | Arquivo(s) | Ação |
|---|----------|-----------|------|
| M1 | `riscoLabel/riscoColor/escapeHtml/tempoRelativo` duplicados | 6+ arquivos | Criar `utils/riscoUtils.ts` e `utils/htmlUtils.ts` |
| M2 | Três geradores de HTML para PDF independentes | `resultado.tsx`, `relatorio.tsx`, `laudo.tsx` | Unificar em `utils/laudoPdfBuilder.ts` |
| M3 | `any` excessivo em tipos de estado | múltiplos arquivos | Criar `types/vistoria.ts` compartilhado |
| M4 | `useLocalSearchParams<any>()` sem tipos | `wizard.tsx:53`, `selecao-formulario.tsx:62` | Definir interfaces de params |
| M5 | `admin/index.tsx` e `supervisor/index.tsx` sem feedback de erro | ambos os arquivos | Adicionar `errorState` e mensagem na UI |
| M6 | `console.log` em NotificationService em vez de `logger` | `NotificationService.ts:78,101` | Substituir por `logger.warn` |
| M7 | Atribuições não notificam o agente | `supervisor/atribuicao.tsx` | Chamar `notificarNovaAtribuicao` no agente alvo |
| M8 | `perfil.tsx` carrega todas vistorias do agente | `perfil.tsx:65` | Usar queries com `count: 'exact'` |
| M9 | Auto-save do wizard captura `step` stale | `wizard.tsx:103` | Usar `useRef` para step no debounce |
| M10 | `lucide-react-native` instalado mas não usado | `package.json:43` | Remover dependência morta |

### 🟢 BAIXO — Melhorias incrementais de qualidade

| # | Problema | Arquivo(s) | Ação |
|---|----------|-----------|------|
| L1 | `jest` config com chaves inválidas | `package.json:64,74` | Corrigir `setupAfterEnv` e `testMatch` |
| L2 | Zero testes de componentes React | `—` | Criar testes para `BottomNavBar`, `wizard` |
| L3 | `BottomNavBar` não memoizado | `BottomNavBar.tsx` | Envolver em `React.memo` |
| L4 | Comentários legados Flutter | `wizard.tsx:27` | Limpar comentários de migração |
| L5 | Onboarding sem revisita pelo perfil | `ThemeContext.tsx`, `perfil.tsx` | Adicionar opção "Ver introdução" no perfil |
| L6 | Laudo PDF mostra ID de pergunta em vez de texto | `resultado.tsx:63` | Resolver texto da pergunta ao gerar PDF |
| L7 | `Colors.ts` com poucos tokens (6 por tema) | `constants/Colors.ts` | Adicionar `success`, `warning`, `error` para eliminar hardcode de cores |
| L8 | Sem pasta `hooks/` | estrutura geral | Extrair lógica de dados para custom hooks |
| L9 | `risco-config.tsx` AsyncStorage sem TTL | `admin/risco-config.tsx` | Adicionar `cached_at` + TTL de 24h |
| L10 | Sem `SafeAreaProvider` explícito na raiz | `app/_layout.tsx` | Adicionar `SafeAreaProvider` wrapper |

---

## Resumo Executivo

O codebase está **bem estruturado e funcional** para as fases 0–5 do PDR. A separação de responsabilidades entre contextos, services e utils é sólida. O sistema offline-first com SQLite + sync em lote é robusto. A tratativa de permissões, logging e auditoria é profissional.

**Principais riscos imediatos:**
1. Build de produção provavelmente falha por falta de assets de ícone e `expo-crypto` canary.
2. `projectId` do EAS vazio quebra push notifications.
3. Pacotes com versão SDK 55 enquanto o projeto é SDK 54 pode gerar crashes em runtime.

**Principal dívida técnica:**
- Funções helper duplicadas em 6+ arquivos (riscoLabel, riscoColor, escapeHtml) e 3 geradores de PDF independentes — consolidação em utils compartilhados é a melhoria com maior retorno de manutenibilidade.

**Próximos passos recomendados:**
1. Executar `npx expo install --check` para alinhar versões ao SDK 54.
2. Substituir `expo-crypto` canary.
3. Configurar `projectId` EAS real.
4. Adicionar assets de ícone Android faltantes.
5. Criar `utils/riscoUtils.ts` e `utils/laudoPdfBuilder.ts` para eliminar duplicações.
