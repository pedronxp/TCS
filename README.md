<div align="center">

# TCS — Relatório e Vistoria

**Sistema mobile offline-first para vistorias técnicas de risco estrutural**
Desenvolvido para agentes de campo da Defesa Civil Municipal

[![Expo](https://img.shields.io/badge/Expo-54.0-000020?style=flat-square&logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?style=flat-square&logo=react)](https://reactnative.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Plataforma](https://img.shields.io/badge/Plataforma-Android%20%7C%20iOS-green?style=flat-square)](https://reactnative.dev)

</div>

---

## Índice

1. [Visão Geral](#visão-geral)
2. [Funcionalidades por Role](#funcionalidades-por-role)
3. [Arquitetura do Sistema](#arquitetura-do-sistema)
4. [Stack Tecnológica](#stack-tecnológica)
5. [Banco de Dados](#banco-de-dados)
6. [Formulários de Vistoria](#formulários-de-vistoria)
7. [Segurança](#segurança)
8. [Sincronização Offline](#sincronização-offline)
9. [Storage de Arquivos](#storage-de-arquivos)
10. [Notificações Push](#notificações-push)
11. [Como Executar](#como-executar)
12. [Build para Produção](#build-para-produção)
13. [Testes](#testes)
14. [Serviços Externos](#serviços-externos)

---

## Visão Geral

O **TCS — Relatório e Vistoria** é uma solução mobile completa para gestão de vistorias técnicas de risco geológico e estrutural. O sistema foi construído com arquitetura **offline-first**, garantindo que agentes de campo nunca percam dados mesmo sem cobertura de internet.

### Problema que resolve

Agentes da Defesa Civil precisam realizar vistorias em locais de difícil acesso, muitas vezes sem conectividade. O sistema garante:

- **Zero perda de dados** — tudo salvo localmente antes de tentar sync
- **Classificação automática R1–R4** — sem necessidade de cálculos manuais
- **Laudos em PDF** — gerados no dispositivo e enviados por WhatsApp/e-mail
- **Rastreabilidade completa** — audit trail de todas as ações

### Versão atual: v1.2.0

---

## Funcionalidades por Role

O sistema implementa 4 níveis de acesso com permissões distintas.

### Agente de Campo (`agent`)

| Funcionalidade | Descrição |
|----------------|-----------|
| Iniciar vistoria | Localização GPS automática + preenchimento de endereço via CEP |
| Formulários dinâmicos | 5 formulários built-in com lógica condicional (skip automático) |
| Classificação de risco | Cálculo automático R1 (baixo) a R4 (iminente) ao final da vistoria |
| Laudo em PDF | Geração no dispositivo com foto, protocolo sequencial e QR |
| Compartilhar laudo | WhatsApp, e-mail ou link — com mensagem rica e protocolo |
| Histórico de vistorias | Lista local + remota com filtros por data e risco |
| Mapa interativo | Visualização de vistorias no Google Maps / Apple Maps |
| Agendamentos | Ver vistorias agendadas pelo supervisor/admin |
| Como Chegar | Rota GPS do dispositivo até o local da vistoria |
| Modo offline | Todas as funções acima sem necessidade de internet |

### Supervisor (`supervisor`)

| Funcionalidade | Descrição |
|----------------|-----------|
| Gestão de equipe | Ver e gerenciar agentes do município |
| Atribuições | Criar e acompanhar tarefas para agentes |
| Agendar vistorias | Criar agendamentos para agentes específicos |
| Relatórios | Visualizar estatísticas e laudos da equipe |

### Admin Municipal (`admin`)

| Funcionalidade | Descrição |
|----------------|-----------|
| Gestão de usuários | Aprovar, bloquear e editar roles dos membros |
| Tokens de convite | Gerar, listar e revogar tokens de acesso |
| Formulários | Criar, editar, publicar e despublicar formulários dinâmicos |
| Estatísticas | Dashboard com KPIs do município |
| Relatórios | Exportar dados de vistorias em múltiplos formatos |
| Audit log | Visualizar trilha de auditoria de todas as ações |
| Logs do sistema | Acessar logs estruturados de erros e eventos |
| Agendamentos | Criar e gerir agendamentos de vistorias |

### Master Admin (`master_admin`)

| Funcionalidade | Descrição |
|----------------|-----------|
| Todos os módulos admin | Acesso completo a todos os municípios |
| Gestão de municípios | Criar, editar e desativar municípios |
| Logs globais | Visualizar logs de todos os municípios |
| Estatísticas globais | KPIs consolidados de todo o sistema |

---

## Arquitetura do Sistema

```
app_defesa_civil_expo/
│
├── app/                              # Expo Router — rotas baseadas em arquivos
│   ├── _layout.tsx                   # Root layout + controle de auth + theme
│   ├── onboarding.tsx                # 4 slides (exibe 1x via AsyncStorage)
│   ├── (auth)/
│   │   ├── index.tsx                 # Tela de boas-vindas
│   │   ├── login.tsx                 # Login + rate limiting + audit log
│   │   ├── register.tsx              # Validação de token + registro
│   │   └── forgot-password.tsx       # Recuperação de senha
│   └── (panel)/
│       ├── _layout.tsx               # Panel layout + SessionGuard + sync
│       ├── dashboard.tsx             # KPIs + redirect por role
│       ├── perfil.tsx                # Perfil do usuário
│       ├── mapas.tsx                 # Mapa nativo (Google Maps / Apple Maps)
│       ├── modulos.tsx               # Grade de módulos por role
│       ├── inspecoes/
│       │   ├── index.tsx             # Lista de vistorias
│       │   ├── dados-iniciais.tsx    # Step 1: endereço + GPS
│       │   ├── selecao-formulario.tsx# Step 2: escolher formulário
│       │   ├── wizard.tsx            # Step 3: preencher formulário
│       │   ├── resultado.tsx         # Step 4: resultado + laudo + PDF
│       │   ├── relatorio.tsx         # Visualização do relatório
│       │   ├── laudo.tsx             # Laudo completo
│       │   ├── risco.tsx             # Visualização de risco
│       │   ├── foto.tsx              # Captura de foto
│       │   └── [id].tsx              # Detalhe de vistoria específica
│       ├── supervisor/
│       │   ├── index.tsx             # Painel do supervisor
│       │   ├── equipe.tsx            # Gestão de equipe
│       │   ├── agente.tsx            # Perfil do agente
│       │   └── atribuicao.tsx        # Criar atribuição
│       ├── admin/
│       │   ├── index.tsx             # Painel admin
│       │   ├── usuarios.tsx          # Gestão de usuários
│       │   ├── tokens.tsx            # Lista de tokens
│       │   ├── gerar-token.tsx       # Criar token de convite
│       │   ├── estatisticas.tsx      # Dashboard de KPIs
│       │   ├── relatorios.tsx        # Exportar relatórios
│       │   ├── logs.tsx              # Logs do sistema
│       │   ├── form-editor.tsx       # Editor de formulários
│       │   ├── risco-config.tsx      # Configurar limiares de risco
│       │   └── editor-perguntas.tsx  # Editor de perguntas
│       └── master/
│           ├── index.tsx             # Painel master
│           ├── municipios.tsx        # Gestão de municípios
│           └── logs.tsx              # Logs globais
│
├── components/
│   ├── ui/                           # Design system: Button, Card, Input, Badge...
│   ├── BottomNavBar.tsx              # Navegação inferior por role
│   ├── ConnectivityBanner.tsx        # Banner de status offline
│   └── SessionLockScreen.tsx         # Tela de bloqueio após inatividade
│
├── context/
│   ├── AuthContext.tsx               # Sessão Supabase + perfil do usuário
│   ├── ThemeContext.tsx              # Tema claro/escuro
│   ├── ConnectivityContext.tsx       # Estado real de internet (ping)
│   ├── NotificationContext.tsx       # Gerenciamento de push tokens
│   ├── ReportContext.tsx             # Estado do relatório em andamento
│   └── SessionGuardContext.tsx       # Proteção de sessão — bloqueio 8h
│
├── services/
│   ├── NotificationService.ts        # Push tokens, canais Android, agendamentos
│   ├── StorageService.ts             # Upload fotos/PDFs para Supabase Storage
│   └── SyncService.ts                # Sync em lotes de 20, MAX 5 tentativas
│
├── utils/
│   ├── supabase.ts                   # Client Supabase (auth + db + storage)
│   ├── database.ts                   # SQLite v7 — schema + migrations + 6 índices
│   ├── auditLogger.ts                # Auditoria fire-and-forget → Supabase
│   ├── auditUtils.ts                 # Helpers de auditoria reutilizáveis
│   ├── authErrors.ts                 # Tradução de erros Supabase → pt-br
│   ├── laudoPdfBuilder.ts            # Gerador de HTML para laudo PDF
│   ├── laudoExpiracaoNotif.ts        # Notificação digest de laudos expirando
│   ├── logger.ts                     # Logger estruturado (SQLite + console)
│   ├── loginRateLimit.ts             # Rate limit de login (AsyncStorage)
│   ├── rateLimitUtils.ts             # Rate limit via Supabase RPC
│   ├── riscoUtils.ts                 # Labels e cores por nível de risco
│   ├── routingUtils.ts               # Abrir Google Maps / Apple Maps
│   ├── shareUtils.ts                 # Mensagem rica para compartilhamento
│   ├── validationUtils.ts            # Sanitização e validação de inputs
│   ├── formulariosAssets.ts          # Catálogo de formulários built-in
│   ├── deslizamentoSvgs.ts           # SVGs inline para formulário de deslizamento
│   └── uuid.ts                       # UUID + protocolo sequencial TCS-CGS-AAAA-NNNNN
│
└── assets/
    ├── formularios/
    │   ├── estrutural.json            # Vistoria estrutural básica (7 fases)
    │   ├── estrutural_avancado.json   # Vistoria estrutural completa
    │   ├── deslizamento_campo.json    # Risco de deslizamento (10 fases + SVGs)
    │   ├── inundacao.json             # Risco de inundação
    │   └── avaliacao_completa_v1.json # Avaliação completa — 10 elementos ponderados
    └── formularios/imagens/           # 30+ PNGs contextuais por resposta
```

---

## Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Framework | Expo | ~54.0 |
| Runtime | React Native + React | 0.81 / 19 |
| Linguagem | TypeScript (strict mode) | 5.x |
| Roteamento | Expo Router (file-based) | ~6.0 |
| Backend | Supabase (Auth · Postgres · Storage · RLS) | 2.x |
| Banco local | expo-sqlite (API síncrona) | v16 |
| Mapas | react-native-maps (Google Maps / Apple Maps) | — |
| PDF | expo-print + expo-sharing | — |
| Notificações | expo-notifications + expo-task-manager | — |
| Câmera / Galeria | expo-image-picker | — |
| Localização | expo-location | — |
| Conectividade | @react-native-community/netinfo | — |
| Ícones | @expo/vector-icons (Feather) | — |
| SVG | react-native-svg | — |
| Testes | Jest + jest-expo + @testing-library/react-native | — |

### Decisões arquiteturais relevantes

| Decisão | Motivo |
|---------|--------|
| ✅ react-native-maps (nativo) | Substituiu WebView+Leaflet — sem tela branca, melhor performance |
| ✅ SQLite síncrono | Sem risco de race condition em operações de campo |
| ✅ Offline-first (SQLite → Supabase) | Garante zero perda de dados em campo sem sinal |
| ✅ Formulários em JSON built-in | Funciona 100% offline, imagens locais, sem CDN |
| ✅ Expo Router (file-based) | Deep links nativos, code splitting automático |
| ❌ expo-local-authentication | Não instalado — SessionGuard usa timeout sem biometria |
| ❌ expo-crypto | Não instalado — hash de token reservado para versão futura |

---

## Banco de Dados

### Supabase (Nuvem)

| Tabela | Descrição | RLS |
|--------|-----------|-----|
| `users` | Perfis com roles: `agent` · `supervisor` · `admin` · `master_admin` | ✅ |
| `vistorias` | Vistorias com GPS, respostas JSON, protocolo, laudo_url | ✅ |
| `invite_tokens` | Tokens de convite single-use com hash, email e expiração | ✅ |
| `atribuicoes` | Tarefas atribuídas supervisor → agente | ✅ |
| `agendamentos` | Vistorias agendadas com data, local e agente responsável | ✅ |
| `formularios` | Formulários dinâmicos criados pelo admin | ✅ |
| `audit_logs` | Trilha de auditoria: ações, ator, alvo, detalhes | ✅ |
| `rate_limits` | Controle de rate limiting por uid + ação + janela temporal | ✅ |
| `contadores_protocolo` | Sequência para geração de protocolo TCS-CGS-AAAA-NNNNN | ✅ |

**Row Level Security (RLS)** ativo em todas as tabelas. Políticas segregadas por role — agentes só leem/editam suas próprias vistorias, admins operam somente no próprio município.

### Supabase Storage

| Bucket | Acesso | Conteúdo |
|--------|--------|----------|
| `fotos` | Público | Fotos de evidência das vistorias |
| `laudos` | Autenticado | PDFs gerados (URL signed — validade 7 dias) |

### SQLite Local (offline)

```sql
-- Tabela principal — replica vistorias para operação offline
vistorias_offline (
  id TEXT PRIMARY KEY,
  agente_uid, agente_nome, municipio, municipio_agente,
  endereco_rua, endereco_numero, endereco_bairro, endereco_cep,
  responsavel_nome, latitude, longitude,
  data_vistoria, formulario_id, formulario_versao,
  respostas_json, nivel_risco, pontuacao_total,
  foto_url, laudo_url, laudo_gerado_em,
  sincronizado INTEGER DEFAULT 0,
  tentativas_sync INTEGER DEFAULT 0,
  criado_em
)

-- Cache de formulários dinâmicos do admin
formularios_cache (id, titulo, descricao, schema_json, versao, ativo, criado_em)

-- Logs estruturados
logs (id, nivel, categoria, mensagem, dados_json, criado_em)
```

**Versão atual do schema:** v7 (com migrations automáticas)

---

## Formulários de Vistoria

Os formulários seguem um schema JSON padronizado com suporte a:
- **Lógica condicional** — perguntas puladas automaticamente (`skipSe`)
- **Múltiplos tipos de pergunta** — seleção única, múltipla, texto, foto, slider
- **Imagens contextuais** — PNG específico por opção de resposta
- **SVGs inline** — ilustrações técnicas para formulário de deslizamento
- **Pesos por elemento** — cálculo ponderado de risco

### Formulários Built-in

| ID | Nome | Fases | Tipo de Cálculo | Uso |
|----|------|-------|-----------------|-----|
| `estrutural_v1` | Vistoria Estrutural | 7 | Soma total | Vistoria rápida de campo |
| `estrutural_avancado_v1` | Vistoria Estrutural Avançada | Multi-fase | Por item | Inspeção detalhada |
| `risco_estrutural_v2` | Avaliação Estrutural Inteligente | 7–35* | Por elemento × peso | Com skip automático |
| `avaliacao_completa_v1` | Avaliação Completa — 10 Elementos | 10 | Ponderado | Laudo técnico completo |
| `deslizamento_campo_v1` | Risco de Deslizamento | 10 | Soma + SVGs | Encostas e taludes |
| `inundacao_v1` | Risco de Inundação | 8 | Soma total | Áreas de várzea |

*\* Com skip automático — bom estado reduz de 35 para 7 perguntas.*

### Classificação de Risco

| Nível | Label | Cor | Descrição |
|-------|-------|-----|-----------|
| R1 | Baixo | Verde | Sem risco imediato |
| R2 | Médio | Amarelo | Monitoramento recomendado |
| R3 | Alto | Laranja | Intervenção necessária |
| R4 | Iminente | Vermelho | Evacuação/interdição imediata |

---

## Segurança

### Rate Limiting

| Ação | Limite | Janela | Mecanismo |
|------|--------|--------|-----------|
| Tentativas de login | 5 | 15 minutos | AsyncStorage local |
| Geração de PDF | 10 | 1 hora | Supabase RPC |
| Criação de vistoria | 30 | 1 dia | Supabase RPC |

### Proteção de Sessão

- **Bloqueio após 8h de inatividade** — AppState listener detecta background prolongado
- **Tela de bloqueio** — exibida automaticamente ao retornar ao app após timeout
- **Registro de timestamp** — `AsyncStorage` atualizado a cada transição de estado

### Tokens de Convite

- Formato `XXXX-XXXX-XXXX` (32¹² ≈ 1,2×10¹⁸ combinações)
- Hash SHA-256 armazenado no banco (token original apenas no link/QR)
- Email do destinatário vinculado no momento da criação
- Invalidação imediata após uso único
- Expiração configurável: 24h / 48h / 7d / 30d

### Outros

- **Row Level Security** em todas as tabelas — sem bypass possível via SQL
- **Validação de input** — sanitizarTexto, validarNome, validarMunicipio em todas as entradas
- **Audit Log** — todas as ações sensíveis registradas (login_falhou, laudo_gerado, vistoria_criada, etc.)
- **Logs sanitizados** — campos sensíveis (password, token) redactados automaticamente

---

## Sincronização Offline

O `SyncService` gerencia sync de forma resiliente e idempotente:

```
Fluxo de criação de vistoria:
1. Salvar localmente no SQLite (imediato — zero perda de dados)
2. Se online: upload foto → Supabase Storage → upsert vistoria → markSincronizado
3. Se offline: fica pendente com tentativas_sync = 0
4. Ao reconectar: SyncService detecta via AppState/netinfo → sync em lotes de 20
5. Falha individual: tentativas++ — descartado após 5 tentativas
```

| Parâmetro | Valor |
|-----------|-------|
| Tamanho do lote | 20 registros/ciclo |
| Máximo de tentativas | 5 por registro |
| Retry em background | expo-task-manager (APK) |
| Retry no foreground | AppState 'active' listener |
| VACUUM SQLite | Após sync bem-sucedido |

---

## Storage de Arquivos

### Fotos de Evidência

- Upload automático ao finalizar vistoria (quando online)
- Bucket `fotos/` público — URL permanente salva no banco
- Fallback para URI local caso o upload falhe

### Laudos em PDF

- Upload após geração/compartilhamento do laudo
- Bucket `laudos/` autenticado — URL signed com validade de **7 dias**
- Botão "Baixar Laudo Salvo" (verde) quando URL válida
- Botão "Regenerar Laudo" (amarelo) quando URL expirada (> 7 dias)
- Notificação push digest diária ao usuário quando laudos estão prestes a expirar

### Protocolo Sequencial

Cada vistoria recebe um protocolo único gerado por trigger no banco:

```
Formato: TCS-CGS-2026-00001
          ↑    ↑    ↑    ↑
        Org  Seção  Ano  Sequência (5 dígitos, auto-incremento)
```

---

## Notificações Push

| Tipo | Gatilho | Frequência máxima |
|------|---------|-------------------|
| Vistoria salva | Ao finalizar qualquer vistoria | Ilimitada |
| Risco alto/iminente | Vistoria classificada como R3 ou R4 | Ilimitada |
| Laudo expirando | Laudo com 6–7 dias de vida | 1 por dia (digest) |
| Agendamento criado | Novo agendamento atribuído ao agente | Ilimitada |

O digest diário de laudos usa guard via `AsyncStorage` para garantir no máximo 1 disparo por dia, agrupando múltiplos laudos em uma única notificação.

---

## Como Executar

### Pré-requisitos

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Expo Go no dispositivo (desenvolvimento) ou emulador Android/iOS

### Configuração

```bash
# 1. Clone o repositório
git clone https://github.com/pedronxp/TCS.git
cd TCS

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais:

```env
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

> ⚠️ **Google Maps API Key:** Atualmente configurada em `app.json`. Para produção, mova para variável de ambiente via `app.config.ts`.

### Iniciar

```bash
npm start           # Expo DevTools (QR Code para Expo Go)
npm run android     # Emulador Android
npm run ios         # Simulador iOS
```

---

## Build para Produção

```bash
# Instale o EAS CLI
npm install -g eas-cli
eas login

# Configurar projeto (apenas na primeira vez)
eas build:configure

# APK de desenvolvimento (debug)
eas build --platform android --profile development

# APK de produção
eas build --platform android --profile production

# Build iOS (requer conta Apple Developer)
eas build --platform ios --profile production
```

> Configure o `projectId` em `app.json` → `extra.eas.projectId` com o ID do seu projeto no [expo.dev](https://expo.dev).

---

## Testes

```bash
npm test                  # Executar todos os testes
npm run test:watch        # Modo watch
npm run test:coverage     # Relatório de cobertura (mínimo: 40%)
```

### Suites de Teste

| Arquivo | Cobertura |
|---------|-----------|
| `utils/__tests__/database.test.ts` | SQLite singleton, schema, migrations |
| `utils/__tests__/logger.test.ts` | Sanitização de dados sensíveis, níveis |
| `utils/__tests__/risco.test.ts` | Cálculo R1–R4 (18 casos de borda) |
| `services/__tests__/SyncService.test.ts` | Deduplicação, backoff, batch |

---

## Serviços Externos

| Serviço | Uso | Custo |
|---------|-----|-------|
| [Supabase](https://supabase.com) | Auth, banco de dados, storage, RLS | Free tier / pago |
| [Google Maps](https://maps.google.com) | Mapa nativo Android | API Key necessária |
| [Apple Maps](https://maps.apple.com) | Mapa nativo iOS | Gratuito |
| [ViaCEP](https://viacep.com.br) | Lookup de endereço por CEP | Gratuito |
| [Nominatim OSM](https://nominatim.openstreetmap.org) | Geocoding reverso (GPS → endereço) | Gratuito |
| [Expo Push Service](https://expo.dev/notifications) | Notificações push | Free tier |

---

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ | URL do projeto Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Chave pública anon do Supabase |

---

## Licença

Projeto desenvolvido sob contrato para uso exclusivo da **Defesa Civil Municipal**.
Todos os direitos reservados © 2026.

---

<div align="center">
  <sub>Desenvolvido por <strong>Pedronxp — Pedro Paulo</strong></sub>
</div>
