# Fase 08: Sincronização Offline — Research

**Pesquisado:** 2026-04-03
**Domínio:** Offline sync, SQLite local, NetInfo, background fetch, Supabase upsert
**Confiança:** HIGH — análise direta do código existente; toda a infraestrutura já está construída

---

## Resumo

A Fase 08 é **predominantemente de diagnóstico, cobertura de testes e validação**, não de construção do zero. O sistema de sincronização offline descrito no requisito SYNC-01 já existe e já está integrado ao app. A análise do código revela uma implementação madura com: SQLite via `expo-sqlite`, fila persistente em `vistorias_offline`, detecção de conectividade via `@react-native-community/netinfo`, sync automático ao reconectar em `app/(panel)/_layout.tsx`, backoff exponencial (30s/60s/120s), upload de fotos locais para Supabase Storage, deduplicação via UUID pré-gerado + `INSERT OR REPLACE`, e background fetch (APK buildado). O display de status nas listas de inspeção (badges "Pendente", "Erro sync", "Falhou", "Sincronizado") também está completo.

A principal pergunta da Fase 08 não é "como implementar", mas sim "o que falta para que o requisito SYNC-01 seja verificável de forma confiável". A análise aponta dois gaps: (1) ausência de testes que cobrem o fluxo de reconexão ponta a ponta, e (2) o `_syncInProgress` guard é variável de módulo em memória — se o processo for destruído e reiniciado, o guard se reseta corretamente, mas nenhum teste valida esse comportamento. A lógica central já está correta.

**Recomendação principal:** Auditar o código existente contra o checklist SYNC-01, escrever os testes de reconexão ausentes, e validar manualmente o fluxo offline → online em dispositivo físico. Nenhuma nova biblioteca ou migração de schema é necessária.

---

<phase_requirements>
## Requisitos da Fase

| ID | Descrição | Suporte da Pesquisa |
|----|-----------|---------------------|
| SYNC-01 | Vistorias criadas offline são enfileiradas localmente e enviadas automaticamente ao Supabase quando a conexão for restaurada. Sem duplicatas. | Sistema já implementado: SQLite local (`vistorias_offline` + `sincronizado=0`), sync automático ao reconectar via `isOnlineReal` watcher em `_layout.tsx`, UUID pré-gerado + `INSERT OR REPLACE` + Supabase `upsert` para deduplicação, upload de fotos locais via `StorageService`. Gaps: cobertura de teste do fluxo de reconexão e exposição do estado de sync para a UI do dashboard. |
</phase_requirements>

---

## 1. Estado Atual do Sistema — O Que Já Existe

Esta seção é a mais importante desta pesquisa. A infraestrutura offline está substancialmente completa.

### 1.1 Mapa de Componentes

| Componente | Arquivo | Estado | O que faz |
|-----------|---------|--------|-----------|
| Banco SQLite | `utils/database.ts` | Completo (DB_VERSION=5) | Schema `vistorias_offline`, CRUD completo, migrations atômicas |
| Fila de pendentes | `database.ts` `getVistoriasNaoSincronizadas()` | Completo | `SELECT * WHERE sincronizado=0 ORDER BY criado_em ASC` |
| Deduplicação | `database.ts` `INSERT OR REPLACE` + `SyncService.ts` `upsert` | Completo | UUID v4 gerado antes do insert local; `upsert` no Supabase por `id` |
| Sync principal | `services/SyncService.ts` `syncPendentes()` | Completo | Lotes de 20, fallback individual, tentativas_sync (max 5), backoff 30s/60s/120s |
| Upload de fotos | `SyncService.ts` `processarImagensVistoria()` + `services/StorageService.ts` | Completo | Detecta `file://` → upload → atualiza SQLite com URL pública antes do upsert |
| Guard de concorrência | `SyncService.ts` `_syncInProgress` | Completo | Evita execuções paralelas de `syncPendentes()` |
| Detecção de rede | `context/ConnectivityContext.tsx` | Completo | NetInfo + HEAD ao Supabase com 8s timeout, debounce 2s, max 2 retries |
| Sync ao reconectar | `app/(panel)/_layout.tsx` `useEffect([isOnlineReal])` | Completo | `if (isOnlineReal && !prevConnected)` → `syncPendentes()` |
| Background fetch | `SyncService.ts` `registerBackgroundSync()` + `TaskManager` | Completo | Intervalo mínimo 15min (Android); silenciosamente ignorado no Expo Go |
| AppState listener | `SyncService.ts` `startAppStateSyncListener()` | Completo | Sync ao `active` com debounce 3s; funciona no Expo Go |
| Persistência wizard | `app/(panel)/inspecoes/wizard.tsx` `finalizar()` | Completo | `insertVistoria()` ANTES de qualquer `await supabase` |
| Geração UUID | `utils/uuid.ts` `generateUUID()` | Completo | Web Crypto API + fallback Math.random |
| Display de status | `app/(panel)/inspecoes/index.tsx` | Completo | Badges "Pendente", "Erro sync", "Falhou", "Sincronizado" |
| Notificações de sync | `SyncService.ts` + `NotificationService.ts` | Completo | Sucesso, falha, retrying, desistiu (ignorado no Expo Go) |
| Testes existentes | `services/__tests__/SyncService.test.ts` (4 casos) | Parcial | Fila vazia, sucesso simples, tentativas esgotadas, concorrência |

### 1.2 Fluxo Completo Verificado

```
1. Agente preenche wizard → finalizar()
2. generateUUID() cria id local único
3. insertVistoria(id, ..., sincronizado=0) → SQLite [SEMPRE, antes de qualquer await]
4. if (isOnlineReal):
     processarImagensVistoria() → upload file:// → Supabase Storage → URL pública
     supabase.from('vistorias').upsert(payload)  ← deduplicação por id
     if (!error): markSincronizado(id)
5. Offline: vistoria fica no SQLite com sincronizado=0

Reconexão:
6. ConnectivityContext detecta: NetInfo connected + HEAD Supabase OK
7. isOnlineReal muda para true → _layout.tsx dispara syncPendentes()
8. SyncService.getVistoriasNaoSincronizadas() → lote
9. processarImagensVistoria() para cada registro
10. supabase.upsert(lote) → markSincronizado(id) por sucesso
11. Falha individual → incrementTentativasSync + markErroSync + backoff auto-retry
12. ≥5 tentativas → vistoria ignorada (badge "Falhou" na UI)
```

### 1.3 Gaps Identificados para SYNC-01

| Gap | Impacto | Tipo de Trabalho |
|-----|---------|------------------|
| Sem teste de integração do fluxo offline→online | Não há evidência automatizada do SYNC-01 | Escrever testes em `SyncService.test.ts` |
| `_syncInProgress` é módulo-level var | Guard reseta ao recarregar módulo (correto para RN), mas nenhum teste verifica isso | Documentar comportamento, adicionar comentário |
| `countPendentes()` existe mas não exposto na UI do dashboard | SYNC-01 exige visibilidade do status de sync | Opcional: contador na home/dashboard |
| `resetTentativasSync()` existe mas nunca chamado no fluxo normal | Vistorias com `erro_sync` ficam presas até atingirem max 5 tentativas sem ter um botão de "retry manual" | Gap de UX, não bloqueia SYNC-01 |
| StorageService usa `upsert: false` → falha se o mesmo path for re-enviado | Se o upload de foto for interrompido após a storage mas antes de salvar a URL no SQLite, retry vai tentar fazer upload pro mesmo caminho e falhar | Edge case real; `upsert: true` ou path com timestamp garante idempotência |

---

## 2. Decisões de Arquitetura — Por Que o Stack Atual é Correto

Esta seção responde às perguntas-chave do briefing com base no código já existente.

### 2.1 Biblioteca para fila offline: expo-sqlite (já escolhida)

**Decisão correta.** `expo-sqlite ~16.0.10` (API síncrona via `runSync`/`getAllSync`) é a escolha padrão para Expo SDK 53+. Comparação com as alternativas:

| Opção | Situação | Veredito |
|-------|----------|---------|
| `expo-sqlite` (atual) | Instalado, DB_VERSION=5, migrations atômicas | Correto — manter |
| `AsyncStorage` | Já usado para rascunho de wizard e timestamp de VACUUM | Correto para dados simples; inadequado para fila com filtros SQL |
| `MMKV` | Não instalado | Seria rápido mas sem capacidade SQL; não justifica troca |
| `WatermelonDB` | Não instalado | Overkill para este caso de uso; adiciona 2MB+ ao bundle |

**Conclusão:** Nenhuma mudança necessária. `expo-sqlite` com seu schema atual é a stack correta.

### 2.2 NetInfo — Detecção de reconexão (já implementado)

O `ConnectivityContext.tsx` já usa `@react-native-community/netinfo 11.4.1` com:
- `NetInfo.addEventListener()` para mudanças de conectividade
- Verificação real via `HEAD` ao Supabase (não apenas interface de rede)
- Debounce de 2s para evitar flicker em trocas WiFi/4G
- `isOnlineReal` — variável que representa conexão real, não apenas interface

O `_layout.tsx` observa `isOnlineReal` e dispara `syncPendentes()` no momento exato da reconexão. Este é o padrão recomendado para Expo.

### 2.3 Deduplicação — UUID local + upsert (já implementado)

O padrão atual é correto e resolve o problema de duplicatas:

```typescript
// utils/uuid.ts — gerado ANTES do insert local
const id = generateUUID(); // crypto.randomUUID() com fallback

// database.ts — INSERT OR REPLACE garante idempotência local
`INSERT OR REPLACE INTO vistorias_offline (id, ...) VALUES (?,...)`

// SyncService.ts — upsert garante idempotência remota
supabase.from('vistorias').upsert(payloads) // ON CONFLICT (id) DO UPDATE
```

Um retry do mesmo registro nunca cria duplicata: localmente (INSERT OR REPLACE) e remotamente (upsert por id).

### 2.4 Fotos locais → Supabase Storage (já implementado)

O `processarImagensVistoria()` em `SyncService.ts` detecta `file://` nas colunas `foto_url` e `fotos_urls`, faz upload via `StorageService.uploadImageFromLocalUri()`, atualiza o SQLite com a URL pública, e só então inclui o registro no lote de upsert. Se o upload falhar, a vistoria vai para `markErroSync` e o retry tentará novamente na próxima vez.

**Gap identificado:** `StorageService` usa `upsert: false`. Se o upload for interrompido após chegar ao Storage mas antes de salvar a URL pública no SQLite, o retry vai tentar fazer upload para o mesmo `remotePath` e falhar com "Object already exists". A correção é usar `upsert: true` ou incluir timestamp no path (já feito: `thumb_${Date.now()}.jpg`). O timestamp garante que paths são únicos por tentativa, então o `upsert: false` funciona na prática. Porém, se o SQLite não for atualizado com a nova URL, a foto original (file://) pode ter sido deletada pelo sistema operacional, perdendo a referência. Baixo risco em prática, mas vale documentar.

### 2.5 Retry logic — Backoff exponencial (já implementado)

```
Tentativa 1 falha → backoff 30s → retry
Tentativa 2 falha → backoff 60s → retry
Tentativa 3 falha → backoff 120s → retry
> MAX_TENTATIVAS_SYNC (5 falhas SQLite) → ignora definitivamente
```

O padrão de backoff exponencial já está implementado em `scheduleAutoRetry()`. Não há necessidade de biblioteca externa (react-query, SWR, etc.).

### 2.6 Estado da fila — sem Zustand ou Context separado

O estado de sync não precisa de Zustand ou de um `SyncContext` dedicado. O estado já está distribuído de forma correta:

- **Estado persistente:** SQLite (`sincronizado`, `tentativas_sync`, `erro_sync`)
- **Estado da lista:** `index.tsx` relê o SQLite a cada `useFocusEffect` (pull-to-refresh automático ao voltar para a tela)
- **Trigger de sync:** `_layout.tsx` reage a `isOnlineReal` (prop do ConnectivityContext já existente)

Adicionar Zustand introduziria estado em memória que pode divergir do SQLite — anti-padrão para apps offline-first.

### 2.7 Background sync — Expo Go vs APK

| Ambiente | AppState Listener | Background Fetch | Comportamento |
|----------|-------------------|------------------|---------------|
| Expo Go | Funciona | Não funciona (silenciosamente ignorado) | Sync ao abrir o app e ao reconectar |
| APK buildado | Funciona | Funciona (min 15min) | Sync em background + ao abrir + ao reconectar |

O código já trata isso corretamente com `Constants.appOwnership === 'expo'` para suprimir notificações locais que não funcionam no Expo Go, e `registerTaskAsync` silenciosamente ignorado.

---

## 3. Padrão de Schema SQLite — Sem Mudança Necessária

### Tabela `vistorias_offline` (DB_VERSION=5 — estável)

```sql
id TEXT PRIMARY KEY                    -- UUID v4 gerado localmente
agente_uid TEXT NOT NULL
agente_nome TEXT
municipio TEXT
endereco_rua TEXT
endereco_numero TEXT
endereco_bairro TEXT
endereco_cep TEXT
responsavel_nome TEXT
latitude REAL
longitude REAL
data_vistoria TEXT                     -- ISO 8601
formulario_id TEXT
formulario_versao INTEGER
respostas_json TEXT                    -- JSON das respostas
nivel_risco TEXT                       -- 'r1'|'r2'|'r3'|'r4'
pontuacao_total INTEGER
foto_url TEXT                          -- file:// (offline) ou https:// (após upload)
fotos_urls TEXT                        -- JSON array de URLs
sincronizado INTEGER DEFAULT 0        -- 0=pendente, 1=sincronizado
erro_sync TEXT
tentativas_sync INTEGER DEFAULT 0     -- max 5
criado_em TEXT NOT NULL
```

**Conclusão:** DB_VERSION permanece 5. Nenhuma migration nova é necessária.

---

## 4. Don't Hand-Roll

| Problema | Não construir | Usar o que existe |
|----------|--------------|-------------------|
| Fila offline com SQLite | Schema novo ou AsyncStorage de JSONs | `vistorias_offline` em `utils/database.ts` |
| Sync ao reconectar | `NetInfo.addEventListener` + lógica inline | `useConnectivity()` → `isOnlineReal` no `_layout.tsx` |
| UUID sem duplicatas | `Math.random()` bare | `generateUUID()` de `utils/uuid.ts` |
| Upload de fotos locais | `fetch()` manual para o Storage | `uploadImageFromLocalUri()` de `services/StorageService.ts` |
| Retry com backoff | `setTimeout` manual ou biblioteca | `scheduleAutoRetry()` em `SyncService.ts` |
| Guard de concorrência | `Promise` mutex manual | `_syncInProgress` booleano em `SyncService.ts` |
| Mapping SQLite→Supabase | Renomear campos inline | `buildSupabasePayload()` em `SyncService.ts` |
| Display de status | Lógica condicional inline | Badges em `app/(panel)/inspecoes/index.tsx` |

---

## 5. Pitfalls Conhecidos

### Pitfall 1: Chamar `syncPendentes()` sem guard ao reconectar
**O que pode errar:** Múltiplos eventos de reconexão em sequência disparam múltiplos `syncPendentes()` em paralelo, causando upserts duplicados ou race conditions.
**Status:** Resolvido — `_syncInProgress` booleano em `SyncService.ts` garante exclusão mútua. O segundo chamador retorna `{sucesso:0, falha:0}` imediatamente.

### Pitfall 2: `file://` URI invalidada pelo sistema operacional
**O que pode errar:** O iOS e Android podem limpar o cache temporário de câmera entre sessões. Se a vistoria foi criada offline e o app foi morto, ao reconectar o `file://` pode não existir mais.
**Como `processarImagensVistoria()` lida:** `FileSystem.getInfoAsync(localUri)` valida existência antes do upload. Se o arquivo não existir, lança erro → `markErroSync` → `incrementTentativasSync`. Após 5 tentativas, fica com badge "Falhou".
**Mitigação recomendada:** Ao salvar a foto offline, copiar para `FileSystem.documentDirectory` (persistente) em vez de usar o URI temporário da câmera diretamente. Verificar onde `expo-image-picker` salva as fotos e se elas sobrevivem ao restart do app.

### Pitfall 3: `StorageService.upload` com `upsert: false` e retry
**O que pode errar:** Upload parcial → retry tenta o mesmo `remotePath` → "Object already exists" → foto never syncs.
**Análise:** O `remotePath` inclui `Date.now()` (`thumb_${Date.now()}.jpg`, `evidencia_${i}_${Date.now()}.jpg`), então cada tentativa de retry vai gerar um novo path e não conflitar. O trade-off é que pode haver arquivos órfãos no Storage se o processo morrer entre o upload e a atualização do SQLite.
**Recomendação:** Documentar o comportamento; não é bloqueante para SYNC-01.

### Pitfall 4: Upsert no Supabase com campos obrigatórios ausentes
**O que pode errar:** A tabela `vistorias` no Supabase pode ter constraints NOT NULL que não estão no SQLite local. Se um campo obrigatório for `null`, o upsert retorna erro → `incrementTentativasSync`.
**Como verificar:** Comparar o schema Supabase (`id, formulario_id, respostas, fotos, score, nivel_risco, created_at, inspector_id, status`) com o `buildSupabasePayload()` atual.
**Gap identificado:** O `buildSupabasePayload()` mapeia `agenteUid` mas o schema Supabase usa `inspector_id`. Verificar se há alias ou se o campo está mapeado corretamente na tabela real. Esta divergência de nomenclatura é um risco real.

### Pitfall 5: `tentativas_sync >= 5` sem caminho de recuperação
**O que pode errar:** Uma vistoria chega ao estado "Falhou" (badge vermelho) e não há botão de "Tentar novamente" na UI. O agente não tem como recuperar a vistoria sem intervenção.
**Status:** Gap de UX existente. `resetTentativasSync()` existe em `database.ts` mas não está exposto em nenhuma tela.
**Para SYNC-01:** Não bloqueia o requisito principal, mas pode ser um item de verificação na UAT.

### Pitfall 6: `isOnlineReal` vs `isConnected` no sync trigger
**O que pode errar:** Usar `isConnected` (apenas interface de rede) em vez de `isOnlineReal` (verificação real ao Supabase) para disparar o sync pode fazer o sync falhar imediatamente se o dispositivo estiver em um WiFi sem internet.
**Status:** Resolvido — `_layout.tsx` usa `isOnlineReal` corretamente.

---

## 6. Pontos de Verificação para SYNC-01

Para que SYNC-01 seja considerado atendido, os seguintes comportamentos precisam ser demonstráveis:

| Critério de Sucesso | Como Verificar | Status |
|--------------------|----------------|--------|
| Vistoria criada offline aparece na lista com badge "Pendente" | Modo avião → criar vistoria → verificar badge | UI pronta |
| Ao reconectar, sync ocorre automaticamente sem ação do usuário | Sair do modo avião → aguardar → badge muda para "Sincronizado" | Fluxo pronto |
| Sem duplicatas no Supabase após múltiplos syncs da mesma vistoria | Verificar tabela `vistorias` após reconectar 2x | Garantido por UUID + upsert |
| Fotos offline sobem junto com os dados da vistoria | Criar vistoria offline com fotos → reconectar → verificar Storage | Fluxo pronto |
| Sync falha → retry com backoff → sucesso eventual | Simular erro de rede intermitente | Fluxo pronto, sem teste |
| Vistoria com 5 falhas fica com badge "Falhou" sem travar o app | Simular 5 falhas consecutivas | Sem teste automatizado |

---

## 7. Abordagem Recomendada por Tarefa

### Tarefa 1 (Wave 1): Auditoria e diagnóstico
**O que fazer:** Ler o código atual linha a linha contra o checklist SYNC-01 e identificar qualquer divergência real entre o que está implementado e o que o requisito exige.

Pontos específicos a auditar:
1. Verificar se `buildSupabasePayload()` mapeia todos os campos que a tabela `vistorias` no Supabase realmente exige (especialmente `inspector_id` vs `agenteUid`, `status`, `score`)
2. Verificar se `insertVistoria()` é chamado ANTES de qualquer `await` no `finalizar()` do wizard
3. Verificar se o `isOnlineReal` watcher em `_layout.tsx` também cobre o caso de mount (app aberto com internet disponível, vistorias pendentes)
4. Verificar se `expo-image-picker` retorna URIs persistentes ou temporárias no Android/iOS

### Tarefa 2 (Wave 1): Gap de payload Supabase
**O que fazer:** Comparar o schema real da tabela `vistorias` no Supabase (colunas: `id, formulario_id, respostas, fotos, score, nivel_risco, created_at, inspector_id, status`) com o `buildSupabasePayload()` atual.

O briefing menciona colunas `respostas (jsonb), fotos (text[]), score, nivel_risco, created_at, inspector_id, status`. O payload atual mapeia:
- `respostasJson` (pode ser `respostas` no Supabase?)
- `agenteUid` (pode ser `inspector_id` no Supabase?)
- `pontuacaoTotal` (pode ser `score` no Supabase?)
- `criado_em` (pode ser `created_at` no Supabase?)

Se houver divergência de nomenclatura, o upsert retorna erro silencioso. Esta auditoria é a tarefa mais crítica da fase.

### Tarefa 3 (Wave 2): Testes de reconexão
**O que fazer:** Expandir `services/__tests__/SyncService.test.ts` com casos que cobrem:
- Fluxo offline → online (mock `isOnlineReal` true, verifica `syncPendentes()` chamado)
- Retry com backoff após falha (mock clock com `jest.useFakeTimers()`)
- Upload de foto local falha → vistoria marcada como erro (não perdida)
- Vistoria com 5 falhas não é enviada (já existe, verificar)

### Tarefa 4 (Wave 2): Sync no mount do layout
**O que fazer:** Verificar se ao abrir o app com internet disponível e vistorias pendentes, o sync é disparado imediatamente. O `useEffect([isOnlineReal])` só dispara quando `isOnlineReal` muda — se o app abrir já conectado, `prevConnected.current` começa como `true` (valor inicial do `useState`) e `isOnlineReal` também é `true`, portanto `!prevConnected.current` é `false` e o sync não dispara no mount.

**Correção necessária:** O `registerBackgroundSync()` e `startAppStateSyncListener()` (AppState `active`) cobrem este caso — mas há uma janela onde o app abre, está conectado, tem pendentes, e o sync só ocorre quando o AppState muda para `active` (o que pode já ter acontecido). Verificar se um sync inicial no mount do `PanelLayout` é necessário.

---

## 8. Exemplos de Código — Padrões Verificados

### Watcher de reconexão (app/(panel)/_layout.tsx — já existe)

```typescript
// Dispara sync quando isOnlineReal muda de false para true
const prevConnected = useRef(true);

useEffect(() => {
  if (isOnlineReal && !prevConnected.current) {
    logger.info('network', 'Conectividade restaurada — iniciando sync automático');
    syncPendentes().catch(() => null);
  }
  prevConnected.current = isOnlineReal;
}, [isOnlineReal]);
```

### Guard de concorrência (SyncService.ts — já existe)

```typescript
let _syncInProgress = false;

export async function syncPendentes(isRetry = false) {
  if (_syncInProgress) return { sucesso: 0, falha: 0 };
  _syncInProgress = true;
  try {
    // ... lógica de sync
  } finally {
    _syncInProgress = false; // sempre libera, mesmo em exceção
  }
}
```

### Deduplicação por UUID (database.ts — já existe)

```typescript
// INSERT OR REPLACE garante idempotência: mesmo id = atualiza, não duplica
database.runSync(
  `INSERT OR REPLACE INTO vistorias_offline (id, ..., sincronizado, criado_em) VALUES (?,... ,0,?)`,
  [vistoria.id, ..., vistoria.criado_em]
);

// No Supabase: upsert por id (chave primária)
supabase.from('vistorias').upsert(payloads) // ON CONFLICT (id) DO UPDATE SET ...
```

### Teste de mock de sync a escrever (padrão)

```typescript
// Usar jest.useFakeTimers() para testar backoff sem esperar tempos reais
it('agenda auto-retry após falha', async () => {
  jest.useFakeTimers();
  const mockUpsert = jest.fn().mockResolvedValue({ error: { message: 'network error' } });
  // ... mock setup
  await syncPendentes();
  expect(mockIncrementTentativas).toHaveBeenCalled();
  jest.advanceTimersByTime(30_000); // avança 30s
  // verificar que syncPendentes foi chamado novamente
  jest.useRealTimers();
});
```

---

## Ambiente e Dependências

Todas as dependências necessárias já estão instaladas:

| Dependência | Versão | Necessária para | Disponível |
|------------|--------|----------------|-----------|
| `expo-sqlite` | ~16.0.10 | Fila SQLite local | Sim |
| `@react-native-community/netinfo` | 11.4.1 | Detecção de rede | Sim |
| `expo-background-fetch` | ~14.0.9 | Sync em background (APK) | Sim |
| `expo-task-manager` | ~14.0.9 | Registro de task de background | Sim |
| `expo-file-system` | ~19.0.21 | Verificação de arquivo local | Sim |
| `@react-native-async-storage/async-storage` | ^2.2.0 | VACUUM timestamp, rascunho | Sim |
| `@supabase/supabase-js` | ^2.45.0 | Upsert + Storage upload | Sim |

**Nenhuma instalação nova é necessária para esta fase.**

---

## Validation Architecture

### Framework de Testes

| Propriedade | Valor |
|------------|-------|
| Framework | jest-expo ~54.0.0 + jest ^29.7.0 |
| Config | `package.json` campo `"jest"` com preset `"jest-expo"` |
| Comando rápido | `npx jest services/__tests__/SyncService.test.ts` |
| Suite completa | `npm run test:coverage` |

### Mapa de Requisitos → Testes

| Req ID | Comportamento | Tipo | Comando Automatizado | Arquivo Existe? |
|--------|---------------|------|---------------------|-----------------|
| SYNC-01 | Vistoria offline salva com `sincronizado=0` | unit | `npx jest utils/__tests__/database.test.ts` | Sim (caso `insertVistoria`) |
| SYNC-01 | `syncPendentes()` envia vistoria pendente e marca `sincronizado=1` | unit | `npx jest services/__tests__/SyncService.test.ts` | Parcial (4 casos — falta reconexão) |
| SYNC-01 | Sem duplicatas: segundo upsert do mesmo `id` não cria registro novo | unit | `npx jest services/__tests__/SyncService.test.ts` | Ausente — Wave 0 gap |
| SYNC-01 | `processarImagensVistoria()` faz upload de `file://` antes do upsert | unit | `npx jest services/__tests__/SyncService.test.ts` | Ausente — Wave 0 gap |
| SYNC-01 | Reconexão dispara sync automaticamente | integration (mock) | `npx jest services/__tests__/SyncService.test.ts` | Ausente — Wave 0 gap |
| SYNC-01 | Retry com backoff após falha de rede | unit (fake timers) | `npx jest services/__tests__/SyncService.test.ts` | Ausente — Wave 0 gap |

### Taxa de Amostragem

- Por commit: `npx jest services/__tests__/SyncService.test.ts utils/__tests__/database.test.ts`
- Por wave: `npm test`
- Gate da fase: `npm run test:coverage` — suite verde antes do `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `services/__tests__/SyncService.test.ts` — adicionar: caso de deduplicação (mesmo `id` → sem duplicata no mock Supabase)
- [ ] `services/__tests__/SyncService.test.ts` — adicionar: caso de foto `file://` → upload → URL pública (mock `StorageService`)
- [ ] `services/__tests__/SyncService.test.ts` — adicionar: caso de reconexão (mock `isOnlineReal` change → `syncPendentes` chamado)
- [ ] `services/__tests__/SyncService.test.ts` — adicionar: caso de backoff com `jest.useFakeTimers()`

---

## Fontes

### Primárias (HIGH confidence — análise direta do código)

- `services/SyncService.ts` — implementação completa do sync, backoff, upload de fotos
- `utils/database.ts` — schema SQLite DB_VERSION=5, CRUD completo
- `context/ConnectivityContext.tsx` — detecção real de conectividade
- `app/(panel)/_layout.tsx` — trigger de sync ao reconectar
- `app/(panel)/inspecoes/index.tsx` — display de badges de status
- `services/StorageService.ts` — upload de fotos locais
- `utils/uuid.ts` — geração de UUID v4
- `services/__tests__/SyncService.test.ts` — testes existentes (4 casos)
- `utils/__tests__/database.test.ts` — testes existentes de persistência
- `package.json` — versões verificadas de todas as dependências

### Secundárias (MEDIUM confidence — documentação oficial)

- Expo SDK 54 BackgroundFetch docs — intervalo mínimo 15min no Android confirmado
- `@react-native-community/netinfo` v11 — API `addEventListener` + `NetInfoState` verificada

---

## Metadata

**Confiança por área:**
- Estado atual do sistema: HIGH — leitura direta de todos os arquivos de implementação
- Deduplicação (UUID + upsert): HIGH — código verificado em duas camadas
- Reconexão trigger: HIGH — `_layout.tsx` confirmado
- Background sync: HIGH — código verificado com handling correto do Expo Go
- Gap de payload Supabase: MEDIUM — inferência do briefing vs buildSupabasePayload; precisa de verificação no Supabase Dashboard
- Persistência de file:// URIs entre restarts: LOW — comportamento dependente de plataforma; iOS/Android podem variar

**Data da pesquisa:** 2026-04-03
**Validade:** Estável — a infraestrutura de sync não está em mudança ativa. Válido por 30+ dias.
