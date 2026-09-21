import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';
import { AppHeader, Button, LoadingState, StateBanner } from '../../../components/ui';
import {
  buscarLayoutDashboard,
  DashboardRole,
  DEFAULT_LAYOUTS,
  LayoutItem,
  normalizarLayout,
  salvarLayoutDashboard,
  WIDGET_SETS,
} from '../../../utils/dashboardLayout';

const ROLE_TABS: { role: DashboardRole; label: string }[] = [
  { role: 'agent', label: 'Agente' },
  { role: 'supervisor', label: 'Supervisor' },
  { role: 'admin', label: 'Admin' },
];

/**
 * Editor de templates do dashboard — admin da org personaliza, por papel,
 * quais blocos aparecem e em que ordem para sua equipe inteira.
 * Precedência: template da org > template global (owner) > padrão do sistema.
 */
export default function PersonalizarDashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const [role, setRole] = useState<DashboardRole>('agent');
  const [layout, setLayout] = useState<LayoutItem[]>(DEFAULT_LAYOUTS.agent);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sujo, setSujo] = useState(false);

  const carregar = useCallback(async (r: DashboardRole) => {
    setCarregando(true);
    const atual = await buscarLayoutDashboard(r);
    setLayout(atual);
    setCarregando(false);
    setSujo(false);
  }, []);

  useEffect(() => { void carregar(role); }, [carregar, role]);

  const mover = (index: number, direcao: -1 | 1) => {
    const alvo = index + direcao;
    if (alvo < 0 || alvo >= layout.length) return;
    const novo = [...layout];
    [novo[index], novo[alvo]] = [novo[alvo], novo[index]];
    setLayout(novo.map((it, i) => ({ ...it, ordem: i + 1 })));
    setSujo(true);
  };

  const alternar = (index: number) => {
    const novo = [...layout];
    novo[index] = { ...novo[index], visivel: !novo[index].visivel };
    setLayout(novo);
    setSujo(true);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await salvarLayoutDashboard(role, layout);
      setSujo(false);
      Alert.alert('Modelo salvo', 'O painel desse papel na sua organização foi atualizado.');
    } catch (e: any) {
      Alert.alert('Erro ao salvar', e?.message || 'Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const restaurar = () => {
    Alert.alert('Restaurar padrão?', 'Volta para o modelo padrão do sistema para este papel.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Restaurar', onPress: () => { setLayout(normalizarLayout(DEFAULT_LAYOUTS[role], role).map(i => ({ ...i, visivel: true }))); setSujo(true); } },
    ]);
  };

  const widgets = WIDGET_SETS[role];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title="Personalizar painel"
          subtitle="Blocos visíveis por papel na sua organização"
          onBack={() => router.back()}
        />
      </View>

      <View style={styles.tabs}>
        {ROLE_TABS.map(t => (
          <TouchableOpacity
            key={t.role}
            style={[styles.tab, { borderColor: role === t.role ? theme.primary : theme.border, backgroundColor: role === t.role ? `${theme.primary}18` : 'transparent' }]}
            onPress={() => setRole(t.role)}
            accessibilityRole="button"
            accessibilityLabel={`Editar dashboard de ${t.label}`}
          >
            <Text style={[styles.tabTexto, { color: role === t.role ? theme.primary : theme.textSecondary }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {carregando ? (
        <LoadingState message="Carregando modelo do painel..." />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
          <StateBanner
            variant="info"
            title="Vale para toda a organização"
            description="Quem tiver esse papel na sua equipe verá o painel nessa ordem. Banners automáticos (offline/cobrança) são sempre exibidos."
          />

          {layout.map((item, index) => {
            const def = widgets.find(w => w.id === item.widget);
            if (!def) return null;
            return (
              <View key={item.widget} style={[styles.item, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.ordemCol}>
                  <TouchableOpacity onPress={() => mover(index, -1)} disabled={index === 0} style={styles.seta}
                    accessibilityRole="button" accessibilityLabel={`Mover ${def.nome} para cima`}>
                    <Feather name="chevron-up" size={18} color={index === 0 ? theme.textSecondary : theme.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => mover(index, 1)} disabled={index === layout.length - 1} style={styles.seta}
                    accessibilityRole="button" accessibilityLabel={`Mover ${def.nome} para baixo`}>
                    <Feather name="chevron-down" size={18} color={index === layout.length - 1 ? theme.textSecondary : theme.primary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.info}>
                  <Text style={[styles.nome, { color: theme.text }]}>{def.nome}</Text>
                  <Text style={[styles.descricao, { color: theme.textSecondary }]}>{def.descricao}</Text>
                </View>
                <Switch
                  value={item.visivel}
                  onValueChange={() => alternar(index)}
                  trackColor={{ true: theme.primary, false: theme.border }}
                  accessibilityLabel={`Ativar ou desativar ${def.nome}`}
                />
              </View>
            );
          })}

          <View style={{ gap: 10, marginTop: 8 }}>
            <Button
              label={sujo ? 'Salvar modelo' : 'Modelo atualizado'}
              onPress={() => void salvar()}
              loading={salvando}
              disabled={!sujo}
              fullWidth
              iconLeft={<Feather name="save" size={18} color="#FFFFFF" />}
            />
            <Button
              label="Restaurar padrão do sistema"
              variant="secondary"
              onPress={restaurar}
              fullWidth
              iconLeft={<Feather name="rotate-ccw" size={16} color={theme.primary} />}
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  tab: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  tabTexto: { fontSize: 13, fontWeight: '700' },
  content: { padding: 16, gap: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  ordemCol: { alignItems: 'center' },
  seta: { padding: 4 },
  info: { flex: 1 },
  nome: { fontSize: 14, fontWeight: '700' },
  descricao: { fontSize: 12, marginTop: 2 },
});
