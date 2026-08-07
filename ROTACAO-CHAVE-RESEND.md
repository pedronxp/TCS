# 🔄 Rotação de Chave Resend API

**Data**: 2026-08-06  
**Motivo**: Chave antiga exposta em arquivos do repositório

---

## ⚠️ Chave Antiga (EXPOSTA - NÃO USAR)
```
re_*********************
```

Esta chave foi exposta nos seguintes arquivos (já removida e rotacionada):
- ~~`.mcp.json`~~
- ~~`DEPLOY-MANUAL.md`~~
- ~~`DEPLOY-VIA-DASHBOARD.md`~~
- ~~`supabase/functions/send-auth-email/DEPLOY.md`~~

---

## 📋 Passos para Rotação

### 1️⃣ Criar Nova Chave no Resend

1. Acesse: **https://resend.com/api-keys**
2. Clique em **"Create API Key"**
3. Preencha:
   - **Name**: `TCS Production - 2026-08`
   - **Permission**: `Sending access`
4. **COPIE A NOVA CHAVE** (você só verá ela uma vez!)

---

### 2️⃣ Atualizar no Supabase Dashboard

1. Acesse: https://supabase.com/dashboard/project/vobcapzssxchdckazfnr/settings/functions
2. Na seção **"Secrets"**, localize `RESEND_API_KEY`
3. Clique em **"Edit"** (ícone de lápis)
4. Cole a **nova chave**
5. Clique em **"Save"**

---

### 3️⃣ Atualizar no `.mcp.json` (local)

Abra o arquivo `.mcp.json` e substitua a chave antiga pela nova:

```json
{
  "mcpServers": {
    "resend": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "resend-mcp"],
      "env": {
        "RESEND_API_KEY": "SUA_NOVA_CHAVE_AQUI"
      }
    }
  }
}
```

**⚠️ IMPORTANTE**: O arquivo `.mcp.json` já está no `.gitignore` para não ser commitado.

---

### 4️⃣ Reiniciar Claude Code

Depois de atualizar o `.mcp.json`, reinicie o Claude Code para carregar a nova chave.

---

### 5️⃣ Deletar Chave Antiga no Resend

1. Acesse: **https://resend.com/api-keys**
2. Localize a chave antiga: `re_*********************`
3. Clique em **"Delete"** → Confirme

---

### 6️⃣ Testar

Envie um email de teste para confirmar que a nova chave funciona:

```bash
curl -X POST https://vobcapzssxchdckazfnr.supabase.co/functions/v1/send-auth-email \
  -H "Content-Type: application/json" \
  -d '{
    "user": {"id": "test", "email": "pedroallvess2001@gmail.com"},
    "email_data": {
      "email_action_type": "signup",
      "token_hash": "test123",
      "site_url": "https://tcs.app"
    }
  }'
```

Ou crie uma nova conta no app TCS.

---

## ✅ Checklist

- [ ] Nova chave criada no Resend Dashboard
- [ ] Chave atualizada no Supabase Secrets
- [ ] Chave atualizada no `.mcp.json` local
- [ ] Claude Code reiniciado
- [ ] Chave antiga deletada no Resend
- [ ] Email de teste enviado com sucesso

---

## 🔒 Boas Práticas

1. **Nunca commite secrets** no git
2. Use `.gitignore` para arquivos com secrets (`.mcp.json`, `.env`, etc.)
3. **Rotacione chaves regularmente** (a cada 90 dias)
4. Use **chaves com permissões mínimas** necessárias
5. **Delete chaves antigas** imediatamente após rotação

---

## 📞 Suporte

- **Resend Docs**: https://resend.com/docs
- **Supabase Secrets**: https://supabase.com/docs/guides/functions/secrets
