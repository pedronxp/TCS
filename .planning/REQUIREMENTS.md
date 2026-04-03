# Requirements — Defesa Civil Expo

## Milestone v1.2.0: Correções Críticas + Funcionalidades Core

**Goal:** Corrigir todos os problemas funcionais críticos do app — mapa, tokens, formulários, sincronização e UX.

---

## Active Requirements

### MAPA

- [ ] **MAPA-01**: Agente consegue visualizar o mapa sem tela branca no Android/iOS
- [ ] **MAPA-02**: Tiles do Leaflet carregam corretamente dentro da WebView

### AUTH

- [x] **AUTH-01**: Admin consegue criar token de convite e usuário consegue usá-lo imediatamente sem erro "Token expirado"
- [x] **AUTH-02**: Master admin consegue cadastrar um novo município sem erros no fluxo

### FORM

- [x] **FORM-01**: Agente consegue preencher formulário de vistoria com campos alinhados ao sistema R1/R2/R3/R4
- [x] **FORM-02**: Sistema calcula automaticamente o nível de risco (R1/R2/R3/R4) com base nas respostas do formulário
- [x] **FORM-03**: Formulário preenchido offline é salvo no SQLite e não se perde com fechamento do app
- [x] **FORM-04**: Formulário de risco estrutural (v2) tem no máximo 35 perguntas e mínimo 7 por vistoria, com skip automático quando elemento está em bom estado
- [x] **FORM-05**: Cada opção de resposta do formulário estrutural exibe imagem PNG contextual criada especificamente para aquele tipo de dano ou condição (sem imagens genéricas)
- [ ] **FORM-06**: Formulário completo de 10 elementos (estrutura principal + complementos) está disponível na seleção e pode ser preenchido pelo agente com 4 critérios por elemento
- [ ] **FORM-07**: Pontuação e classificação R1/R4 do formulário completo são calculadas corretamente usando a fórmula (estado + gravidade + extensão + ativa) × peso
- [x] **FORM-08**: Questões Q5–Q10 do formulário de deslizamento exibem ilustrações SVG específicas ao tema (não ícones genéricos) e limites de classificação correspondem à planilha técnica (R1≤1, R2≤3, R3≤5, R4>5)

### SYNC

- [x] **SYNC-01**: Dados de vistoria preenchidos offline sobem para o Supabase na próxima conexão sem duplicatas ou perda de dados

### UX

- [x] **UX-01**: Todas as mensagens de erro exibidas ao usuário estão em português (pt-br)
- [x] **UX-02**: Admin consegue visualizar a aba de logs com os registros corretos exibidos

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
| MAPA-01 | Phase 06 | pending |
| MAPA-02 | Phase 06 | pending |
| AUTH-01 | Phase 06 | Complete |
| AUTH-02 | Phase 06 | Complete |
| FORM-01 | Phase 07 | Complete |
| FORM-02 | Phase 07 | Complete |
| FORM-03 | Phase 07 | Complete |
| FORM-04 | Phase 10 | Complete |
| FORM-05 | Phase 10 | Complete |
| FORM-06 | Phase 12 | pending |
| FORM-07 | Phase 12 | pending |
| FORM-08 | Phase 13 | Complete |
| SYNC-01 | Phase 08 | Complete |
| UX-01 | Phase 09 | Complete |
| UX-02 | Phase 09 | Complete |

---

*Última atualização: 2026-04-03 — Fase 13 adicionada: Deslizamento SVG + Thresholds (FORM-08)*
