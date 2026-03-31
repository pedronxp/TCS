# Retrospectiva do Projeto

## Milestone: v1.1.0 — Build Estável + UI Redesign + Qualidade

**Concluído:** 2026-03-31
**Fases:** 5 | **Planos:** 23 | **Duração:** 7 dias | **Commits:** 67

### O que foi construído

- Build Android estabilizado do zero (SDK 54, assets, Jest, permissões)
- Design system completo com tokens e 7 componentes reutilizáveis
- 14 telas Auth + Agente redesenhadas
- Painéis Admin/Supervisor/Master padronizados
- Camada de segurança e consolidação de utils

### O que funcionou bem

- Execução paralela de planos por wave reduziu tempo total significativamente
- Design system definido na Fase 02 tornou as Fases 03/04 previsíveis e rápidas
- Atomic commits por tarefa facilitaram rastreamento e reversão
- Fallback offline SQLite implementado antes de ser pedido (fase 03)

### O que foi ineficiente

- Fase 04 gerou PHASE-04-FINAL-SUMMARY ao invés de summaries por plano — ruído nos stats
- Extração de one-liners dos SUMMARY.md pelo gsd-tools capturou ruído textual
- Tabela `municipios` e RPC `get_municipios_stats` não tinham migrations — descoberto em produção

### Padrões estabelecidos

- Button: aceitar `children` como fallback para `label` — API mais ergonômica
- Erros Supabase: sempre usar `e?.message || JSON.stringify(e)`, nunca `String(e)`
- ThemeContext: padrão 'system' sem dialog é a UX correta
- RPC ausente: tratar como warn não erro — tela funciona degradada

### Lições aprendidas

- Supabase RPCs e tabelas customizadas precisam de migration SQL documentada junto ao código
- `height: 100%` em HTML dentro de WebView não funciona — sempre usar `100vh`
- `map.invalidateSize()` é obrigatório após render do Leaflet em WebView
- `allowFileAccessFromFileURLs` + `allowUniversalAccessFromFileURLs` são necessários no Android para CDN

### Observações de custo

- Modelo: Claude Sonnet 4.6
- Sessões: múltiplas ao longo de 7 dias
- Ritmo: ~9,6 commits/dia, eficiente com wave parallelization

---

## Tendências Cross-Milestone

| Milestone | Fases | Planos | Dias | Commits/dia |
|-----------|-------|--------|------|-------------|
| v1.1.0    | 5     | 23     | 7    | ~9,6        |
