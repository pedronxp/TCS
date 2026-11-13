# 🗺️ MAPA DE TELAS — TCS "Relatório de Risco" (App Mobile + Dashboard Web)

> Gerado por exploração completa do código-fonte real (`TCS/`) · 08/10/2026
> Stack: Expo SDK 57 + RN 0.86 + Expo Router + Supabase + SQLite offline-first · Dashboard: React 18 + Vite + Tailwind + Radix/shadcn

---

## 0. Shell / Estrutura de navegação

- **`app/_layout.tsx`** — Providers globais (Connectivity → Theme → Auth → Subscription → Training → Report → Notification → ForceUpdate) + roteamento por estado (onboarding? autenticado? treinamento?) + deep links + navegação por push (vistoria→inspecoes, qe→qe, suporte, cobrança→assinatura, avisos, tokens, qe_devolvida→inspecoes/[id]).
- **`(panel)/_layout.tsx`** — guarda por papel (admin/supervisor/qe/master/internal), guarda de suspensão de cobrança (libera só assinatura/suporte/dashboard), **WEB_ONLY_ROUTES** (form-editor, editor-perguntas, risco-config, tokens, gerar-token, master/municipios|logs|contratacoes → redirecionam ao `/modulos`), sync automático ao reconectar, **BottomNavBar** por papel (Agente: Início/Vistorias/Avisos/Módulos · Admin: Início/Mapa/Avisos/Módulos · Internal: conforme permissões) com badge de notificações.
- **`onboarding.tsx`** — carrossel 4 slides (vistoria, offline, risco R1-R4, perfis); grava `@onboarding_done`.
- **`showcase.tsx`** — vitrine do fluxo (Contexto → Coleta → Classificação → Laudo) + módulos.

## 1. Auth (`app/(auth)/`)

| Tela | Arquivo | Função | UI principal | Estados |
|---|---|---|---|---|
| Boas-vindas | `index.tsx` | Porta de entrada + chip de conectividade | ProductIdentity, RiskBar, Card preview | 3 variantes de conexão |
| Login | `login.tsx` | E-mail/senha + Google + Turnstile; valida perfil municipal × staff | Tabs E-mail/WhatsApp, FormField, StateBanner, GoogleMark | loading, erro, rate-limit por e-mail |
| Cadastro | `register.tsx` | Multi-etapa: form → termos → permissões → sucesso; token convite XXXX-XXXX-XXXX; LGPD | Stepper animado, medidor de senha, permissões câmera/GPS/push | loading, erros de token RPC |
| Planos públicos | `planos.tsx` | `PlanCatalogScreen mode="public"` + modal de solicitação | Cards de planos, seletor audiência/ciclo | submitting, Alert |
| Preview | `preview.tsx` | Demo sem conta (2 vistorias/aparelho) → sessão de treino | Card de limite, StateBanner | loading, blocked, error |
| Treinamento requer conta | `treinamento.tsx` | Informativo | Card + 3 botões | — |
| Recuperar senha | `forgot-password.tsx` | Link por e-mail (resposta indistinguível) + Turnstile | Form + tela "Confira seu e-mail" | loading, sent, error |
| Verificar OTP | `verify-otp.tsx` | Código 6 dígitos, reenvio 60s | Input de código, contador | loading, erro, timer |
| Redefinir senha | `reset-password.tsx` | Nova senha + revogar outras sessões | Medidor de força, tela sucesso | sessão inválida, loading |
| Concluir cadastro | `customer-onboarding.tsx` | Pós-Google: individual ou convite municipal + termos | ChoiceCard radio, input convite | erros mapeados (expirado/usado/limite) |

## 2. Painel principal (`app/(panel)/`)

| Tela | Arquivo | Função | UI | Estados |
|---|---|---|---|---|
| Dashboard Agente | `dashboard.tsx` | Métricas do turno, widgets, banner cobrança, CTA nova vistoria | MetricCards, AlertasRisco/QePendencias widgets, BillingBanner, pull-to-refresh | metricsLoading, ErrorState+retry, banners offline/sync |
| Dashboard Supervisor | `supervisor/index.tsx` | Visão municipal: totais, alto risco, ranking vs meta | MetricCards, ranking com barras | loading, pull-to-refresh |
| Dashboard Admin | `admin/index.tsx` | KPIs RPC `get_dashboard_kpis_admin`, checklist onboarding org | MetricCards, CustomerOnboardingChecklist | erro, banners |
| Dashboard Master | `master/index.tsx` | Rede TCS inteira + risco por cidade (modal) | MetricCards, modal | loading, erro |
| Dashboard Interno | `internal/index.tsx` | Owner/dev/support/auditor por permissão | MetricCards, ModuleCards, StateBanner | loading, sem permissão |
| Detalhe do Agente | `agente.tsx` | Stats por risco + histórico | 4 MetricCards, chips filtro, EmptyState | loading, empty |
| Equipe | `equipe.tsx` | Agentes com contagem por nível | Dropdown modal próprio | loading |
| Coordenação | `coordenacao.tsx` | Convites (72h), membros, sessões ativas | FormField, cards membro/sessão | acesso restrito, loading |
| Mapa Tático | `mapas.tsx` | Vistorias georref. offline + heatmap + pins por risco + rota | react-native-maps (Heatmap, MarkerPin custom), rail de filtros, bottom-sheets | loading, empty, modo offline |
| Módulos | `modulos.tsx` | Catálogo por papel com busca | Busca, ModuleCard grid | filtro runtime |
| Perfil | `perfil.tsx` | Dados, Google, **7 temas** (Sistema/Claro/Escuro/Orca/Dracula/Nord/Gruvbox), push | OptionSheet de tema | authLoading, offline |
| Planos | `planos.tsx` | `PlanCatalogScreen mode="panel"` | igual auth | — |
| Minha assinatura | `assinatura.tsx` | Consumo por recurso, faturas, convite, status portal | PortalStateCard, SecaoFaturas, barras de uso | loading/error do contexto |
| Suporte | `suporte.tsx` | Abre chamado + lista tickets | FormFields, Badges status | busy, carregando |
| Ticket | `suporte/[id].tsx` | Timeline de eventos + resposta | Badge, timeline | carregando, enviando |
| Avisos | `avisos/index.tsx` | Inbox por severidade (Info/Alerta/Emergência), cache 45s offline | Cards severidade, Modal leitura | loading, empty |
| Grupos | `grupos/index.tsx`+`[id].tsx` | Grupos locais (SQLite) + membros | Modal criação, ConfirmSheet | loading, empty |
| Fila QE | `qe/index.tsx` | Revisão de qualidade (RPC `qe_fila`) | Badge risco+ciclo, cards | loading, empty "Fila vazia" |
| Revisar QE | `qe/[id].tsx` | Checklist 5 itens, nota 0-10, Aprovar/Devolver | OptionSheet nota, fotos | loading, salvando |
| Agenda | `agendamentos/index.tsx`+`[id].tsx` | Tarefas por papel, criação, concluir/iniciar vistoria vinculada | MetricCards status, Badge "FEITO NA WEB", modal criação | loading, validação de data |
| Treinamento | `treinamento/index.tsx`+`acesso.tsx` | Sessão isolada de treino, métricas, cota preview; turma por código | MetricCards, StateBanner, histórico | sessão expirada, preview bloqueado |

## 3. VISTORIA — fluxo completo (`app/(panel)/inspecoes/`)

> index → dados-iniciais (1/3) → selecao-formulario (2/3) → wizard (3/3) → resultado → (laudo | relatorio | foto | ciencia) → [id]

- **`index.tsx` — Lista:** offline-first (SQLite + Supabase 50), badges R1-R4 + status de sync (Pendente/Erro/Feita offline/Sincronizada), busca, chips de filtro, exclusão local, sync manual. Estados: loading/erro+retry/empty com ação.
- **`dados-iniciais.tsx` — Passo 1 (Local):** GPS alta precisão + reverse geocoding (Nominatim) + CEP (ViaCEP) + município com origem (gps/cep/perfil/manual), banner de divergência, footer fixo. Estados: detectandoGps, buscandoCep, precisão ±Xm.
- **`selecao-formulario.tsx` — Passo 2 (Tipo):** 7 builtin (Inundação, Incêndio Vegetação, Ponte/Passarela, Bueiro/Drenagem, Árvore CBMMG, Deslizamento v3, Estrutural v2) + personalizados publicados (cache SQLite), features do plano, formulários da turma. Radio-cards com ícones coloridos.
- **`wizard.tsx` — Passo 3 (CORAÇÃO):** pergunta-a-pergunta com visibilidade condicional; opções em grid com imagens/SVG; observação obrigatória contextual; campos decimais com unidade; **foto por pergunta**; banner flutuante "RISCO ATUAL · N pontos" (Animated); cálculo `soma_total` ou `ponderada_max_elemento`; rascunho debounced 800ms (retomada); finalizar → SQLite primeiro → RPC `sync_finalized_inspection` (protocolo oficial) → upload fotos → auditoria. Feature bloqueada → assinatura.
- **`resultado.tsx` — Hub pós-vistoria:** timeline (salva → QE com parecer → ciência), laudo/termo via OptionSheet (abrir/compartilhar/imprimir/escolher modelo), revisar relatório, ciência com SignaturePad, evidências fotográficas. Cooldown 15min/PDF.
- **`foto.tsx` — Evidências:** até 3 fotos extras, URLs assinadas, upload individual com estado por foto.
- **`laudo.tsx` — Laudo oficial:** `buildLaudoHtml` → expo-print → upload → registro de geração; **Modal Termo de Interdição** (dados do notificado com máscaras).
- **`relatorio.tsx` — Relatório editável:** prévia de papel com protocolo `TCS·CIDADE—DATA—HASH` em partes coloridas, respostas por fase com pesos, campos editáveis inline (conduta/observações/cargo), Gerar PDF/Imprimir/Compartilhar/Termo.
- **`ciencia.tsx` — Ciência eletrônica:** outcome (Ciente/Recusa/Impossibilidade), nome/vínculo, **SignaturePad (SVG + PanResponder)**, testemunha opcional, WebView de preview, recibo, histórico remoto com retry, correção com motivo.
- **`risco.tsx` — Legado:** resultado + conduta por nível (R1 monitorar → R4 evacuar/Bombeiros) + comprovante em Modal.
- **`[id].tsx` — Detalhe:** risco (ícone+cor+pontos), dados com ícones, galeria horizontal + Modal fullscreen, ciência por versão (confirmada/pendente/falha/superseded), banner sync com ação, excluir local, traçar rota.

## 4. Admin (`app/(panel)/admin/`) — município

Painel (KPIs) · **Usuarios** (paginado RPC, aprovar/suspender/redefinir) · **Tokens** (métricas + cota com barra) · **Gerar-token** (quota 80%/100% colorida, modal revisão) · **Estatisticas** (bar chart em Views puro, período) · **Relatorios** (filtros → laudo) · **Form-editor** (CRUD modelos) · **Editor-perguntas** (perguntas/opções/pesos + versionamento) · **Risco-config** (faixas R1-R4 + texto orientação, sync nuvem) · **Logs** (auditoria local) · **Protocolo-doc** (anatomia `TCS-{code}-AAAA-000001` + FAQ) · **Personalizar-dashboard** (widgets por papel: ordem ↑↓ + Switch).
⚠️ WEB_ONLY no mobile: form-editor, editor-perguntas, risco-config, tokens, gerar-token.

## 5. Master (`app/(panel)/master/`)

Visão global (rede, ranking, risco por cidade) · **Treinamentos** (turmas, códigos, limite) · **Municipios** (rede) · **Logs globais** · **Contratacoes** (aprovação manual de solicitações de plano). ⚠️ Últimas 3 = web-only no mobile.

## 6. Dashboard Web — Protocolos (`dashboard/src/pages/Protocol*.tsx`)

- **`ProtocolsPage`** — "Pesquisa de protocolos": busca por protocolo/cidade/prefeitura/agente/risco (RPC `search_internal_protocol_registry`, 25/pág., filtros na URL via useSearchParams), tabela desktop + lista mobile, paginação, **séries municipais** (rotação auditada com MFA + HighRiskDialog), BrazilStateSelect/MunicipalityPicker.
- **`ProtocolInspectionPage`** — "Investigação da vistoria": dossiê com resumo + evidências (laudo/relatório/termo/fotos) autorizadas via Edge Function `internal-protocol-resource` (links temporários), versões do laudo com ciência, timeline completa, bloco "Dados pessoais protegidos" sem `canViewSensitive`.
- **`ProtocolDocumentWorkspacePage`** — Workspace por kind: laudo (ver/baixar), relatório (observações/base legal/técnico + **assinatura obrigatória** via SignaturePad web em canvas), termo (R3/R4, 8 campos do notificado), fotos; gera PDF via popup com o **mesmo `laudoPdfBuilder` do mobile**; RPC `mark_inspection_document_generated`.

## 7. 🎨 Sistema de estilo (para telas novas consistentes)

### Mobile — RN puro com tokens (SEM Tailwind/NativeWind)
- `StyleSheet.create` + `useTheme()` (ThemeContext). Tokens em `constants/`: **Colors.ts** (6 paletas: light/dark/orca/dracula/nord/gruvbox · light: bg #FAFAFA, surface #FFF, fg/primary #171717, muted #666, border #E0E0E0, success #22C55E, warning #C77A00, danger #C0291D, riscoR3 #D9531F, riscoR1..R4) · **Typography.ts** (xs 11 → 4xl 32, pesos 400-800) · **Spacing.ts** (base 4, TouchTarget 44/48, input 48).
- Design system `components/ui/`: Screen, AppHeader, Card, Button (primary/secondary/ghost/danger + loading + icons), **Badge com variantes R1-R4**, EmptyState, LoadingState, ErrorState (retry), StateBanner (info/success/warning/danger + ação), SectionHeader, FormField, FlowProgress (X/Y), ListRow, MetricCard, ModuleCard, ConfirmSheet, OptionSheet.
- Ícones: Feather (padrão) + MaterialCommunityIcons (formulários). Especializados: SignaturePad, TurnstileChallenge, BottomNavBar, ConnectivityBanner, BillingBanner, PortalStateCard.
- Padrão visual: SafeArea + AppHeader, ScrollView padding 16, footer fixo (Cancelar + Primário flex 2), cards border 1 + radius 12-16, chips pill, risco sempre semântico, accessibilityRole/Label consistente.

### Dashboard Web — Tailwind + shadcn/Radix (CSS vars HSL)
- `index.css`: tokens `--background/--card/--primary/--muted/--border/--success(+soft)/--warning(+soft)/--destructive(+soft)/--info(+soft)/--risk-r1..r4/--radius 1.25rem` + temas `data-theme` (light/dark + orca/dracula/nord/gruvbox) — **mesma identidade monocromática do mobile**.
- Fonte Inter (@fontsource), ícones lucide-react, dados react-query, mapa maplibre-gl, gráficos recharts. `AsyncBoundary` para estados; `HighRiskDialog` para operações sensíveis.

### Padrões transversais
- **Offline-first:** SQLite fonte primária; SyncService com fila/tombstones; badges por registro.
- **Estados:** LoadingState/ErrorState(retry)/EmptyState(actionLabel)/StateBanner — nunca spinner cru.
- **Risco:** sempre `resolverApresentacaoRisco` + cores `theme.riscoR*` — nunca hardcode.
- **Navegação:** params serializados entre etapas; `safeBack` com fallback; redirect por papel; push navega para rota específica.

*Cobertura: todos os arquivos listados existem e foram lidos. Telas "web-only" têm implementação completa no app, mas o guard do painel mobile as redireciona (consumidas no console web).*
