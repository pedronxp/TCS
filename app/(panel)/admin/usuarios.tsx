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
        .select('uid, name, email, role, "isApproved", "createdAt", municipio')
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
              const { error: updateError } = await supabase
                .from('users')
                .update({ isApproved: !user.isApproved })
                .eq('uid', user.uid);
              if (updateError) throw updateError;
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
        acao: 'senha_redefinida',
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
      u.email?.toLowerCase().includes(busca.toLowerCase()) ||
      u.municipio?.toLowerCase().includes(busca.toLowerCase());
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
      <View style={[styles.header, { backgroundColor: theme.background, paddingTop: insets.top + 20 }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" color={theme.text} size={22} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>Gerenciar Usuários</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {filtrados.length} de {users.length} encontrados
            </Text>
          </View>
        </View>

        {/* Busca e Filtros - Integrados no Cabeçalho */}
        <View style={{ marginTop: 24 }}>
          <View style={[styles.searchInput, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
            <Feather name="search" size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchText, { color: theme.text }]}
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar por nome, email ou cidade..."
              placeholderTextColor={theme.textSecondary}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {busca.length > 0 && (
              <TouchableOpacity onPress={() => setBusca('')} style={{ padding: 4 }}>
                <Feather name="x-circle" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 16 }}>
            {([
              { key: 'todos', label: 'Todos', icon: 'users' },
              { key: 'ativos', label: 'Ativos', icon: 'check-circle' },
              { key: 'pendentes', label: 'Pendentes', icon: 'clock' },
            ] as const).map(f => {
              const isActive = filtro === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[
                    styles.chip,
                    isActive
                      ? { backgroundColor: theme.primary, borderColor: theme.primary }
                      : { backgroundColor: theme.surfaceHighlight, borderColor: theme.border },
                  ]}
                  onPress={() => setFiltro(f.key)}
                >
                  <Feather name={f.icon as any} size={14} color={isActive ? '#FFF' : theme.textSecondary} />
                  <Text style={{ 
                    color: isActive ? '#FFF' : theme.textSecondary, 
                    fontSize: 13, 
                    fontWeight: isActive ? '700' : '600' 
                  }}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
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
            {filtrados.map((u, index) => {
              const roleVariant = u.role === 'agent' ? 'agente' : u.role;
              return (
                <View 
                  key={u.uid} 
                  style={[
                    styles.userCard, 
                    { 
                      backgroundColor: theme.surfaceHighlight,
                      borderColor: theme.border,
                      marginTop: index === 0 ? 8 : 12
                    }
                  ]}
                >
                  <View style={styles.cardInfo}>
                    <View style={[styles.avatar, { backgroundColor: u.isApproved ? theme.primaryLight : theme.surfaceVariant }]}>
                      <Text style={[styles.avatarText, { color: u.isApproved ? theme.primaryText : theme.textSecondary }]}>
                        {u.name?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>{u.name}</Text>
                        <Badge label={ROLE_LABELS[u.role] || u.role} variant={roleVariant} size="sm" />
                        {u.municipio && (
                          <Badge label={u.municipio} variant="neutral" size="sm" />
                        )}
                      </View>
                      <Text style={[styles.userEmail, { color: theme.textSecondary }]} numberOfLines={1}>{u.email}</Text>
                      
                      <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: u.isApproved ? '#10B981' : '#F59E0B' }]} />
                        <Text style={[styles.userStatus, { color: u.isApproved ? '#10B981' : '#F59E0B' }]}>
                          {u.isApproved ? 'Acesso liberado' : 'Aguardando aprovação'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.cardActions, { borderTopColor: theme.border }]}>
                    <View style={styles.toggleRow}>
                      <Text style={[styles.toggleLabel, { color: theme.textSecondary }]}>
                        {u.isApproved ? 'Bloquear conta' : 'Aprovar acesso'}
                      </Text>
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
                    </View>

                    {meRef.current?.role === 'master_admin' && (
                      <TouchableOpacity 
                        style={[styles.actionBtn, { borderColor: theme.border, backgroundColor: theme.background }]}
                        onPress={() => handleOpenPasswordModal(u)}
                      >
                        <Feather name="key" size={16} color={theme.textSecondary} />
                        <Text style={[styles.actionBtnText, { color: theme.textSecondary }]}>Redefinir Senha</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
            {hasMore && (
              <TouchableOpacity
                style={[styles.loadMoreBtn, { borderColor: theme.border, backgroundColor: theme.surfaceHighlight }]}
                onPress={() => loadUsers(true)}
                disabled={loadingMore}
              >
                {loadingMore
                  ? <ActivityIndicator size="small" color={theme.text} />
                  : <Text style={[styles.loadMoreText, { color: theme.text }]}>Carregar mais usuários</Text>}
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
          <View style={[styles.modalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: theme.surfaceHighlight }]}>
                <Feather name="key" size={24} color={theme.text} />
              </View>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Redefinir Senha</Text>
              <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>
                Defina uma nova senha para o acesso de <Text style={{fontWeight: '700'}}>{passUser?.name}</Text>
              </Text>
            </View>
            
            <TextInput
              style={[styles.inputPass, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border, color: theme.text }]}
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
                style={[styles.modalBtn, { backgroundColor: theme.surfaceHighlight, borderWidth: 0 }]}
                onPress={() => setPassModalVisible(false)}
                disabled={changingPass}
              >
                <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: theme.text }]}
                onPress={handleChangePassword}
                disabled={changingPass}
              >
                {changingPass ? (
                  <ActivityIndicator color={theme.background} size="small" />
                ) : (
                  <Text style={{ color: theme.background, fontWeight: '700' }}>Salvar</Text>
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
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  headerTop: {
    flexDirection: 'row', 
    alignItems: 'center',
  },
  backButton: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, marginRight: 16,
  },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 13, fontWeight: '500', marginTop: 4 },
  searchInput: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, height: 48,
  },
  searchText: { flex: 1, fontSize: 15 },
  chip: { 
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, 
    borderRadius: 24, borderWidth: 1,
  },
  scrollContent: { padding: 24, paddingBottom: 80 },
  userCard: {
    borderRadius: 16, borderWidth: 1, 
    overflow: 'hidden', // Importante para o layout das ações não vazar as bordas
  },
  cardInfo: {
    flexDirection: 'row', alignItems: 'center', 
    padding: 18,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 16, 
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontWeight: '800', fontSize: 22 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  userName: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  userEmail: { fontSize: 13, marginBottom: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  userStatus: { fontSize: 13, fontWeight: '600' },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '600' },
  loadMoreBtn: { borderRadius: 14, borderWidth: 1, padding: 16, alignItems: 'center', marginTop: 8 },
  loadMoreText: { fontSize: 14, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', maxWidth: 400, borderRadius: 24, borderWidth: 1, padding: 24, elevation: 4 },
  modalHeader: { alignItems: 'center', marginBottom: 20 },
  modalIcon: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  modalDesc: { fontSize: 14, textAlign: 'center', paddingHorizontal: 10, lineHeight: 20 },
  inputPass: { height: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, fontSize: 16, marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, height: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 14 },
});

