---
plan: 18-05
phase: 18-seguranca
status: complete
completed_at: 2026-04-03
---

## One-liner
Audit log expandido: 6 novos tipos de ação adicionados a `auditLogger.ts`; `laudo_gerado`, `vistoria_acessada`, `vistoria_criada` e `login_falhou` registrados nos pontos críticos do app.

## What was done
- `utils/auditLogger.ts`: tipos `laudo_gerado`, `vistoria_acessada`, `vistoria_criada`, `login_falhou`, `agendamento_criado`, `token_usado` adicionados ao enum `AuditAction`
- `resultado.tsx`: `vistoria_acessada` ao carregar dados + `laudo_gerado` após gerar PDF com sucesso
- `wizard.tsx`: `vistoria_criada` após salvar localmente
- `login.tsx`: `login_falhou` após erro de autenticação (authError e conta não aprovada)

## Files changed
- `utils/auditLogger.ts` (novos AuditAction types)
- `app/(panel)/inspecoes/resultado.tsx` (audit logs)
- `app/(panel)/inspecoes/wizard.tsx` (audit log)
- `app/(auth)/login.tsx` (audit log)
