import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
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
];

function sectionsForRole(role: string | undefined, developerMode: boolean): ModuleSection[] {
  if (developerMode) {
    return [
      {
        key: 'operation', title: 'Operação', description: 'Fluxos utilizados em campo', items: [
          { title: 'Nova vistoria', description: 'Iniciar fluxo técnico completo', icon: 'plus-circle', route: '/(panel)/inspecoes/dados-iniciais', badge: 'Principal' },
          ...baseOperation,
          { title: 'Agenda', description: 'Agendamentos e distribuição', icon: 'calendar', route: '/(panel)/agendamentos' },
        ],
      },
      {
        key: 'management', title: 'Gestão', description: 'Pessoas, territórios e documentos', items: [
          { title: 'Painel administrativo', description: 'Visão municipal e ferramentas', icon: 'settings', route: '/(panel)/admin' },
          { title: 'Usuários', description: 'Perfis, aprovações e acessos', icon: 'users', route: '/(panel)/admin/usuarios' },
          { title: 'Equipe', description: 'Agentes e desempenho', icon: 'user-check', route: '/(panel)/equipe' },
          { title: 'Tokens', description: 'Convites e níveis de acesso', icon: 'key', route: '/(panel)/admin/tokens' },
          { title: 'Municípios', description: 'Cobertura territorial', icon: 'map', route: '/(panel)/master/municipios' },
          { title: 'Contratações', description: 'Planos e ativações', icon: 'shopping-bag', route: '/(panel)/master/contratacoes' },
          { title: 'Coordenação', description: 'Recursos de coordenação', icon: 'layers', route: '/(panel)/coordenacao' },
          { title: 'Protocolo', description: 'Numeração de documentos', icon: 'hash', route: '/(panel)/admin/protocolo-doc' },
        ],
      },
      {
        key: 'configuration', title: 'Produto e configuração', description: 'Modelos, regras e observabilidade', items: [
          { title: 'Formulários', description: 'Modelos e perguntas técnicas', icon: 'edit-3', route: '/(panel)/admin/form-editor' },
          { title: 'Regras de risco', description: 'Faixas e classificações', icon: 'sliders', route: '/(panel)/admin/risco-config' },
          { title: 'Relatórios', description: 'Laudos e exportações', icon: 'file-text', route: '/(panel)/admin/relatorios' },
          { title: 'Estatísticas', description: 'Indicadores da operação', icon: 'bar-chart-2', route: '/(panel)/admin/estatisticas' },
          { title: 'Treinamentos', description: 'Turmas e capacitação', icon: 'book-open', route: '/(panel)/master/treinamentos' },
          { title: 'Logs do sistema', description: 'Diagnóstico e rastreabilidade', icon: 'terminal', route: '/(panel)/master/logs' },
        ],
      },
      {
        key: 'account', title: 'Conta e atendimento', description: 'Assinatura, planos e suporte', items: [
          trainingAccess,
          subscription,
          { title: 'Planos', description: 'Catálogo comercial', icon: 'package', route: '/(panel)/planos' },
          { title: 'Suporte', description: 'Ajuda e atendimento', icon: 'help-circle', route: '/(panel)/suporte' },
          profile,
        ],
      },
    ];
  }

  if (role === 'master_admin') {
    return [
      {
        key: 'network', title: 'Rede TCS', description: 'Operação global e cobertura', items: [
          { title: 'Contratações', description: 'Analisar e ativar planos', icon: 'shopping-bag', route: '/(panel)/master/contratacoes' },
          { title: 'Municípios', description: 'Gerenciar cobertura', icon: 'map', route: '/(panel)/master/municipios' },
          { title: 'Equipe', description: 'Agentes de todos os municípios', icon: 'user-check', route: '/(panel)/equipe' },
          { title: 'Usuários', description: 'Todos os perfis da rede', icon: 'users', route: '/(panel)/admin/usuarios' },
        ],
      },
      {
        key: 'intelligence', title: 'Operação e inteligência', description: 'Dados técnicos e controle', items: [
          ...baseOperation,
          { title: 'Relatórios', description: 'Laudos e exportações', icon: 'file-text', route: '/(panel)/admin/relatorios' },
          { title: 'Estatísticas', description: 'Indicadores globais', icon: 'bar-chart-2', route: '/(panel)/admin/estatisticas' },
          { title: 'Tokens', description: 'Convites e acesso', icon: 'key', route: '/(panel)/admin/tokens' },
          { title: 'Logs', description: 'Auditoria do sistema', icon: 'terminal', route: '/(panel)/master/logs' },
        ],
      },
      { key: 'account', title: 'Conta', description: 'Plano e preferências', items: [trainingAccess, subscription, profile] },
    ];
  }

  if (role === 'admin') {
    return [
      {
        key: 'municipal', title: 'Gestão municipal', description: 'Equipe, acesso e organização', items: [
          { title: 'Usuários', description: 'Aprovações e perfis', icon: 'users', route: '/(panel)/admin/usuarios' },
          { title: 'Equipe', description: 'Desempenho dos agentes', icon: 'user-check', route: '/(panel)/equipe' },
          { title: 'Grupos', description: 'Organização por área ou turno', icon: 'grid', route: '/(panel)/grupos' },
          { title: 'Tokens', description: 'Convites de acesso', icon: 'key', route: '/(panel)/admin/tokens' },
        ],
      },
      {
        key: 'technical', title: 'Operação técnica', description: 'Vistorias e inteligência local', items: [
          ...baseOperation,
          { title: 'Relatórios', description: 'Exportar laudos', icon: 'file-text', route: '/(panel)/admin/relatorios' },
          { title: 'Estatísticas', description: 'Métricas municipais', icon: 'bar-chart-2', route: '/(panel)/admin/estatisticas' },
          { title: 'Logs', description: 'Atividades recentes', icon: 'terminal', route: '/(panel)/admin/logs' },
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
  const { profile: userProfile, developerMode } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomPadding = useBottomTabPadding();
  const [query, setQuery] = useState('');
  const sections = useMemo(() => sectionsForRole(userProfile?.role, developerMode), [userProfile?.role, developerMode]);
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

  const roleLabel = developerMode
    ? 'Ambiente de desenvolvimento'
    : userProfile?.role === 'master_admin'
      ? 'Gestão da rede TCS'
      : userProfile?.role === 'admin'
        ? 'Administração municipal'
        : userProfile?.role === 'supervisor'
          ? 'Supervisão de campo'
          : 'Operação de campo';

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
