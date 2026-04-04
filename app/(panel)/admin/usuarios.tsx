import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Switch, Alert, TextInput, Modal
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { registrarAuditoria } from '../../../utils/auditLogger';
import { LoadingState } from '../../../components/ui/LoadingState';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Badge } from '../../../components/ui/Badge';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ROLE_LABELS: Record<string, string> = {
  agent: 'Agente', supervisor: 'Supervisor',
  admin: 'Admin', master_admin: 'Master',
};

const PAGE_SIZE = 20;
type Filtro = 'todos' | 'ativos' | 'pendentes';

export default function UsuariosScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);
  
  // States para redefinição de senha
  const [passModalVisible, setPassModalVisible] = useState(false);
  const [passUser, setPassUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const meRef = useRef<any>(null);

  const loadUsers = async (append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (!meRef.current) {
        const { data: me } = await supabase
          .from('users').select('municipio, role').eq('uid', session.user.id).single();
        if (!me) return;
        meRef.current = me;
      }
      const me = meRef.current;

      let query = supabase
        .from('users')
        .select('uid, name, email, role, "isApproved", "createdAt"')
        .neq('role', 'master_admin')
        .order('name')
        .range(append ? users.length : 0, (append ? users.length : 0) + PAGE_SIZE - 1);

      if (me.role !== 'master_admin') {
        query = query.eq('municipio', me.municipio);
      }

      const { data } = await query;
      const page = data || [];
      setUsers(prev => append ? [...prev, ...page] : page);
      setHasMore(page.length === PAGE_SIZE);
      setErro(null);
    } catch (e: any) {
      logger.error('system', 'Erro ao carregar usuários', { erro: String(e) });
      setErro('Não foi possível carregar a lista de usuários.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useFocusEffect(useCallback(() => { meRef.current = null; loadUsers(); }, []));

  const toggleAprovacao = (user: any) => {
    const acao = user.isApproved ? 'bloquear' : 'liberar';
    Alert.alert(
      `${acao.charAt(0).toUpperCase() + acao.slice(1)} acesso?`,
      `Deseja ${acao} o acesso de ${user.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: acao.charAt(0).toUpperCase() + acao.slice(1),
          style: user.isApproved ? 'destructive' : 'default',
          onPress: async () => {
            setToggling(user.uid);
            try {
              await supabase
                .from('users')
                .update({ isApproved: !user.isApproved })
                .eq('uid', user.uid);
              setUsers(prev => prev.map(u =>
                u.uid === user.uid ? { ...u, isApproved: !u.isApproved } : u
              ));
              registrarAuditoria({
                acao: user.isApproved ? 'usuario_bloqueado' : 'usuario_aprovado',
                adminUid: profile?.uid ?? '',
                adminNome: profile?.name ?? '',
                municipio: profile?.municipio ?? '',
                alvoId: user.uid,
                alvoNome: user.name,
              });
            } catch (e) {
              Alert.alert('Erro', 'Não foi possível atualizar o acesso.');
            } finally {
              setToggling(null);
            }
          }
        }
      ]
    );
  };

  const handleOpenPasswordModal = (user: any) => {
    setPassUser(user);
    setNewPassword('');
    setPassModalVisible(true);
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Atenção', 'A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    setChangingPass(true);
    try {
      const { error } = await supabase.rpc('admin_reset_password', {
        p_uid: passUser.uid,
        p_new_password: newPassword
      });
      if (error) throw error;
      
      registrarAuditoria({
        acao: 'usuario_aprovado', // Log proxy
        adminUid: profile?.uid ?? '',
        adminNome: profile?.name ?? '',
        municipio: profile?.municipio ?? '',
        alvoId: passUser.uid,
        alvoNome: passUser.name,
        detalhes: { msg: 'Senha de usuário redefinida pelo Admin' }
      });

      Alert.alert('Sucesso', 'A senha foi alterada com sucesso.');
      setPassModalVisible(false);
    } catch (e: any) {
      logger.error('system', 'Erro resetar senha admin', { erro: String(e) });
      Alert.alert('Erro', 'Houve uma falha ao tentar mudar a senha.');
    } finally {
      setChangingPass(false);
    }
  };

  const filtrados = users.filter(u => {
    const matchFiltro =
      filtro === 'todos' ||
      (filtro === 'ativos' && u.isApproved) ||
      (filtro === 'pendentes' && !u.isApproved);
    const matchBusca = !busca ||
      u.name?.toLowerCase().includes(busca.toLowerCase()) ||
      u.email?.toLowerCase().includes(busca.toLowerCase());
    return matchFiltro && matchBusca;
  });

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LoadingState />
      </View>
    );
  }

  if (erro) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
          <ErrorState
            title="Falha ao Carregar"
            message={erro}
            onRetry={() => loadUsers()}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" color={theme.textSecondary} size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Usuários</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {filtrados.length} de {users.length}
          </Text>
        </View>
      </View>

      {/* Busca */}
      <View style={[styles.searchBar, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <View style={[styles.searchInput, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Feather name="search" size={16} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchText, { color: theme.text }]}
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar usuário..."
            placeholderTextColor={theme.textSecondary}
          />
        </View>
      </View>

      {/* Filtros */}
      <View style={[styles.filterBar, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        {([
          { key: 'todos', label: 'Todos' },
          { key: 'ativos', label: 'Ativos' },
          { key: 'pendentes', label: 'Pendentes' },
        ] as const).map(f => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.chip,
              filtro === f.key
                ? { backgroundColor: theme.primary }
                : { backgroundColor: theme.iconBackground, borderColor: theme.border, borderWidth: 1 },
            ]}
            onPress={() => setFiltro(f.key)}
          >
            <Text style={{ color: filtro === f.key ? '#FFF' : theme.textSecondary, fontSize: 13, fontWeight: '600' }}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {filtrados.length === 0 ? (
          <EmptyState
            icon="users"
            title="Nenhum usuário"
            description="Não foram encontrados usuários com os filtros selecionados."
          />
        ) : (
          <>
            {filtrados.map(u => (
              <View key={u.uid} style={[styles.userCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder, borderRadius: 16, borderWidth: 1 }]}>
                <View style={[styles.avatar, { backgroundColor: u.isApproved ? theme.primary : theme.textSecondary }]}>
                  <Text style={styles.avatarText}>{u.name?.[0]?.toUpperCase() || '?'}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.userName, { color: theme.text }]}>{u.name}</Text>
                    <Badge label={ROLE_LABELS[u.role] || u.role} variant="neutral" />
                  </View>
                  <Text style={[styles.userEmail, { color: theme.textSecondary }]}>{u.email}</Text>
                  <Text style={[styles.userStatus, { color: u.isApproved ? '#10B981' : '#F59E0B' }]}>
                    {u.isApproved ? 'Acesso liberado' : 'Aguardando aprovação'}
                  </Text>
                </View>
                {toggling === u.uid ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Switch
                    value={u.isApproved}
                    onValueChange={() => toggleAprovacao(u)}
                    trackColor={{ false: theme.border, true: `${theme.primary}80` }}
                    thumbColor={u.isApproved ? theme.primary : theme.textSecondary}
                  />
                )}
                {meRef.current?.role === 'master_admin' && (
                   <TouchableOpacity 
                     style={{ marginLeft: 12, padding: 8 }}
                     onPress={() => handleOpenPasswordModal(u)}
                   >
                     <Feather name="key" size={20} color={theme.primary} />
                   </TouchableOpacity>
                )}
              </View>
            ))}
            {hasMore && (
              <TouchableOpacity
                style={[styles.loadMoreBtn, { borderColor: theme.border }]}
                onPress={() => loadUsers(true)}
                disabled={loadingMore}
              >
                {loadingMore
                  ? <ActivityIndicator size="small" color={theme.primary} />
                  : <Text style={[styles.loadMoreText, { color: theme.primary }]}>Carregar mais</Text>}
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {/* Modal Redefinir Senha */}
      <Modal
        visible={passModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPassModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: `${theme.primary}15` }]}>
                <Feather name="key" size={24} color={theme.primary} />
              </View>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Redefinir Senha</Text>
              <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>
                Alterando a senha de {passUser?.name}
              </Text>
            </View>
            
            <TextInput
              style={[styles.inputPass, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Digite a nova senha"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, { borderColor: theme.border, borderWidth: 1 }]}
                onPress={() => setPassModalVisible(false)}
                disabled={changingPass}
              >
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                onPress={handleChangePassword}
                disabled={changingPass}
              >
                {changingPass ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 20, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1,
  },
  backButton: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, marginRight: 16,
  },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  searchBar: { padding: 14, borderBottomWidth: 1 },
  searchInput: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 44,
  },
  searchText: { flex: 1, fontSize: 15 },
  filterBar: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  userCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16,
    borderWidth: 1, padding: 16, marginBottom: 12,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#FFF', fontWeight: '800', fontSize: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  userName: { fontSize: 16, fontWeight: '700', flex: 1 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  roleText: { fontSize: 10, fontWeight: '700' },
  userEmail: { fontSize: 12, marginBottom: 2 },
  userStatus: { fontSize: 12, fontWeight: '600' },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '600' },
  loadMoreBtn: { borderRadius: 14, borderWidth: 1, padding: 16, alignItems: 'center', marginTop: 4 },
  loadMoreText: { fontSize: 14, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', maxWidth: 400, borderRadius: 20, borderWidth: 1, padding: 24, elevation: 4 },
  modalHeader: { alignItems: 'center', marginBottom: 20 },
  modalIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  modalDesc: { fontSize: 13, textAlign: 'center', paddingHorizontal: 10 },
  inputPass: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 16, marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
});
