# Formulários V3 e Documentos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a V3 de deslizamento e o fluxo estrutural confiáveis com formulários remotos, preservar o nome do solicitante em todas as emissões e deixar a sincronização/documentação administráveis.

**Architecture:** O UUID continua sendo a chave de persistência do catálogo e da vistoria. O código de sistema será propagado como a identidade canônica apenas para regras de risco e escolha de schema de PDF; o snapshot de risco gravará essa identidade para permitir reemissão consistente. A correção do nome será isolada em um construtor testável de `LaudoData`, sem alterar o gerador de PDF.

**Tech Stack:** Expo Router + React Native, TypeScript, Jest/`jest-expo`, SQLite local, Supabase RPC/Storage, React/Vite/Vitest no Console.

**Spec:** `docs/panorama-formularios-sincronizacao-documentos-2026-11-01.html`

## Global Constraints

- Executar em worktree limpo e em branch com prefixo `codex/`; o checkout atual contém alterações do usuário no dashboard e em outros arquivos não relacionados.
- Não trocar `formularioId` persistido: UUID segue sendo usado em SQLite, Supabase e navegação do formulário remoto.
- Usar `formularioSystemCode || formularioId` somente para cálculo, regras condicionais, observações condicionais e resolução do schema do PDF.
- Não reclassificar automaticamente vistorias históricas já concluídas; a correção vale para novas emissões/cálculos e reemissões explicitamente solicitadas.
- Não preencher retroativamente nome de solicitante ausente sem fonte confiável e ação auditável.
- O Console só pode gerar documento quando a vistoria e seus dados-base já existirem no servidor; ele não pode recuperar uma vistoria restrita ao aparelho.
- Não incluir dependências novas para esta correção.

## Review Focus

- UUID remoto de deslizamento V3 com exposição “muito alto” deve gerar R4, 7 pontos e regra no snapshot; coberto na Task 1.
- UUID remoto estrutural com fundação inexistente “crítico” deve gerar piso R4 e explicação técnica; coberto na Task 1.
- Formulário que não possui `formularioSystemCode` deve manter o comportamento atual, sem regra cruzada; coberto na Task 1.
- PDF disparado pela tela Resultado deve imprimir o solicitante quando ele existe e “-” apenas quando realmente não existe; coberto na Task 2.
- Vistoria com dados sincronizados mas mídia pendente deve ser diagnosticada como “dados no servidor; mídia pendente”, não como vistoria inexistente; coberto nas Tasks 3 e 4.

---

## File structure

| Arquivo | Papel após a implementação |
|---|---|
| `app/(panel)/inspecoes/wizard.tsx` | Passar o código canônico à rotina de cálculo, mantendo UUID no registro da vistoria. |
| `utils/riscoUtils.ts` | Aceitar explicitamente o código de sistema ao calcular e gravá-lo no snapshot de regras. |
| `utils/__tests__/risco.test.ts` | Provar pisos V3 e estrutural com UUID remoto + código de sistema. |
| `utils/laudoPdfBuilder.ts` | Resolver o schema do formulário a partir do código canônico disponível no snapshot, antes de usar o UUID persistido. |
| `utils/__tests__/laudoPdfBuilder.test.ts` | Provar justificativa/explicação no HTML quando o registro usa UUID remoto. |
| `utils/inspectionLaudoData.ts` (novo) | Converter uma vistoria carregada pela tela Resultado em `LaudoData` de forma pura e testável. |
| `utils/__tests__/inspectionLaudoData.test.ts` (novo) | Fixar a passagem de `responsavelNome` à emissão. |
| `app/(panel)/inspecoes/resultado.tsx` | Substituir o construtor local por `buildResultadoLaudoData`. |
| `services/SyncService.ts` | Expor um diagnóstico estruturado para estados de fila, sem mudar o contrato do RPC. |
| `services/__tests__/SyncService.test.ts` | Cobrir dados enviados/mídia pendente, limite e falha do RPC no diagnóstico. |
| `app/(panel)/inspecoes/index.tsx` | Mostrar motivo resumido e estado operacional da pendência, sem apagar `erro_sync` técnico. |
| `dashboard/src/pages/ProtocolInspectionPage.tsx` | Confirmar link de emissão administrativa e mensagem de pré-requisito de sincronização. |
| `dashboard/src/pages/ProtocolInspectionPage.test.tsx` (novo) | Provar que usuário com `protocol.read` encontra “Gerar ou editar” para relatório. |

## Task 1: Canonicalizar a identidade de regras do formulário remoto

**Files:**
- Modify: `utils/riscoUtils.ts:429-510`
- Modify: `app/(panel)/inspecoes/wizard.tsx:275-295`
- Test: `utils/__tests__/risco.test.ts`

**Interfaces:**
- Consumes: `params.formularioId` (UUID ou código atual) e `params.formularioSystemCode?: string`.
- Produces: `calcularRiscoFormulario(params)` com `snapshot.formularioId` igual à identidade canônica usada nas regras e `snapshot.formularioVersao` inalterado.

- [ ] **Step 1: Escrever os testes que falham para UUID remoto de deslizamento e estrutural**

Adicionar em `utils/__tests__/risco.test.ts` duas chamadas a `calcularRiscoFormulario` com `formularioId: 'uuid-remoto-...'` e, respectivamente, `formularioSystemCode: 'vistoria_deslizamento_v3'` e `formularioSystemCode: 'risco_estrutural_novo_v2'`.

Asserções obrigatórias:

```ts
expect(deslizamento.pontuacaoTotal).toBe(7);
expect(deslizamento.nivelRisco).toBe('r4');
expect(deslizamento.regrasCondicionais[0].id).toBe('exposicao_altura_distancia_muito_alto');
expect(estrutural.nivelRisco).toBe('r4');
expect(estrutural.regrasCondicionais[0].justificativa).toContain('fundação');
```

Incluir um terceiro teste sem `formularioSystemCode` que prove que UUID desconhecido não recebe regra de deslizamento ou estrutural.

- [ ] **Step 2: Executar o teste vermelho**

Run: `npm test -- --runInBand utils/__tests__/risco.test.ts`

Expected: FAIL nos novos casos, pois o cálculo consulta regras pelo UUID remoto.

- [ ] **Step 3: Adicionar `formularioSystemCode?: string` ao contrato de `calcularRiscoFormulario`**

Em `utils/riscoUtils.ts`, calcular internamente `const formularioRegraId = params.formularioSystemCode || params.formularioId`. Usar `formularioRegraId` em `opcaoAcionaObservacaoCondicionalRisco`, nas duas funções de regras condicionais, em `getConfiguracaoFormulario`, em `resolverFaixaMetodologica` e na verificação de evidências CBMMG. Gravar `formularioRegraId` no `CalculoRiscoSnapshot.formularioId`.

- [ ] **Step 4: Passar a identidade canônica apenas ao cálculo no wizard**

Em `app/(panel)/inspecoes/wizard.tsx`, manter `params.formularioId` onde a vistoria é salva/sincronizada. Na chamada de `calcularRiscoFormulario`, acrescentar `formularioSystemCode: params.formularioSystemCode || undefined`; não substituir o UUID do payload de persistência.

- [ ] **Step 5: Executar o teste verde e a suíte do cálculo**

Run: `npm test -- --runInBand utils/__tests__/risco.test.ts`

Expected: PASS, incluindo os casos existentes de limites e os três novos casos de identidade.

- [ ] **Step 6: Commit**

```bash
git add utils/riscoUtils.ts app/(panel)/inspecoes/wizard.tsx utils/__tests__/risco.test.ts
git commit -m "fix: aplica regras V3 a formularios remotos"
```

## Task 2: Preservar solicitante e schema em todas as emissões de PDF

**Files:**
- Create: `utils/inspectionLaudoData.ts`
- Create: `utils/__tests__/inspectionLaudoData.test.ts`
- Modify: `app/(panel)/inspecoes/resultado.tsx:364-384`
- Modify: `utils/laudoPdfBuilder.ts` na resolução de `ASSETS[dados.formularioId]`
- Test: `utils/__tests__/laudoPdfBuilder.test.ts`

**Interfaces:**
- Produces: `buildResultadoLaudoData(input: ResultadoLaudoInput): LaudoData`.
- Consumes: `vistoria.responsavelNome`, `vistoria.formularioId` (UUID) e `vistoria.calculoRisco` (snapshot canônico da Task 1).
- Produces: PDF com solicitante vindo da vistoria e schema vindo de `parseCalculoRiscoSnapshot(dados.calculoRisco)?.formularioId || dados.formularioId`.

- [ ] **Step 1: Criar testes vermelhos para o mapeamento da tela Resultado**

Em `utils/__tests__/inspectionLaudoData.test.ts`, criar uma vistoria mínima contendo `responsavelNome: 'Maria da Silva'`, UUID em `formularioId` e layout/assinatura. Verificar:

```ts
expect(dados.responsavelNome).toBe('Maria da Silva');
expect(dados.formularioId).toBe('uuid-formulario-remoto');
```

Criar também caso sem nome que retorna `undefined`, sem inventar valor.

- [ ] **Step 2: Criar teste vermelho de schema remoto no PDF**

Em `utils/__tests__/laudoPdfBuilder.test.ts`, usar `formularioId: 'uuid-formulario-remoto'`, mas `calculoRisco.formularioId: 'vistoria_deslizamento_v3'`, com respostas de altura × distância. Verificar a presença de “Justificativa técnica da classificação” e do texto da justificativa.

- [ ] **Step 3: Executar os testes vermelhos**

Run: `npm test -- --runInBand utils/__tests__/inspectionLaudoData.test.ts utils/__tests__/laudoPdfBuilder.test.ts`

Expected: FAIL porque o construtor ainda está local à tela Resultado e o builder procura o schema pelo UUID.

- [ ] **Step 4: Extrair `buildResultadoLaudoData` sem alterar o contrato do gerador**

Criar `utils/inspectionLaudoData.ts` com a interface explícita abaixo; copiar para ela apenas a transformação hoje presente em `buildDados`:

```ts
export function buildResultadoLaudoData(input: ResultadoLaudoInput): LaudoData
```

O retorno deve atribuir `responsavelNome: input.vistoria?.responsavelNome || undefined`, preservar `formularioId` como UUID e carregar as mesmas fotos, layout e assinatura que o construtor local já utiliza.

- [ ] **Step 5: Usar o construtor extraído na tela Resultado**

Em `resultado.tsx`, remover o objeto literal de `buildDados` e delegar ao novo helper. Não alterar armazenamento de PDF, assinatura ou chamadas de sincronização desta tela.

- [ ] **Step 6: Resolver o schema pelo snapshot canônico**

Em `utils/laudoPdfBuilder.ts`, depois de `parseCalculoRiscoSnapshot`, criar `const formularioSchemaId = calculo?.formularioId || dados.formularioId` e usar esse valor na consulta a `ASSETS`. Manter `dados.formularioId` onde ele é exibido/persistido como referência original.

- [ ] **Step 7: Executar testes verdes**

Run: `npm test -- --runInBand utils/__tests__/inspectionLaudoData.test.ts utils/__tests__/laudoPdfBuilder.test.ts`

Expected: PASS, com PDF de UUID remoto exibindo justificativa e emissão da tela Resultado mantendo o solicitante.

- [ ] **Step 8: Commit**

```bash
git add utils/inspectionLaudoData.ts utils/__tests__/inspectionLaudoData.test.ts app/(panel)/inspecoes/resultado.tsx utils/laudoPdfBuilder.ts utils/__tests__/laudoPdfBuilder.test.ts
git commit -m "fix: preserva solicitante e schema remoto no PDF"
```

## Task 3: Tornar a pendência de sincronização diagnosticável em campo

**Files:**
- Modify: `services/SyncService.ts`
- Modify: `services/__tests__/SyncService.test.ts`
- Modify: `app/(panel)/inspecoes/index.tsx:47-120`

**Interfaces:**
- Produces: `getSyncDiagnostic(vistoria: Pick<VistoriaLocal, 'sincronizado' | 'erro_sync' | 'tentativas_sync'>): { state: 'synced' | 'pending' | 'media_pending' | 'subscription_limited' | 'retry_exhausted' | 'failed'; message: string }` exported from `services/SyncService.ts`.
- Consumes: estado local já persistido; não altera o contrato do RPC `sync_finalized_inspection`.

- [ ] **Step 1: Escrever testes vermelhos dos seis estados de diagnóstico**

Em `services/__tests__/SyncService.test.ts`, testar: sincronizada; pendente sem erro; “Dados enviados; mídia local pendente de upload.”; erro de limite; `tentativas_sync: 5`; e mensagem genérica de RPC.

Asserção-chave para mídia:

```ts
expect(getSyncDiagnostic(vistoria).state).toBe('media_pending');
expect(getSyncDiagnostic(vistoria).message).toMatch(/dados.*servidor/i);
```

- [ ] **Step 2: Executar o teste vermelho**

Run: `npm test -- --runInBand services/__tests__/SyncService.test.ts`

Expected: FAIL porque a função ainda não existe.

- [ ] **Step 3: Implementar `getSyncDiagnostic` como adaptador puro dos estados existentes**

Em `services/SyncService.ts`, classificar primeiro `sincronizado === 1`, depois a mensagem literal de mídia pendente, depois limite de assinatura via função já existente, depois tentativa >= 5 e por fim erro/fila genérica. Não apagar nem reescrever `erro_sync` armazenado.

- [ ] **Step 4: Exibir o diagnóstico na lista de vistorias pendentes**

Em `app/(panel)/inspecoes/index.tsx`, renderizar a mensagem operacional de `getSyncDiagnostic` acima ou junto de `erro_sync`; manter o erro técnico existente em duas linhas para suporte. Não criar botão que force reenvio nem alterar contador de tentativas nesta task.

- [ ] **Step 5: Executar teste verde e regressão de sync**

Run: `npm test -- --runInBand services/__tests__/SyncService.test.ts utils/__tests__/subscriptionSync.test.ts`

Expected: PASS, inclusive os casos já existentes de limite, recuperação de schema e exaustão de tentativas.

- [ ] **Step 6: Commit**

```bash
git add services/SyncService.ts services/__tests__/SyncService.test.ts app/(panel)/inspecoes/index.tsx
git commit -m "feat: explica estado de sincronizacao da vistoria"
```

## Task 4: Homologar e proteger a emissão administrativa existente

**Files:**
- Create: `dashboard/src/pages/ProtocolInspectionPage.test.tsx`
- Modify: `dashboard/src/pages/ProtocolInspectionPage.tsx:123-125` only if the test exposes missing copy or navigation.
- Test: `dashboard/src/pages/ProtocolInspectionPage.test.tsx`

**Interfaces:**
- Consumes: rota existente `/app/protocolos/:inspectionId/relatorio` protegida por `protocol.read`.
- Produces: acesso explícito a “Gerar ou editar” para vistoria sincronizada; nenhuma promessa de recuperação de registro local não sincronizado.

- [ ] **Step 1: Escrever teste de rota e de ação administrativa**

Criar `ProtocolInspectionPage.test.tsx` seguindo os mocks já usados pelo dashboard. Entregar uma inspeção com `documents.report: false`, `id: 'inspection-1'` e permissão `protocol.read`. Verificar que o link “Gerar ou editar” aponta para `/app/protocolos/inspection-1/relatorio` e que a descrição informa geração web.

- [ ] **Step 2: Executar o teste vermelho no pacote do Console**

Run: `npm --prefix dashboard test -- ProtocolInspectionPage.test.tsx`

Expected: FAIL até que o componente/rota satisfaça a asserção ou a infraestrutura de mocks do novo teste esteja completa.

- [ ] **Step 3: Corrigir apenas o que a prova funcional revelar**

Se o teste não encontrar a ação, adicionar o link para a rota já existente. Se a ação já estiver correta (situação esperada pela inspeção atual), não alterar produção: manter o teste como proteção contra regressão.

- [ ] **Step 4: Adicionar a mensagem de limite de sincronização, se ausente**

Garantir que a descrição do relatório deixe claro que os dados devem estar sincronizados para o painel emitir. Não chamar Edge Function de geração server-side nessa task, pois o Console já gera pelo construtor oficial e registra a emissão.

- [ ] **Step 5: Executar o teste verde e build do Console**

Run: `npm --prefix dashboard test -- ProtocolInspectionPage.test.tsx`

Expected: PASS.

Run: `npm --prefix dashboard run build`

Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/pages/ProtocolInspectionPage.tsx dashboard/src/pages/ProtocolInspectionPage.test.tsx
git commit -m "test: protege emissao administrativa de relatorio"
```

## Task 5: Homologação integrada e decisão de release

**Files:**
- Create: `docs/operacao/homologacao-formularios-v3-2026-11-01.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: APK candidata criada a partir dos commits das Tasks 1–3 e Console da Task 4.
- Produces: evidência de homologação, versão do APK e decisão explícita de liberar/bloquear V3.

- [ ] **Step 1: Registrar roteiro de homologação com IDs e resultados esperados**

Criar o documento com seis cenários: V3 remoto/muito alto → R4; V3 remoto/alto → R3; estrutural remoto/fundação crítica → R4 e explicação no PDF; Resultado com solicitante; vistoria offline que sincroniza posteriormente; dados sincronizados + mídia pendente exibindo estado correto e habilitando relatório no Console.

- [ ] **Step 2: Executar a suíte móvel completa antes do APK**

Run: `npm test -- --runInBand`

Expected: PASS, sem regressões nas suítes de risco, PDF, banco e sincronização.

- [ ] **Step 3: Gerar APK candidata sem promover produção**

Run: usar o fluxo de release documentado em `DEPLOY-MANUAL.md`, gerando uma versão candidata superior a 1.3.70.

Expected: APK instalável identificada no documento de homologação; não publicar automaticamente.

- [ ] **Step 4: Homologar em aparelho conectado e sem conexão**

No aparelho, preencher os seis cenários do Step 1. Anexar IDs de vistoria, nível/pontuação exibidos, captura do PDF e valor de `erro_sync` quando aplicável. No Console, abrir a mesma vistoria sincronizada e emitir o relatório com assinatura.

- [ ] **Step 5: Atualizar changelog e decidir liberação**

Em `CHANGELOG.md`, registrar: correção de identidade do formulário, solicitante no Resultado e mensagem de status de sincronização. Marcar V3 como liberada somente se os seis cenários tiverem evidência; caso contrário, bloquear a distribuição da APK candidata e manter V3 como não padrão.

- [ ] **Step 6: Commit**

```bash
git add docs/operacao/homologacao-formularios-v3-2026-11-01.md CHANGELOG.md
git commit -m "docs: registra homologacao da correcao de formularios V3"
```

## Self-review

- **Cobertura da especificação:** Task 1 trata talude/fundação e o uso de UUID; Task 2 trata PDF, justificativa e nome; Task 3 torna o motivo de não subir observável; Task 4 protege a emissão administrativa existente; Task 5 exige validação real antes da APK.
- **Limites preservados:** UUID não é substituído no banco, históricos não são reclassificados e o painel não promete recuperar dados que nunca saíram do aparelho.
- **Risco principal controlado:** cada correção é primeiro reproduzida com UUID remoto nos testes, em vez de validar somente com o código de formulário embutido.
- **Dependências:** Task 2 depende do snapshot canônico da Task 1; Task 5 depende das Tasks 1–4. Tasks 3 e 4 podem seguir em paralelo depois de criada a worktree limpa.
