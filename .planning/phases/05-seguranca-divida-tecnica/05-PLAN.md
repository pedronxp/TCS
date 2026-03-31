# PLAN.md — Fase 5: Segurança + Dívida Técnica

**Projeto:** Defesa Civil Expo
**Fase:** 05 — Segurança + Dívida Técnica
**Objetivo:** Corrigir vulnerabilidades de segurança identificadas e eliminar duplicação de código com extração para utils compartilhados.
**Pré-requisito:** `expo-secure-store` deve estar instalado antes de executar as tarefas 5.1–5.2.

---

## Checklist de Instalação (executar antes de tudo)

```bash
npx expo install expo-secure-store
```

Verificar que `expo-secure-store` aparece em `package.json` como dependência antes de prosseguir.

---

## TAREFA 5.1 — Migrar JWT de AsyncStorage para expo-secure-store

**Arquivo:** `utils/supabase.ts`

**O que fazer:**

Substituir o `AsyncStorage` do Supabase por um adapter baseado em `expo-secure-store`, que criptografa o token no Keychain (iOS) / Keystore (Android).

Reescrever o arquivo inteiro com o seguinte conteúdo:

```typescript
import 'react-native-url-polyfill/auto'
import * as SecureStore from 'expo-secure-store'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Configuração ausente: defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env'
  );
}

/**
 * Adapter SecureStore para o Supabase auth.
 * Armazena o JWT criptografado no Keychain/Keystore em vez do AsyncStorage em texto claro.
 *
 * LIMITAÇÃO: expo-secure-store tem limite de ~2KB por chave no iOS.
 * Supabase armazena a sessão como JSON. Se o JSON ultrapassar 2KB,
 * usamos uma chave de índice que aponta para partes armazenadas separadamente.
 * Na prática, o JSON de sessão Supabase fica em ~1-1.5KB — limite seguro.
 */
const ExpoSecureStoreAdapter = {
  getItem: (key: string): Promise<string | null> => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string): Promise<void> => {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string): Promise<void> => {
    return SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

**ATENÇÃO:** Remover o import de `AsyncStorage` — não é mais necessário. O import de `react-native-url-polyfill/auto` deve ser mantido na primeira linha.

**Critério de verificação:**
- `npx tsc --noEmit` passa sem erros em `utils/supabase.ts`
- O arquivo não contém mais `AsyncStorage` em nenhuma forma
- Login e logout funcionam (sessão persiste entre reaberturas do app)

**Feito quando:** `grep -n "AsyncStorage" utils/supabase.ts` retorna vazio.

---

## TAREFA 5.2 — Restringir select('*') em register.tsx

**Arquivo:** `app/(auth)/register.tsx`

**O que fazer:**

Na linha 57–62, o código faz `select('*')` na tabela `invite_tokens`, retornando todos os campos incluindo possíveis metadados internos. Substituir por um select explícito com apenas os campos necessários.

Localizar este trecho:
```typescript
const { data: tokenData, error: tokenError } = await supabase
  .from('invite_tokens')
  .select('*')
  .eq('codigo', codigoNorm)
  .eq('usado', false)
  .single();
```

Substituir por:
```typescript
const { data: tokenData, error: tokenError } = await supabase
  .from('invite_tokens')
  .select('id, codigo, expiraEm, municipio, role, usado')
  .eq('codigo', codigoNorm)
  .eq('usado', false)
  .single();
```

Nenhuma outra mudança é necessária — os campos usados no restante da função (`tokenData.expiraEm`, `tokenData.municipio`, `tokenData.role`) estão todos listados no select.

**Critério de verificação:**
- `grep -n "select('\*')" app/(auth)/register.tsx` retorna vazio
- Cadastro com token válido continua funcionando (fluxo completo)

**Feito quando:** A linha do select contém apenas os 6 campos listados acima.

---

## TAREFA 5.3 — Substituir console.log por logger.warn em NotificationService.ts

**Arquivo:** `services/NotificationService.ts`

**O que fazer:**

Existem dois `console.log` que expõem dados de push token em produção (linhas 78 e 101). Substituir por `logger.warn` usando o logger estruturado já existente no projeto.

1. Adicionar import do logger no topo do arquivo (após os imports existentes):
```typescript
import { logger } from '../utils/logger';
```

2. Linha 78 — substituir:
```typescript
// ANTES:
console.log('Erro ao obter push token:', e);

// DEPOIS:
logger.warn('notifications', 'Erro ao obter push token', { erro: String(e) });
```

3. Linha 101 — substituir:
```typescript
// ANTES:
console.log('Erro ao registrar push token:', e);

// DEPOIS:
logger.warn('notifications', 'Erro ao registrar push token', { erro: String(e) });
```

**Critério de verificação:**
- `grep -n "console.log" services/NotificationService.ts` retorna vazio
- `npx tsc --noEmit` passa sem erros

**Feito quando:** Nenhum `console.log` existe no arquivo; ambas as linhas usam `logger.warn`.

---

## TAREFA 5.4 — Adicionar filtros de município e agenteUid em inspecoes/[id].tsx

**Arquivo:** `app/(panel)/inspecoes/[id].tsx`

**O que fazer:**

A função `fetchDetalhes` (linhas 38–70) busca vistoria apenas por `id` sem filtrar por `municipio` nem `agenteUid`. Um agente autenticado pode acessar dados de qualquer município. Além disso, não há fallback para SQLite — vistorias offline ficam inacessíveis.

**Parte A — Adicionar filtros de segurança na query:**

Adicionar os imports necessários no topo:
```typescript
import { useAuth } from '../../../context/AuthContext';
import { getVistoriaById } from '../../../utils/database';
```

Adicionar o hook `useAuth` dentro do componente `VistoriaDetalhesScreen`:
```typescript
const { profile } = useAuth();
```

Substituir a função `fetchDetalhes` completa por:
```typescript
const fetchDetalhes = async () => {
  try {
    // Construir query com filtros de segurança por role
    let query = supabase
      .from('vistorias')
      .select('id, nivelRisco, pontuacaoTotal, endereco, enderecoRua, enderecoNumero, enderecoBairro, municipio, dataVistoria, agenteNome, agenteUid, responsavelNome, respostasJson, formularioId, status')
      .eq('id', id as string);

    // Agentes só veem suas próprias vistorias
    if (profile?.role === 'agent') {
      query = query.eq('agenteUid', profile.uid);
    }
    // Admin e supervisor só veem vistorias do seu município
    if (profile?.role !== 'master_admin' && profile?.municipio) {
      query = query.eq('municipio', profile.municipio);
    }

    const { data, error } = await query.single();

    if (!error && data) {
      setVistoria(data);
      populateReport(data);
      return;
    }

    // Fallback: SQLite local (vistorias não sincronizadas)
    const local = getVistoriaById(id as string);
    if (local) {
      // Verificar se pertence ao agente atual (segurança offline)
      if (profile?.role === 'agent' && local.agente_uid !== profile.uid) {
        logger.warn('vistoria', 'Acesso negado — vistoria de outro agente (SQLite)');
        return;
      }
      setVistoria({
        id: local.id,
        nivelRisco: local.nivel_risco,
        pontuacaoTotal: local.pontuacao_total,
        endereco: `${local.endereco_rua}, ${local.endereco_numero} — ${local.endereco_bairro}`,
        enderecoRua: local.endereco_rua,
        enderecoNumero: local.endereco_numero,
        enderecoBairro: local.endereco_bairro,
        municipio: local.municipio,
        dataVistoria: local.data_vistoria,
        agenteNome: local.agente_nome,
        agenteUid: local.agente_uid,
        responsavelNome: local.responsavel_nome,
        respostasJson: local.respostas_json,
        formularioId: local.formulario_id,
        status: 'Pendente Sync',
      });
      return;
    }

    logger.warn('vistoria', 'Vistoria não encontrada — Supabase e SQLite');
  } catch (e) {
    logger.error('vistoria', 'Erro ao buscar vistoria', { erro: String(e) });
  } finally {
    setLoading(false);
  }
};
```

**Parte B — Adicionar função `populateReport` (extraída do resultado.tsx):**

Adicionar antes de `fetchDetalhes`:
```typescript
const populateReport = (data: any) => {
  let respostas: Record<string, string> = {};
  try { respostas = JSON.parse(data.respostasJson || '{}'); } catch { /* noop */ }
  initReport({
    vistoriaId: data.id,
    protocolo: (data.id || '').slice(0, 8).toUpperCase(),
    endereco: data.endereco || `${data.enderecoRua || ''}, ${data.enderecoNumero || ''} — ${data.enderecoBairro || ''}`,
    municipio: data.municipio || '',
    agenteNome: data.agenteNome || '',
    dataVistoria: data.dataVistoria || '',
    formularioId: data.formularioId || 'Padrão',
    nivelRisco: data.nivelRisco || 'r1',
    pontuacaoTotal: data.pontuacaoTotal ?? 0,
    respostas,
    condutaRecomendada: '',
    observacoesTecnicas: '',
    cargo: 'Agente de Defesa Civil',
  });
};
```

**Critério de verificação:**
- Agente A não consegue acessar vistoria do Agente B informando o UUID na URL
- Vistorias offline (sincronizado=0) aparecem na tela
- `npx tsc --noEmit` passa sem erros

**Feito quando:** Query inclui filtro de `agenteUid` para role `agent`, fallback SQLite funcional.

---

## TAREFA 5.5 — Limitar VACUUM SQLite a 1 execução por dia

**Arquivo:** `services/SyncService.ts`

**O que fazer:**

O VACUUM é executado após cada sync bem-sucedido (linha 96), o que pode travar o SQLite por segundos em bancos grandes. Limitar para no máximo 1 execução por dia usando AsyncStorage como timestamp.

1. Adicionar import de AsyncStorage no topo (após imports existentes):
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
```

2. Adicionar a constante logo após `const BATCH_SIZE`:
```typescript
const VACUUM_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 horas
const VACUUM_LAST_KEY = '@vacuum_last_run';
```

3. Adicionar a função auxiliar antes de `syncPendentes`:
```typescript
async function shouldRunVacuum(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(VACUUM_LAST_KEY);
    if (!raw) return true;
    const last = parseInt(raw, 10);
    return Date.now() - last >= VACUUM_INTERVAL_MS;
  } catch {
    return false; // Em caso de erro, não executar VACUUM
  }
}

async function markVacuumRun(): Promise<void> {
  try {
    await AsyncStorage.setItem(VACUUM_LAST_KEY, String(Date.now()));
  } catch { /* não crítico */ }
}
```

4. Substituir o bloco VACUUM na linha 94–97:

```typescript
// ANTES:
if (sucesso > 0) {
  // VACUUM após sync bem-sucedido para desfragmentar o banco SQLite
  try { getDb().runSync('VACUUM'); } catch { /* não crítico */ }
  notificarSincronizacao(sucesso).catch(() => null);
  logger.info('sync', `Sync concluído — sucesso: ${sucesso}, falha: ${falha}`);
}

// DEPOIS:
if (sucesso > 0) {
  // VACUUM limitado a 1x/dia — evita travar SQLite a cada sync
  const vacuum = await shouldRunVacuum();
  if (vacuum) {
    try {
      getDb().runSync('VACUUM');
      await markVacuumRun();
      logger.info('sync', 'VACUUM executado');
    } catch { /* não crítico */ }
  }
  notificarSincronizacao(sucesso).catch(() => null);
  logger.info('sync', `Sync concluído — sucesso: ${sucesso}, falha: ${falha}`);
}
```

**Critério de verificação:**
- Executar sync 3 vezes seguidas → `AsyncStorage.getItem('@vacuum_last_run')` retorna timestamp só após o primeiro
- `grep -n "VACUUM" services/SyncService.ts` mostra apenas o bloco com `shouldRunVacuum()`
- `npx tsc --noEmit` passa sem erros

**Feito quando:** VACUUM envolto em `shouldRunVacuum()`, timestamp salvo no AsyncStorage após cada execução.

---

## TAREFA 5.6 — Criar utils/riscoUtils.ts (consolidar riscoLabel + riscoColor)

**Arquivo a criar:** `utils/riscoUtils.ts`

**O que fazer:**

Criar o arquivo com as funções canônicas de risco:

```typescript
/**
 * utils/riscoUtils.ts
 * Funções compartilhadas para exibição de nível de risco estrutural.
 * Fonte única da verdade — consolidado de 7 arquivos que tinham cópias inline.
 */

/** Labels de exibição para cada nível de risco */
export const RISCO_LABELS: Record<string, string> = {
  r1: 'BAIXO',
  r2: 'MÉDIO',
  r3: 'ALTO',
  r4: 'CRÍTICO',
};

/** Cores de exibição para cada nível de risco */
export const RISCO_CORES: Record<string, string> = {
  r1: '#10B981',
  r2: '#F59E0B',
  r3: '#EF4444',
  r4: '#DC2626',
};

/**
 * Retorna o label textual do nível de risco.
 * @param nivel — string r1, r2, r3 ou r4
 */
export function riscoLabel(nivel: string): string {
  return RISCO_LABELS[nivel] ?? 'BAIXO';
}

/**
 * Retorna a cor hex do nível de risco.
 * @param nivel — string r1, r2, r3 ou r4
 */
export function riscoColor(nivel: string): string {
  return RISCO_CORES[nivel] ?? '#10B981';
}

/**
 * Retorna o ícone Feather adequado para o nível de risco.
 * @param nivel — string r1, r2, r3 ou r4
 */
export function riscoIcon(nivel: string): 'check-circle' | 'alert-circle' | 'alert-triangle' {
  if (nivel === 'r4' || nivel === 'r3') return 'alert-triangle';
  if (nivel === 'r2') return 'alert-circle';
  return 'check-circle';
}

/**
 * Texto de conduta recomendada por nível de risco.
 */
export function riscoConduta(nivel: string): string {
  const map: Record<string, string> = {
    r1: 'A estrutura apresenta condições adequadas. Recomenda-se monitoramento preventivo periódico e manutenção de rotina.',
    r2: 'Foram identificadas irregularidades. Recomenda-se laudo técnico complementar e medidas de reforço estrutural em curto prazo.',
    r3: 'ATENÇÃO: Risco elevado detectado. Recomenda-se interdição preventiva imediata e evacuação até laudo estrutural por engenheiro habilitado.',
    r4: 'EMERGÊNCIA: Risco crítico à vida. Evacuar imediatamente. Acionar defesa civil municipal e corpo de bombeiros. Interdição obrigatória.',
  };
  return map[nivel] ?? map.r1;
}
```

**Arquivos a atualizar (remover declarações locais e importar de utils/riscoUtils.ts):**

| Arquivo | O que remover | Import a adicionar |
|---------|--------------|-------------------|
| `app/(panel)/inspecoes/laudo.tsx` | Funções `riscoLabel()` (linha 24) e `riscoColor()` (linha 30) | `import { riscoLabel, riscoColor } from '../../../utils/riscoUtils';` |
| `app/(panel)/inspecoes/resultado.tsx` | Constantes `RISCO_LABELS` (linha 25) e `RISCO_CORES` (linha 29) + uso via objeto | `import { riscoLabel, riscoColor, RISCO_LABELS, RISCO_CORES } from '../../../utils/riscoUtils';` |
| `app/(panel)/inspecoes/[id].tsx` | Funções `riscoLabel()` (linha 10) e `riscoColor()` (linha 16) | `import { riscoLabel, riscoColor } from '../../../utils/riscoUtils';` |
| `app/(panel)/admin/relatorios.tsx` | Funções `riscoLabel()` (linha 30) e `riscoColor()` (linha 36) | `import { riscoLabel, riscoColor } from '../../../utils/riscoUtils';` |
| `app/(panel)/admin/index.tsx` | Função `riscoColor()` (linha 20) | `import { riscoColor } from '../../../utils/riscoUtils';` |
| `app/(panel)/admin/estatisticas.tsx` | Função `riscoColor()` (linha 24) | `import { riscoColor } from '../../../utils/riscoUtils';` |
| `app/(panel)/supervisor/index.tsx` | Função `riscoColor()` (linha 27) | `import { riscoColor } from '../../../utils/riscoUtils';` |
| `app/(panel)/supervisor/agente.tsx` | Funções `riscoColor()` (linha 14) e `riscoLabel()` (linha 20) | `import { riscoLabel, riscoColor } from '../../../utils/riscoUtils';` |

**Em resultado.tsx especificamente:** A função `getConduta()` (linha 163) pode ser substituída por `riscoConduta()` do utils. Remover a definição local e importar.

**Critério de verificação:**
```bash
grep -rn "function riscoLabel\|function riscoColor\|RISCO_LABELS\s*=\|RISCO_CORES\s*=" app/
```
Retorna vazio (zero definições locais nos arquivos de tela).

```bash
npx tsc --noEmit
```
Sem erros.

**Feito quando:** `utils/riscoUtils.ts` existe com 4 funções exportadas; todos os 8 arquivos importam deste util; zero duplicatas em `app/`.

---

## TAREFA 5.7 — Criar utils/htmlUtils.ts (consolidar escapeHtml + formatarData + tempoRelativo)

**Arquivo a criar:** `utils/htmlUtils.ts`

**O que fazer:**

Criar o arquivo com as funções de formatação e escape:

```typescript
/**
 * utils/htmlUtils.ts
 * Funções utilitárias de formatação HTML e de datas.
 * Consolidado de múltiplos arquivos que tinham cópias inline.
 */

/**
 * Escapa caracteres especiais HTML para uso seguro em templates de PDF.
 * Aceita qualquer tipo — converte para string antes de escapar.
 */
export function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formata uma string ISO de data para exibição brasileira — apenas data.
 * Ex: "2026-03-28T10:30:00Z" → "28/03/2026"
 */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formata uma string ISO de data para exibição brasileira — data e hora.
 * Ex: "2026-03-28T10:30:00Z" → "28/03/2026 10:30"
 */
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Retorna tempo relativo em português a partir de uma string ISO.
 * Ex: "há 5 minutos", "há 2 horas", "há 3 dias"
 */
export function tempoRelativo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d} dia${d !== 1 ? 's' : ''}`;
  const w = Math.floor(d / 7);
  if (w < 4) return `há ${w} semana${w !== 1 ? 's' : ''}`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
```

**Arquivos a atualizar (remover declarações locais e importar de utils/htmlUtils.ts):**

| Arquivo | O que remover | Import a adicionar |
|---------|--------------|-------------------|
| `app/(panel)/inspecoes/resultado.tsx` | Função `escapeHtml()` (linha 16–23) | `import { escapeHtml, formatarDataHora } from '../../../utils/htmlUtils';` |
| `app/(panel)/inspecoes/relatorio.tsx` | Função `escapeHtml()` (linha 15–22) | `import { escapeHtml, formatarDataHora } from '../../../utils/htmlUtils';` |
| `app/(panel)/inspecoes/laudo.tsx` | Funções `escapeHtml()` (linha 15) e `formatarData()` (linha 35) | `import { escapeHtml, formatarData } from '../../../utils/htmlUtils';` |
| `app/(panel)/inspecoes/[id].tsx` | Função `formatarData()` (linha 21) | `import { formatarData } from '../../../utils/htmlUtils';` |
| `app/(panel)/admin/relatorios.tsx` | Função `formatarData()` (linha 41) | `import { formatarData } from '../../../utils/htmlUtils';` |
| `app/(panel)/admin/index.tsx` | Função `tempoRelativo()` (linha 26) | `import { tempoRelativo } from '../../../utils/htmlUtils';` |
| `app/(panel)/admin/logs.tsx` | Função `tempoRelativo()` (linha 38) | `import { tempoRelativo } from '../../../utils/htmlUtils';` |
| `app/(panel)/supervisor/index.tsx` | Função `tempoRelativo()` (linha 33) | `import { tempoRelativo } from '../../../utils/htmlUtils';` |
| `app/(panel)/supervisor/equipe.tsx` | Função `tempoRelativo()` (linha 23) | `import { tempoRelativo } from '../../../utils/htmlUtils';` |
| `app/(panel)/supervisor/agente.tsx` | Função `formatarData()` (linha 27) | `import { formatarData } from '../../../utils/htmlUtils';` |
| `app/(panel)/mapas.tsx` | Função `escapeHtml()` (linha 85) | `import { escapeHtml } from '../../utils/htmlUtils';` |
| `app/(panel)/perfil.tsx` | Funções `formatarData()` (linha 27) e `formatarDataHora()` (linha 33) | `import { formatarData, formatarDataHora } from '../../utils/htmlUtils';` |
| `app/(panel)/master/logs.tsx` | Função `tempoRelativo()` (linha 22) | `import { tempoRelativo } from '../../../utils/htmlUtils';` |

**Observação sobre resultado.tsx:** A função `gerarHtmlLaudo` usa `new Date(v.dataVistoria).toLocaleDateString(...)` com opções específicas (ano 4 dígitos + hora). Substituir por `formatarDataHora(v?.dataVistoria)`.

**Critério de verificação:**
```bash
grep -rn "function escapeHtml\|function formatarData\|function tempoRelativo" app/
```
Retorna vazio.

```bash
npx tsc --noEmit
```
Sem erros.

**Feito quando:** `utils/htmlUtils.ts` existe com 5 funções exportadas; todos os 13 arquivos importam deste util; zero duplicatas em `app/`.

---

## TAREFA 5.8 — Criar utils/laudoPdfBuilder.ts (unificar 3 geradores de PDF)

**Arquivo a criar:** `utils/laudoPdfBuilder.ts`

**O que fazer:**

Atualmente existem 3 geradores de HTML para PDF com visual ligeiramente diferente:
- `resultado.tsx` → `gerarHtmlLaudo()` — design sofisticado com grid e badge
- `laudo.tsx` → HTML inline no `gerarPDF()` — design mais simples com header azul
- `relatorio.tsx` → `buildHtml()` — design com edição de texto livre

O builder unificado deve usar o design de `resultado.tsx` (mais completo) como base canônica, e aceitar um objeto de dados tipado.

Criar `utils/laudoPdfBuilder.ts`:

```typescript
/**
 * utils/laudoPdfBuilder.ts
 * Gerador único de HTML para PDF de laudo técnico de vistoria.
 * Substitui as 3 implementações inline em resultado.tsx, laudo.tsx e relatorio.tsx.
 */

import { escapeHtml, formatarDataHora } from './htmlUtils';
import { riscoLabel, riscoColor, riscoConduta } from './riscoUtils';

export interface LaudoData {
  id: string;
  nivelRisco: string;
  pontuacaoTotal: number;
  endereco: string;
  municipio: string;
  dataVistoria: string | null;
  agenteNome: string;
  formularioId?: string;
  respostasJson?: string;
  // Campos opcionais do relatório técnico editável
  condutaRecomendada?: string;
  observacoesTecnicas?: string;
  cargo?: string;
  bairro?: string;
  responsavelNome?: string;
}

/**
 * Gera o HTML completo do laudo técnico para exportação via expo-print.
 *
 * @param dados - Dados da vistoria normalizados
 * @returns string HTML pronto para Print.printToFileAsync({ html })
 */
export function buildLaudoHtml(dados: LaudoData): string {
  const nivel = dados.nivelRisco || 'r1';
  const cor = riscoColor(nivel);
  const label = riscoLabel(nivel);
  const data = formatarDataHora(dados.dataVistoria);
  const protocolo = (dados.id || '000000').slice(0, 8).toUpperCase();
  const conduta = dados.condutaRecomendada || riscoConduta(nivel);

  // Gerar tabela de respostas
  let respostasHtml = '';
  if (dados.respostasJson) {
    try {
      const respostas = typeof dados.respostasJson === 'string'
        ? JSON.parse(dados.respostasJson)
        : dados.respostasJson;
      respostasHtml = Object.entries(respostas as Record<string, unknown>)
        .map(([k, val]) => {
          const safeKey = escapeHtml(k);
          const safeVal = escapeHtml(Array.isArray(val) ? (val as string[]).join(', ') : String(val));
          return `<tr><td class="label">${safeKey}</td><td>${safeVal}</td></tr>`;
        }).join('');
    } catch { /* sem respostas */ }
  }

  // Seção de observações técnicas (apenas no relatório editável)
  const obsHtml = dados.observacoesTecnicas
    ? `<div class="section">
        <div class="section-title">Observações Técnicas</div>
        <div class="conduta">${escapeHtml(dados.observacoesTecnicas)}</div>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1A202C; background: #fff; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #E2E8F0; padding-bottom: 24px; }
  .logo-title { font-size: 20px; font-weight: 900; color: #1A365D; letter-spacing: -0.5px; }
  .logo-sub { font-size: 11px; color: #718096; font-weight: 600; letter-spacing: 1px; margin-top: 2px; }
  .doc-title { font-size: 12px; font-weight: 700; color: #718096; letter-spacing: 1px; text-align: right; }
  .doc-num { font-size: 18px; font-weight: 900; color: #1A365D; margin-top: 4px; text-align: right; }
  .risco-badge { background: ${cor}; color: white; padding: 20px 32px; border-radius: 16px; text-align: center; margin-bottom: 32px; }
  .risco-badge-label { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; opacity: 0.85; }
  .risco-badge-value { font-size: 36px; font-weight: 900; letter-spacing: -1px; margin: 8px 0; }
  .risco-badge-pts { font-size: 14px; opacity: 0.8; }
  .section { margin-bottom: 32px; }
  .section-title { font-size: 11px; font-weight: 800; letter-spacing: 1px; color: #718096; text-transform: uppercase; border-bottom: 1px solid #E2E8F0; padding-bottom: 8px; margin-bottom: 16px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .info-item label { font-size: 10px; font-weight: 700; color: #A0AEC0; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px; }
  .info-item span { font-size: 14px; font-weight: 600; color: #1A202C; }
  table { width: 100%; border-collapse: collapse; }
  table th { font-size: 10px; font-weight: 800; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; padding: 10px 12px; background: #F7FAFC; border-bottom: 2px solid #E2E8F0; }
  table td { font-size: 13px; padding: 10px 12px; border-bottom: 1px solid #EDF2F7; }
  table td.label { font-weight: 700; color: #4A5568; width: 40%; }
  .conduta { background: ${cor}15; border-left: 4px solid ${cor}; padding: 16px 20px; border-radius: 0 12px 12px 0; font-size: 13px; line-height: 1.6; color: #2D3748; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center; }
  .footer-left { font-size: 10px; color: #A0AEC0; }
  .assinatura { border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px 32px; text-align: center; }
  .assinatura-linha { border-top: 1px solid #A0AEC0; width: 200px; margin: 0 auto 8px; }
  .assinatura-nome { font-size: 12px; font-weight: 700; }
  .assinatura-cargo { font-size: 10px; color: #718096; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo-title">DEFESA CIVIL</div>
      <div class="logo-sub">LAUDO TÉCNICO DE VISTORIA</div>
    </div>
    <div>
      <div class="doc-title">PROTOCOLO</div>
      <div class="doc-num">#${protocolo}</div>
    </div>
  </div>

  <div class="risco-badge">
    <div class="risco-badge-label">NÍVEL DE RISCO ESTRUTURAL</div>
    <div class="risco-badge-value">RISCO ${escapeHtml(label)}</div>
    <div class="risco-badge-pts">${dados.pontuacaoTotal ?? 0} pontos acumulados</div>
  </div>

  <div class="section">
    <div class="section-title">Dados da Vistoria</div>
    <div class="info-grid">
      <div class="info-item"><label>Endereço</label><span>${escapeHtml(dados.endereco || '—')}</span></div>
      <div class="info-item"><label>Município</label><span>${escapeHtml(dados.municipio || '—')}</span></div>
      <div class="info-item"><label>Data e Hora</label><span>${escapeHtml(data)}</span></div>
      <div class="info-item"><label>Agente Responsável</label><span>${escapeHtml(dados.agenteNome || '—')}</span></div>
      <div class="info-item"><label>Formulário</label><span>${escapeHtml(dados.formularioId || 'Padrão')}</span></div>
      ${dados.responsavelNome ? `<div class="info-item"><label>Responsável pelo Imóvel</label><span>${escapeHtml(dados.responsavelNome)}</span></div>` : ''}
    </div>
  </div>

  ${respostasHtml ? `
  <div class="section">
    <div class="section-title">Respostas do Formulário</div>
    <table>
      <thead><tr><th>Parâmetro</th><th>Resposta</th></tr></thead>
      <tbody>${respostasHtml}</tbody>
    </table>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Conduta Recomendada</div>
    <div class="conduta">${escapeHtml(conduta)}</div>
  </div>

  ${obsHtml}

  <div class="footer">
    <div class="footer-left">
      Gerado automaticamente pelo Sistema de Vistoria Defesa Civil<br/>
      ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
    </div>
    <div class="assinatura">
      <div class="assinatura-linha"></div>
      <div class="assinatura-nome">${escapeHtml(dados.agenteNome || '—')}</div>
      <div class="assinatura-cargo">${escapeHtml(dados.cargo || 'Agente de Defesa Civil')}</div>
    </div>
  </div>
</body>
</html>`;
}
```

**Atualizar os 3 arquivos para usar o builder:**

**1. `app/(panel)/inspecoes/resultado.tsx`:**
- Remover: `function escapeHtml()`, `RISCO_LABELS`, `RISCO_CORES`, `function gerarHtmlLaudo()`, `function getConduta()`
- Adicionar import: `import { buildLaudoHtml, LaudoData } from '../../../utils/laudoPdfBuilder';`
- Na função `gerarPdf()`, substituir `gerarHtmlLaudo(vistoria, agenteNome)` por:
```typescript
const dados: LaudoData = {
  id: vistoria?.id || '',
  nivelRisco: vistoria?.nivelRisco || 'r1',
  pontuacaoTotal: vistoria?.pontuacaoTotal ?? 0,
  endereco: vistoria?.endereco || '—',
  municipio: vistoria?.municipio || '—',
  dataVistoria: vistoria?.dataVistoria || null,
  agenteNome,
  formularioId: vistoria?.formularioId || 'Padrão',
  respostasJson: vistoria?.respostasJson || '{}',
};
const html = buildLaudoHtml(dados);
```

**2. `app/(panel)/inspecoes/laudo.tsx`:**
- Remover: `function escapeHtml()`, `function riscoLabel()`, `function riscoColor()`, `function formatarData()`, o bloco HTML inline inteiro dentro de `gerarPDF()`
- Adicionar imports:
```typescript
import { buildLaudoHtml, LaudoData } from '../../../utils/laudoPdfBuilder';
```
- Na função `gerarPDF()`, substituir o bloco `const html = \`<!DOCTYPE html>...\`` por:
```typescript
const dados: LaudoData = {
  id: vistoria.id,
  nivelRisco: vistoria.nivelRisco,
  pontuacaoTotal: vistoria.pontuacaoTotal ?? 0,
  endereco: vistoria.endereco || `${vistoria.enderecoRua || ''}, ${vistoria.enderecoNumero || ''}`,
  municipio: vistoria.municipio || '—',
  dataVistoria: vistoria.dataVistoria,
  agenteNome: vistoria.agenteNome || profile?.name || '—',
  formularioId: vistoria.formularioId || 'Padrão',
  respostasJson: typeof vistoria.respostasJson === 'string'
    ? vistoria.respostasJson
    : JSON.stringify(vistoria.respostasJson || {}),
  bairro: vistoria.enderecoBairro,
  responsavelNome: vistoria.responsavelNome,
};
const html = buildLaudoHtml(dados);
```

**3. `app/(panel)/inspecoes/relatorio.tsx`:**
- Localizar a função que gera o HTML (procurar por `buildHtml` ou `function build` ou bloco `<!DOCTYPE html>` inline)
- Remover `function escapeHtml()` e o gerador HTML inline
- Adicionar imports:
```typescript
import { buildLaudoHtml, LaudoData } from '../../../utils/laudoPdfBuilder';
```
- Substituir a geração de HTML por:
```typescript
const dados: LaudoData = {
  id: draft.vistoriaId,
  nivelRisco: draft.nivelRisco,
  pontuacaoTotal: draft.pontuacaoTotal,
  endereco: draft.endereco,
  municipio: draft.municipio,
  dataVistoria: draft.dataVistoria,
  agenteNome: draft.agenteNome,
  formularioId: draft.formularioId,
  respostasJson: JSON.stringify(draft.respostas || {}),
  condutaRecomendada: draft.condutaRecomendada,
  observacoesTecnicas: draft.observacoesTecnicas,
  cargo: draft.cargo,
};
const html = buildLaudoHtml(dados);
```

**Critério de verificação:**
```bash
grep -rn "gerarHtmlLaudo\|buildHtml\|<!DOCTYPE html>" app/(panel)/inspecoes/
```
Retorna vazio (nenhum gerador inline nos arquivos de tela).

```bash
npx tsc --noEmit
```
Sem erros.

Gerar PDF em `resultado.tsx` e em `laudo.tsx` — ambos produzem o mesmo layout.

**Feito quando:** Um único arquivo `utils/laudoPdfBuilder.ts` exporta `buildLaudoHtml`; 3 telas consomem este builder; zero HTML inline de PDF nos arquivos de tela.

---

## TAREFA 5.9 — Criar types/vistoria.ts (interfaces TypeScript compartilhadas)

**Arquivo a criar:** `types/vistoria.ts`

**O que fazer:**

Criar o arquivo com as interfaces TypeScript compartilhadas para eliminar os `any` nos estados das telas:

```typescript
/**
 * types/vistoria.ts
 * Interfaces TypeScript compartilhadas para o domínio de vistorias.
 * Elimina o uso de `any` nos estados das telas.
 */

/** Vistoria retornada pelo Supabase (camelCase) */
export interface VistoriaSupabase {
  id: string;
  agenteUid: string;
  agenteNome: string;
  municipio: string;
  endereco: string;
  enderecoRua: string;
  enderecoNumero: string;
  enderecoBairro: string;
  enderecoCep?: string | null;
  responsavelNome?: string | null;
  latitude?: number;
  longitude?: number;
  dataVistoria: string;
  formularioId: string;
  formularioVersao?: number;
  respostasJson: string;
  nivelRisco: string;
  pontuacaoTotal: number;
  fotoUrl?: string | null;
  fotosUrls?: string[];
  status?: string;
  createdAt?: string;
}

/** Vistoria normalizada para uso nas telas (aceita tanto camelCase quanto snake_case) */
export interface VistoriaNormalizada {
  id: string;
  nivelRisco: string;
  pontuacaoTotal: number;
  endereco: string;
  municipio: string;
  dataVistoria: string | null;
  agenteNome: string;
  agenteUid?: string;
  respostasJson: string;
  formularioId: string;
  status?: string;
  responsavelNome?: string | null;
  enderecoRua?: string;
  enderecoNumero?: string;
  enderecoBairro?: string;
}

/** Item de atividade recente (admin/supervisor dashboard) */
export interface AtividadeItem {
  id: string;
  nivelRisco: string;
  endereco?: string;
  enderecoRua?: string;
  enderecoNumero?: string;
  enderecoBairro?: string;
  municipio?: string;
  dataVistoria: string | null;
  agenteNome?: string;
  pontuacaoTotal?: number;
  status?: string;
}

/** Parâmetros de navegação tipados para o wizard */
export interface WizardParams {
  formularioId: string;
  formularioTitulo: string;
  formularioVersao?: string;
  isBuiltin?: string;
  rua: string;
  numero: string;
  bairro: string;
  cep?: string;
  municipio?: string;
  responsavelNome?: string;
  lat?: string;
  lng?: string;
}
```

**Arquivos a atualizar:**

| Arquivo | Substituição |
|---------|-------------|
| `app/(panel)/admin/index.tsx` linha 40 | `useState<any[]>([])` → `useState<AtividadeItem[]>([])` + `import { AtividadeItem } from '../../../types/vistoria';` |
| `app/(panel)/supervisor/index.tsx` linha 47 | `useState<any[]>([])` → `useState<VistoriaNormalizada[]>([])` + `import { VistoriaNormalizada } from '../../../types/vistoria';` |
| `app/(panel)/inspecoes/[id].tsx` linha 34 | `useState<any>(null)` → `useState<VistoriaNormalizada | null>(null)` + `import { VistoriaNormalizada } from '../../../types/vistoria';` |
| `app/(panel)/inspecoes/wizard.tsx` linha 53 | `useLocalSearchParams<any>()` → `useLocalSearchParams<WizardParams>()` + `import { WizardParams } from '../../../types/vistoria';` |

**Critério de verificação:**
```bash
npx tsc --noEmit
```
Sem erros de tipo.

**Feito quando:** `types/vistoria.ts` existe; os 4 arquivos importam interfaces deste arquivo; os `any` das linhas listadas foram substituídos por tipos concretos.

---

## TAREFA 5.10 — Corrigir botão "Compartilhar" em resultado.tsx

**Arquivo:** `app/(panel)/inspecoes/resultado.tsx`

**O que fazer:**

O terceiro botão de exportação (Compartilhar, linhas 394–408) chama `gerarPdf` — mesmo comportamento do botão "Baixar PDF". O comportamento correto é:
1. Gerar o PDF silenciosamente (sem abrir diálogo de compartilhamento nativo do expo-print)
2. Usar `expo-sharing` para abrir o seletor de apps (WhatsApp, Gmail, etc.)

O botão "Baixar PDF" (atual `gerarPdf`) já usa `Sharing.shareAsync` — comportamento correto.

A diferença que precisa ser criada é:
- **Baixar PDF:** comportamento atual — gerar + abrir diálogo de compartilhamento nativo
- **Compartilhar:** gerar + usar `Share.share()` do React Native com o caminho do arquivo (comportamento diferente: não abre o seletor de PDF, abre o seletor de app genérico)

Adicionar import de `Share` do React Native no topo (já está importado — verificar se `Share` está na linha 3):
```typescript
import { ..., Share } from 'react-native';
```

Adicionar a função `compartilhar` após a função `imprimir` (linha ~296):
```typescript
const compartilhar = async () => {
  setGerando(true);
  try {
    const agenteNome = vistoria?.agenteNome || profile?.name || '—';
    const dados: LaudoData = {
      id: vistoria?.id || '',
      nivelRisco: vistoria?.nivelRisco || 'r1',
      pontuacaoTotal: vistoria?.pontuacaoTotal ?? 0,
      endereco: vistoria?.endereco || '—',
      municipio: vistoria?.municipio || '—',
      dataVistoria: vistoria?.dataVistoria || null,
      agenteNome,
      formularioId: vistoria?.formularioId || 'Padrão',
      respostasJson: vistoria?.respostasJson || '{}',
    };
    const html = buildLaudoHtml(dados);
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    // Share nativo (WhatsApp, email, etc.) — distinto do Sharing.shareAsync do botão Baixar
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Laudo ${(vistoria?.id || '').slice(0, 8).toUpperCase()} — Defesa Civil`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      // Fallback: compartilhar texto com link (iOS sem Files.app)
      await Share.share({
        message: `Laudo Técnico Defesa Civil — ${vistoria?.endereco || 'Endereço não informado'}\nNível de Risco: ${riscoLabel(vistoria?.nivelRisco || 'r1')}\nArquivo: ${uri}`,
        title: 'Laudo Técnico — Defesa Civil',
      });
    }
  } catch {
    Alert.alert('Erro', 'Não foi possível compartilhar o laudo.');
  } finally {
    setGerando(false);
  }
};
```

Atualizar o terceiro botão para chamar `compartilhar` em vez de `gerarPdf`:
```typescript
// Linha ~396: onPress={gerarPdf} → onPress={compartilhar}
onPress={compartilhar}
```

**Critério de verificação:**
- "Baixar PDF" e "Compartilhar" têm comportamentos distintos
- Ambos os botões geram PDF sem erro
- `grep -n "onPress={gerarPdf}" app/(panel)/inspecoes/resultado.tsx` retorna no máximo 1 resultado (o botão Baixar PDF)

**Feito quando:** Botão "Compartilhar" usa a função `compartilhar`; botão "Baixar PDF" mantém `gerarPdf`; ambos funcionam sem erro.

---

## TAREFA 5.11 — Corrigir foto do wizard para persistir URI local no SQLite

**Arquivo:** `app/(panel)/inspecoes/wizard.tsx`

**O que fazer:**

A função `tirarFoto` (linha 234) salva o URI da foto no estado `respostas` via `setResposta(perguntaId, result.assets[0].uri)`, mas na função `finalizar` (linha 289), o campo `foto_url` fica fixo como `null`:

```typescript
foto_url: null,   // linha 289 — problema aqui
```

O URI da foto precisa ser persistido no SQLite para que a foto não se perca se o app for fechado antes de chegar na tela `foto.tsx`.

**Identificar qual pergunta é do tipo `foto`:**

No wizard, perguntas com `tipo === 'foto'` são capturadas pela câmera. O URI fica em `respostas[perguntaFotoId]`.

**Modificação em `finalizar()`:**

Antes da chamada `insertVistoria(vistoriaLocal)`, adicionar:
```typescript
// Extrair URI da foto das respostas (pergunta do tipo 'foto')
const perguntaFoto = perguntas.find(p => p.tipo === 'foto');
const fotoUri = perguntaFoto ? (respostas[perguntaFoto.id] || null) : null;
```

Substituir `foto_url: null` por:
```typescript
foto_url: fotoUri,
```

**Critério de verificação:**
- Tirar foto no wizard → finalizar → abrir SQLite viewer (ou `getVistoriaById(id)`) → campo `foto_url` contém o URI local (ex: `file:///data/user/...`)
- `npx tsc --noEmit` passa sem erros

**Feito quando:** Campo `foto_url` no `vistoriaLocal` usa `fotoUri` (não mais `null` fixo).

---

## Ordem de Execução Recomendada

As tarefas podem ser executadas na seguinte ordem (algumas são independentes e podem ser feitas em paralelo):

```
Instalação:  npx expo install expo-secure-store
             ↓
Wave 1 (independentes entre si):
  5.1 — supabase.ts (SecureStore)
  5.2 — register.tsx (select restrito)
  5.3 — NotificationService.ts (logger)
  5.11 — wizard.tsx (foto_url)
             ↓
Wave 2 (criar utils base — outras tarefas dependem delas):
  5.6 — utils/riscoUtils.ts
  5.7 — utils/htmlUtils.ts
             ↓
Wave 3 (dependem de 5.6 e 5.7):
  5.8 — utils/laudoPdfBuilder.ts
  5.9 — types/vistoria.ts
             ↓
Wave 4 (dependem de 5.7/5.6 nos arquivos de tela):
  5.4 — inspecoes/[id].tsx (filtros + fallback SQLite)
  5.5 — SyncService.ts (VACUUM limitado)
  5.10 — resultado.tsx (botão Compartilhar)
  5.12 — SyncService.ts (import dinâmico NotificationService — independente)
```

---

## TAREFA 5.12 — Corrigir erro de push notifications no Expo Go (SDK 53+)

**Arquivo:** `services/SyncService.ts`

**Contexto do erro:**

Ao abrir qualquer tela do painel (ex.: mapa), o `_layout.tsx` carrega `SyncService`, que tem um import **estático** de `NotificationService`. Esse import por sua vez faz `import * as Notifications from 'expo-notifications'`, cujo módulo `DevicePushTokenAutoRegistration.fx.js` registra um listener de push token **no momento do carregamento do módulo** — antes de qualquer guard nosso ser executado. No Expo Go SDK 53+, esse listener lança:

```
ERROR expo-notifications: Android Push notifications (remote notifications) functionality
provided by expo-notifications was removed from Expo Go with the release of SDK 53.
```

**Causa raiz:** import estático em `SyncService.ts` linha 13:

```typescript
import { notificarSincronizacao } from './NotificationService';
```

Isso força o carregamento do módulo `expo-notifications` no boot do app, disparando o efeito colateral nativo antes de qualquer código de guard.

**O que fazer:**

1. Remover o import estático do `NotificationService` em `SyncService.ts` (linha 13):

```typescript
// REMOVER esta linha:
import { notificarSincronizacao } from './NotificationService';
```

2. Adicionar import de `Constants` no topo de `SyncService.ts` (junto com os outros imports):

```typescript
import Constants from 'expo-constants';
```

3. Substituir todas as chamadas a `notificarSincronizacao(...)` em `SyncService.ts` por import dinâmico com guard:

```typescript
// ANTES (qualquer ocorrência de):
await notificarSincronizacao(...args);

// DEPOIS — import dinâmico, só carrega o módulo em build real:
if (Constants.appOwnership !== 'expo') {
  const { notificarSincronizacao } = await import('./NotificationService');
  await notificarSincronizacao(...args);
}
```

> **Atenção:** Manter o número exato de argumentos de cada chamada. Usar `grep -n "notificarSincronizacao" services/SyncService.ts` para listar todas as ocorrências antes de editar.

**Critério de verificação:**

```bash
# 1. Import estático removido
grep -n "import.*notificarSincronizacao" services/SyncService.ts
# Esperado: retorno vazio

# 2. TypeScript compila
npx tsc --noEmit
# Esperado: sem saída

# 3. No Expo Go, abrir o painel não deve exibir o erro de push notifications
# Abrir o app no Expo Go e navegar para (panel) — o ERROR deve sumir do Metro
```

**Feito quando:** O painel carrega no Expo Go sem o erro `expo-notifications: Android Push notifications... was removed from Expo Go`.

---

## Verificação Final da Fase 5

Após concluir todas as tarefas, executar:

```bash
# 1. Zero definições duplicadas de funções helper
grep -rn "function riscoLabel\|function riscoColor\|function escapeHtml\|function tempoRelativo\|function formatarData" app/
# Esperado: retorno vazio

# 2. JWT não usa mais AsyncStorage
grep -n "AsyncStorage" utils/supabase.ts
# Esperado: retorno vazio

# 3. Nenhum select('*') em tabelas sensíveis
grep -n "select('\*')" app/(auth)/register.tsx
# Esperado: retorno vazio

# 4. Sem console.log no NotificationService
grep -n "console.log" services/NotificationService.ts
# Esperado: retorno vazio

# 5. TypeScript compila sem erros
npx tsc --noEmit
# Esperado: sem saída (zero erros)
```

---

## Must-Haves da Fase 5

- JWT armazenado em `expo-secure-store` — não em `AsyncStorage` em texto claro
- Zero funções `riscoLabel` / `riscoColor` / `escapeHtml` / `tempoRelativo` / `formatarData` duplicadas em `app/`
- Um único gerador de PDF (`utils/laudoPdfBuilder.ts`) consumido pelas 3 telas
- Botão "Compartilhar" com comportamento distinto do "Baixar PDF"
- VACUUM SQLite executado no máximo 1x por dia
- Foto tirada no wizard persistida no SQLite (`foto_url` preenchido)
- Filtros de `municipio` e `agenteUid` aplicados na query de `inspecoes/[id].tsx`
- `TypeScript` compila sem erros (`npx tsc --noEmit` limpo)
- Painel abre no Expo Go sem o erro `expo-notifications: Android Push notifications was removed from Expo Go`
