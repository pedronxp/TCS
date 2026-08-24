# Cloudflare Turnstile gratuito no TCS

## 1. Criar a conta e o widget

1. Acesse https://dash.cloudflare.com/sign-up e crie uma conta gratuita.
2. No painel, abra **Turnstile** e selecione **Add widget**.
3. Nomeie o widget como `TCS - Login e cadastro`.
4. Cadastre o hostname `tcsvisto.netlify.app`, sem `https://` e sem caminho.
5. Se utilizar outros projetos ou previews, adicione seus hostnames exatos,
   como `tcsvistoria.netlify.app` e
   `deploy-preview-83--tcsvisto.netlify.app`. Hostnames irmãos no Netlify não
   são autorizados automaticamente, e caracteres `*` não são aceitos.
6. Selecione o modo **Managed** e crie o widget.
7. Guarde a **Site Key** e a **Secret Key** separadamente.

Não é necessário transferir DNS, contratar plano pago nem cadastrar cartão para
utilizar o Turnstile gratuito.

## 2. Preparar o aplicativo Expo

Configure somente a chave pública no ambiente do aplicativo:

```dotenv
EXPO_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAEZrvk6QszB6lWKY
EXPO_PUBLIC_TURNSTILE_ORIGIN=https://tcsvisto.netlify.app
```

A configuração pode ser definida no ambiente do EAS Build ou no arquivo
`.env.local` do projeto. A **Secret Key nunca deve ser colocada** em variáveis
`EXPO_PUBLIC_*`, arquivos do aplicativo ou repositório Git.

Depois de configurar as variáveis, gere uma nova versão do aplicativo. Login,
cadastro e recuperação de senha passam a mostrar o desafio automaticamente.

## 3. Preparar o portal web e o Console TCS

O CAPTCHA do Supabase Auth é global. Antes de ativá-lo, todos os clientes que
utilizam login, cadastro ou recuperação de senha precisam gerar e enviar um
`captchaToken`, inclusive o painel web que utiliza o mesmo projeto Supabase.

O dashboard Vite utiliza a mesma **Site Key pública**, com outro prefixo:

```dotenv
VITE_TURNSTILE_SITE_KEY=0x4AAAAAAEZrvk6QszB6lWKY
```

A variável pública também está configurada no `netlify.toml` para os builds do
portal. Os acessos `/entrar` e `/login`, a criação de conta e a solicitação de
recuperação apresentam automaticamente o desafio. A Edge Function
`password-recovery-request` encaminha o token ao Supabase Auth e precisa ser
publicada junto com esta alteração para a recuperação protegida funcionar.

O Google retorna para `/auth/callback`, onde a conta autenticada é classificada
por RPCs protegidas e direcionada ao Console, à organização, ao portal
individual ou à escolha de vínculo. Cadastre esse endereço na lista de URLs
autorizadas do Supabase Auth:

```text
https://tcsvisto.netlify.app/auth/callback
```

Se houver outros domínios ou previews autorizados, cadastre também os respectivos
endereços de callback nas configurações de autenticação.

## 4. Ativar no Supabase

1. Abra o projeto em https://supabase.com/dashboard/project/vobcapzssxchdckazfnr.
2. Abra **Authentication** e depois a página de proteção contra bots:
   `https://supabase.com/dashboard/project/vobcapzssxchdckazfnr/auth/protection`.
3. Localize **Bot and Abuse Protection**.
4. Ative **Enable CAPTCHA protection**.
5. Escolha **Cloudflare Turnstile**.
6. Cole a **Secret Key** no campo do provedor e salve.

Só execute esta etapa depois que o app atualizado, o painel web e a Edge
Function de recuperação estiverem publicados; caso contrário, acessos
existentes poderão ser bloqueados.

## 5. Validar

1. Acesse a tela de login e aguarde a verificação de segurança.
2. Faça um login com uma conta existente.
3. Teste um cadastro individual e um cadastro com convite municipal.
4. Teste o Google nas rotas `/entrar` e `/login` e confirme o destino correto.
5. Teste a recuperação de senha depois do deploy da Edge Function.
6. Confirme os eventos no painel do Cloudflare Turnstile.

O desafio usa WebView no Android/iOS e iframe na versão web. Teste também em
um aparelho físico e confirme que `challenges.cloudflare.com` está acessível.
