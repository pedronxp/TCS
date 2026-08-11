# Inteligência territorial operacional — Design

**Data:** 2026-08-11
**Status:** aprovado para planejamento de implementação

## Objetivo

Criar uma camada operacional para a Defesa Civil municipal que conecte cada vistoria ao histórico do local, à priorização territorial e ao acompanhamento de providências. O resultado deve permitir que coordenadores tomem decisões no portal web e que agentes concluam as ações atribuídas a eles no app mobile, inclusive sem conectividade.

## Contexto e limites

O repositório possui dois ambientes web:

- O console interno do TCS (`/app`) atende a equipe da plataforma: clientes, suporte, auditoria e eventos técnicos.
- O portal municipal atende à Defesa Civil e já concentra vistorias, agenda e mapa.

Os recursos operacionais pertencem ao portal municipal. O console interno terá apenas observabilidade técnica e acesso auditável de leitura; ele não poderá priorizar, editar ou concluir pendências de municípios.

O escopo cobre quatro experiências conectadas:

1. Linha do Tempo do Imóvel.
2. Dossiê Territorial.
3. Monitor de Cobertura.
4. Mural de Pendências.

O app mobile recebe uma quinta experiência derivada: **Minhas pendências**, para os agentes executarem e concluírem ações atribuídas.

## Abordagem escolhida

O produto adotará uma camada operacional derivada das vistorias existentes, em vez de iniciar por cadastros canônicos de imóveis e territórios.

Essa abordagem normaliza endereço, bairro e coordenadas no momento de consulta para compor agrupamentos de local e território. Ela reduz risco de migração e entrega valor com a qualidade de dados atual. Uma futura modelagem canônica poderá evoluir a precisão sem alterar os contratos da interface.

A única entidade operacional nova do MVP será a pendência, acompanhada de seus eventos de histórico.

## Arquitetura e responsabilidades

```text
Vistorias existentes
        |
        +-- agrupamento por endereço, bairro e coordenadas
        |       |
        |       +-- Linha do Tempo do Imóvel
        |       +-- Dossiê Territorial
        |       +-- Monitor de Cobertura
        |
        +-- Pendências operacionais
                |
                +-- Mural web de coordenação
                +-- Minhas pendências no app
                +-- Auditoria e observabilidade interna
```

### Portal municipal

- Coordenadores e perfis autorizados criam, priorizam, atribuem e acompanham pendências.
- A Linha do Tempo apresenta vistorias, laudos, fotos, eventos de pendência e mudanças de risco do local.
- O Dossiê agrega locais e riscos por bairro ou território disponível.
- O Monitor aponta territórios sem vistoria recente e locais de risco que ultrapassaram o prazo de revisão.

### App mobile

- Apenas agentes com pendências atribuídas visualizam o módulo **Minhas pendências**.
- O agente consulta contexto resumido, linha do tempo e evidências do local.
- O agente anexa observação ou foto e pode concluir uma pendência atribuída a ele.
- A operação é persistida em fila local quando não houver conexão e sincronizada quando a rede retornar.

### Console interno

- Exibe métricas de disponibilidade, falhas de consulta, erros de sincronização e volume por município.
- Oferece dados operacionais somente em modo leitura dentro das permissões existentes de suporte/auditoria.
- Registra qualquer futura ação administrativa sensível com motivo, confirmação e auditoria.

## Modelo de dados

### Chave de local derivada

Uma função compartilhada gerará uma chave estável a partir de município, endereço normalizado e, quando presente, coordenadas arredondadas. A chave nunca substituirá o identificador da vistoria; ela só agrupa o histórico exibido.

### Pendência operacional

Cada pendência terá:

- identificador, organização/município e referência opcional à vistoria de origem;
- chave de local derivada e resumo de endereço para consulta rápida;
- título, descrição, prioridade (`baixa`, `média`, `alta`, `crítica`) e estado (`aberta`, `em_andamento`, `concluída`, `cancelada`);
- agente responsável, criador, prazo e datas de criação/atualização/conclusão;
- versão de atualização para detecção de conflitos;
- registro de eventos imutáveis para criação, atribuição, mudanças de estado, evidências e conflitos.

Políticas RLS restringirão cada organização aos próprios dados. Agentes poderão ler somente pendências atribuídas a si e criar eventos permitidos para elas. Coordenadores poderão gerenciar pendências da organização conforme permissão. A trilha de eventos não poderá ser alterada pelo cliente.

## Fluxos principais

### Criar e acompanhar pendência no portal

1. Um coordenador abre uma vistoria, Linha do Tempo ou Dossiê Territorial.
2. Cria uma pendência com prioridade, responsável e prazo.
3. O Mural a exibe na coluna correspondente ao estado, com filtros por prioridade, responsável, prazo e território.
4. Cada transição registra evento de auditoria e atualiza a Linha do Tempo do local.

### Concluir no app mobile

1. O agente abre **Minhas pendências** e seleciona uma pendência atribuída.
2. O app apresenta prioridade, prazo, endereço, contexto da vistoria e a linha do tempo.
3. O agente pode registrar nota e evidência; então escolhe **Concluir pendência**.
4. Uma confirmação explícita mostra o efeito da ação. A conclusão registra data/hora e localização disponível.
5. Sem internet, a operação é salva na fila local com estado de sincronização visível.
6. Ao sincronizar, o servidor valida a versão da pendência. Se ela foi alterada ou concluída por outra pessoa, o app não sobrescreve o dado: preserva a tentativa como evento de conflito, atualiza o histórico e informa o agente.

## Interface e acessibilidade

- O portal usa o design system existente, com hierarquia visual para risco, prioridade, responsável e prazo.
- O app prioriza condições de campo: alvos de toque amplos, contraste alto, textos legíveis e a ação principal próxima do contexto.
- A conclusão não depende apenas de cor; estado e prioridade são acompanhados de texto e ícone.
- Telas de uso repetido não terão animações decorativas. Feedback de toque e alterações ocasionais usarão transições curtas, específicas e compatíveis com `prefers-reduced-motion`.
- Carregamento, ausência de dados, erro, sincronização pendente e conflito terão estados explícitos e acionáveis.

## Entrega incremental

### Fase 1 — Fundação operacional

- Migrações, RLS, eventos e contratos de pendência.
- Linha do Tempo do Imóvel no portal.
- Mural de Pendências no portal.
- Minhas pendências e conclusão offline no app.

### Fase 2 — Visão territorial

- Dossiê por bairro/território com locais recorrentes e distribuição de risco.

### Fase 3 — Cobertura preventiva

- Critérios configuráveis de revisão, territórios sem inspeção recente e locais de risco sem acompanhamento.

## Qualidade e QA

A implementação será guiada por testes antes do código de produção:

- regras de permissão, estados permitidos, auditoria, sincronização offline e conflito de versões;
- componentes para carregamento, estado vazio, erro, confirmação e indicação de sincronização;
- integração do portal e app com os contratos Supabase/RLS;
- validação manual em dispositivo ou simulador, incluindo toque, legibilidade, rede intermitente e conclusão;
- execução da suíte relevante, checagem de tipos/build e revisão final do fluxo antes da entrega.

## Fora do escopo inicial

- Cadastro mestre e deduplicação definitiva de imóveis.
- Geocodificação automática de endereços legados.
- Edição operacional de dados municipais pelo console interno.
- Previsão de risco baseada em dados externos.
