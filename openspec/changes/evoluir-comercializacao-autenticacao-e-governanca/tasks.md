## 1. Decisões e preparação

- [ ] 1.1 Aprovar catálogo inicial, preços, franquias, add-ons e retirada de venda do Individual Básico.
- [ ] 1.2 Aprovar prazo de pendência, cancelamento, retenção, reembolso e papéis internos com jurídico/comercial.
- [ ] 1.3 Validar em sandbox Mercado Pago o agendamento trial, implantação e primeira mensalidade.
- [ ] 1.4 Inventariar dados legados de cidade, organização, protocolo, token e assinatura; registrar exceções.

## 2. Tenancy, municípios e protocolos

- [ ] 2.1 Criar referência de municípios IBGE, importador, sincronização e política de atualização.
- [ ] 2.2 Adicionar município IBGE canônico às organizações/onboarding e migrar dados textuais com revisão de ambiguidades.
- [ ] 2.3 Criar séries, contadores e função idempotente de alocação de protocolo por organização.
- [ ] 2.4 Migrar protocolos existentes sem renumeração, criar índices únicos e impedir reutilização de anulados.
- [ ] 2.5 Alterar mobile/web para exibirem protocolo pendente até alocação autoritativa.
- [ ] 2.6 Testar concorrência, offline, organizações na mesma cidade e isolamento por RLS.

## 3. Identidade e onboarding

- [ ] 3.1 Configurar Google OAuth, callbacks por ambiente, e-mail/senha e verificação de e-mail.
- [ ] 3.2 Implementar entrada neutra, vínculo explícito de identidade e recuperação de senha segura.
- [ ] 3.3 Implementar onboarding idempotente de individual e organização com município canônico.
- [ ] 3.4 Restringir token a convite/migração, com hash, expiração, uso único e auditoria.
- [ ] 3.5 Testar login web/mobile, vínculo Google, conta existente, abuso e falhas de callback.

## 4. Catálogo, assinatura e pagamento

- [ ] 4.1 Modelar versões de plano, implantação, mensalidade, limites, módulos, add-ons e serviços sob proposta.
- [ ] 4.2 Implementar máquina de estados de assinatura e calendário trial/implantação/mensalidade.
- [ ] 4.3 Criar ordem de pagamento, checkout Mercado Pago, verificação de webhook e conciliação idempotente.
- [ ] 4.4 Criar cupom, reserva, elegibilidade, consumo, expiração e trilha de auditoria.
- [ ] 4.5 Testar aprovado, pendente, recusado, estorno, evento repetido e retorno de checkout sem webhook.

## 5. Limites, arquivos e notificações

- [ ] 5.1 Implementar enforcement atômico de vistorias, usuários, convites, módulos e ciclo pago.
- [ ] 5.2 Implementar ledger de Storage com reserva/finalização/exclusão/reconciliação e alertas 80/95/100.
- [ ] 5.3 Criar outbox, templates e entregas Resend, inbox web e push mobile.
- [ ] 5.4 Exibir consumo, bloqueio explicável, links de upgrade/suporte e estado comercial no portal/app.
- [ ] 5.5 Testar limites concorrentes, exclusão, falha de upload, retry de notificação e ausência de PII em alertas técnicos.

## 6. Console comercial, financeiro e privacidade

- [ ] 6.1 Criar permissões internas para comercial, financeiro, suporte, privacidade e desenvolvedor.
- [ ] 6.2 Criar telas de vendas, propostas sob proposta, cupons, assinaturas e conciliação.
- [ ] 6.3 Criar simulador de preço, taxa, custo, margem prevista e realizado.
- [ ] 6.4 Criar central de notificações e central LGPD para pedidos, exportação, correção e exclusão aplicável.
- [ ] 6.5 Implementar acesso emergencial com MFA, justificativa, expiração e auditoria.

## 7. Segurança, homologação e lançamento

- [ ] 7.1 Aplicar rate limiting, CAPTCHA progressivo, validação de upload, URLs assinadas e proteção contra enumeração.
- [ ] 7.2 Revisar RLS, segredos, logs, auditoria, contratos com operadores e plano de incidente.
- [ ] 7.3 Criar ambiente de homologação isolado com dados e credenciais de teste.
- [ ] 7.4 Executar bateria de testes de aceitação, segurança, migração e performance.
- [ ] 7.5 Executar piloto com um Individual Profissional e uma organização municipal em mesma cidade.
- [ ] 7.6 Liberar por feature flag, monitorar conversão/erros/suporte e aprovar produção comercial.
