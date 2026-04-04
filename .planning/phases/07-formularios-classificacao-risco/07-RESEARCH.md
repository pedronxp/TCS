# Fase 07: Formulários + Classificação de Risco — Research

**Pesquisado:** 2026-04-02
**Domínio:** Formulários dinâmicos offline-first, motor de risco R1/R2/R3/R4, persistência SQLite
**Confiança:** HIGH — análise direta do código existente

---

## Resumo

A fase 07 é **predominantemente de diagnóstico e correção**, não de construção do zero. O sistema de formulários já existe e funciona: `wizard.tsx` (motor de perguntas), `calcularNivelRisco()` (algoritmo), `insertVistoria()` + `SyncService` (persistência offline). O objetivo dos três requisitos é verificar se os campos estão corretos para o sistema R1/R2/R3/R4, garantir que o cálculo de risco seja exibido em tempo real durante o preenchimento, e confirmar que o SQLite persiste sem perda de dados ao fechar o app.

O principal gap identificado é que **o risco calculado não é exibido durante o preenchimento do wizard** — ele só aparece na tela de resultado pós-finalização. FORM-02 exige exibição automática do nível calculado **durante** o preenchimento. Esse é o único requisito que exige código novo significativo no `wizard.tsx`.

FORM-01 e FORM-03 são essencialmente verificação de estado atual: os campos dos formulários JSON built-in já estão alinhados ao R1/R2/R3/R4, e o padrão `insertVistoria()` antes de qualquer sync já garante zero perda offline.

**Recomendação principal:** Adicionar um `RiscoBanner` em tempo real no `wizard.tsx` que recalcula o nível a cada mudança de resposta, exibindo no rodapé acima do botão "Avançar". Nenhuma mudança de schema SQLite é necessária.

---

<phase_requirements>
## Requisitos da Fase

| ID | Descrição | Suporte da Pesquisa |
|----|-----------|---------------------|
| FORM-01 | Agente consegue preencher formulário com campos alinhados ao sistema R1/R2/R3/R4 | Os 4 formulários JSON built-in já usam `classificacao.limites[]` e `pesoRisco` por opção — alinhamento verificado. Campos ausentes ou obsoletos precisam ser auditados pergunta a pergunta nos 4 JSONs. |
| FORM-02 | Sistema calcula automaticamente o nível de risco e o exibe durante o preenchimento | `calcularNivelRisco()` já existe em `wizard.tsx` (linha 199-233) mas só é chamado no `finalizar()`. Precisa ser movido para um `useMemo` reativo + exibido num banner no footer. |
| FORM-03 | Formulário preenchido offline é salvo no SQLite e não se perde com fechamento do app | `insertVistoria()` é chamado **antes** do `supabase.upsert()` em `wizard.tsx` (linha 299). O rascunho intermediário usa `AsyncStorage` (chave `@draft_wizard_{formularioId}`). Padrão correto. Precisa apenas de teste de validação. |
</phase_requirements>

---

## 1. Estado Atual do Código

### 1.1 Fluxo completo de uma vistoria hoje

```
dados-iniciais.tsx   → coleta endereço + GPS
selecao-formulario.tsx → escolhe formulário (built-in JSON ou Supabase)
wizard.tsx           → exibe perguntas uma a uma, auto-save rascunho AsyncStorage
                     → finalizar(): calcula risco, insertVistoria() SQLite, tenta sync imediato
resultado.tsx        → exibe risco final, PDF, compartilhar
```

### 1.2 O que já existe e funciona

| Componente | Localização | Estado |
|-----------|-------------|--------|
| Motor de perguntas (wizard) | `app/(panel)/inspecoes/wizard.tsx` | Funcional. 4 tipos: cards, multipla_escolha, texto, foto |
| Algoritmo de risco | `wizard.tsx` linhas 199-233 | Funcional. Usa `classificacao.limites[]` do JSON com fallback hardcoded |
| Mapeamento de nível | `wizard.tsx` `nivelMap` + `utils/riscoUtils.ts` | Funcional. `sem_risco/baixo→r1`, `medio→r2`, `alto→r3`, `iminente/critico→r4` |
| Persistência SQLite | `utils/database.ts` — `insertVistoria()` | Funcional. Chamado antes do sync |
| Rascunho intermediário | `AsyncStorage @draft_wizard_{formularioId}` | Funcional. Auto-save debounced 800ms |
| Sync offline | `services/SyncService.ts` | Funcional. Background fetch + AppState listener |
| Cache formulários | `utils/database.ts` `formularios_cache` (v5) | Funcional. Online: Supabase → SQLite; Offline: lê cache |
| Formulários built-in | `assets/formularios/*.json` | 4 arquivos. Todos usam `classificacao.limites[]` |
| Display do risco pós-vistoria | `app/(panel)/inspecoes/risco.tsx` + `resultado.tsx` | Funcional |
| Label/cor/conduta | `utils/riscoUtils.ts` | Fonte única da verdade consolidada |
| Testes do algoritmo | `utils/__tests__/risco.test.ts` | 18 casos cobrindo fallback, limites, aliases, edge cases |

### 1.3 O que NÃO existe ainda (gaps para esta fase)

| Gap | Onde Falta | Impacto |
|-----|-----------|---------|
| Exibição em tempo real do risco durante o wizard | `wizard.tsx` — `calcularNivelRisco()` só chamado no `finalizar()` | Bloqueia FORM-02 |
| Auditoria dos campos dos 4 JSONs built-in | `assets/formularios/*.json` — campos não foram validados contra critérios R1-R4 oficiais da Defesa Civil | Pode bloquear FORM-01 |
| Teste de persistência offline (fechar + reabrir) | `utils/__tests__/` — nenhum teste cobre o cenário "fechar app + SQLite sobrevive" | Validação FORM-03 |

---

## 2. Arquivos-Chave a Modificar

| Arquivo | Motivo | Tipo de Mudança |
|---------|--------|-----------------|
| `app/(panel)/inspecoes/wizard.tsx` | Adicionar exibição em tempo real do risco calculado | Modificação: `useMemo` para `calcularNivelRisco()` + `RiscoBanner` no footer |
| `assets/formularios/estrutural.json` | Auditoria de campos vs. critérios R1-R4 | Possível adição/remoção de perguntas/opções se auditoria detectar gaps |
| `assets/formularios/deslizamento_campo.json` | Idem | Idem |
| `assets/formularios/estrutural_avancado.json` | Idem | Idem |
| `assets/formularios/inundacao.json` | Idem | Idem |
| `utils/__tests__/risco.test.ts` | Expandir cobertura de testes | Adição de casos de teste para os JSONs built-in |
| `utils/database.ts` | Nenhuma mudança de schema necessária | Nenhuma — DB_VERSION permanece 5 |

**Arquivos que NÃO precisam ser tocados:**
- `utils/riscoUtils.ts` — já é fonte única da verdade
- `services/SyncService.ts` — padrão de sync já correto
- `types/vistoria.ts` — tipos já cobrem todos os campos
- `app/(panel)/inspecoes/resultado.tsx` — exibição pós-vistoria já funciona

---

## 3. Schema SQLite Atual (DB_VERSION = 5)

### Tabela `vistorias_offline` (migration v1 + v2 + v3)

```sql
id TEXT PRIMARY KEY
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
data_vistoria TEXT
formulario_id TEXT
formulario_versao INTEGER
respostas_json TEXT               -- JSON das respostas {perguntaId: opcaoId|texto}
nivel_risco TEXT                  -- 'r1' | 'r2' | 'r3' | 'r4'
pontuacao_total INTEGER
foto_url TEXT
fotos_urls TEXT                   -- JSON array ["url1", "url2"] (v2)
sincronizado INTEGER DEFAULT 0    -- 0=pendente, 1=sincronizado
erro_sync TEXT
tentativas_sync INTEGER DEFAULT 0 -- max 5 tentativas (v3)
criado_em TEXT NOT NULL

-- Índices (v4): agente_uid, municipio, sincronizado, data_vistoria DESC, nivel_risco
```

### Tabela `formularios_cache` (migration v5)

```sql
id TEXT PRIMARY KEY
titulo TEXT NOT NULL
descricao TEXT
versao INTEGER NOT NULL
status TEXT NOT NULL
perguntas_json TEXT NOT NULL    -- JSON das perguntas (flat ou fases)
municipio TEXT
atualizado_em TEXT NOT NULL
cached_at TEXT NOT NULL

-- Índice: municipio
```

### Tabela `logs` (migration v3)

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
level TEXT NOT NULL
category TEXT NOT NULL
message TEXT NOT NULL
data TEXT
criado_em TEXT NOT NULL
```

**Conclusão:** Nenhuma migration nova é necessária para a Fase 07. O schema cobre todos os campos que o wizard já preenche. `nivel_risco` e `pontuacao_total` já existem.

---

## 4. Algoritmo de Risco R1/R2/R3/R4 — Como Funciona Hoje

### Fonte de dados

Cada formulário JSON define `classificacao.limites[]`. Exemplo do `estrutural.json`:

```json
"classificacao": {
  "limites": [
    { "max": 30,  "nivel": "sem_risco" },
    { "max": 70,  "nivel": "medio" },
    { "max": 100, "nivel": "alto" },
    { "max": 9999, "nivel": "iminente" }
  ]
}
```

Cada opção de pergunta tem `pesoRisco` (número inteiro). Exemplos reais do `estrutural.json`:
- `"Nenhuma abertura visível"` → `pesoRisco: 0`
- `"Fissura"` → `pesoRisco: 10`
- `"Trinca"` → `pesoRisco: 25`
- `"Rachadura"` → `pesoRisco: 50`

### Algoritmo (implementado em `wizard.tsx` `calcularNivelRisco()`)

```typescript
// 1. Somar pesoRisco de todas as opções selecionadas (tipos cards e multipla_escolha)
let pontuacao = 0;
perguntas.forEach(p => {
  const r = respostas[p.id];
  if (r && (p.tipo === 'cards' || p.tipo === 'multipla_escolha')) {
    const opcao = p.opcoes.find(o => o.id === r);
    if (opcao) pontuacao += opcao.pesoRisco;
  }
});

// 2. Mapear string do JSON para código interno r1-r4
const nivelMap = {
  sem_risco: 'r1', baixo: 'r1',
  medio: 'r2', medio_baixo: 'r2',
  alto: 'r3', medio_alto: 'r3',
  iminente: 'r4', critico: 'r4',
};

// 3. Percorrer limites em ordem crescente de max
const sorted = [...limites].sort((a, b) => a.max - b.max);
for (const l of sorted) {
  if (pontuacao <= l.max) return { nivel: nivelMap[l.nivel] || 'r2', pontuacao };
}
return { nivel: 'r4', pontuacao }; // acima de todos os limites → R4

// Fallback hardcoded (quando limites[] ausente):
// 0-24 → r1, 25-49 → r2, 50-74 → r3, 75+ → r4
```

### Testes existentes

`utils/__tests__/risco.test.ts` — 18 casos, cobre:
- Fallback hardcoded (0, 24, 25, 49, 50, 74, 75, 999)
- Limites customizados (4 casos)
- Aliases de string (baixo→r1, medio_alto→r3, critico→r4)
- Edge cases (limites vazios, pontuação negativa)

### O que FALTA para FORM-02

O `calcularNivelRisco()` só é chamado dentro de `finalizar()`. Para FORM-02, precisa ser transformado em um `useMemo` reativo:

```typescript
// Em wizard.tsx — adicionar depois dos estados existentes:
const riscoAtual = useMemo(() => {
  let pontuacao = 0;
  perguntas.forEach(p => {
    const r = respostas[p.id];
    if (r && (p.tipo === 'cards' || p.tipo === 'multipla_escolha')) {
      const opcao = p.opcoes.find(o => o.id === r);
      if (opcao) pontuacao += opcao.pesoRisco;
    }
  });
  // ... mesma lógica de limites ...
  return { nivel, pontuacao };
}, [respostas, perguntas, limites]);
```

Exibir `riscoAtual.nivel` e `riscoAtual.pontuacao` em um banner no footer do wizard (acima ou ao lado do botão "Avançar").

---

## 5. Padrão de Persistência Offline — Como o SyncService Funciona

### Fluxo de salvamento (wizard.tsx `finalizar()`)

```
1. insertVistoria(vistoriaLocal)     ← SQLite SEMPRE (offline-first)
2. notificarVistoriaSalva()          ← notificação local
3. if (isConnected):
     supabase.from('vistorias').upsert(payload)
     if (!error): markSincronizado(id)
4. router.replace('/resultado', { id, nivelRisco, pontuacao })
```

**Garantia:** Se o app fechar após o passo 1, a vistoria está no SQLite com `sincronizado=0`. Na próxima vez que o app ficar `active` (AppState listener), `syncPendentes()` é disparado automaticamente.

### Rascunho intermediário (AsyncStorage)

- Chave: `@draft_wizard_{formularioId}`
- Salvo: a cada 800ms de debounce após qualquer mudança de resposta
- Recuperado: ao abrir o wizard (Alert pergunta se quer continuar)
- Apagado: após `insertVistoria()` com sucesso

**Atenção:** O rascunho no `AsyncStorage` sobrevive ao fechamento do app, mas não é uma vistoria real — não aparece na lista de inspeções. Apenas as vistorias em `vistorias_offline` aparecem na lista. Uma vistoria só vai para a lista de inspeções após `insertVistoria()` ser chamado (no `finalizar()`).

### SyncService — mecanismos

| Mecanismo | Condição | Intervalo |
|-----------|----------|-----------|
| AppState listener | App volta para `active` | Debounce 3s |
| Background fetch | APK buildado (não Expo Go) | Mínimo 15 min (Android) |
| Sync imediato | Após `insertVistoria()` se online | Imediato |
| Manual | `syncPendentes()` direto | Sob demanda |

### Status de uma vistoria na lista (index.tsx)

```
sincronizado=0, tentativas_sync=0  → badge "Pendente" (amarelo, ícone clock)
sincronizado=0, erro_sync!=null     → badge "Erro sync" (vermelho, ícone alert-triangle)
sincronizado=0, tentativas_sync>=5  → badge "Falhou" (vermelho, ícone x-circle)
sincronizado=1                      → sem badge (sincronizado)
```

O status "pendente de sincronização" do sucesso criterion 4 de FORM-03 já é exibido via badge "Pendente" no card da lista.

---

## 6. Abordagem Recomendada por Requisito

### FORM-01: Campos alinhados ao sistema R1/R2/R3/R4

**O que fazer:** Auditar os 4 JSONs built-in pergunta a pergunta. Verificar se:
1. Cada formulário tem perguntas que cobrem os fatores de risco relevantes para o seu tipo (estrutural, deslizamento, inundação)
2. Os `pesoRisco` das opções levam a pontuações que, com os `classificacao.limites[]` definidos, resultam em R1/R2/R3/R4 coerentes
3. Não há campos que pedem CPF (regra absoluta do CONTEXT.md)
4. Não há perguntas obsoletas (ex: referências a campos removidos do schema)

**Como implementar sem quebrar nada:**
- Editar apenas os campos `texto`, `descricao`, `pesoRisco` das opções nos JSONs
- Se adicionar/remover perguntas, atualizar `versao` do formulário no JSON e no campo `formulario_versao` da vistoria
- Os formulários built-in são carregados via `require()` no build — mudanças só afetam novas vistorias, não as já salvas no SQLite

**Risco:** Mudanças no `classificacao.limites[]` alteram a classificação de vistorias futuras mas não retroativas (as salvas no SQLite têm `nivel_risco` já calculado como string).

### FORM-02: Cálculo automático em tempo real

**O que fazer:** Extrair a lógica de `calcularNivelRisco()` do `finalizar()` em `wizard.tsx` para um `useMemo` e exibir no footer do wizard.

**Abordagem:**
1. Extrair a função pura `calcularNivelRisco(pontuacao, limites)` para dentro do componente como função auxiliar (já existe no teste risco.test.ts como referência)
2. Criar `const riscoAtual = useMemo(() => calcularNivelRisco(...), [respostas, perguntas, limites])`
3. Adicionar um `RiscoBanner` no footer do wizard — pequeno, acima do botão "Avançar" — mostrando nível atual e pontuação parcial
4. Usar `riscoColor(riscoAtual.nivel)` e `riscoLabel(riscoAtual.nivel)` de `riscoUtils.ts` para consistência visual

**Cuidado:** O banner só deve aparecer depois que pelo menos uma pergunta de peso foi respondida (para não confundir com "R1 por padrão" quando o formulário acabou de abrir).

**O wizard não deve ser refatorado em outros aspectos** — o fluxo step-by-step, o auto-save de rascunho, e o `finalizar()` permanecem intactos.

### FORM-03: Persistência offline sem perda de dados

**O que fazer:** Verificar e validar o comportamento existente. O código já está correto (`insertVistoria()` antes do sync), mas o requisito exige que o **sucesso criterion 3** seja demonstrável.

**Abordagem:**
1. Escrever um teste de integração em `utils/__tests__/database.test.ts` que simula: `insertVistoria()` → `getVistoriaById()` → verifica que `sincronizado=0` e dados intactos
2. Verificar no `wizard.tsx` que `insertVistoria()` é chamado dentro de um `try` antes de qualquer `await supabase.upsert()` — confirmar que mesmo em exceção no try, a vistoria já foi persistida no SQLite (hoje o `insertVistoria()` na linha 299 está dentro do `try` junto com o `supabase.upsert` — se `insertVistoria()` falhar, a vistoria não é salva; se o `supabase.upsert` falhar depois, a vistoria já está salva)
3. Confirmar que `index.tsx` exibe corretamente vistorias com `sincronizado=0` como "Pendente"

**Possível ajuste:** Se a auditoria revelar que `insertVistoria()` pode ser chamado depois de um `await` que pode falhar, mover o `insertVistoria()` para o início do bloco try (antes de qualquer `await`). Verificar linhas 299 e seguintes de `wizard.tsx`.

---

## 7. Padrões de Código — Não Quebrar

### Design system
- Sem libs UI externas. Usar componentes de `components/ui` (`Card`, `Badge`, `Button`)
- `Feather` para ícones (`@expo/vector-icons`)
- `useTheme()` para todas as cores — nunca hardcode de cor que não seja os valores de risco

### Risco colors/labels
- Sempre usar `riscoColor(nivel)` e `riscoLabel(nivel)` de `utils/riscoUtils.ts`
- Nunca duplicar o map de cores/labels inline — já existe código duplicado em `risco.tsx` com `RISCO_CONFIG` que é tecnicamente inconsistente com `riscoUtils.ts`

### Animações
- **NÃO usar `react-native-reanimated`** — crashava no Expo Go (regra absoluta do CONTEXT.md)
- Usar `Animated` nativo do React Native para qualquer animação

### Supabase schema
- `respostasJson` no Supabase é `JSONB`, não TEXT — o `wizard.tsx` já envia como string e o Supabase aceita (coerção automática), mas para queries é importante
- Campos camelCase no Supabase: `nivelRisco`, `pontuacaoTotal`, `formularioId`, etc.
- Campos snake_case no SQLite local: `nivel_risco`, `pontuacao_total`, `formulario_id`, etc.

### Regras absolutas do CONTEXT.md relevantes para esta fase
- NUNCA pedir CPF em nenhuma tela ou formulário
- Município vem sempre do perfil do agente — nunca do formulário
- ConnectivityBanner quando offline — nunca bloquear o preenchimento do formulário

---

## 8. Riscos e Pitfalls

### Pitfall 1: Duplicar a lógica de cálculo de risco
**O que vai errar:** Criar uma segunda cópia de `calcularNivelRisco()` no componente para o banner em tempo real, ficando dessincronizada da que é usada no `finalizar()`.
**Como evitar:** Extrair a função como função auxiliar pura dentro do mesmo arquivo e reutilizá-la em ambos os lugares. Ou mover para `riscoUtils.ts` se fizer sentido como utilitário compartilhado.

### Pitfall 2: Banner de risco gerando re-renders excessivos
**O que vai errar:** `useMemo` com dependências incorretas recalculando a cada render, causando lentidão em formulários com muitas perguntas.
**Como evitar:** As dependências do `useMemo` devem ser `[respostas, perguntas, limites]`. `respostas` muda a cada `setResposta()`, o que é esperado e correto. `perguntas` e `limites` são estáticos após o carregamento — não causam re-renders.

### Pitfall 3: Mostrar "R1" no banner antes de qualquer resposta
**O que vai errar:** Banner aparece imediatamente ao abrir o formulário com "RISCO BAIXO" porque `pontuacao=0` mapeia para R1, confundindo o agente.
**Como evitar:** Mostrar o banner somente após o agente ter respondido ao menos uma pergunta do tipo `cards` ou `multipla_escolha` (verificar `Object.keys(respostas).some(k => ...)`).

### Pitfall 4: Modificar os JSONs built-in e quebrar formulários já em cache no SQLite
**O que vai errar:** Um agente tem o formulário `estrutural_v1` cacheado no SQLite com as perguntas antigas. Após atualização, o wizard carrega o novo JSON mas as respostas salvas no rascunho AsyncStorage referenciam IDs de perguntas que não existem mais.
**Como evitar:** Se perguntas forem adicionadas/removidas dos JSONs built-in, **incrementar a versão** (`"versao": 2`) e limpar o rascunho da versão antiga via chave diferente. A `draftKey` atual é `@draft_wizard_{params.formularioId}` — se mudar o ID do formulário, o rascunho não é recuperado (proteção natural). Se o ID permanecer igual mas a versão mudar, deve-se incluir a versão na `draftKey`.

### Pitfall 5: insertVistoria() dentro de try com await antes dele
**O que vai errar:** Se o `supabase.auth.getSession()` (linha 263 do wizard.tsx) falhar por timeout ou erro de rede, o `insertVistoria()` na linha 299 nunca é chamado e a vistoria se perde.
**Como evitar:** O `await supabase.auth.getSession()` é necessário para obter o `session.user.id`. Alternativa: verificar se há sessão em cache antes de entrar no try (usar o `profile` já disponível via `useAuth()`). O `profile` já contém `uid`, então a dependência de `getSession()` pode ser eliminada ou movida para um fallback.

### Pitfall 6: Supabase respostasJson como JSONB
**O que vai errar:** No `wizard.tsx` linha 291, `respostas_json: JSON.stringify(respostas)` envia uma string. No `supabase.upsert()` linha 329, `respostasJson: vistoriaLocal.respostas_json` envia a mesma string para um campo JSONB. O Supabase tenta fazer parse e pode rejeitar se a string não for JSON válido.
**Como evitar:** O padrão atual funciona (Supabase aceita string JSON para campos JSONB), mas ao fazer queries de `respostasJson` no Supabase, o campo retorna como objeto JS, não como string. Na tela de resultado, o `resultado.tsx` já lida com isso via `JSON.parse(v.respostasJson || '{}')`.

### Pitfall 7: react-native-reanimated
**O que vai errar:** Se o banner de risco for implementado com animação de entrada usando `react-native-reanimated`, crasha o Expo Go no Android.
**Como evitar:** Usar `Animated` nativo do React Native (já usado no `ConnectivityBanner.tsx` como referência).

---

## 9. Don't Hand-Roll

| Problema | Não construir | Usar o que existe |
|----------|--------------|-------------------|
| Labels e cores de risco | Map inline no componente | `riscoLabel()`, `riscoColor()` de `utils/riscoUtils.ts` |
| Persistência SQLite | Queries manuais | `insertVistoria()`, `getVistoriaById()` de `utils/database.ts` |
| Sync offline | Lógica de retry manual | `syncPendentes()` de `services/SyncService.ts` |
| Geração de UUID | `Math.random()` | `generateUUID()` de `utils/uuid.ts` |
| Conectividade | Verificar manualmente | `useConnectivity()` do `ConnectivityContext` |
| Autenticação | `supabase.auth.getUser()` direto | `useAuth()` do `AuthContext` — já tem `profile.uid` |

---

## Validation Architecture

### Framework de Testes

| Propriedade | Valor |
|------------|-------|
| Framework | jest-expo ~54.0.0 + jest ^29.7.0 |
| Config | `package.json` campo `"jest"` com preset `"jest-expo"` |
| Comando rápido | `npm test` (ou `npx jest --passWithNoTests`) |
| Suite completa | `npm run test:coverage` |

### Mapa de Requisitos → Testes

| Req ID | Comportamento | Tipo | Comando Automatizado | Arquivo Existe? |
|--------|---------------|------|---------------------|-----------------|
| FORM-01 | Formulários JSON têm perguntas/pesos coerentes com R1-R4 | unit | `npx jest utils/__tests__/risco.test.ts` | Parcial (18 casos) — expandir com limites dos 4 JSONs |
| FORM-02 | `calcularNivelRisco()` reativo retorna nível correto para pontuação parcial | unit | `npx jest utils/__tests__/risco.test.ts` | Parcial — a função pura já testada; novo teste para o useMemo seria integration |
| FORM-03 | `insertVistoria()` persiste com `sincronizado=0` e dados intactos | unit | `npx jest utils/__tests__/database.test.ts` | Parcial — database.test.ts existe; adicionar caso de insertVistoria com verificação |

### Taxa de Amostragem

- Por commit: `npx jest utils/__tests__/risco.test.ts utils/__tests__/database.test.ts`
- Por wave: `npm test`
- Gate da fase: `npm run test:coverage` — suite verde antes do `/gsd:verify-work`

### Wave 0 Gaps

- [ ] Adicionar em `utils/__tests__/database.test.ts`: caso que chama `insertVistoria()` + `getVistoriaById()` e verifica `sincronizado === 0`
- [ ] Adicionar em `utils/__tests__/risco.test.ts`: casos com `classificacao.limites[]` dos 4 JSONs built-in reais

---

## Ambiente e Dependências

Nenhuma dependência nova é necessária para esta fase. Todos os pacotes usados já estão instalados:

| Dependência | Necessária para | Disponível |
|------------|----------------|-----------|
| `expo-sqlite` | SQLite offline | Sim (v5 schema) |
| `@react-native-async-storage/async-storage` | Rascunho wizard | Sim |
| `react` (useMemo, useCallback) | Banner reativo | Sim |
| `utils/riscoUtils.ts` | Labels e cores | Sim |
| `jest-expo` | Testes | Sim |

---

## Fontes

### Primárias (HIGH confidence — análise direta do código)
- `app/(panel)/inspecoes/wizard.tsx` — motor completo, algoritmo, persistência
- `utils/database.ts` — schema SQLite completo (DB_VERSION=5), CRUD
- `services/SyncService.ts` — lógica de sync, batch, tentativas
- `utils/riscoUtils.ts` — labels, cores, conduta por nível
- `utils/__tests__/risco.test.ts` — testes existentes do algoritmo
- `types/vistoria.ts` — interfaces TypeScript
- `CONTEXT.md` — regras absolutas, schema Supabase, stack

### Secundárias (HIGH confidence — arquivos de assets)
- `assets/formularios/estrutural.json` — estrutura verificada (7 fases, limites, pesoRisco)
- `assets/formularios/*.json` — 4 formulários built-in confirmados

---

## Metadata

**Confiança por área:**
- Estado atual do código: HIGH — leitura direta de todos os arquivos relevantes
- Algoritmo de risco: HIGH — código + testes verificados
- Schema SQLite: HIGH — migration v1-v5 lida na íntegra
- Padrão offline: HIGH — SyncService + database.ts verificados
- Abordagem para FORM-02 (banner em tempo real): HIGH — padrão useMemo padrão React, sem deps externas

**Data da pesquisa:** 2026-04-02
**Validade:** Estável — código não está em mudança ativa neste domínio
