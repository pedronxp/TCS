# ROADMAP — TCS - Relatório de Risco

> App móvel para vistoria técnica de risco geotécnico, integrado ao Supabase com suporte offline-first.

---

## ✅ v1.1.0 — Build Estável + UI Redesign (entregue 2026-03-31)

| Fase | Descrição |
|------|-----------|
| 01 | Correções de build — SDK 54, assets, dependências |
| 02 | Design System — tokens, tipografia, 7 componentes UI |
| 03 | UI Redesign — telas de auth e agente |
| 04 | UI Admin + Supervisor + Master |
| 05 | Segurança — SecureStore, imports dinâmicos |

---

## ✅ v1.2.0 — Funcionalidades Core (entregue 2026-04-04)

| Fase | Descrição |
|------|-----------|
| 06 | Mapa + Autenticação — token de convite, município, mapa funcional |
| 07 | Formulários + Classificação de Risco R1/R2/R3/R4 |
| 08 | Sincronização Offline — upload automático, retry, deduplicação |
| 09 | UX — mensagens em pt-br, logs admin |
| 10 | Formulário Estrutural Inteligente — skip automático, imagens contextuais |
| 11 | Mapa Nativo — Google Maps (Android) / Apple Maps (iOS) |
| 12 | Formulário Completo — 10 elementos estruturais e complementares |
| 13 | Deslizamento SVG + Thresholds técnicos (planilha oficial) |
| 14 | Bug Fixes Críticos — município, fotos PDF, safe area |
| 15 | Vistorias Agendadas — criação supervisor/admin, visualização agente |
| 16 | Sistema de Rotas — "Como Chegar" via Google Maps / Apple Maps |
| 17 | Storage + Protocolo — upload Supabase, TCS-CGS-2026-NNNNN, WhatsApp |
| 18 | Segurança — RLS, rate limiting, audit log, proteção de sessão |
| 19 | Bug Fixes + Melhorias — GPS, wizard foto, NavBar, grupos, municípios |
| 20 | Showcase + Onboarding redesenhado |

---

## 🚀 v1.3.0 — Comunicação + Produtividade (planejado)

### Fase 21 — Chat Interno da Equipe
**Objetivo:** Agentes e supervisores trocam mensagens dentro do app sem precisar de WhatsApp externo.
- Chat entre agente ↔ supervisor vinculado a uma vistoria específica
- Mensagens com timestamp, leitura confirmada e notificação push
- Histórico de conversa armazenado no Supabase (tabela `mensagens`)
- Suporte offline: mensagens ficam na fila e enviam ao reconectar

### Fase 22 — Histórico por Endereço
**Objetivo:** Qualquer usuário consulta o histórico completo de vistorias de um endereço.
- Busca por CEP, logradouro ou coordenadas GPS
- Timeline cronológica com evolução do risco (R1 → R4)
- Comparativo visual entre vistorias do mesmo imóvel
- Exportação em PDF do histórico completo

### Fase 23 — Exportação de Dados (Excel / CSV)
**Objetivo:** Admin e supervisor exportam relatórios operacionais em planilha.
- Filtros por período, agente, município e nível de risco
- Campos exportados: protocolo, endereço, risco, pontuação, agente, data
- Download direto pelo app (compartilhamento nativo)
- Formato `.xlsx` compatível com Excel e Google Sheets

### Fase 24 — Assinatura Digital nos Documentos
**Objetivo:** Laudos e relatórios gerados no app possuem assinatura eletrônica válida.
- Campo de assinatura por toque na tela (canvas)
- Assinatura embutida no PDF do laudo
- Hash SHA-256 do documento registrado no Supabase para auditoria
- Compatível com ICP-Brasil nível básico

### Fase 25 — Integração ViaCEP + Auto-preenchimento
**Objetivo:** Agente digita o CEP e o app preenche rua, bairro e cidade automaticamente.
- Chamada à API ViaCEP no campo de dados iniciais da vistoria
- Cache local de CEPs consultados (offline parcial)
- Fallback manual se a API falhar ou não houver conexão

---

## 🔭 v2.0.0 — Plataforma Avançada (backlog)

| Fase | Descrição | Prioridade |
|------|-----------|-----------|
| 26 | QR Code de vistoria — link rápido para detalhes do laudo | Alta |
| 27 | Dashboard Analytics — gráficos de tendência, mapa de calor temporal | Alta |
| 28 | Modo Tablet — layout adaptado para telas maiores | Média |
| 29 | Suporte Multilíngua — pt-br (padrão), en-US | Média |
| 30 | API Pública REST — integração com sistemas municipais externos | Baixa |
| 31 | Backup & Restauração — exportação completa do banco local | Baixa |
| 32 | Reconhecimento de Imagem — IA classifica tipo de dano pela foto | Baixa |
| 33 | Permissões Granulares — controle por campo e por ação | Média |
| 34 | Notificações por E-mail — digest diário para administradores | Baixa |
| 35 | Dark Mode Aprimorado — tema totalmente personalizado por município | Baixa |

---

## Versões e Artefatos

| Versão | Build | Data | APK |
|--------|-------|------|-----|
| 1.0.0 | 1 | — | — |
| 1.2.0 | 2 | 2026-04-04 | TCS-Relatorio-de-Risco-1.2.0.apk |
| 1.3.3 | 7 | 2026-05-26 | EAS Build Android APK |
| 1.3.4 | 8 | 2026-05-26 | Pendente novo APK |

---

*Última atualização: 2026-05-26*
