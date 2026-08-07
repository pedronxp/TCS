# 🚀 Deploy Manual — Funções de E-mail TCS

## Passo 1: Login no Supabase CLI

Abra o terminal no diretório do projeto:

```bash
cd C:/Users/User/orca/workspaces/TCS/Resend
```

Faça login (vai abrir o navegador automaticamente):

```bash
npx supabase login
```

## Passo 2: Link ao Projeto

```bash
npx supabase link --project-ref vobcapzssxchdckazfnr
```

Se pedir senha do banco, pegue em:
**Dashboard → Settings → Database → Connection string → Password**

## Passo 3: Configurar Secret

```bash
npx supabase secrets set RESEND_API_KEY=YOUR_RESEND_API_KEY
```

## Passo 4: Deploy das Funções

```bash
npx supabase functions deploy send-auth-email --no-verify-jwt
npx supabase functions deploy welcome-email --no-verify-jwt
```

---

## ⚙️ Configurar Auth Hook no Dashboard

Depois do deploy bem-sucedido:

### 1. Acesse o Dashboard
https://supabase.com/dashboard/project/vobcapzssxchdckazfnr/auth/hooks

### 2. Configure o Hook "Send Email"

Clique em **Edit** na seção "Send Email" e configure:

```
Enable: ✅ ON
URL: https://vobcapzssxchdckazfnr.supabase.co/functions/v1/send-auth-email
HTTP Method: POST
```

Clique em **Save**.

### 3. Teste

Crie uma nova conta no app ou use "Forgot Password" — você receberá os e-mails customizados no lugar dos templates padrão do Supabase.

---

## 📧 Ativar Welcome Email (Opcional)

Para disparar o e-mail de boas-vindas após confirmação de cadastro, adicione no app após login:

```typescript
// app/(auth)/register.tsx ou onde confirma o OTP
const { data: { user } } = await supabase.auth.getUser();

if (user) {
  await supabase.functions.invoke('welcome-email', {
    body: {
      email: user.email,
      name: user.user_metadata?.full_name ?? user.email,
    },
  });
}
```

Ou configure um **Database Webhook** no Dashboard:
- **Database → Webhooks → Create a new hook**
- Table: `auth.users`
- Events: `INSERT`
- URL: `https://vobcapzssxchdckazfnr.supabase.co/functions/v1/welcome-email`

---

## ✅ Checklist Final

- [ ] Login no CLI (`npx supabase login`)
- [ ] Link ao projeto (`npx supabase link`)
- [ ] Secret configurado (`npx supabase secrets set`)
- [ ] Funções deployed (2x `npx supabase functions deploy`)
- [ ] Auth Hook configurado no Dashboard
- [ ] Testado cadastro/reset de senha

---

## 🐛 Troubleshooting

**"Unauthorized" no CLI:**
- Verifique se você é owner/admin do projeto no Dashboard
- Tente gerar um novo Access Token: https://supabase.com/dashboard/account/tokens
- Use `npx supabase login` sem `--token` (login interativo via navegador)

**E-mails não chegam:**
- Verifique os logs: `npx supabase functions logs send-auth-email`
- Confirme que o Hook está habilitado e com a URL correta
- Verifique se o secret `RESEND_API_KEY` foi configurado

**Domínio do remetente:**
- Atualmente usando `onboarding@resend.dev` (teste)
- Para produção, adicione e verifique seu domínio no Resend Dashboard
- Atualize `FROM_EMAIL` nas duas funções (index.ts linha 10)
