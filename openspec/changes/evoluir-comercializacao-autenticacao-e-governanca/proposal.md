## Why

O TCS já possui uma fundação de organizações, planos, portal e console interno, mas o fluxo comercial ainda não garante uma entrada sem token, cobrança confiável, protocolo isolado por cliente, municípios padronizados e governança de dados. Sem essas regras, clientes diferentes da mesma cidade podem compartilhar sequência de protocolos, vendas podem não liberar acesso de forma confiável e o produto não pode ser oferecido em escala com segurança.

## What Changes

- Substituir o token como fluxo comercial padrão por criação de conta com e-mail/senha ou Google, mantendo token apenas para convite e migração controlada.
- Modelar cada cliente como organização/sujeito de cobrança e usar município apenas como referência geográfica IBGE.
- **BREAKING**: gerar protocolos oficiais exclusivamente no servidor e escopar a numeração por organização e série, nunca apenas por município.
- Criar catálogo versionado de planos, módulos, limites, implantação, mensalidade, add-ons e serviços sob proposta; retirar Individual Básico de novas vendas sem alterar contratos legados.
- Criar o ciclo comercial fixado: trial de 2 dias, cobrança única de implantação no dia 2 e primeira mensalidade 30 dias depois da implantação.
- Integrar Mercado Pago por checkout e webhook validado, com idempotência, conciliação e estados de assinatura autoritativos.
- Criar cupons, consumo de vistorias/armazenamento/assentos, notificações transacionais e painéis internos de vendas, propostas e margem.
- Estabelecer controles de autenticação, rate limiting, auditoria, LGPD, retenção, acesso emergencial e operação de incidente.
- Publicar somente após homologação isolada, piloto controlado e liberação gradual.

## Capabilities

### New Capabilities

- `tenant-protocol-governance`: organizações como limite de isolamento e séries oficiais de protocolo concorrentes e imutáveis.
- `municipality-reference-data`: base de municípios IBGE sincronizada e seleção canônica no cadastro.
- `customer-identity-entry`: entrada de cliente por e-mail/senha ou Google, onboarding e compatibilidade de token.
- `commercial-subscription-lifecycle`: catálogo versionado, trial, implantação, mensalidade, add-ons e estados de assinatura.
- `payment-coupon-orchestration`: checkout Mercado Pago, webhook, conciliação, cupom e idempotência financeira.
- `usage-storage-enforcement`: limites autoritativos de vistorias, armazenamento, usuários e módulos.
- `commercial-finance-console`: telas internas de vendas, propostas, cupons, margem e conciliação com visibilidade por papel.
- `transactional-notification-center`: outbox de e-mail, web e push para eventos comerciais e operacionais.
- `security-privacy-operations`: proteção contra abuso, auditoria, privacidade LGPD, retenção e incidente.
- `pilot-release-governance`: homologação, feature flags, piloto, critérios de aceite e reversão.

### Modified Capabilities

- `subscription-plans`: o catálogo já iniciado passa a ter ciclo comercial aprovado, versionamento de preço, add-ons e regras de descontinuação.
- `organization-access`: organização torna-se a chave obrigatória de isolamento e de escopo de protocolos, consumo e faturamento.
- `usage-entitlements`: limites passam a incluir ocupação real de Storage, renovação dependente de pagamento e bloqueio por capacidade.
- `mobile-subscription-experience`: app passa a exibir protocolo pendente/offline, estados comerciais e notificações persistentes.
- `owner-admin-console`: console passa a incluir comercial, financeiro, propostas, cupons, privacidade e acesso restrito por função.

## Impact

- Supabase Auth, Postgres, RLS, Storage, Edge Functions, cron/scheduler e Realtime.
- Aplicativo Expo/React Native em autenticação, onboarding, criação/sincronização de vistorias, consumo e notificações.
- Dashboard React/Vite em portal do cliente e console interno.
- Integrações Mercado Pago, Google OAuth, Resend e fonte oficial de municípios IBGE.
- Contratos comerciais, aviso de privacidade, DPA com municípios, política de retenção, processo de suporte e de incidente.
