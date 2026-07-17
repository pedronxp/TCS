## Context

O aplicativo é Expo/React Native com Expo Router, SQLite local, Supabase e formulários built-in em JSON. O wizard atual aplaina `fases[].perguntas[]`, salva rascunho no AsyncStorage, calcula risco em `utils/riscoUtils.ts`, persiste uma vistoria local/remota e reutiliza o mesmo pipeline em detalhe, resultado, relatório, compartilhamento e PDF.

Os formulários ativos de deslizamento e risco estrutural usam a escala 0-10 com classificação R1-R4. O Quadro 2 do CBMMG também termina em 10 pontos, porém sua regra é diferente: quatro itens com máximos 3, 4, 3 e 2, teto de 10 e classificação binária de risco iminente somente a partir de 9. O app já possui o entitlement `inspection_arv`, mas não possui o formulário correspondente. O protótipo aprovado está em `output/pdf/prototipo_formulario_arvore_cbmmg.pdf`.

## Goals / Non-Goals

**Goals:**

- Entregar um formulário built-in, offline e versionado, fiel ao Apêndice B da ITO nº 06.
- Reutilizar o wizard, a persistência, a sincronização e o pipeline de relatório existentes.
- Preservar a regra de maior severidade do Item 2, o teto de 10 e o limiar de 9.
- Exibir `NÃO IMINENTE` e `RISCO IMINENTE` em todas as superfícies do formulário de árvore.
- Manter cálculo e relatório historicamente auditáveis por snapshot.
- Reutilizar o entitlement `inspection_arv` sem migração comercial.

**Non-Goals:**

- Digitalizar todo o Capítulo da ITO nº 06 além do Quadro 2 fornecido.
- Substituir avaliação técnica, julgamento do agente, REDS ou procedimentos operacionais do CBMMG.
- Criar diagnóstico botânico, reconhecimento automático de espécie ou análise de imagem por IA.
- Alterar a metodologia dos formulários estrutural e de deslizamento.
- Tornar o formulário editável pelo editor administrativo nesta primeira versão.
- Criar nova tabela ou migration remota se os campos genéricos atuais comportarem o snapshot e as respostas.

## Decisions

1. **Criar `avaliacao_arvore_cbmmg_v1` como formulário built-in.**
   - Decisão: o JSON será registrado em `ASSETS` e no catálogo padrão, com metadados de versão, fonte, entitlement e configuração de resultado.
   - Racional: garante operação offline e controle de versão da metodologia oficial. O editor administrativo atual não representa adequadamente os pesos 0/1/2/3/4, a estrutura em fases e as regras condicionais necessárias.
   - Alternativa considerada: criar o formulário como registro dinâmico Supabase. Rejeitada por depender de publicação/cache e permitir edição incompatível com a fonte normativa.

2. **Modelar o Item 2 como seleção única da maior faixa de severidade.**
   - Decisão: o agente escolhe 4, 3, 2 ou 1 ponto em cards que resumem os critérios da coluna correspondente e descreve obrigatoriamente o defeito determinante.
   - Racional: a metodologia determina que a pontuação seja a do defeito mais severo, não a soma de todos os defeitos. A seleção única expressa diretamente essa regra com o componente atual.
   - Alternativa considerada: novo componente multisseleção com cálculo do máximo. Adiada porque aumenta complexidade sem mudar a pontuação; a descrição técnica preserva defeitos adicionais relevantes.

3. **Adicionar configuração de resultado metodológico ao schema do formulário.**
   - Decisão: o JSON terá metadados equivalentes a `metodologia`, `escala`, `teto`, `faixasResultado`, `resultadoLabel` e `conduta`, lidos por helpers genéricos.
   - Racional: evita condicionais espalhadas por `formularioId` e permite que futuras metodologias usem classificação própria.
   - Alternativa considerada: mapear 0-8 para R1 e 9-10 para R4 diretamente no JSON. Rejeitada para apresentação porque comunica uma classificação que não existe no documento-fonte.

4. **Manter um nível de compatibilidade interno separado do resultado metodológico.**
   - Decisão: o snapshot armazenará `resultadoCodigo`, `resultadoLabel`, `somaBruta`, `pontuacaoTotal`, fonte e versão; quando componentes legados precisarem de cor/ordenação, um nível compatível derivado poderá ser usado internamente, mas nunca exibido como classificação da árvore.
   - Racional: reduz regressão em filtros, mapas e dashboards que hoje entendem R1-R4, sem adulterar a comunicação ao usuário.
   - Alternativa considerada: trocar imediatamente todo o domínio de risco por uma union aberta. Rejeitada nesta mudança pelo alcance e risco de regressão.

5. **Estender texto numérico de forma declarativa.**
   - Decisão: perguntas de texto poderão informar modo de entrada numérico, unidade, mínimo e validação de faixa. A altura será obrigatória para calcular o raio de 1,5x; a medição exata do diâmetro será opcional e validada contra a faixa escolhida.
   - Racional: evita números inválidos e melhora o relatório sem criar uma tela paralela.
   - Alternativa considerada: armazenar altura e diâmetro como texto livre. Rejeitada porque impede validação e cálculo confiável do raio.

6. **Persistir um snapshot autossuficiente e versionado.**
   - Decisão: a conclusão salvará pontos por item, respostas determinantes, soma bruta, teto, resultado, evidências condicionais, decisão operacional e versão da regra.
   - Racional: relatórios históricos não podem mudar se o asset evoluir para v2.
   - Alternativa considerada: recalcular sempre pelo JSON atual. Rejeitada por quebrar auditabilidade.

7. **Resolver rótulos e condutas a partir do snapshot/metadados, não de `RISCO_LABELS` fixos.**
   - Decisão: helpers de apresentação receberão contexto do formulário ou snapshot. Wizard, resultado, detalhe, relatório, laudo, compartilhamento e listas usarão o resolvedor metodológico.
   - Racional: atualmente `riscoLabel` sempre retorna BAIXO/MÉDIO/ALTO/CRÍTICO e produziria um relatório incorreto para árvores.
   - Alternativa considerada: sobrescrever apenas o banner do wizard. Rejeitada porque histórico, PDF e compartilhamento continuariam divergentes.

8. **Tornar a conduta de risco iminente parte do fluxo concluível.**
   - Decisão: após total >= 9, o usuário registra `intervir` ou `não intervir`. Não intervenção exige justificativa e número do REDS; intervenção exige descrição da conduta recomendada.
   - Racional: reproduz a ressalva explícita do documento e cria rastreabilidade operacional.
   - Alternativa considerada: deixar a decisão apenas como texto opcional no relatório. Rejeitada porque permitiria concluir uma exceção sem justificativa.

9. **Usar entitlement explícito no catálogo.**
   - Decisão: itens built-in poderão declarar `featureCode`; o formulário de árvore usará `inspection_arv` sem depender de busca por palavras no título.
   - Racional: o código atual infere árvore pelo nome e é vulnerável a renomeações ou acentuação.
   - Alternativa considerada: manter a inferência por `arv`/`arvore`. Rejeitada por fragilidade.

10. **Reutilizar persistência e sincronização existentes.**
    - Decisão: respostas auxiliares e novos campos ficarão em `respostasJson` e `calculoRisco`; fotos continuarão no pipeline atual. Uma migration só será criada se a auditoria de implementação provar que algum campo excede o contrato existente.
    - Racional: reduz risco operacional e mantém compatibilidade offline/remota.
    - Alternativa considerada: criar colunas exclusivas para árvore. Rejeitada por duplicar dados específicos de um formulário no schema genérico.

## Risks / Trade-offs

- [Risk] O texto técnico das quatro faixas do Item 2 pode ficar longo em telas pequenas. -> Mitigação: cards com título e resumo, detalhe expansível ou instrução complementar, testes em Android compacto e acessibilidade de fonte.
- [Risk] Usar nível interno compatível pode vazar R1/R4 em alguma lista antiga. -> Mitigação: inventariar todos os usos de `riscoLabel`, `nivelRisco.toUpperCase()` e filtros; adicionar testes específicos por `formularioId`/snapshot.
- [Risk] Rascunhos antigos podem não ter os novos campos numéricos ou condicionais. -> Mitigação: aplicar validação somente ao avançar/concluir a versão v1 e manter parsing defensivo.
- [Risk] A exigência do REDS pode não se aplicar a todos os clientes municipais. -> Mitigação: manter o campo vinculado à metodologia CBMMG e documentar que sua ativação é parte deste formulário específico.
- [Risk] Fotos grandes podem aumentar tempo de geração do PDF. -> Mitigação: reutilizar compressão existente, limitar dimensões na renderização e paginar a galeria.
- [Risk] O protótipo contém campos auxiliares não textualmente presentes no quadro, como espécie e medição exata. -> Mitigação: marcá-los como identificação/evidência, sem influência na pontuação, e submetê-los à validação técnica antes da publicação.

## Migration Plan

1. Adicionar tipos/helpers e testes sem registrar o formulário no catálogo.
2. Criar e validar o asset `avaliacao_arvore_cbmmg_v1` com cálculo e snapshot.
3. Adaptar apresentação e relatório usando fixtures antes de habilitar o catálogo.
4. Registrar o formulário com `inspection_arv` e validar modo online/offline.
5. Executar testes, TypeScript e geração/renderização de PDF.
6. Publicar em versão de teste e validar com responsável técnico em Android e iOS.
7. Em rollback, remover o item do catálogo mantendo o asset e os leitores de snapshot para que vistorias já salvas continuem abrindo.

## Open Questions

- O texto integral das situações de risco do Item 2 deve aparecer sempre no card ou em painel expansível de consulta?
- A espécie aparente deve permanecer opcional ou ser removida da primeira versão?
- O número do REDS deve aceitar somente dígitos ou o formato alfanumérico adotado pelo cliente?
- O formulário será liberado no Modo Treinamento desde a primeira versão ou apenas após homologação operacional?
