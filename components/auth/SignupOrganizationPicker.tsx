import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import { useTheme } from '../../context/ThemeContext';
import { AppHeader, Button } from '../ui';
export type SignupOrganization = { id: string; name: string; municipality: string; uf: string };
export function SignupOrganizationPicker({ value, onChange }: { value: SignupOrganization | null; onChange: (value: SignupOrganization) => void }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SignupOrganization[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setItems([]); setError('');
    if (!open || query.trim().length < 2) { setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const { data, error } = await supabase.rpc('search_signup_organizations', { p_search: query.trim().toLowerCase() === 'bh' ? 'Belo Horizonte' : query.trim() });
          if (error) throw error;
          if (current) setItems(data || []);
        } catch { if (current) setError('Não foi possível consultar as organizações. Confira sua conexão e tente novamente.'); }
        finally { if (current) setLoading(false); }
      })();
    }, 350);
    return () => { current = false; clearTimeout(timer); };
  }, [query, open, retry]);
  const close = () => { Keyboard.dismiss(); setOpen(false); };
  return <>
    <Button label={value ? `${value.name} · ${value.municipality}/${value.uf}` : 'Selecionar organização'} variant="secondary" onPress={() => setOpen(true)} />
    <Modal visible={open} animationType="slide" onRequestClose={close}><SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}><AppHeader title="Sua organização" onBack={close} /><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><View style={{ padding: 20, gap: 12 }}><TextInput accessibilityLabel="Buscar organização" value={query} onChangeText={setQuery} maxLength={120} placeholder="Nome, município ou UF" placeholderTextColor={theme.textSecondary} autoCorrect={false} style={{ color: theme.text, padding: 16, borderWidth: 1, borderColor: theme.border, borderRadius: 12 }} /><Text style={{ color: theme.textSecondary }}>Pesquise a organização que enviou seu convite. O token precisa pertencer a ela.</Text></View>
      {loading ? <ActivityIndicator color={theme.primary} /> : null}
      {error ? <View style={{ padding: 20, gap: 12 }}><Text accessibilityRole="alert" style={{ color: theme.error }}>{error}</Text><Button label="Tentar novamente" onPress={() => setRetry(v => v + 1)} /></View> : null}
      <FlatList style={{ flex: 1 }} data={items} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" keyExtractor={item => item.id} contentContainerStyle={{ padding: 20, gap: 12 }} ListEmptyComponent={!loading && !error ? <Text style={{ color: theme.textSecondary }}>{query.trim().length < 2 ? 'Digite pelo menos 2 caracteres.' : 'Organização não encontrada. Confira o nome com o responsável pelo convite.'}</Text> : undefined} renderItem={({ item }) => <TouchableOpacity accessibilityRole="button" onPress={() => { onChange(item); close(); }} style={{ padding: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.border, gap: 8 }}><Text style={{ color: theme.text, fontWeight: '700' }}>{item.name}</Text><Text style={{ color: theme.textSecondary }}>{item.municipality} · {item.uf}</Text></TouchableOpacity>} />
      <View style={{ padding: 20 }}><Button label="Voltar ao cadastro" variant="secondary" onPress={close} /></View>
    </KeyboardAvoidingView></SafeAreaView></Modal>
  </>;
}
