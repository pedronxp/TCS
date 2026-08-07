# 📋 Deploy Manual via Dashboard — Funções de E-mail TCS

## ✅ PASSO 1: Configurar o Secret

1. Acesse: **https://supabase.com/dashboard/project/vobcapzssxchdckazfnr/settings/functions**

2. Na seção **"Secrets"**, clique em **"Add secret"**

3. Preencha:
   - **Name**: `RESEND_API_KEY`
   - **Value**: `YOUR_RESEND_API_KEY`

4. Clique em **"Save"**

---

## ✅ PASSO 2: Criar Edge Function `send-auth-email`

1. Acesse: **https://supabase.com/dashboard/project/vobcapzssxchdckazfnr/functions**

2. Clique em **"Deploy a new function"**

3. Escolha **"Via editor"**

4. Preencha:
   - **Function name**: `send-auth-email`
   - **Verify JWT**: ❌ **DESMARQUE** (desabilite)

5. Cole o código completo de: `supabase/functions/send-auth-email/index.ts` (360 linhas)

6. Clique em **"Deploy function"**

---

## ✅ PASSO 3: Criar Edge Function `welcome-email`

Repita o mesmo processo:

1. **"Deploy a new function"** → **"Via editor"**
2. **Function name**: `welcome-email`
3. **Verify JWT**: ❌ **DESMARQUE**
4. Cole o código completo de: `supabase/functions/welcome-email/index.ts` (206 linhas)
5. **Deploy**

---

## ✅ PASSO 4: Configurar Auth Hook

1. Acesse: **https://supabase.com/dashboard/project/vobcapzssxchdckazfnr/auth/hooks**

2. Na seção **"Send Email"**, clique em **"Edit"**

3. Configure:
   ```
   Enable: ✅ ON
   Hook URL: https://vobcapzssxchdckazfnr.supabase.co/functions/v1/send-auth-email
   HTTP Method: POST
   ```

4. Clique em **"Save"**

---

## ✅ PASSO 5: Testar

Crie uma nova conta no app ou use "Esqueci minha senha" — você deve receber os e-mails customizados TCS com os templates bonitos.

---

## 📂 Códigos Prontos

Os arquivos já estão criados no projeto:

- `supabase/functions/send-auth-email/index.ts` (449 linhas)
- `supabase/functions/welcome-email/index.ts` (206 linhas)
- `supabase/functions/_shared/defesaCivilLogo.ts` (logo em base64)

Basta copiar e colar no Dashboard.

---

## 🎨 Templates no Resend (já criados via MCP)

✅ **tcs-confirmacao-cadastro** (ID: ab04ad92-cf93-4281-a0ea-e9eccfe66e96)
✅ **tcs-redefinir-senha** (ID: 11862e58-e197-4c06-9d4b-3aa79fca3da1)
✅ **tcs-codigo-verificacao** (ID: ab2b9216-a6b4-4ce1-95c5-98e08b319827)

Todos publicados e prontos para uso.

---

## 🔧 Troubleshooting

**Se os e-mails não chegarem:**

1. Verifique os logs: **Functions → send-auth-email → Logs**
2. Confirme que o secret `RESEND_API_KEY` foi salvo corretamente
3. Verifique se o Auth Hook está habilitado e com a URL correta
4. Teste manualmente via curl:

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

---

## ⏱️ Tempo estimado: 5-10 minutos

Siga os 5 passos acima e tudo estará funcionando!
