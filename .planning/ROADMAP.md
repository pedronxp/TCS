# Roadmap — Defesa Civil Expo

## Milestones

- ✅ **v1.1.0** — Build Estável + UI Redesign + Qualidade (shipped 2026-03-31)
- 🚧 **v1.2.0** — Correções Críticas + Funcionalidades Core (em andamento)

---

<details>
<summary>✅ v1.1.0 — Build Estável + UI Redesign + Qualidade — CONCLUÍDO 2026-03-31</summary>

- [x] Fase 01: Correções de Build e Dependências (1/1 plano) — SDK 54 alinhado, assets criados, canary removido
- [x] Fase 02: Design System — Base Visual (3/3 planos) — tokens, tipografia, espaçamento, 7 componentes UI
- [x] Fase 03: UI Redesign — Auth + Agente (14/14 planos) — todas as telas redesenhadas com design system
- [x] Fase 04: UI Admin + Supervisor + Master (4/4 planos) — painéis administrativos padronizados
- [x] Fase 05: Segurança + Dívida Técnica (1/1 plano) — SecureStore, utils consolidados, imports dinâmicos

Detalhes: `.planning/milestones/v1.1.0-ROADMAP.md`

</details>

---

## v1.2.0 — Correções Críticas + Funcionalidades Core

### Phases

- [x] **Phase 06: Mapa + Autenticação** - Corrigir tela branca do mapa e fluxos de token/município (completed 2026-04-02)
- [x] **Phase 07: Formulários + Classificação de Risco** - Refazer campos do formulário alinhados ao R1/R2/R3/R4 com persistência SQLite (completed 2026-04-02)
- [ ] **Phase 08: Sincronização Offline** - Garantir upload de dados offline ao Supabase sem duplicatas
- [ ] **Phase 09: UX + Correções Finais** - Traduzir erros para pt-br e corrigir exibição de logs admin

### Phase Details

#### Phase 06: Mapa + Autenticação
**Goal**: Agentes conseguem visualizar o mapa funcional e admins conseguem gerenciar tokens de convite e municípios sem erros
**Depends on**: Phase 05 (v1.1.0 — stack estável)
**Requirements**: MAPA-01, MAPA-02, AUTH-01, AUTH-02
**Success Criteria** (what must be TRUE):
  1. Agente abre a tela de mapa e vê o mapa renderizado sem tela branca em Android e iOS
  2. Tiles do OpenStreetMap carregam dentro da WebView sem erros de console
  3. Admin cria um token de convite e o usuário consegue usá-lo imediatamente (no mesmo dia) sem receber "Token expirado"
  4. Master admin consegue cadastrar um novo município e o registro aparece na lista sem mensagem de erro
**Plans**: TBD
**UI hint**: yes

#### Phase 07: Formulários + Classificação de Risco
**Goal**: Agente preenche um formulário de vistoria com campos corretos, recebe classificação de risco automática R1/R2/R3/R4 e o formulário persiste offline
**Depends on**: Phase 06
**Requirements**: FORM-01, FORM-02, FORM-03
**Success Criteria** (what must be TRUE):
  1. Agente visualiza formulário de vistoria com campos alinhados ao sistema R1/R2/R3/R4 (sem campos obsoletos ou ausentes)
  2. Ao preencher o formulário, o sistema exibe automaticamente o nível de risco calculado (R1, R2, R3 ou R4) com base nas respostas
  3. Agente preenche formulário offline, fecha o app e ao reabrir os dados estão intactos no SQLite
  4. Formulário salvo offline aparece na lista de vistorias do agente com status "pendente de sincronização"
**Plans**: TBD
**UI hint**: yes

#### Phase 08: Sincronização Offline
**Goal**: Dados de vistoria coletados offline sobem automaticamente ao Supabase quando a conexão é restaurada
**Depends on**: Phase 07
**Requirements**: SYNC-01
**Success Criteria** (what must be TRUE):
  1. Formulário preenchido offline aparece no Supabase após o app recuperar conexão com a internet
  2. Sincronizar o mesmo formulário duas vezes não cria registros duplicados no Supabase
  3. Se a sincronização falhar (rede instável), os dados permanecem no SQLite e são retentados sem intervenção do agente
**Plans**: TBD

#### Phase 09: UX + Correções Finais
**Goal**: Todas as mensagens de erro estão em português e admin consegue visualizar logs corretamente
**Depends on**: Phase 06
**Requirements**: UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. Todas as mensagens de erro exibidas ao usuário final estão em português (nenhuma mensagem em inglês visível na UI)
  2. Admin abre a aba de logs e vê os registros de atividade renderizados corretamente (sem lista vazia ou layout quebrado)
  3. Erros de autenticação, sync e formulários exibem mensagens descritivas em pt-br que orientam o usuário sobre a ação a tomar
**Plans**: TBD
**UI hint**: yes

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 06. Mapa + Autenticação | 2/3 | Complete    | 2026-04-02 |
| 07. Formulários + Classificação de Risco | 1/3 | Complete    | 2026-04-02 |
| 08. Sincronização Offline | 0/? | Not started | - |
| 09. UX + Correções Finais | 0/? | Not started | - |
