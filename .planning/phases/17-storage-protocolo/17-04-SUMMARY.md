---
plan: 17-04
phase: 17-storage-protocolo
status: complete
---

## Summary

Criado `utils/laudoExpiracaoNotif.ts` com `verificarLaudosExpirando()`: consulta SQLite por laudos gerados entre 6-7 dias atrás, agenda notificação push digest (máx 1 por dia via AsyncStorage guard) às 09:00 do dia seguinte com count agrupado. Função chamada em `dashboard.tsx` ao montar a tela para agentes — silenciosa se nada expira ou já rodou hoje.
