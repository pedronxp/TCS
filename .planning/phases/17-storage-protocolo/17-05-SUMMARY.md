---
plan: 17-05
phase: 17-storage-protocolo
status: complete
---

## Summary

Criado `utils/shareUtils.ts` com `buildShareMessage()` que monta mensagem estruturada com protocolo, endereço, município, "Secretaria de Origem: X" (só quando `municipio_agente ≠ municipio`), nível de risco, agente e data. `resultado.tsx` e `relatorio.tsx` atualizados para usar o helper em todos os fluxos de Share e Sharing. Agente de Barbacena vistoriando em Cataguases agora vê "Secretaria de Origem: Barbacena" na mensagem.
