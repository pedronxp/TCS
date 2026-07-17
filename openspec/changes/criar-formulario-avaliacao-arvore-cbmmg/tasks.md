## 1. Metodologia e contrato do formulário

- [x] 1.1 Transcrever e revisar os critérios dos Itens 1 a 4 do PDF `AVALIACAO_ARVORE_CBMMG.pdf` contra a ITO nº 06, preservando pontuação e regra de maior severidade.
- [x] 1.2 Definir o identificador estável `avaliacao_arvore_cbmmg_v1`, versão do formulário, versão da regra, fonte metodológica e entitlement `inspection_arv`.
- [x] 1.3 Definir no schema JSON os metadados de escala, teto 10, faixas `não iminente`/`risco iminente`, rótulos, cores e condutas.
- [x] 1.4 Registrar quais campos são pontuáveis, auxiliares, obrigatórios, opcionais e condicionais antes de criar o asset.

## 2. Tipos e helpers de formulário

- [x] 2.1 Estender `PerguntaModel` e `flattenPerguntas` para preservar configuração de entrada numérica, unidade, mínimo e validação de faixa sem quebrar assets existentes.
- [x] 2.2 Estender os tipos do formulário para preservar metadados de metodologia, resultado e entitlement.
- [x] 2.3 Criar helper para resolver configuração metodológica por formulário e fallback seguro para formulários antigos/dinâmicos.
- [x] 2.4 Criar helper de validação para altura positiva e cálculo do raio de referência `altura x 1,5`.
- [x] 2.5 Criar helper para validar medição exata de diâmetro contra a faixa selecionada no Item 3.
- [x] 2.6 Garantir que filtros de perguntas/respostas preservem campos auxiliares condicionais ativos e removam respostas condicionais obsoletas.

## 3. Asset built-in CBMMG

- [x] 3.1 Criar `assets/formularios/avaliacao_arvore_cbmmg_v1.json` com identificação da árvore, foto geral, altura, espécie aparente e fonte metodológica.
- [x] 3.2 Implementar o Item 1 com opções de 3, 2, 1 e 0 pontos e instrução do raio de 1,5 vezes a altura.
- [x] 3.3 Implementar o registro de medida mitigadora e justificativa obrigatória quando nenhuma medida for aplicada.
- [x] 3.4 Implementar o Item 2 com as quatro faixas de severidade, critérios técnicos e pontuações 4, 3, 2 e 1.
- [x] 3.5 Implementar descrição obrigatória da parte e do defeito determinante após a seleção do Item 2.
- [x] 3.6 Implementar o Item 3 com faixas maior que 51 cm, 10 a 51 cm e menor que 10 cm, além da medição exata opcional.
- [x] 3.7 Implementar o Item 4 com 0, 1 ou 2 pontos e justificativa obrigatória para acréscimos.
- [x] 3.8 Implementar campos auxiliares de conduta, decisão de intervir e justificativa/REDS para não intervenção em risco iminente.
- [x] 3.9 Registrar o novo asset em `utils/formulariosAssets.ts` e garantir que o bundle React Native o carregue estaticamente.

## 4. Cálculo e snapshot auditável

- [x] 4.1 Estender `utils/riscoUtils.ts` para calcular soma bruta, aplicar teto configurável de 10 e resolver o limiar configurável de 9.
- [x] 4.2 Garantir que o Item 2 contribua com uma única pontuação correspondente à maior faixa selecionada, sem somar critérios internos.
- [x] 4.3 Adicionar ao snapshot versão da metodologia, versão da regra, pontos por item, soma bruta, teto aplicado, pontuação final e resultado metodológico.
- [x] 4.4 Adicionar ao snapshot medida mitigadora, defeito determinante, fator adicional, conduta, decisão operacional, justificativa e REDS quando presentes.
- [x] 4.5 Manter um nível de compatibilidade interno para componentes legados sem expor R1-R4 ao usuário da avaliação de árvore.
- [x] 4.6 Tornar o parser de snapshot compatível com registros antigos que não possuam os novos campos.

## 5. Wizard e validações de campo

- [x] 5.1 Renderizar perguntas numéricas com teclado apropriado, unidade e mensagens de validação no wizard.
- [x] 5.2 Exibir o raio calculado de avaliação do alvo após o preenchimento da altura.
- [x] 5.3 Exibir instruções e critérios extensos do Item 2 de forma legível em telas Android compactas.
- [x] 5.4 Impedir avanço sem medida mitigadora ou justificativa, defeito determinante e demais campos obrigatórios ativos.
- [x] 5.5 Validar a coerência entre medição exata e faixa de diâmetro antes da conclusão.
- [x] 5.6 Mostrar pontuação parcial e resultado provisório usando `NÃO IMINENTE` ou `RISCO IMINENTE` sem R1-R4.
- [x] 5.7 Exigir decisão operacional após resultado >= 9 e bloquear não intervenção sem justificativa técnica e número do REDS.
- [x] 5.8 Preservar rascunho, descarte, retomada e limpeza de respostas condicionais no novo formulário.

## 6. Catálogo, assinatura e disponibilidade

- [x] 6.1 Adicionar o formulário ao catálogo built-in em `selecao-formulario.tsx` com ícone, descrição, badge e `featureCode: inspection_arv` explícito.
- [x] 6.2 Substituir a inferência por texto do título pelo `featureCode` explícito para itens built-in, preservando fallback de formulários dinâmicos.
- [x] 6.3 Verificar bloqueio e chamada para assinatura em planos sem `inspection_arv`.
- [x] 6.4 Verificar seleção, carregamento e preenchimento completos sem internet.
- [x] 6.5 Definir e implementar a disponibilidade no Modo Treinamento conforme decisão de homologação.

## 7. Resultado, detalhe e superfícies operacionais

- [x] 7.1 Criar resolvedor de apresentação que retorne código, rótulo, cor e conduta pelo snapshot/metodologia.
- [x] 7.2 Adaptar o banner de risco em tempo real do wizard para a classificação CBMMG.
- [x] 7.3 Adaptar `resultado.tsx` para mostrar pontuação, resultado binário, alerta operacional e ações de conduta.
- [x] 7.4 Adaptar detalhe e histórico de inspeções para exibir o rótulo metodológico correto.
- [x] 7.5 Auditar listas de agente, administrador, supervisor, master e mapas para impedir vazamento de R1/R4 na avaliação de árvore.
- [x] 7.6 Adaptar filtros ou agrupamentos que dependam de `nivelRisco` para reconhecer o nível compatível sem alterar a etiqueta exibida.
- [x] 7.7 Adaptar `shareUtils.ts` para compartilhar formulário, protocolo, endereço, pontuação e resultado CBMMG.

## 8. Relatório e PDF

- [x] 8.1 Adaptar a resolução de respostas para incluir altura, raio, espécie, medida mitigadora, defeito determinante, diâmetro, fator adicional e conduta.
- [x] 8.2 Criar layout específico ou blocos metodológicos em `laudoPdfBuilder.ts` para o relatório de árvore.
- [x] 8.3 Incluir identificação, fonte metodológica, quadro de pontuação, soma bruta quando aplicável, total e resultado sem rótulos R1-R4.
- [x] 8.4 Incluir fotos proporcionais e paginadas com legendas de evidência.
- [x] 8.5 Incluir decisão operacional, conduta, justificativa e REDS quando a não intervenção ocorrer em risco iminente.
- [x] 8.6 Incluir áreas de assinatura/ciência e rodapé com protocolo e versão metodológica.
- [ ] 8.7 Comparar o relatório implementado com `output/pdf/prototipo_formulario_arvore_cbmmg.pdf` e registrar divergências aprovadas.
- [x] 8.8 Renderizar PDFs de cenários 0, 8, 9, 10 e soma bruta 12 para verificar quebra de página, tabelas, fotos e legibilidade.

## 9. Persistência, offline e sincronização

- [x] 9.1 Auditar os contratos SQLite, Supabase e `SyncService` para confirmar que respostas e snapshot novos cabem nos campos genéricos existentes.
- [x] 9.2 Persistir localmente a vistoria completa, incluindo snapshot, fotos e resultado metodológico, sem nova tabela.
- [x] 9.3 Verificar sincronização posterior de vistoria concluída offline sem perda de campos condicionais.
- [x] 9.4 Verificar leitura remota e reconstrução de detalhe/relatório a partir dos dados sincronizados.
- [x] 9.5 Criar migration somente se a auditoria demonstrar incompatibilidade real e documentar rollback.

## 10. Testes automatizados

- [x] 10.1 Adicionar o asset de árvore à auditoria de formulários com assertions específicas para máximos 3/4/3/2 e campos obrigatórios.
- [x] 10.2 Testar Item 1 para pontuações 0, 1, 2 e 3.
- [x] 10.3 Testar Item 2 para pontuações 1, 2, 3 e 4 e confirmar ausência de soma entre critérios.
- [x] 10.4 Testar Item 3 para as três faixas e validação da medição exata.
- [x] 10.5 Testar Item 4 para 0, 1 e 2 pontos e justificativa condicional.
- [x] 10.6 Testar totais 8, 9, 10, 11 e 12, incluindo rótulo, teto e soma bruta do snapshot.
- [x] 10.7 Testar bloqueios de medida mitigadora, defeito determinante, fator adicional e não intervenção sem REDS.
- [x] 10.8 Testar parser de snapshot novo e fallback de snapshot legado.
- [x] 10.9 Testar rótulos CBMMG em resultado, detalhe, compartilhamento e builder de PDF.
- [x] 10.10 Testar entitlement `inspection_arv`, carregamento offline e cache/retomada quando houver harness aplicável.

## 11. Validação e homologação

- [x] 11.1 Executar `npm test -- --runInBand` e corrigir regressões.
- [x] 11.2 Executar `npx tsc --noEmit` e corrigir erros de tipagem.
- [x] 11.3 Executar a validação OpenSpec da mudança em modo estrito.
- [ ] 11.4 Validar manualmente o fluxo completo em Android com tela compacta, modo offline e retomada de rascunho.
- [ ] 11.5 Validar manualmente o fluxo completo em iOS ou web conforme a matriz suportada.
- [ ] 11.6 Submeter texto técnico, campos auxiliares, conduta e PDF à homologação do responsável técnico.
- [x] 11.7 Entregar resumo de arquivos alterados, resultados de testes, cenários validados, riscos residuais e decisão sobre Modo Treinamento.
