import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { isInternalMobileRole } from '../../services/AppProfileService';
import { resolveMobileOrganizationAccess } from '../../services/MobileAccessService';
import { useBottomTabPadding } from '../../utils/useBottomTabPadding';
import { ModuleCard, SectionHeader, StateBanner } from '../../components/ui';
import { FontSize, FontWeight } from '../../constants/Typography';
import { ComponentSize, Spacing, SpacingAlias } from '../../constants/Spacing';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

interface ModuleItem {
  title: string;
  description: string;
  icon: FeatherName;
  route: string;
  badge?: string;
  feature?: string;
  requiresOrganization?: boolean;
}

interface ModuleSection {
  key: string;
  title: string;
  description: string;
  items: ModuleItem[];
}

const subscription: ModuleItem = {
  title: 'Minha assinatura',
  description: 'Plano, consumo e situação da conta',
  icon: 'credit-card',
  route: '/(panel)/assinatura',
};

const profile: ModuleItem = {
  title: 'Meu perfil',
  description: 'Dados pessoais e preferências',
  icon: 'user',
  route: '/(panel)/perfil',
};

const trainingAccess: ModuleItem = {
  title: 'Treinamento',
  description: 'Entrar em uma turma com código',
  icon: 'book-open',
  route: '/(panel)/treinamento/acesso',
};

const baseOperation: ModuleItem[] = [
  { title: 'Vistorias', description: 'Histórico, evidências e laudos', icon: 'clipboard', route: '/(panel)/inspecoes' },
  { title: 'Mapa tático', description: 'Ocorrências georreferenciadas', icon: 'map-pin', route: '/(panel)/mapas' },
  { title: 'Avisos', description: 'Comunicados da organização', icon: 'bell', route: '/(panel)/avisos', feature: 'comunicados', requiresOrganization: true },
];

function sectionsForRole(role: string | undefined): ModuleSection[] {
  if (isInternalMobileRole(role)) {
    return [
      {
        key: 'internal',
        title: 'Acompanhamento TCS',
        description: 'Acesso mobile conforme suas permissões',
        items: [
          { title: 'Painel interno', description: 'Indicadores do seu perfil', icon: 'activity', route: '/(panel)/internal' },
          profile,
        ],
      },
    ];
  }

  if (role === 'master_admin') {
    return [
      {
        key: 'operation', title: 'Acompanhamento operacional', description: 'Informações úteis durante o uso do aplicativo', items: [
          ...baseOperation,
          { title: 'Equipe', description: 'Acompanhar profissionais', icon: 'user-check', route: '/(panel)/equipe' },
          { title: 'Agenda', description: 'Compromissos e atividades', icon: 'calendar', route: '/(panel)/agendamentos' },
          { title: 'Relatórios', description: 'Consultar laudos disponíveis', icon: 'file-text', route: '/(panel)/admin/relatorios' },
        ],
      },
      { key: 'account', title: 'Conta', description: 'Plano e preferências', items: [trainingAccess, subscription, profile] },
    ];
  }

  if (role === 'admin') {
    return [
      {
        key: 'municipal', title: 'Acompanhamento municipal', description: 'Equipe e organização do trabalho', items: [
          { title: 'Equipe', description: 'Desempenho dos agentes', icon: 'user-check', route: '/(panel)/equipe' },
          { title: 'Grupos', description: 'Organização por área ou turno', icon: 'grid', route: '/(panel)/grupos' },
          { title: 'Agenda', description: 'Compromissos da organização', icon: 'calendar', route: '/(panel)/agendamentos' },
        ],
      },
      {
        key: 'technical', title: 'Operação técnica', description: 'Vistorias e inteligência local', items: [
          ...baseOperation,
          { title: 'Relatórios', description: 'Consultar laudos', icon: 'file-text', route: '/(panel)/admin/relatorios' },
          { title: 'Estatísticas', description: 'Métricas municipais', icon: 'bar-chart-2', route: '/(panel)/admin/estatisticas' },
        ],
      },
      { key: 'account', title: 'Conta', description: 'Plano e preferências', items: [trainingAccess, subscription, profile] },
    ];
  }

  if (role === 'supervisor') {
    return [
      {
        key: 'operation', title: 'Operação da equipe', description: 'Campo, agenda e cobertura', items: [
          ...baseOperation,
          { title: 'Grupos', description: 'Agentes por área ou turno', icon: 'grid', route: '/(panel)/grupos' },
          { title: 'Agenda', description: 'Distribuição de tarefas', icon: 'calendar', route: '/(panel)/agendamentos' },
        ],
      },
      { key: 'account', title: 'Conta', description: 'Plano e preferências', items: [trainingAccess, subscription, profile] },
    ];
  }

  return [
    {
      key: 'field', title: 'Trabalho em campo', description: 'Acesso rápido à sua operação', items: [
        { title: 'Nova vistoria', description: 'Iniciar coleta técnica', icon: 'plus-circle', route: '/(panel)/inspecoes/dados-iniciais', badge: 'Principal' },
        ...baseOperation,
        { title: 'Agenda', description: 'Tarefas atribuídas', icon: 'calendar', route: '/(panel)/agendamentos' },
      ],
    },
    { key: 'account', title: 'Conta', description: 'Plano e preferências', items: [trainingAccess, subscription, profile] },
  ];
}

export default function ModulosScreen() {
  const { theme } = useTheme();
  const { profile: userProfile } = useAuth();
  const { context: subscriptionContext, hasFeature } = useSubscription();
  const insets = useSafeAreaInsets();
  const bottomPadding = useBottomTabPadding();
  const [query, setQuery] = useState('');
  const access = resolveMobileOrganizationAccess(userProfile, subscriptionContext);
  const organizationId = access.organizationId;
  const sections = useMemo(() => sectionsForRole(userProfile?.role)
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        if (item.requiresOrganization && !organizationId) return false;
        if (!item.feature || !subscriptionContext?.features) return true;
        if (!(item.feature in subscriptionContext.features)) return true;
        return hasFeature(item.feature);
      }),
    }))
    .filter(section => section.items.length > 0), [hasFeature, organizationId, subscriptionContext?.features, userProfile?.role]);
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
  const visibleSections = useMemo(() => {
    if (!normalizedQuery) return sections;
    return sections
      .map(section => ({
        ...section,
        items: section.items.filter(item => `${item.title} ${item.description}`.toLocaleLowerCase('pt-BR').includes(normalizedQuery)),
      }))
      .filter(section => section.items.length > 0);
  }, [normalizedQuery, sections]);

  const roleLabel = isInternalMobileRole(userProfile?.role)
      ? 'Acompanhamento interno TCS'
      : userProfile?.role === 'master_admin'
      ? 'Acompanhamento da operação'
      : userProfile?.role === 'admin'
        ? 'Administração municipal'
        : userProfile?.role === 'supervisor'
          ? 'Supervisão de campo'
          : organizationId ? 'Operação de campo' : 'Conta profissional individual';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top ? 0 : Spacing[3], 0) }]}>
        <Text style={[styles.eyebrow, { color: theme.primary }]}>CENTRAL DE MÓDULOS</Text>
        <Text style={[styles.title, { color: theme.text }]}>Tudo o que você precisa</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{roleLabel}</Text>
      </View>

      <View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Feather name="search" size={19} color={theme.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar módulo"
          placeholderTextColor={theme.textSecondary}
          style={[styles.searchInput, { color: theme.text }]}
          accessibilityLabel="Buscar módulo"
          autoCorrect={false}
        />
        {query ? (
          <Feather name="x-circle" size={18} color={theme.textSecondary} onPress={() => setQuery('')} />
        ) : null}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + Spacing[4] }]}
        keyboardShouldPersistTaps="handled"
      >
        {(userProfile?.role === 'master_admin' || userProfile?.role === 'admin' || isInternalMobileRole(userProfile?.role)) ? (
          <StateBanner
            variant="info"
            title="Administração disponível no painel web"
            description="Ativação de módulos, permissões, contratações e configurações administrativas não são feitas pelo aplicativo."
          />
        ) : null}
        {access.requiresOrganizationLink ? (
          <StateBanner
            variant="warning"
            title="Vínculo com organização pendente"
            description="Peça ao responsável para vincular sua conta pelo painel web. Avisos e módulos municipais ficam indisponíveis até a confirmação."
          />
        ) : null}
        {visibleSections.length ? visibleSections.map(section => (
          <View key={section.key} style={styles.section}>
            <SectionHeader title={section.title} subtitle={section.description} />
            <View style={styles.grid}>
              {section.items.map(item => (
                <View key={`${section.key}-${item.title}`} style={styles.gridCell}>
                  <ModuleCard
                    title={item.title}
                    description={item.description}
                    icon={item.icon}
                    badge={item.badge}
                    badgeVariant="success"
                    onPress={() => router.push(item.route as any)}
                  />
                </View>
              ))}
            </View>
          </View>
        )) : (
          <StateBanner
            title="Nenhum módulo encontrado"
            description="Tente buscar por vistoria, equipe, mapa ou relatório."
            variant="info"
            actionLabel="Limpar"
            onAction={() => setQuery('')}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { paddingHorizontal: Spacing[5], paddingTop: Spacing[4], gap: Spacing[2] },
  eyebrow: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, letterSpacing: 1.2 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: FontWeight.extrabold, letterSpacing: -0.8 },
  subtitle: { fontSize: FontSize.sm },
  search: { minHeight: ComponentSize.input, marginHorizontal: Spacing[5], marginTop: Spacing[5], borderWidth: 1, borderRadius: SpacingAlias.radiusMd, paddingHorizontal: Spacing[3], flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  searchInput: { flex: 1, fontSize: FontSize.base, paddingVertical: Spacing[2] },
  content: { paddingHorizontal: Spacing[5], paddingTop: Spacing[6], gap: Spacing[8] },
  section: { gap: Spacing[1] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  gridCell: { width: '48%', flexGrow: 1, minWidth: 150 },
});
