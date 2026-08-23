<div align="center">

# TCS — Relatório de Risco

Plataforma para registrar, acompanhar e administrar vistorias técnicas de risco.

[![Expo](https://img.shields.io/badge/Expo-54-000020?style=flat-square&logo=expo)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?style=flat-square&logo=react)](https://reactnative.dev/)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-3FCF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Versão](https://img.shields.io/badge/Versão-1.3.26-2563EB?style=flat-square)](./CHANGELOG.md)

</div>

## Sobre o projeto

O TCS apoia o trabalho de equipes de campo, coordenações municipais e operadores da plataforma. O repositório reúne o aplicativo Expo para Android, iOS e web, um portal/console web em React, o backend no Supabase e uma integração opcional com WhatsApp.

No aplicativo, a equipe registra dados da vistoria, localização, evidências fotográficas e assinatura, aplica formulários técnicos e gera o respectivo relatório. Dados operacionais podem ser mantidos localmente durante instabilidades de conexão e sincronizados com o backend quando a rede estiver disponível.

O projeto está em desenvolvimento ativo. Recursos que envolvem autenticação, sincronização, notificações, pagamentos, documentos ou WhatsApp dependem da configuração dos serviços externos correspondentes.

## O que existe hoje

### Aplicativo de campo e gestão

- Cadastro e acesso de clientes, recuperação de senha, onboarding e treinamento.
- Fluxo guiado de vistoria com dados iniciais, formulário, risco, fotos, assinatura e resultado.
- Catálogo de formulários técnicos versionados para árvore, deslizamento, risco estrutural, inundação, incêndio em vegetação, pontes/passarelas e drenagem.
- Classificação de risco, histórico, busca, mapa e rota até o local vistoriado.
- Geração, armazenamento e compartilhamento de laudos e relatórios.
- Operação offline-first com SQLite local e serviço de sincronização.
- Agendamentos, avisos, notificações, grupos, equipe e perfis com permissões distintas.
- Áreas administrativas para usuários, tokens de convite, formulários, regras de risco, estatísticas, relatórios, logs e protocolos.
- Assinaturas e planos para contas individuais ou organizações.

### Portal e console web

O diretório `dashboard/` contém uma aplicação React/Vite com três experiências:

- site comercial público;
- portal do cliente para acompanhar vistorias, documentos, equipe, agenda, comunicados e assinatura;
- console interno para suporte, clientes, planos, protocolos, dispositivos, comunicações, auditoria e configuração operacional.

As operações sensíveis são validadas no backend, com funções, políticas RLS, trilhas de auditoria e contratos de permissão versionados nas migrations do Supabase.

### Integração opcional com WhatsApp

O diretório `bot-whatsapp/` contém um serviço externo para vincular números por QR Code e processar filas de comunicados. Ele não é necessário para o funcionamento principal do TCS e usa uma biblioteca não oficial, sujeita a indisponibilidade ou banimento do número. Consulte [`bot-whatsapp/README.md`](./bot-whatsapp/README.md) antes de utilizá-lo.

## Arquitetura do repositório

```text
app/              rotas e telas do aplicativo Expo
assets/           imagens, ícones e formulários técnicos versionados
components/       componentes compartilhados do aplicativo
context/          autenticação, conexão, sessão, assinatura e estado global
services/         sincronização, armazenamento, laudos e serviços de domínio
utils/            banco local, regras, PDF e utilitários
dashboard/        site público, portal do cliente e console interno
supabase/         migrations, testes SQL e Edge Functions
bot-whatsapp/     integração opcional para comunicados no WhatsApp
__tests__/        testes de integração e regressão do aplicativo
docs/             decisões técnicas e documentação operacional
```

## Tecnologias principais

| Área | Tecnologias |
| --- | --- |
| Aplicativo | Expo 54, React Native 0.81, React 19, Expo Router e TypeScript |
| Persistência local | Expo SQLite e AsyncStorage |
| Portal e console | React 18, Vite, React Router, TanStack Query/Table e Tailwind CSS |
| Backend | Supabase Auth, PostgreSQL, Storage, RLS e Edge Functions |
| Mapas | React Native Maps, MapLibre e Leaflet |
| Documentos | Expo Print, Expo Sharing e geração de PDF no backend |
| Qualidade | Jest, Vitest, Testing Library, Playwright e testes SQL |

## Executando o aplicativo

### Pré-requisitos

- Node.js 20 ou superior;
- npm;
- Android Studio, Xcode ou Expo Go, conforme a plataforma escolhida;
- um projeto Supabase para os fluxos que usam backend.

Instale as dependências na raiz:

```bash
npm install
```

Crie um arquivo `.env` na raiz, sem versioná-lo:

```env
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-chave-publica-anon
EXPO_PUBLIC_DOCUMENT_ACKNOWLEDGEMENT_BASE_URL=http://localhost:5173
```

Inicie o Expo:

```bash
npm start
```

Atalhos disponíveis:

```bash
npm run android
npm run ios
npm run web
```

> Algumas APIs nativas, como câmera, localização, notificações, mapas e armazenamento seguro, não têm o mesmo comportamento no navegador ou no Expo Go. Para validar o aplicativo completo, use um development build ou build nativo.

## Executando o portal e console web

```bash
cd dashboard
npm install
npm run dev
```

Use `dashboard/.env.example` como referência para criar `dashboard/.env.local`. As variáveis mínimas para autenticação e acesso ao Supabase são:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publica-anon
```

A documentação específica do frontend web está em [`dashboard/README.md`](./dashboard/README.md).

## Verificações

Aplicativo:

```bash
npm test
npx tsc --noEmit
```

Portal e console:

```bash
cd dashboard
npm run lint
npm test
npm run build
```

O repositório também possui testes direcionados para concorrência de assinatura, protocolo oficial, detalhes de agentes e restauração de arquivos. Veja os scripts disponíveis em [`package.json`](./package.json).

## Backend e implantação

O histórico do banco está em `supabase/migrations/`; as Edge Functions ficam em `supabase/functions/` e os testes de segurança/contrato em `supabase/tests/`. A aplicação web possui configuração de deploy no Netlify em [`netlify.toml`](./netlify.toml), mas URLs, chaves, segredos de pagamento, e-mail e credenciais administrativas devem ser configurados no ambiente de implantação — nunca no repositório.

Antes de aplicar migrations ou publicar funções em um ambiente compartilhado, revise a documentação em `docs/` e valide a sequência em um projeto Supabase local ou de homologação.

## Documentação

- [`README.CLIENT.md`](./README.CLIENT.md) — referência técnica ampliada do aplicativo.
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — convenções para contribuir.
- [`CHANGELOG.md`](./CHANGELOG.md) — histórico de versões documentado.
- [`ROADMAP.md`](./ROADMAP.md) — planejamento registrado; pode conter itens ainda não entregues.
- [`docs/`](./docs/) — arquitetura, segurança, operações e decisões técnicas.

## Segurança

- Não versione arquivos `.env`, chaves privadas, tokens, sessões do WhatsApp ou a chave `service_role` do Supabase.
- Use somente a chave pública `anon` nos clientes mobile e web.
- Mantenha autorização, limites e validações críticas no backend; controles de interface não substituem RLS e RPCs seguras.
- Revise migrations e políticas antes de qualquer implantação em produção.

## Licença

Software proprietário desenvolvido por **Pedronxp — Pedro Paulo**. Todos os direitos reservados © 2026. O código não possui licença de redistribuição pública.
