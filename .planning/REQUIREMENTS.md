# Requirements — Defesa Civil Expo

## Milestone v1.2.0: Correções Críticas + Funcionalidades Core

**Goal:** Corrigir todos os problemas funcionais críticos do app — mapa, tokens, formulários, sincronização e UX.

---

## Active Requirements

### MAPA

- [ ] **MAPA-01**: Agente consegue visualizar o mapa sem tela branca no Android/iOS
- [ ] **MAPA-02**: Tiles do Leaflet carregam corretamente dentro da WebView

### AUTH

- [ ] **AUTH-01**: Admin consegue criar token de convite e usuário consegue usá-lo imediatamente sem erro "Token expirado"
- [ ] **AUTH-02**: Master admin consegue cadastrar um novo município sem erros no fluxo

### FORM

- [ ] **FORM-01**: Agente consegue preencher formulário de vistoria com campos alinhados ao sistema R1/R2/R3/R4
- [ ] **FORM-02**: Sistema calcula automaticamente o nível de risco (R1/R2/R3/R4) com base nas respostas do formulário
- [ ] **FORM-03**: Formulário preenchido offline é salvo no SQLite e não se perde com fechamento do app

### SYNC

- [ ] **SYNC-01**: Dados de vistoria preenchidos offline sobem para o Supabase na próxima conexão sem duplicatas ou perda de dados

### UX

- [ ] **UX-01**: Todas as mensagens de erro exibidas ao usuário estão em português (pt-br)
- [ ] **UX-02**: Admin consegue visualizar a aba de logs com os registros corretos exibidos

---

## Future Requirements

*(Requisitos não selecionados para este milestone — candidatos para v1.3.0)*

- Upload de fotos durante vistoria
- Geração de PDF a partir dos dados do formulário preenchido
- Cache de mapa offline
- Dashboard admin com analytics

---

## Out of Scope (v1.2.0)

| Item | Motivo |
|------|--------|
| Drizzle ORM | SQL manual suficiente para v1.2.0; migrar se schema crescer |
| Resolução avançada de conflitos de sync | last-write-wins suficiente para inspeções; revisar se surgir problema real |
| i18n completo com biblioteca externa | Catálogo de strings manual é suficiente para o volume atual |

---

## Traceability

| REQ-ID | Fase | Status |
|--------|------|--------|
| MAPA-01 | — | pending |
| MAPA-02 | — | pending |
| AUTH-01 | — | pending |
| AUTH-02 | — | pending |
| FORM-01 | — | pending |
| FORM-02 | — | pending |
| FORM-03 | — | pending |
| SYNC-01 | — | pending |
| UX-01 | — | pending |
| UX-02 | — | pending |

---

*Última atualização: 2026-03-31 — Milestone v1.2.0 requisitos definidos*
