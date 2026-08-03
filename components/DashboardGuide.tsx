import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

interface GuideItem {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  description: string;
}

interface GuideSection {
  heading: string;
  items: GuideItem[];
}

const GUIDE_CONTENT: Record<string, GuideSection[]> = {
  agent: [
    {
      heading: 'Vistorias & Campo',
      items: [
        {
          icon: 'plus-circle',
          title: 'Nova Vistoria',
          description: 'Inicia uma inspeção técnica. Preencha endereço, responda o formulário de riscos e salve. Funciona sem internet — sincroniza ao reconectar.',
        },
        {
          icon: 'clipboard',
          title: 'Inspeções',
          description: 'Histórico das suas vistorias. Acesse laudos, relatórios e status de sincronização. Vistorias pendentes têm badge amarelo.',
        },
        {
          icon: 'map',
          title: 'Mapa Tático',
          description: 'Visualize suas vistorias georeferenciadas. Filtre por nível de risco (R1–R4) e período. Disponível offline com dados já carregados.',
        },
        {
          icon: 'calendar',
          title: 'Agendamentos',
          description: 'Vistorias agendadas para você por supervisores. Quando há agendamento pendente, um número aparece no ícone de calendário.',
        },
      ],
    },
    {
      heading: 'Documentos',
      items: [
        {
          icon: 'file-text',
          title: 'Laudo Técnico',
          description: 'Gerado ao concluir a avaliação de risco de uma vistoria. Contém protocolo único, endereço, pontuação e classificação (R1–R4).',
        },
        {
          icon: 'bar-chart-2',
          title: 'Relatório',
          description: 'Documento detalhado com respostas do formulário, fotos e histórico. Acesse pelo módulo Relatórios ou dentro de uma vistoria.',
        },
      ],
    },
    {
      heading: 'Modo Offline',
      items: [
        {
          icon: 'wifi-off',
          title: 'Sem conexão?',
          description: 'O app funciona normalmente offline. Vistorias são salvas localmente e sincronizadas automaticamente assim que a internet voltar. Procure o banner amarelo na tela.',
        },
      ],
    },
  ],

  supervisor: [
    {
      heading: 'Gestão de Equipe',
      items: [
        {
          icon: 'users',
          title: 'Equipe',
          description: 'Veja todos os agentes do município, histórico de vistorias por agente, desempenho mensal e ranking.',
        },
        {
          icon: 'send',
          title: 'Atribuições',
          description: 'Delegue vistorias específicas para agentes. O agente recebe notificação automática com endereço e prioridade.',
        },
        {
          icon: 'calendar',
          title: 'Agendamentos',
          description: 'Crie agendamentos vinculados a agentes específicos. O agente vê o agendamento e pode iniciar a vistoria diretamente da tela de detalhe.',
        },
      ],
    },
    {
      heading: 'Monitoramento',
      items: [
        {
          icon: 'clipboard',
          title: 'Inspeções',
          description: 'Suas vistorias pessoais de campo. Para ver vistorias de toda a equipe, use o painel de Equipe.',
        },
        {
          icon: 'map',
          title: 'Mapa Tático',
          description: 'Todas as vistorias do município no mapa. Heatmap de risco, filtro por período e navegação para cada local.',
        },
        {
          icon: 'alert-triangle',
          title: 'Alertas de Risco',
          description: 'O dashboard exibe automaticamente alertas quando há vistorias R3/R4 críticas no município.',
        },
      ],
    },
    {
      heading: 'Modo Offline',
      items: [
        {
          icon: 'wifi-off',
          title: 'Sem conexão?',
          description: 'Vistorias e agendamentos são salvos localmente. Dados de equipe e mapas ficam indisponíveis sem internet — os dados locais continuam acessíveis.',
        },
      ],
    },
  ],

  admin: [
    {
      heading: 'Gestão de Acesso',
      items: [
        {
          icon: 'users',
          title: 'Usuários',
          description: 'Aprove ou bloqueie contas de agentes, supervisores e admins do seu município. Usuários aguardando aprovação aparecem destacados.',
        },
        {
          icon: 'key',
          title: 'Tokens de Acesso',
          description: 'Gere códigos de convite para novos usuários. Você tem um limite mensal (exibido ao gerar). Cada token define a role e expira em até 30 dias.',
        },
        {
          icon: 'user-plus',
          title: 'Grupos',
          description: 'Organize agentes em grupos de trabalho. Útil para municípios com múltiplas regiões ou equipes especializadas.',
        },
      ],
    },
    {
      heading: 'Análise & Documentos',
      items: [
        {
          icon: 'bar-chart-2',
          title: 'Relatórios',
          description: 'Exporte relatórios gerenciais de vistorias do município. Filtre por período, agente ou nível de risco. Gere CSV ou PDF.',
        },
        {
          icon: 'clipboard',
          title: 'Inspeções',
          description: 'Visualize todas as vistorias do município. Acesse detalhes, laudos e relatórios de qualquer agente.',
        },
        {
          icon: 'hash',
          title: 'Guia de Protocolo',
          description: 'Explica o formato dos números de laudo: TCS-CIDADE-AAAAMMDD-HASH. Acesse pelo dashboard para entender cada parte do protocolo.',
        },
      ],
    },
    {
      heading: 'Limites & Suporte',
      items: [
        {
          icon: 'info',
          title: 'Limite de Tokens',
          description: 'Cada admin tem um limite mensal de tokens. Ao atingir o limite, solicite aumento ao Master Admin — ele receberá uma notificação automática.',
        },
      ],
    },
  ],

  master_admin: [
    {
      heading: 'Controle Global',
      items: [
        {
          icon: 'map',
          title: 'Municípios',
          description: 'Cadastre e gerencie todos os municípios do sistema. Cada município tem seus próprios administradores, equipes e vistorias.',
        },
        {
          icon: 'users',
          title: 'Usuários',
          description: 'Visualize todos os usuários do sistema sem filtro de município. Aprovações, bloqueios e alterações de role de qualquer usuário.',
        },
        {
          icon: 'key',
          title: 'Tokens',
          description: 'Monitore todos os tokens gerados por qualquer admin. A seção "Por Administrador" mostra quantos tokens cada admin criou. Você é notificado quando um admin gera um token.',
        },
      ],
    },
    {
      heading: 'Análise de Dados',
      items: [
        {
          icon: 'bar-chart-2',
          title: 'Relatórios',
          description: 'Acesso global a todos os relatórios. Dados de todos os municípios sem filtro.',
        },
        {
          icon: 'clipboard',
          title: 'Inspeções',
          description: 'Todas as vistorias do sistema, sem filtro de município. Use os filtros da tela para segmentar por cidade ou agente.',
        },
        {
          icon: 'alert-triangle',
          title: 'Distribuição de Risco',
          description: 'Toque no card "Distribuição de Risco" do dashboard para ver um ranking de municípios com mais vistorias R3/R4. Identifique focos críticos rapidamente.',
        },
      ],
    },
    {
      heading: 'Auditoria & Sistema',
      items: [
        {
          icon: 'activity',
          title: 'Logs do Sistema',
          description: 'Auditoria completa de ações administrativas: aprovações, tokens gerados, logins com falha, sincronizações. Acesse via Módulos → Logs.',
        },
        {
          icon: 'hash',
          title: 'Guia de Protocolo',
          description: 'Explica o formato TCS-CIDADE-AAAAMMDD-HASH para administradores que não conhecem o padrão de numeração dos laudos.',
        },
      ],
    },
  ],
};

interface DashboardGuideProps {
  role: string;
  inline?: boolean;
}

export function DashboardGuide({ role, inline }: DashboardGuideProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  const sections = GUIDE_CONTENT[role] ?? GUIDE_CONTENT['agent'];
  const moduleColor = (icon: GuideItem['icon']) => {
    if (['alert-triangle', 'file-text'].includes(icon)) return theme.error;
    if (['wifi-off', 'clipboard', 'activity', 'hash'].includes(icon)) return theme.warning;
    if (['map', 'users'].includes(icon)) return theme.success;
    return theme.primary;
  };

  const trigger = inline ? (
    <TouchableOpacity
      style={[
        styles.inlineTrigger,
        { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder },
      ]}
      onPress={() => setVisible(true)}
      activeOpacity={0.8}
    >
      <View style={[styles.inlineIcon, { backgroundColor: `${theme.primary}15` }]}>
        <Feather name="help-circle" size={18} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.inlineTitle, { color: theme.text }]}>Guia do Sistema</Text>
        <Text style={[styles.inlineDesc, { color: theme.textSecondary }]}>Saiba como usar cada módulo do app</Text>
      </View>
      <Feather name="chevron-right" size={16} color={theme.textSecondary} />
    </TouchableOpacity>
  ) : (
    <TouchableOpacity
      style={[styles.trigger, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
      onPress={() => setVisible(true)}
      activeOpacity={0.75}
    >
      <Feather name="help-circle" size={18} color={theme.textSecondary} />
    </TouchableOpacity>
  );
  return (
    <>
      {trigger}

      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={() => setVisible(false)}
      >
        <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {/* Handle */}
            <View style={[styles.handle, { backgroundColor: theme.border }]} />

            {/* Header */}
            <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>Guia do Sistema</Text>
                <Text style={[styles.sheetSubtitle, { color: theme.textSecondary }]}>
                  Como usar cada módulo do app
                </Text>
              </View>
              <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 24 }]}
              showsVerticalScrollIndicator={false}
            >
              {sections.map((section, si) => (
                <View key={si} style={{ marginBottom: 24 }}>
                  <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
                    {section.heading.toUpperCase()}
                  </Text>
                  {section.items.map((item, ii) => {
                    const color = moduleColor(item.icon);
                    return (
                      <View key={ii} style={[styles.guideCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
                        <View style={[styles.guideIcon, { backgroundColor: `${color}15` }]}>
                          <Feather name={item.icon} size={18} color={color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.guideTitle, { color: theme.text }]}>{item.title}</Text>
                          <Text style={[styles.guideDesc, { color: theme.textSecondary }]}>{item.description}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}

              {/* Footer */}
              <View style={[styles.footer, { borderTopColor: theme.border }]}>
                <Feather name="shield" size={14} color={theme.textSecondary} />
                <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                  TCS · Relatório de Risco
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  inlineTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 16,
  },
  inlineIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  inlineTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  inlineDesc: { fontSize: 12, fontWeight: '400' },
  trigger: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, maxHeight: '90%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 20, paddingBottom: 16, borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800' },
  sheetSubtitle: { fontSize: 13, marginTop: 2, fontWeight: '500' },
  closeBtn: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  sheetContent: { padding: 20 },
  sectionHeading: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.2,
    marginBottom: 10, marginTop: 4,
  },
  guideCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8,
  },
  guideIcon: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0, marginTop: 1,
  },
  guideTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  guideDesc: { fontSize: 13, lineHeight: 19, fontWeight: '400' },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderTopWidth: 1, paddingTop: 16, marginTop: 8,
  },
  footerText: { fontSize: 12, fontWeight: '500' },
});
