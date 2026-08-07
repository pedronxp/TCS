# Deploy — send-auth-email

## 1. Fazer deploy das funções

```bash
# Na raiz do projeto (onde está supabase/config.toml)
cd C:/Users/User/orca/workspaces/TCS/Resend

# Linkar ao projeto remoto (só precisa fazer uma vez)
npx supabase link --project-ref <SEU_PROJECT_REF>

# Definir o secret RESEND_API_KEY
npx supabase secrets set RESEND_API_KEY=YOUR_RESEND_API_KEY

# Deploy das funções
npx supabase functions deploy send-auth-email --no-verify-jwt
npx supabase functions deploy welcome-email --no-verify-jwt
```

O `<SEU_PROJECT_REF>` é o ID do projeto no Supabase Dashboard (Settings → General → Reference ID).

---

## 2. Configurar o Auth Hook no Supabase Dashboard

1. Acesse: **Supabase Dashboard → Authentication → Hooks**
2. Em **"Send Email"**, clique em **Edit**
3. Habilite o hook e preencha:
   - **URL**: `https://<SEU_PROJECT_REF>.supabase.co/functions/v1/send-auth-email`
   - **HTTP Method**: `POST`
4. Salve

> ⚠️ A partir desse momento, o Supabase **para de enviar os e-mails padrão** e passa tudo para a função.

---

## 3. Testar o hook manualmente

```bash
curl -X POST https://<SEU_PROJECT_REF>.supabase.co/functions/v1/send-auth-email \
  -H "Content-Type: application/json" \
  -d '{
    "user": { "id": "test-id", "email": "pedroallvess2001@gmail.com" },
    "email_data": {
      "email_action_type": "signup",
      "token_hash": "test-hash",
      "site_url": "https://tcs.app",
      "redirect_to": "/"
    }
  }'
```

---

## 4. Disparar welcome-email após confirmação (opcional)

Você pode chamar `welcome-email` diretamente do app após o primeiro login:

```typescript
// No app, logo após supabase.auth.exchangeCodeForSession() ou verifyOtp()
await supabase.functions.invoke('welcome-email', {
  body: {
    email: user.email,
    name: user.user_metadata?.full_name ?? user.email,
  },
});
```

Ou via **Database Webhook** em `auth.users` (INSERT) no Supabase Dashboard.
