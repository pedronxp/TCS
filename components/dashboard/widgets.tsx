import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../utils/supabase';
import { useTheme } from '../../context/ThemeContext';

// ─── Widget: alertas de risco (R3/R4 recentes do agente) ────────────────────

interface Alerta {
  id: string;
  endereco: string | null;
  nivelRisco: string;
  dataVistoria: string;
}

export function AlertasRiscoWidget({ agenteUid }: { agenteUid?: string }) {
  const { theme } = useTheme();
  const [itens, setItens] = useState<Alerta[]>([]);

  useEffect(() => {
    if (!agenteUid) return;
    let ativo = true;
    (async () => {
      const { data } = await supabase
        .from('vistorias')
        .select('id, endereco, "nivelRisco", "dataVistoria"')
        .eq('agenteUid', agenteUid)
        .in('nivelRisco', ['r3', 'r4'])
        .order('dataVistoria', { ascending: false })
        .limit(3);
      if (ativo) setItens((data ?? []) as Alerta[]);
    })();
    return () => { ativo = false; };
  }, [agenteUid]);

  if (itens.length === 0) return null;

  return (
    <View style={{ gap: 10 }}>
      <Text style={[styles.titulo, { color: theme.text }]}>Alertas de risco recentes</Text>
      {itens.map(a => (
        <TouchableOpacity
          key={a.id}
          style={[styles.item, { backgroundColor: theme.surface, borderColor: theme.error }]}
          onPress={() => router.push(`/(panel)/inspecoes/${a.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Abrir vistoria ${a.nivelRisco?.toUpperCase()}`}
        >
          <View style={[styles.dot, { backgroundColor: theme.error }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemTitulo, { color: theme.text }]} numberOfLines={1}>
              {a.endereco ?? 'Endereço não informado'}
            </Text>
            <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
              {a.nivelRisco?.toUpperCase()} · {new Date(a.dataVistoria).toLocaleDateString('pt-BR')}
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Widget: pendências de QE (supervisor/admin) ────────────────────────────

export function QePendenciasWidget() {
  const { theme } = useTheme();
  const [pendentes, setPendentes] = useState<number | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('qe_fila');
        if (!error && ativo) setPendentes(Array.isArray(data) ? data.length : 0);
      } catch { /* perfil sem papel de revisor — esconde */ }
    })();
    return () => { ativo = false; };
  }, []);

  if (pendentes === null) return null;

  return (
    <TouchableOpacity
      style={[styles.qe, { backgroundColor: pendentes > 0 ? theme.warning + '18' : theme.secondary, borderColor: theme.border }]}
      onPress={() => router.push('/(panel)/qe')}
      accessibilityRole="button"
      accessibilityLabel="Abrir fila de qualidade"
    >
      <Feather name="check-square" size={18} color={pendentes > 0 ? theme.warning : theme.success} />
      <Text style={[styles.qeTexto, { color: theme.text }]}>
        {pendentes === 0
          ? 'Qualidade: nenhuma vistoria aguardando revisão'
          : `Qualidade: ${pendentes} vistoria${pendentes === 1 ? '' : 's'} aguardando revisão`}
      </Text>
      <Feather name="chevron-right" size={16} color={theme.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  titulo: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  itemTitulo: { fontSize: 13, fontWeight: '700' },
  itemMeta: { fontSize: 11, marginTop: 2 },
  qe: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  qeTexto: { flex: 1, fontSize: 13, fontWeight: '600' },
});
