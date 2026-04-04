---
phase: 21
title: WhatsApp OTP — Login + Validação de Número
status: backlog
prioridade: media
---

# Phase 21 — WhatsApp OTP Completo

## Objetivo
Implementar login funcional por WhatsApp usando Meta Cloud API (free tier 1.000/mês),
com validação de número no cadastro e sistema anti-abuso.

---

## Pré-requisitos (feitos antes de implementar)

- [ ] Criar conta em developers.facebook.com
- [ ] Criar App Meta → produto WhatsApp Business
- [ ] Criar e aprovar template de mensagem OTP (~24h aprovação)
- [ ] Pegar `WHATSAPP_TOKEN` e `WHATSAPP_PHONE_ID`
- [ ] Adicionar variáveis de ambiente no Supabase

---

## Plano de Implementação

### 21-01 — Migration SQL
- Tabela `otp_codes` (phone, codigo, usado, expira_em, criado_em)
- Tabela `otp_rate_limits` (phone, tentativas, bloqueado_ate, ultimo_envio)
- Coluna `telefone_verificado boolean` na tabela `users`

### 21-02 — Edge Function `send-otp`
- Verifica rate limit por número (máx 5/dia, 60s cooldown)
- Verifica rate limit por IP (máx 10/hora)
- Gera código 6 dígitos
- Salva em `otp_codes` com expiração 5min
- Chama Meta Cloud API → envia WhatsApp
- Rejeita silenciosamente números não cadastrados

### 21-03 — Edge Function `verify-otp`
- Valida código (correto + não expirado + não usado)
- Marca código como usado
- Busca uid do usuário pelo telefone
- Retorna sessão Supabase

### 21-04 — Validação no Cadastro (register.tsx)
- Após preencher campo WhatsApp, botão "Verificar Número"
- Envia OTP para o número informado
- Campo de código com countdown 60s
- Só avança para Termos após número verificado
- Salva `telefone_verificado = true` no insert final

### 21-05 — Login WhatsApp no App (login.tsx)
- Cooldown 60s com timer regressivo visível
- Chama Edge Function `send-otp` (não Supabase phone auth diretamente)
- Chama Edge Function `verify-otp` na verificação
- Fallback: "Prefere entrar por e-mail?" sempre visível

---

## Regras Anti-Abuso

| Regra | Valor |
|---|---|
| Cooldown entre reenvios | 60 segundos |
| Máx OTPs por número por dia | 5 |
| Bloqueio após limite diário | 24 horas |
| Máx requisições por IP por hora | 10 |
| Validade do código | 5 minutos |
| Reutilização do código | Não permitida |

---

## Estimativa de Consumo

| Cenário | OTPs/mês |
|---|---|
| 20 agentes, 1 login/dia | ~600 ✅ dentro do free |
| 20 agentes, 2 logins/dia | ~1.200 ⚠️ paga excedente |
| 50 agentes, 1 login/dia | ~1.500 ❌ considerar plano pago |

**Custo excedente Meta:** ~R$0,25 por conversa acima de 1.000/mês

---

## Estratégia recomendada

- Login principal: **e-mail + senha** (ilimitado, já funciona)
- Login WhatsApp: **secundário**, protegido com rate limit
- Cadastro: **valida número uma vez** (custo único por usuário)
- Fallback: **"Entrar por e-mail"** sempre disponível

---

## Notas
- Template OTP precisa ser aprovado pelo Meta (~24h, gratuito)
- Categoria "Authentication" — aprovação simples
- Números de teste gratuitos disponíveis para desenvolvimento
