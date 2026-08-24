# Cloudflare Turnstile gratuito no TCS

## 1. Criar a conta e o widget

1. Acesse https://dash.cloudflare.com/sign-up e crie uma conta gratuita.
2. No painel, abra **Turnstile** e selecione **Add widget**.
3. Nomeie o widget como `TCS - Login e cadastro`.
4. Cadastre o hostname `tcsvisto.netlify.app`, sem `https://` e sem caminho.
5. Adicione outros domínios próprios somente quando realmente forem utilizados.
6. Selecione o modo **Managed** e crie o widget.
7. Guarde a **Site Key** e a **Secret Key** separadamente.

Não é necessário transferir DNS, contratar plano pago nem cadastrar cartão para
utilizar o Turnstile gratuito.

## 2. Preparar o aplicativo Expo

Configure somente a chave pública no ambiente do aplicativo:

```dotenv
EXPO_PUBLIC_TURNSTILE_SITE_KEY=sua_site_key_publica
EXPO_PUBLIC_TURNSTILE_ORIGIN=https://tcsvisto.netlify.app
```

A configuração pode ser definida no ambiente do EAS Build ou no arquivo
`.env.local` do projeto. A **Secret Key nunca deve ser colocada** em variáveis
`EXPO_PUBLIC_*`, arquivos do aplicativo ou repositório Git.

Depois de configurar as variáveis, gere uma nova versão do aplicativo. Login,
cadastro e recuperação de senha passam a mostrar o desafio automaticamente.

## 3. Preparar os demais clientes do mesmo Supabase

O CAPTCHA do Supabase Auth é global. Antes de ativá-lo, todos os clientes que
utilizam login, cadastro ou recuperação de senha precisam gerar e enviar um
`captchaToken`, inclusive o painel web, se utilizar o mesmo projeto Supabase.

Esta branch prepara o aplicativo mobile e não modifica o dashboard web.
Portanto, o painel web precisa receber a integração correspondente antes da
ativação definitiva em produção.

## 4. Ativar no Supabase

1. Abra o projeto em https://supabase.com/dashboard/project/vobcapzssxchdckazfnr.
2. Entre em **Authentication** e depois em **Settings**.
3. Abra **Bot and Abuse Protection**.
4. Ative **Enable CAPTCHA protection**.
5. Escolha **Cloudflare Turnstile**.
6. Cole a **Secret Key** no campo do provedor e salve.

Só execute esta etapa depois que o app atualizado e o painel web estiverem
preparados; caso contrário, acessos existentes poderão ser bloqueados.

## 5. Validar

1. Acesse a tela de login e aguarde a verificação de segurança.
2. Faça um login com uma conta existente.
3. Teste um cadastro individual e um cadastro com convite municipal.
4. Teste a recuperação de senha.
5. Confirme os eventos no painel do Cloudflare Turnstile.

O desafio usa WebView no Android/iOS e iframe na versão web. Teste também em
um aparelho físico e confirme que `challenges.cloudflare.com` está acessível.
