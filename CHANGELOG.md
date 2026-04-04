# Changelog — TCS Relatório e Vistoria

Todas as mudanças notáveis do projeto são documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [v1.2.0] — 2026-04-03 · Correções Críticas + Funcionalidades Core

### ✅ Fase 18 — Segurança (2026-04-03)

**Objetivo:** Blindar o app contra abusos e garantir rastreabilidade completa.

#### Adicionado
- **Rate limiting de login** — bloqueio automático após 5 tentativas em 15 minutos (AsyncStorage)
- **Rate limiting de PDF** — máximo 10 gerações de laudo por hora por usuário (Supabase RPC)
- **Rate limiting de vistoria** — máximo 30 vistorias por dia por agente (Supabase RPC)
- **Tabela `rate_limits`** no Supabase com UPSERT atômico e janela temporal
- **Função `check_rate_limit`** — RPC Supabase fail-open (não bloqueia se servidor cair)
- **Proteção de sessão** — bloqueio automático após 8h de inatividade (`SessionGuardContext`)
- **Tela de bloqueio** — `SessionLockScreen` exibida ao retornar após timeout
- **Audit log expandido** — novos tipos: `laudo_gerado`, `vistoria_acessada`, `vistoria_criada`, `login_falhou`, `agendamento_criado`, `token_usado`
- **Validação de inputs** — `sanitizarTexto`, `validarNome`, `validarMunicipio`, `validarEmail`, `validarCep` em todos os pontos de entrada
- **Constraints no banco** — `char_length` em campos de texto de `vistorias` e `users`
- **RLS audit** — política `vistorias_agent_own` (FOR ALL) dividida em SELECT + UPDATE — agentes não podiam deletar vistorias mas permissão existia implicitamente

#### Arquivos criados
- `utils/rateLimitUtils.ts`
- `utils/loginRateLimit.ts`
- `utils/validationUtils.ts`
- `context/SessionGuardContext.tsx`
- `components/SessionLockScreen.tsx`
- `supabase/migrations/phase18_rls_fix_agent_delete.sql`
- `supabase/migrations/phase18_rate_limits.sql`
- `supabase/migrations/phase18_token_security.sql`
- `supabase/migrations/phase18_input_constraints.sql`

---

### ✅ Fase 17 — Storage + Protocolo + Mensagem Rica (2026-04-03)

**Objetivo:** Laudos salvos na nuvem, protocolo oficial rastreável, mensagens profissionais.

#### Adicionado
- **Upload de fotos para Supabase Storage** — bucket `fotos/` (público), URL permanente salva no banco
- **Upload de laudos PDF** — bucket `laudos/` (autenticado), URL signed com validade de 7 dias
- **Botão "Baixar Laudo Salvo"** (verde) — acessa laudo salvo na nuvem quando disponível
- **Botão "Regenerar Laudo"** (amarelo) — reprocessa laudo quando URL expirada (>7 dias)
- **Protocolo sequencial** — formato `TCS-CGS-2026-00001` gerado por trigger no banco (`contadores_protocolo`)
- **Coluna `municipio_agente`** — diferencia cidade do agente da cidade da vistoria em atendimentos cross-município
- **Mensagem WhatsApp rica** — incluindo protocolo, endereço, risco, data e "Secretaria de Origem" (quando cross-município)
- **Notificação digest de laudos** — alerta diário (máx 1/dia) quando laudos estão prestes a expirar

#### Arquivos criados
- `services/StorageService.ts`
- `utils/shareUtils.ts`
- `utils/laudoExpiracaoNotif.ts`
- `supabase/migrations/phase17_vistorias_protocolo.sql`
- `supabase/migrations/phase17_storage_buckets.sql`

#### Arquivos modificados
- `utils/database.ts` — migration v7: colunas `municipio_agente`, `laudo_url`, `laudo_gerado_em`
- `app/(panel)/inspecoes/wizard.tsx` — upload foto ao criar vistoria
- `app/(panel)/inspecoes/resultado.tsx` — upload PDF, botões laudo, protocolo
- `app/(panel)/dashboard.tsx` — trigger de verificação de laudos expirando

---

### ✅ Fase 16 — Sistema de Rotas (2026-04-03)

**Objetivo:** Agente traça rota até o local da vistoria com um toque.

#### Adicionado
- **Botão "Como Chegar"** na tela de detalhe da vistoria `[id].tsx`
- **Botão "Como Chegar"** no popup de marcador do mapa
- **Abertura nativa de mapas** — Google Maps no Android, Apple Maps no iOS
- **Fallback para URL universal** (`maps.google.com`) caso app não esteja instalado

#### Arquivos criados
- `utils/routingUtils.ts`

#### Arquivos modificados
- `app/(panel)/inspecoes/[id].tsx`
- `app/(panel)/mapas.tsx`

---

### ✅ Fase 15 — Vistorias Agendadas (2026-04-03)

**Objetivo:** Supervisor/Admin agenda vistorias; agente visualiza com ícone no header.

#### Adicionado
- **Tabela `agendamentos`** no Supabase (com RLS) e na SQLite local (migration v6)
- **Tela de agendamentos** para Supervisor/Admin/Master — criar, listar, cancelar
- **Tela de detalhe do agendamento** — ações concluir/cancelar com sync
- **Ícone de agendamentos** no header de todas as telas do painel
- **Lista de agendamentos para o agente** — visualizar próximas vistorias atribuídas
- **Notificação push** ao criar novo agendamento para um agente

#### Arquivos criados
- `app/(panel)/inspecoes/agendamentos.tsx`
- `supabase/migrations/20260403_agendamentos.sql`

#### Arquivos modificados
- `utils/database.ts` — migration v6: tabela `agendamentos`
- `components/BottomNavBar.tsx` — ícone de agendamentos
- `services/NotificationService.ts` — notificação de agendamento criado

---

### ✅ Fase 14 — Bug Fixes Críticos (2026-04-03)

**Objetivo:** Corrigir problemas que afetavam usuários em produção.

#### Corrigido
- **Município errado nos relatórios** — usando município do agente em vez da cidade da vistoria
- **Foto não aparecia no PDF** — URI local não era convertida para base64 corretamente
- **Banner offline sobrepondo conteúdo** — layout sem safe area causava sobreposição no iOS
- **Safe area inconsistente** — headers e footers não respeitavam notch/Dynamic Island em alguns dispositivos

#### Arquivos modificados
- `utils/laudoPdfBuilder.ts`
- `components/ConnectivityBanner.tsx`
- `app/(panel)/inspecoes/resultado.tsx`
- Múltiplas telas: ajuste de `paddingTop` com `useSafeAreaInsets`

---

### ✅ Fase 13 — Deslizamento SVG + Thresholds (2026-04-03)

**Objetivo:** Ilustrações técnicas no formulário de deslizamento + limiares corretos.

#### Adicionado
- **SVGs inline** nas questões Q5–Q10 do formulário de deslizamento — trincas, degraus, muros, escorregamento
- **Catálogo DESL_SVGS** com 15+ ilustrações técnicas renderizadas via `react-native-svg`

#### Corrigido
- **Limiares de classificação do formulário de deslizamento** — alinhados à planilha técnica original: R1 ≤ 1 ponto, R2 ≤ 3, R3 ≤ 5, R4 > 5

#### Arquivos criados
- `utils/deslizamentoSvgs.ts`

#### Arquivos modificados
- `assets/formularios/deslizamento_campo.json` — thresholds corrigidos
- `app/(panel)/inspecoes/wizard.tsx` — renderização de SVG por resposta

---

### ✅ Fase 12 — Formulário Completo — 10 Elementos (2026-04-03)

**Objetivo:** Formulário de avaliação estrutural completa com 10 elementos ponderados.

#### Adicionado
- **Formulário "Avaliação Completa — 10 Elementos"** — 4 estruturais + 6 complementares
- **Pontuação ponderada por elemento** — (estado + gravidade + extensão + ativa) × peso
- **Classificação composta** — baseada no maior elemento e média ponderada total
- Formulário disponível na tela de seleção ao lado dos demais built-ins

#### Arquivos criados
- `assets/formularios/avaliacao_completa_v1.json`

---

### ✅ Fase 11 — Mapa Nativo (2026-04-03)

**Objetivo:** Substituir WebView+Leaflet por mapa nativo sem tela branca.

#### Mudança Breaking
- **Removido:** WebView + Leaflet.js + OpenStreetMap
- **Adicionado:** `react-native-maps` com Google Maps (Android) e Apple Maps (iOS)

#### Adicionado
- Mapa renderiza tiles nativos do Google Maps no Android — sem tela branca
- Mapa renderiza tiles do Apple Maps no iOS — sem tela branca
- Marcadores de vistoria com cores por nível de risco (R1–R4)
- Filtros por risco, período e agente
- Popup de marcador com dados resumidos da vistoria
- Heatmap de densidade de vistorias
- Modal de seleção de estilo de mapa
- Clustering de marcadores em áreas densas

#### Arquivos modificados
- `app/(panel)/mapas.tsx` — reescrita completa com react-native-maps

---

### ✅ Fase 10 — Formulário Estrutural Inteligente (2026-04-02)

**Objetivo:** Formulário adaptativo com skip automático e imagens contextuais.

#### Adicionado
- **Lógica condicional `skipSe`** — perguntas de gravidade/extensão/foto puladas quando elemento em bom estado (7 → 35 perguntas dependendo do estado)
- **Progresso por elemento** — indicador visual de etapas do formulário
- **30+ imagens PNG contextuais** — foto específica por tipo de resposta (fissura, trinca, rachadura, etc.)
- **Formulário `risco_estrutural_v2.json`** — alinhado à planilha técnica com pesos por elemento

#### Arquivos criados
- `assets/formularios/imagens/est_bom.png`, `est_regular.png`, `est_grave.png`, etc. (30+ PNGs)
- `assets/formularios/risco_estrutural_v2.json`

#### Arquivos modificados
- `app/(panel)/inspecoes/wizard.tsx` — engine de skip condicional
- `utils/formulariosAssets.ts` — novo formulário no catálogo

---

### ✅ Fase 09 — UX + Correções Finais (2026-04-03)

**Objetivo:** Todas as mensagens de erro em português. Logs admin funcionando.

#### Adicionado
- **Tradução de todos os erros Supabase** → português em `utils/authErrors.ts`
- Mensagens de erro descritivas e acionáveis para o usuário final

#### Corrigido
- **Tela de logs do admin** — substituído `system_logs` Supabase por `getLogs()` SQLite (dados corretos exibidos)

#### Arquivos criados
- `utils/authErrors.ts`

#### Arquivos modificados
- `app/(auth)/login.tsx`
- `app/(panel)/master/logs.tsx`

---

### ✅ Fase 08 — Sincronização Offline (2026-04-03)

**Objetivo:** Dados offline sobem ao Supabase sem duplicatas quando conecta.

#### Adicionado
- **Deduplicação via upsert** — mesmo dado nunca cria duplicatas no Supabase
- **Sync em lotes de 20** com fallback individual por registro
- **Máximo 5 tentativas** por registro — descartado após esgotar tentativas
- **AppState listener** para sync automático ao retornar ao foreground
- **VACUUM SQLite** após sync bem-sucedido

#### Corrigido
- **Gap de sync no mount** — `_layout.tsx` agora dispara sync imediato ao entrar no painel online

#### Arquivos criados/modificados
- `services/SyncService.ts` — lógica completa de sync resiliente

---

### ✅ Fase 07 — Formulários + Classificação de Risco (2026-04-02)

**Objetivo:** Formulário alinhado ao sistema R1/R2/R3/R4 com persistência offline.

#### Adicionado
- **Schema JSON padronizado** para formulários de vistoria
- **Classificação automática R1–R4** baseada em limiares configuráveis por formulário
- **Persistência offline via SQLite** — formulários preenchidos nunca são perdidos
- Indicador de "pendente de sincronização" na lista de vistorias

#### Arquivos criados
- `utils/riscoUtils.ts`
- `assets/formularios/estrutural.json`
- `assets/formularios/deslizamento_campo.json`
- `assets/formularios/inundacao.json`

---

### ✅ Fase 06 — Mapa + Autenticação (2026-04-02)

**Objetivo:** Mapa funcional + fluxo de token/município sem erros.

#### Corrigido
- **Tela branca do mapa** em Android e iOS
- **Bug de expiração de token de convite** — token recém-criado aparecia como expirado
- **Erro ao cadastrar municípios** pelo Master Admin

---

## [v1.1.0] — 2026-03-31 · Build Estável + UI Redesign + Qualidade

### ✅ Fase 05 — Segurança + Dívida Técnica

- `SecureStore` para armazenamento de tokens sensíveis
- Utils consolidados e imports dinâmicos corrigidos

### ✅ Fase 04 — UI Admin + Supervisor + Master

- Painéis administrativos redesenhados com design system
- Admin: 9 módulos (usuários, tokens, formulários, estatísticas, relatórios, logs, editor)
- Supervisor: gestão de equipe, atribuições e acompanhamento
- Master: municípios, logs globais, visão consolidada

### ✅ Fase 03 — UI Redesign Auth + Agente

- Todas as telas do agente redesenhadas com design system
- Telas de auth: welcome, login, registro, recuperação de senha, onboarding
- Telas do agente: dashboard, mapa, vistorias, perfil, módulos

### ✅ Fase 02 — Design System

- Tokens de cor (light/dark), tipografia e espaçamento
- 7 componentes UI reutilizáveis: Button, Card, Input, Badge, Avatar, Spinner, Divider
- Tema automático seguindo configuração do sistema

### ✅ Fase 01 — Correções de Build

- Expo SDK 54 alinhado
- Assets criados (ícone, splash, notificação)
- Dependências canary removidas
- Build estável para Android e iOS

---

## Legenda de Status

| Símbolo | Significado |
|---------|-------------|
| ✅ | Concluído e em produção |
| 🔧 | Em desenvolvimento |
| 📋 | Planejado |
| ⚠️ | Requer atenção |

---

<div align="center">
  <sub>TCS — Relatório e Vistoria · Desenvolvido por <strong>Pedronxp</strong></sub>
</div>
