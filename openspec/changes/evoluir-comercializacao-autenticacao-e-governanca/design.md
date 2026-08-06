## Context

O repositório já contém organizações, memberships, planos, assinaturas, uso, portal individual/municipal, console interno e buckets privados. Há, porém, compatibilidade legada por município, protocolo sequencial baseado em município/ano e fallback no aplicativo baseado em cidade/data/hash. O produto precisa comercializar acesso sem token, cobrar por Mercado Pago, suportar Google, limites configuráveis e conformidade operacional sem misturar dados entre clientes.

Partes interessadas: cliente individual, organização municipal, equipe de campo, dono/comercial/financeiro TCS, suporte, desenvolvimento e encarregado de dados. A fonte de verdade deve ser o backend TCS; Mercado Pago confirma dinheiro, mas não concede acesso diretamente.

## Goals / Non-Goals

**Goals:**

- Isolar dados, consumo, cobrança e protocolo por organização/sujeito contratante.
- Permitir venda, trial, implantação e renovação sem ação manual insegura.
- Tornar planos e preços configuráveis e versionados, sem alterar código por venda.
- Preservar histórico, permitir operação offline segura e reduzir exposição de dados pessoais.
- Criar um lançamento testável, reversível e auditável.

**Non-Goals:**

- Definir valores comerciais finais, política fiscal ou parecer jurídico; estes serão configurações/validações externas.
- Integrar sistemas externos específicos de cada prefeitura nesta mudança; isso é serviço sob proposta.
- Reescrever o aplicativo ou o portal existente.
- Prometer exclusão de dados que precisem ser retidos por obrigação legal ou contratual.

## Decisions

### 1. Organização é o perímetro de negócio

Cada cliente individual possui um sujeito/organização própria; cada prefeitura possui uma organização própria. `municipality_ibge_code` descreve localização, mas não confere acesso nem define faturamento, consumo ou protocolo. Todas as tabelas novas com dados do cliente terão `organization_id` ou `billing_subject_id` autoritativo, RLS e índices nesse escopo.

Alternativa rejeitada: usar nome de município como tenant. Ela mistura organizações da mesma cidade e falha com homônimos entre UFs.

### 2. Protocolo oficial é uma alocação transacional no servidor

O rascunho/offline recebe somente identificador local. Ao sincronizar e atingir a transição configurada de finalização, uma função server-side aloca `protocol_series`, ano e sequência usando lock/UPSERT atômico; grava protocolo, auditoria e idempotency key na mesma transação. Devem existir `UNIQUE(protocol)` e `UNIQUE(organization_id, protocol_series, protocol_year, protocol_seq)`.

Uma prefeitura pode configurar uma série contratual; todos os membros dela compartilham a sequência. Profissionais na mesma cidade recebem séries distintas. Número anulado não é reutilizado. Protocolos legados permanecem imutáveis e contadores novos iniciam acima do maior valor já pertencente à série migrada.

### 3. Municípios são um cadastro canônico local

Uma tabela de referência armazena código IBGE de 7 dígitos, nome, UF, estado, ativo e carimbo da fonte. Processo server-side importa snapshot inicial e sincroniza regularmente, preservando códigos desativados/renomeados. Cadastro seleciona UF e município pesquisável; não faz chamada ao IBGE por dispositivo. Dados legados em texto serão conciliados, com fila para ambiguidade.

### 4. Identidade não concede autoridade

Supabase Auth atende e-mail/senha e Google, com e-mail verificado e callback em allowlist. A primeira autenticação cria identidade neutra; backend cria/associa organização, plano e papel. Vínculo Google/e-mail existente exige fluxo explícito, nunca duplicação silenciosa. Token permanece apenas como convite/migração hashado, expirável, de uso único e sem autoridade comercial.

### 5. Ciclo comercial e estados são autoritativos

O ciclo aprovado é: `trial` de 2 dias; no fim, cobrar apenas implantação; após implantação aprovada, iniciar 30 dias de uso; no dia 30 cobrar primeira mensalidade e nas datas seguintes repetir mensalidade. Estados: `trial`, `awaiting_setup_payment`, `active`, `payment_pending`, `suspended`, `cancellation_scheduled`, `cancelled`, `closed`. Prazo de pendência, retenção e política de reembolso são configuração contratual aprovada antes de produção.

Cada contrato referencia uma versão imutável de plano que contém implantação, mensalidade, moeda, limites, módulos, trial, visibilidade e regras comerciais. Individual Básico fica `retired` para novas vendas e contratos existentes preservam sua versão.

### 6. Mercado Pago e cupom usam orquestração idempotente

Backend cria intenção/checkout e grava uma ordem própria antes de chamar Mercado Pago. Webhook com assinatura válida, timestamp, deduplicação e consulta de confirmação atualiza a ordem e a assinatura em transação idempotente. Página de retorno é somente informativa. Cupom é reservado de forma atômica e consumido apenas com pagamento aprovado; cancelamento/expiração libera reserva conforme regra publicada.

Taxa efetiva recebida e custo estimado são separados. Simulação não altera contabilidade; conciliação usa dados confirmados do provedor.

### 7. Entitlements bloqueiam por capacidade, não por tela

Antes de criar/finalizar vistoria, convite, upload ou ação de módulo, RPC/Edge Function resolve organização, assinatura, versão, add-ons e uso. Vistoria é contada no ciclo da assinatura; franquia é reiniciada somente após mensalidade aprovada. Storage usa bytes de objetos ativos, com reserva antes de upload, finalização, decremento em exclusão e reconciliação periódica. Alertas 80/95/100 são configuráveis. Consulta de histórico e exportação permitida continuam disponíveis quando um limite de criação é atingido.

### 8. Console interno separado por função

`owner` gerencia catálogo, clientes e aprovações; `finance` vê cobrança/conciliação; `commercial` vê vendas/propostas/cupons; `support` trabalha com mínimo necessário; `developer` vê saúde técnica sem conteúdo pessoal por padrão; `privacy` trata solicitações LGPD. Acesso temporário a dado protegido exige MFA, justificativa, duração curta e auditoria append-only.

### 9. Notificação é outbox, não efeito de tela

Evento de domínio grava notificação e item de outbox na mesma transação. Worker entrega Resend, push e inbox web com tentativas, deduplicação, status de entrega e conteúdo mínimo. Cliente recebe confirmação de conta/pagamento/status; dono e financeiro recebem venda; desenvolvedor recebe somente falhas técnicas sem PII.

### 10. Segurança e privacidade por padrão

Rate limits são aplicados por rota, IP, identidade e organização; login/recuperação usam resposta neutra e CAPTCHA progressivo. Arquivos privados usam URLs assinadas; logs evitam PII e segredos. A central de privacidade autentica solicitante, registra pedido, prazo, evidência e resultado; retenção é aplicada por categoria. Plano de incidente inclui contenção, avaliação, comunicação e lições aprendidas.

## Risks / Trade-offs

- [Regra de cobrança agendada não ser suportada exatamente pelo produto Mercado Pago escolhido] → validar em sandbox a autorização/cobranças de implantação e mensalidade antes do desenvolvimento final; manter orquestrador próprio como fonte de calendário.
- [Migração de município ou organização legada errada] → executar relatório, reconciliação e rollout por coorte; preservar texto original.
- [Concorrência offline gera duas finalizações] → idempotency key por vistoria, transação e protocolo atribuível apenas uma vez.
- [Trial gratuito é usado abusivamente] → limite de criação no trial, rate limiting, CAPTCHA e monitoramento de fraude.
- [Exclusão LGPD conflita com retenção] → classificar dados, reter justificativa e responder ao titular de forma transparente.
- [Acesso de suporte expõe laudos/fotos] → acesso mínimo, temporário, auditado e desligado por padrão.

## Migration Plan

1. Inventariar contas, municípios, protocolos, planos e políticas legadas; gerar relatório de exceções.
2. Adicionar tabelas/campos, funções e políticas sem alterar o comportamento atual.
3. Importar municípios IBGE e reconciliar organizações/cidades.
4. Criar séries de protocolo e habilitar geração server-side por coorte; manter leitura dos históricos.
5. Publicar catálogo/ciclo de assinatura com enforcement inicialmente em homologação e piloto.
6. Integrar pagamento, notificações e console com feature flags por organização.
7. Migrar clientes aprovados, monitorar e somente então retirar fluxos legados de token/município.

Rollback: desligar feature flags e impedir novas vendas/ativações, preservando identidades, protocolos, pedidos, pagamentos, auditorias e dados. Não há rollback destrutivo nem renumeração de protocolo.

## Open Questions

- Quais são os preços, franquias e prazo de tolerância publicados para cada versão de plano?
- Qual modalidade Mercado Pago passará nos testes de cobrança após trial e mensalidade posterior?
- Qual prazo contratual/fiscal de retenção para cada categoria de documento e município?
- Quais add-ons padronizados serão autoatendimento na primeira publicação?
- Quem exercerá formalmente os papéis comercial, financeiro e encarregado de privacidade?
