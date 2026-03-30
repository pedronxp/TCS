<div align="center">

# 🛡️ Defesa Civil — App de Vistoria Técnica

**Sistema mobile offline-first para agentes de campo da Defesa Civil**  
Classificação automática de risco estrutural R1–R4 com sincronização em nuvem

[![Expo](https://img.shields.io/badge/Expo-54.0-000020?style=flat-square&logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?style=flat-square&logo=react)](https://reactnative.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?style=flat-square&logo=github-actions)](https://github.com/features/actions)

</div>

---

## 📋 Visão Geral

O **App Defesa Civil** é uma solução mobile Android para agentes de campo realizarem vistorias técnicas de risco estrutural. O sistema suporta operação completamente offline, com sincronização automática em segundo plano quando a conexão é restaurada.

### Principais Funcionalidades

- 🔍 **Motor de inspeção dinâmico** — formulários JSON configuráveis (estrutural, deslizamento, inundação)
- ⚡ **Cálculo automático de risco R1–R4** — baseado em limites configuráveis por formulário
- 📡 **Offline-first com SQLite** — nunca perde dados, sync em background com retry inteligente
- 🗺️ **Mapa tático** — clustering de pins, heatmap e 4 estilos de mapa (via Leaflet.js + OpenStreetMap)
- 📄 **Relatórios técnicos em PDF** — laudos editáveis gerados no dispositivo
- 🔔 **Notificações push** — alertas de risco alto e atualizações de status
- 👥 **Sistema de roles** — Agente · Supervisor · Admin Municipal · Master Admin
- 🔐 **Convite por token** — single-use, com expiração configurável

---

## 🏗️ Arquitetura

```
app_defesa_civil_expo/
├── app/
│   ├── _layout.tsx              # Root layout + controle de auth
│   ├── onboarding.tsx           # 4 slides (exibe 1x via AsyncStorage)
│   ├── (auth)/                  # Login, registro, recuperação de senha
│   └── (panel)/
│       ├── dashboard.tsx        # KPIs + redirect por role
│       ├── mapas.tsx            # Mapa OSM com clustering e heatmap
│       ├── inspecoes/           # Fluxo completo de vistoria
│       ├── supervisor/          # Gestão de equipe e atribuições
│       ├── admin/               # Painel admin municipal (9 módulos)
│       └── master/              # Painel master admin (10 módulos)
├── components/
│   └── ConnectivityBanner.tsx   # Banner de status offline
├── context/                     # Auth, Theme, Connectivity, Notification, Report
├── services/
│   ├── NotificationService.ts   # Push tokens e canais Android
│   └── SyncService.ts           # Sync em lotes de 20, MAX 5 tentativas
├── utils/
│   ├── supabase.ts              # Client Supabase
│   ├── database.ts              # SQLite v5 — schema + 6 índices
│   ├── logger.ts                # Logger estruturado (SQLite + console)
│   ├── uuid.ts                  # UUID via expo-crypto (Hermes-safe)
│   └── auditLogger.ts           # Auditoria fire-and-forget → Supabase
└── assets/
    └── formularios/             # JSONs dos formulários built-in
        ├── estrutural.json
        ├── estrutural_avancado.json
        ├── deslizamento_campo.json
        └── inundacao.json
```

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Framework | Expo ~54.0 + Expo Router ~6.0 |
| Runtime | React Native 0.81 + React 19 |
| Linguagem | TypeScript (strict) |
| Backend | Supabase (Auth · Postgres · Storage) |
| Banco local | expo-sqlite v16 (API síncrona) |
| Mapas | react-native-webview + Leaflet.js + OpenStreetMap |
| Câmera/Galeria | expo-image-picker + expo-image-manipulator |
| PDF | expo-print + expo-sharing |
| Notificações | expo-notifications + expo-task-manager |
| Conectividade | @react-native-community/netinfo |
| Testes | Jest + jest-expo + @testing-library/react-native |
| CI/CD | GitHub Actions |

> **Decisões arquiteturais:**  
> ❌ `react-native-reanimated` — removido (crash TurboModule no Expo Go)  
> ❌ `react-native-maps` — não usada (requer Google Maps API pago)  
> ✅ Mapas via WebView + Leaflet — gratuito, sem API key

---

## 🚀 Como Executar

### Pré-requisitos

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Expo Go no dispositivo Android (para desenvolvimento)

### Configuração

```bash
# 1. Clone o repositório
git clone https://github.com/pedronxp/TCS.git
cd TCS

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais Supabase:
# EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
# EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon

# 4. Inicie o servidor de desenvolvimento
npm start
```

### Scripts disponíveis

```bash
npm start           # Expo DevTools
npm run android     # Inicia no Android
npm run ios         # Inicia no iOS
npm test            # Executa os testes
npm run test:watch  # Testes em modo watch
npm run test:coverage # Relatório de cobertura
```

---

## 🗄️ Banco de Dados (Supabase)

O projeto usa as seguintes tabelas no Supabase:

| Tabela | Descrição |
|--------|-----------|
| `users` | Perfis com roles: `agent` · `supervisor` · `admin` · `master_admin` |
| `vistorias` | Registros de vistorias com dados GPS e respostas JSON |
| `invite_tokens` | Tokens de convite single-use com expiração |
| `atribuicoes` | Atribuições de tarefas supervisor → agente |
| `formularios` | Formulários dinâmicos criados pelo admin |
| `system_logs` | Logs de sistema (acesso: master_admin) |
| `audit_logs` | Trilha de auditoria de ações administrativas |

> **Row Level Security (RLS)** ativo em todas as tabelas.

### Schema local (SQLite)

O banco local replica as vistorias para operação offline com controle de sincronização:

```
vistorias_local     → dados offline + tentativas_sync (máx 5)
formularios_cache   → cache de formulários para uso offline
logs                → logs estruturados (máx 500 entradas)
```

---

## 📱 Formulários de Inspeção

Os formulários seguem um schema JSON padronizado:

```json
{
  "id": "estrutural_v1",
  "titulo": "Vistoria Estrutural",
  "tipoCalculo": "soma_total",
  "classificacao": {
    "limites": [
      { "max": 24, "nivel": "sem_risco" },
      { "max": 49, "nivel": "medio" },
      { "max": 74, "nivel": "alto" },
      { "max": 999, "nivel": "iminente" }
    ]
  },
  "fases": [...]
}
```

**Formulários built-in:**
- `estrutural.json` — 7 fases, soma total
- `estrutural_avancado.json` — multi-fase, pontuação por item
- `deslizamento_campo.json` — 10 fases, soma total
- `inundacao.json` — 8 fases, soma total

---

## 👥 Sistema de Roles

```
master_admin  →  Visão global de todos os municípios
admin         →  Gestão do município: usuários, tokens, formulários, estatísticas
supervisor    →  Gestão de equipe e atribuições de tarefas
agent         →  Realiza vistorias e consulta histórico
```

**Fluxo de acesso:**
1. Admin gera token de convite (validade: 24h / 48h / 7d / 30d)
2. Novo usuário se registra com o token
3. Admin aprova o usuário no painel
4. Usuário acessa o app com o role atribuído

---

## 🔒 Segurança

- **Tokens de convite:** formato `XXXX-XXXX-XXXX` (32^12 ≈ 1,2×10¹⁸ combinações)
- **Rate limit:** máx 10 tokens/hora por admin
- **Fotos:** comprimidas em JPEG 72% / máx 1280px antes do upload
- **Logs sanitizados:** campos sensíveis (password, token) redactados automaticamente
- **CSP no mapa:** `Content-Security-Policy` meta tag no HTML do Leaflet
- **RLS ativo:** todas as tabelas Supabase com Row Level Security

---

## 🔄 Sincronização Offline

O `SyncService` gerencia a sincronização de forma resiliente:

- **Lotes de 20 registros** por ciclo de sync
- **Máximo 5 tentativas** por registro (evita loops infinitos)
- **VACUUM SQLite** após sync bem-sucedido
- **Fallback individual** quando o batch falha
- **AppState listener** para sync quando o app volta ao foreground (Expo Go)
- **expo-task-manager** para sync em background (APK)

---

## 🧪 Testes

```bash
# Cobertura mínima exigida: 40% (linhas)
npm run test:coverage
```

Suites de teste:
- `utils/__tests__/database.test.ts` — SQLite singleton e shapes
- `utils/__tests__/logger.test.ts` — sanitização de dados sensíveis
- `utils/__tests__/risco.test.ts` — cálculo de risco (18 casos)
- `services/__tests__/SyncService.test.ts` — cenários de sync

---

## 🌐 Serviços Externos

| Serviço | Uso |
|---------|-----|
| [ViaCEP](https://viacep.com.br) | Lookup de endereço por CEP |
| [Nominatim OSM](https://nominatim.openstreetmap.org) | Geocoding reverso (GPS → endereço) |
| [CartoDB](https://carto.com) | Tiles do mapa Padrão e Escuro |
| [Esri ArcGIS](https://www.arcgis.com) | Tiles do mapa Satélite e Relevo |
| [Supabase](https://supabase.com) | Auth · Banco de dados · Storage |

> Todos os serviços de mapa e geocoding são **100% gratuitos**, sem necessidade de API key.

---

## 📦 Build para Produção

```bash
# Instale o EAS CLI
npm install -g eas-cli

# Configure o projeto (necessário na primeira vez)
eas build:configure

# Build APK de desenvolvimento
eas build --platform android --profile development

# Build APK de produção
eas build --platform android --profile production
```

> **Nota:** Configure o `projectId` em `app.json` > `extra.eas.projectId` antes do build.

---

## 🗺️ Roadmap

- [ ] Fase 7: Assinatura digital no laudo
- [ ] Fase 7: QR Code para identificação de imóvel
- [ ] Fase 7: Autenticação biométrica
- [ ] Clonar formulários built-in para o Supabase via admin
- [ ] Editor de limiares de classificação na UI do formulário
- [ ] Integração dos `activity_logs` no viewer de logs do admin

---

## 📄 Licença

Projeto desenvolvido para uso interno da Defesa Civil Municipal.  
Todos os direitos reservados.

---

<div align="center">
  <sub>Desenvolvido com ❤️ usando Expo + React Native + Supabase</sub>
</div>
