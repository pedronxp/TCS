<div align="center">

# TCS — Relatório e Vistoria

### O app que a Defesa Civil precisava

**Vistorias técnicas de risco na palma da mão.**
**Funciona sem internet. Gera laudos em segundos. Salva vidas.**

[![Plataforma](https://img.shields.io/badge/Plataforma-Android%20%7C%20iOS-blue?style=flat-square)](https://reactnative.dev)
[![Offline](https://img.shields.io/badge/Modo-Offline--First-green?style=flat-square)](#)
[![PDF](https://img.shields.io/badge/Laudos-PDF%20automático-orange?style=flat-square)](#)
[![Versão](https://img.shields.io/badge/Versão-1.3.4-informational?style=flat-square)](#)

</div>

---

## O Problema

Agentes da Defesa Civil enfrentam situações críticas todos os dias:

- Vistorias em encostas, morros e áreas de difícil acesso — **sem sinal de internet**
- Laudos preenchidos à mão em papel — **sujeitos a erros e perdas**
- Cálculo manual de risco — **lento e impreciso**
- Relatórios que demoram dias para chegar ao gestor — **decisões atrasadas**

---

## A Solução

O **TCS** é um aplicativo mobile desenvolvido especificamente para equipes de Defesa Civil.
Com ele, o agente vai a campo e faz tudo no celular — mesmo sem internet.

---

## Por que o TCS é diferente?

### Funciona 100% offline

Não precisa de sinal. O app salva tudo localmente no dispositivo e sincroniza automaticamente com o servidor assim que a internet retornar. **Nenhum dado é perdido.**

### Classificação de risco automática

Ao final de cada vistoria, o app calcula automaticamente o nível de risco —
**R1 (baixo) a R4 (iminente)** — com base nas respostas preenchidas. Sem contas manuais, sem planilhas.

### Laudo PDF em segundos

Com um toque, o agente gera um **laudo técnico em PDF** com foto da evidência, dados da vistoria,
protocolo sequencial e classificação de risco. Pronto para compartilhar pelo WhatsApp, e-mail ou imprimir.

### Protocolo oficial rastreável

Cada vistoria recebe automaticamente um **número de protocolo único** no formato `TCS-CGS-2026-00001`.
Rastreabilidade completa, do campo ao gestor.

### Mapa interativo

Visualize todas as vistorias no mapa. Filtros por nível de risco, período e agente.
Veja onde estão as áreas de maior risco no município — em tempo real.

### Como Chegar

O agente toca em "Como Chegar" e o **Google Maps (Android) ou Apple Maps (iOS)** abre com a rota
completa do dispositivo até o local da vistoria. Zero esforço.

---

## Funcionalidades Principais

| Funcionalidade | Descrição |
|----------------|-----------|
| **Vistoria offline** | Preenche formulários sem internet, sync automático ao conectar |
| **7 formulários técnicos** | Árvore, Deslizamento, Edificação, Inundação, Incêndio, Ponte e Drenagem |
| **Classificação R1–R4** | Calculada automaticamente com base nas respostas |
| **Laudo em PDF** | Gerado no dispositivo com foto, protocolo e assinatura |
| **Compartilhamento rico** | Mensagem formatada com todos os dados para WhatsApp |
| **Mapa nativo** | Google Maps / Apple Maps com pins por nível de risco |
| **Navegação GPS** | Rota do agente até o local da vistoria |
| **Agendamentos** | Supervisor agenda vistorias para agentes específicos |
| **Notificações push** | Alertas de vistoria, risco alto e laudos expirando |
| **Histórico completo** | Todas as vistorias com filtros e busca |
| **Modo escuro** | Interface adaptável ao ambiente de campo |

---

## Para Gestores e Administradores

O TCS não é só um app de campo. É uma plataforma de **gestão completa**:

- **Dashboard de KPIs** — vistorias realizadas, distribuição por risco, evolução temporal
- **Gestão de equipe** — aprovar usuários, definir funções, monitorar atividade
- **Formulários dinâmicos** — crie e publique novos formulários sem atualizar o app
- **Relatórios exportáveis** — dados em múltiplos formatos para relatórios institucionais
- **Audit trail completo** — cada ação registrada com data, hora e responsável
- **Multimunicípio** — gestão centralizada de múltiplas cidades pelo Master Admin

---

## Segurança em Primeiro Lugar

- **Acesso por convite** — novos usuários só entram com token gerado pelo admin
- **4 níveis de permissão** — cada role só vê e faz o que lhe compete
- **Bloqueio automático de sessão** — app bloqueia após 8h de inatividade
- **Rate limiting** — proteção contra abuso (PDFs, logins, vistorias)
- **Audit log completo** — trilha de auditoria de todas as ações sensíveis
- **Dados protegidos** — banco de dados com Row Level Security (RLS) ativo em todas as tabelas

---

## Resultados Esperados

| Antes do TCS | Com o TCS |
|--------------|-----------|
| Laudos em papel, risco de perda | Laudo digital com backup em nuvem |
| Cálculo manual de risco | Classificação automática R1–R4 |
| Relatório chega em dias | Dados disponíveis ao gestor em minutos |
| Sem rastreabilidade | Protocolo único + audit log completo |
| Dependente de internet | Funciona 100% offline |
| Cada agente no seu silo | Gestão centralizada por município |

---

## Para Quem é o TCS?

- **Defesas Civis municipais** que precisam digitalizar e acelerar o processo de vistoria
- **Prefeituras** que querem rastreabilidade e dados para políticas públicas de risco
- **Equipes de campo** que realizam vistorias em locais com cobertura precária de internet
- **Gestores** que precisam de dados em tempo real para tomada de decisão

---

<details>
<summary>Informações técnicas para desenvolvedores</summary>

### Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Framework | Expo ~54.0 + Expo Router |
| Runtime | React Native 0.81 + React 19 |
| Linguagem | TypeScript (strict) |
| Backend | Supabase (Auth · Postgres · Storage · RLS) |
| Banco local | expo-sqlite v16 |
| Mapas | react-native-maps (Google Maps / Apple Maps) |
| PDF | expo-print + expo-sharing |
| Notificações | expo-notifications + expo-task-manager |

### Configuração

```bash
npm install
cp .env.example .env
# Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY
npm start
```

### Documentação completa

Consulte `README.CLIENT.md` para documentação técnica detalhada,
arquitetura completa, schema do banco de dados e instruções de build.

</details>

---

## Licença

Desenvolvido por **Pedronxp — Pedro Paulo** para uso exclusivo do **TCS — Relatório e Risco**.
Todos os direitos reservados © 2026. Redistribuição e uso não autorizados são expressamente proibidos.

---

<div align="center">
  <sub>Tecnologia a serviço da proteção civil</sub>
</div>
