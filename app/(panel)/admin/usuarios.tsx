import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
  TextInput,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth, UserProfile } from '../../../context/AuthContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { registrarAuditoria } from '../../../utils/auditLogger';
import { validarSenha } from '../../../utils/passwordValidation';
import { LoadingState } from '../../../components/ui/LoadingState';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Badge } from '../../../components/ui/Badge';
import { UserDeleteModal } from '../../../components/admin/UserDeleteModal';
import { UserPasswordModal } from '../../../components/admin/UserPasswordModal';
import {
  deleteUserAsMasterAdmin,
  fetchUserDeletionImpact,
  getSafeDeletionImpact,
} from '../../../services/UserManagementService';
import {
  EMPTY_USER_DELETION_IMPACT,
  getUserDeletionGuard,
  UserDeletionGuardReason,
  UserDeletionImpact,
} from '../../../utils/userDeletion';

const ROLE_LABELS: Record<string, string> = {
  agent: 'Agente',
  supervisor: 'Supervisor',
  admin: 'Admin',
  master_admin: 'Master',
};

const DELETE_GUARD_MESSAGES: Record<UserDeletionGuardReason, string> = {
  not_master_admin: 'Apenas o master admin pode excluir usuários.',
  self_delete: 'O master admin não pode excluir a própria conta por esta tela.',
  protected_role: 'Outro master admin não pode ser excluído por esta tela.',
};

const PAGE_SIZE = 20;

type Filtro = 'todos' | 'ativos' | 'pendentes';

interface ManagedUser {
  uid: string;
  name: string;
  email: string;
  role: UserProfile['role'];
  isApproved: boolean;
  createdAt?: string;
  municipio?: string | null;
}

interface ViewerScope {
  municipio: string;
  role: UserProfile['role'];
}

export default function UsuariosScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const isMasterAdmin = profile?.role === 'master_admin';

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  const [passModalVisible, setPassModalVisible] = useState(false);
  const [passUser, setPassUser] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteUser, setDeleteUser] = useState<ManagedUser | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteVistorias, setDeleteVistorias] = useState(false);
  const [deleteImpact, setDeleteImpact] = useState<UserDeletionImpact>(EMPTY_USER_DELETION_IMPACT);
  const [deleteImpactLoading, setDeleteImpactLoading] = useState(false);
  const [deleteImpactError, setDeleteImpactError] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const meRef = useRef<ViewerScope | null>(null);

  const loadUsers = async (append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        return;
      }

      if (!meRef.current) {
        const { data: me, error: meError } = await supabase
          .from('users')
          .select('municipio, role')
          .eq('uid', session.user.id)
          .single();

        if (meError || !me) {
          throw new Error(meError?.message ?? 'Não foi possível carregar o escopo do usuário atual.');
        }

        meRef.current = me as ViewerScope;
      }

      const me = meRef.current;
      const rangeStart = append ? users.length : 0;

      let query = supabase
        .from('users')
        .select('uid, name, email, role, isApproved, createdAt, municipio')
        .neq('role', 'master_admin')
        .order('name')
        .range(rangeStart, rangeStart + PAGE_SIZE - 1);

      if (me.role !== 'master_admin') {
        query = query.eq('municipio', me.municipio);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }

      const page = (data ?? []) as ManagedUser[];
      setUsers((prev) => (append ? [...prev, ...page] : page));
      setHasMore(page.length === PAGE_SIZE);
      setErro(null);
    } catch (error) {
      logger.error('system', 'Erro ao carregar usuários', { erro: String(error) });
      setErro('Não foi possível carregar a lista de usuários.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      meRef.current = null;
      loadUsers();
    }, [])
  );

  const getDeleteGuard = (user: ManagedUser) =>
    getUserDeletionGuard({
      currentUserId: profile?.uid,
      currentUserRole: profile?.role ?? null,
      targetUserId: user.uid,
      targetUserRole: user.role,
    });

  const closeDeleteModal = () => {
    setDeleteModalVisible(false);
    setDeleteUser(null);
    setDeleteReason('');
    setDeleteVistorias(false);
    setDeleteImpact(EMPTY_USER_DELETION_IMPACT);
    setDeleteImpactError(null);
    setDeleteImpactLoading(false);
  };

  const closePasswordModal = (force = false) => {
    if (changingPass && !force) {
      return;
    }

    setPassModalVisible(false);
    setPassUser(null);
    setNewPassword('');
  };

  const toggleAprovacao = (user: ManagedUser) => {
    if (!profile?.role || !['admin', 'master_admin'].includes(profile.role)) {
      Alert.alert('Sem permissão', 'Você não tem permissão para alterar o acesso de usuários.');
      return;
    }

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

              if (updateError) {
                throw updateError;
              }

              setUsers((prev) =>
                prev.map((item) =>
                  item.uid === user.uid ? { ...item, isApproved: !item.isApproved } : item
                )
              );

              registrarAuditoria({
                acao: user.isApproved ? 'usuario_bloqueado' : 'usuario_aprovado',
                adminUid: profile.uid,
                adminNome: profile.name,
                adminRole: profile.role,
                municipio: profile.municipio,
                alvoId: user.uid,
                alvoNome: user.name,
              });
            } catch (error) {
              logger.error('system', 'Erro ao atualizar status de aprovação', { erro: String(error) });
              Alert.alert('Erro', 'Não foi possível atualizar o acesso.');
            } finally {
              setToggling(null);
            }
          },
        },
      ]
    );
  };

  const handleOpenPasswordModal = (user: ManagedUser) => {
    setPassUser(user);
    setNewPassword('');
    setPassModalVisible(true);
  };

  const handleChangePassword = async () => {
    if (!profile?.role || !['admin', 'master_admin'].includes(profile.role)) {
      Alert.alert('Sem permissão', 'Você não tem permissão para redefinir senhas.');
      return;
    }

    if (!passUser) {
      Alert.alert('Erro', 'Selecione um usuário válido.');
      return;
    }

    const validacao = validarSenha(newPassword);
    if (!validacao.valido) {
      Alert.alert('Atenção', validacao.erro ?? 'Senha inválida.');
      return;
    }

    setChangingPass(true);
    try {
      const { error } = await supabase.rpc('admin_reset_password', {
        p_uid: passUser.uid,
        p_new_password: newPassword,
      });

      if (error) {
        throw error;
      }

      registrarAuditoria({
        acao: 'senha_redefinida',
        adminUid: profile.uid,
        adminNome: profile.name,
        adminRole: profile.role,
        municipio: profile.municipio,
        alvoId: passUser.uid,
        alvoNome: passUser.name,
        detalhes: { msg: 'Senha de usuário redefinida pelo Admin' },
      });

      Alert.alert('Sucesso', 'A senha foi alterada com sucesso.');
      closePasswordModal(true);
    } catch (error) {
      logger.error('system', 'Erro ao redefinir senha via admin', { erro: String(error) });
      Alert.alert('Erro', 'Houve uma falha ao tentar mudar a senha.');
    } finally {
      setChangingPass(false);
    }
  };

  const handleOpenDeleteModal = async (user: ManagedUser) => {
    const guard = getDeleteGuard(user);
    if (!guard.allowed) {
      Alert.alert('Ação indisponível', DELETE_GUARD_MESSAGES[guard.reason]);
      return;
    }

    setDeleteUser(user);
    setDeleteReason('');
    setDeleteImpact(EMPTY_USER_DELETION_IMPACT);
    setDeleteImpactError(null);
    setDeleteImpactLoading(true);
    setDeleteModalVisible(true);

    try {
      const impact = await fetchUserDeletionImpact(user.uid);
      setDeleteImpact(getSafeDeletionImpact(impact));
    } catch (error) {
      logger.warn('system', 'Falha ao mapear impacto da exclusão do usuário', {
        userId: user.uid,
        erro: String(error),
      });
      setDeleteImpactError('Falha ao mapear vínculos.');
      setDeleteImpact(EMPTY_USER_DELETION_IMPACT);
    } finally {
      setDeleteImpactLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!profile || !deleteUser) {
      return;
    }

    const guard = getDeleteGuard(deleteUser);
    if (!guard.allowed) {
      Alert.alert('Ação indisponível', DELETE_GUARD_MESSAGES[guard.reason]);
      return;
    }

    const motivo = deleteReason.trim();
    if (!motivo) {
      Alert.alert('Motivo obrigatório', 'Informe o motivo da exclusão antes de continuar.');
      return;
    }

    setDeletingUserId(deleteUser.uid);

    try {
      await deleteUserAsMasterAdmin(deleteUser.uid, deleteVistorias);

      registrarAuditoria({
        acao: 'usuario_excluido',
        adminUid: profile.uid,
        adminNome: profile.name,
        adminRole: profile.role,
        municipio: profile.municipio,
        alvoId: deleteUser.uid,
        alvoNome: deleteUser.name,
        detalhes: {
          motivo,
          alvoEmail: deleteUser.email,
          alvoMunicipio: deleteUser.municipio ?? null,
          alvoRole: deleteUser.role,
          impacto: getSafeDeletionImpact(deleteImpact),
        },
      });

      setUsers((prev) => prev.filter((item) => item.uid !== deleteUser.uid));
      closeDeleteModal();
      Alert.alert('Usuário excluído', 'A conta foi removida com sucesso.');
    } catch (error) {
      logger.error('system', 'Erro ao excluir usuário', {
        userId: deleteUser.uid,
        erro: String(error),
      });
      Alert.alert('Erro', 'Não foi possível excluir o usuário.');
    } finally {
      setDeletingUserId(null);
    }
  };

  const filtrados = users.filter((user) => {
    const matchFiltro =
      filtro === 'todos' ||
      (filtro === 'ativos' && user.isApproved) ||
      (filtro === 'pendentes' && !user.isApproved);

    const termo = busca.toLowerCase();
    const matchBusca =
      !busca ||
      user.name?.toLowerCase().includes(termo) ||
      user.email?.toLowerCase().includes(termo) ||
      user.municipio?.toLowerCase().includes(termo);

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
        <View style={styles.errorWrap}>
          <ErrorState
            title="Falha ao carregar"
            message={erro}
            onRetry={() => loadUsers()}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: theme.background, paddingTop: insets.top + 20 },
        ]}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={[
              styles.backButton,
              { backgroundColor: theme.surfaceHighlight, borderColor: theme.border },
            ]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" color={theme.text} size={22} />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={[styles.title, { color: theme.text }]}>Gerenciar usuários</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {filtrados.length} de {users.length} encontrados
            </Text>
          </View>
        </View>

        <View style={styles.filtersSection}>
          <View
            style={[
              styles.searchInput,
              { backgroundColor: theme.surfaceHighlight, borderColor: theme.border },
            ]}
          >
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
              <TouchableOpacity onPress={() => setBusca('')} style={styles.clearSearchButton}>
                <Feather name="x-circle" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {([
              { key: 'todos', label: 'Todos', icon: 'users' },
              { key: 'ativos', label: 'Ativos', icon: 'check-circle' },
              { key: 'pendentes', label: 'Pendentes', icon: 'clock' },
            ] as const).map((item) => {
              const isActive = filtro === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.chip,
                    isActive
                      ? { backgroundColor: theme.primary, borderColor: theme.primary }
                      : { backgroundColor: theme.surfaceHighlight, borderColor: theme.border },
                  ]}
                  onPress={() => setFiltro(item.key)}
                >
                  <Feather
                    name={item.icon as never}
                    size={14}
                    color={isActive ? '#FFF' : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      { color: isActive ? '#FFF' : theme.textSecondary },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
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
            {filtrados.map((user, index) => {
              const roleVariant = user.role === 'agent' ? 'agente' : user.role;
              const deleteGuard = getDeleteGuard(user);

              return (
                <View
                  key={user.uid}
                  style={[
                    styles.userCard,
                    {
                      backgroundColor: theme.surfaceHighlight,
                      borderColor: theme.border,
                      marginTop: index === 0 ? 8 : 12,
                    },
                  ]}
                >
                  <View style={styles.cardInfo}>
                    <View
                      style={[
                        styles.avatar,
                        {
                          backgroundColor: user.isApproved
                            ? theme.primaryLight
                            : theme.surfaceVariant,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarText,
                          {
                            color: user.isApproved ? theme.primaryText : theme.textSecondary,
                          },
                        ]}
                      >
                        {user.name?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>

                    <View style={styles.userMetaWrap}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
                          {user.name}
                        </Text>
                        <Badge label={ROLE_LABELS[user.role] || user.role} variant={roleVariant} size="sm" />
                        {user.municipio && (
                          <Badge label={user.municipio} variant="neutral" size="sm" />
                        )}
                      </View>

                      <Text
                        style={[styles.userEmail, { color: theme.textSecondary }]}
                        numberOfLines={1}
                      >
                        {user.email}
                      </Text>

                      <View style={styles.statusRow}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: user.isApproved ? '#10B981' : '#F59E0B' },
                          ]}
                        />
                        <Text
                          style={[
                            styles.userStatus,
                            { color: user.isApproved ? '#10B981' : '#F59E0B' },
                          ]}
                        >
                          {user.isApproved ? 'Acesso liberado' : 'Aguardando aprovação'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.cardActions, { borderTopColor: theme.border }]}>
                    <View style={styles.toggleRow}>
                      <Text style={[styles.toggleLabel, { color: theme.textSecondary }]}>
                        {user.isApproved ? 'Bloquear conta' : 'Aprovar acesso'}
                      </Text>

                      {toggling === user.uid ? (
                        <ActivityIndicator size="small" color={theme.primary} />
                      ) : (
                        <Switch
                          value={user.isApproved}
                          onValueChange={() => toggleAprovacao(user)}
                          trackColor={{ false: theme.border, true: `${theme.primary}80` }}
                          thumbColor={user.isApproved ? theme.primary : theme.textSecondary}
                        />
                      )}
                    </View>

                    {isMasterAdmin && (
                      <View style={styles.secondaryActions}>
                        <TouchableOpacity
                          style={[
                            styles.actionBtn,
                            { borderColor: theme.border, backgroundColor: theme.background },
                          ]}
                          onPress={() => handleOpenPasswordModal(user)}
                        >
                          <Feather name="key" size={16} color={theme.textSecondary} />
                          <Text style={[styles.actionBtnText, { color: theme.textSecondary }]}>
                            Redefinir senha
                          </Text>
                        </TouchableOpacity>

                        {deleteGuard.allowed && (
                          <TouchableOpacity
                            style={[
                              styles.actionBtn,
                              styles.dangerActionBtn,
                              { borderColor: 'rgba(239,68,68,0.22)' },
                            ]}
                            onPress={() => handleOpenDeleteModal(user)}
                          >
                            <Feather name="trash-2" size={16} color="#EF4444" />
                            <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>
                              Excluir usuário
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            {hasMore && (
              <TouchableOpacity
                style={[
                  styles.loadMoreBtn,
                  { borderColor: theme.border, backgroundColor: theme.surfaceHighlight },
                ]}
                onPress={() => loadUsers(true)}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={theme.text} />
                ) : (
                  <Text style={[styles.loadMoreText, { color: theme.text }]}>
                    Carregar mais usuários
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      <UserPasswordModal
        visible={passModalVisible}
        changingPass={changingPass}
        newPassword={newPassword}
        onCancel={closePasswordModal}
        onChangePassword={handleChangePassword}
        onPasswordChange={setNewPassword}
        userName={passUser?.name}
      />

      <UserDeleteModal
        visible={deleteModalVisible}
        user={deleteUser}
        reason={deleteReason}
        onReasonChange={setDeleteReason}
        deleteVistorias={deleteVistorias}
        onDeleteVistoriasChange={setDeleteVistorias}
        impact={deleteImpact}
        impactError={deleteImpactError}
        loadingImpact={deleteImpactLoading}
        deleting={deletingUserId === deleteUser?.uid}
        confirmDisabled={
          deleteImpactLoading || !deleteReason.trim() || deletingUserId === deleteUser?.uid
        }
        onCancel={closeDeleteModal}
        onConfirm={handleDeleteUser}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actionBtn: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
  },
  backButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    marginRight: 16,
    width: 44,
  },
  cardActions: {
    borderTopWidth: 1,
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  cardInfo: {
    alignItems: 'center',
    flexDirection: 'row',
    padding: 18,
  },
  chip: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  chipsRow: {
    gap: 8,
    marginTop: 16,
  },
  clearSearchButton: {
    padding: 4,
  },
  container: {
    flex: 1,
  },
  dangerActionBtn: {
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  filtersSection: {
    marginTop: 24,
  },
  header: {
    paddingBottom: 4,
    paddingHorizontal: 24,
  },
  headerContent: {
    flex: 1,
  },
  headerTop: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  inputPass: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 16,
    height: 52,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  loadMoreBtn: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    padding: 16,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    height: 50,
    justifyContent: 'center',
  },
  modalBtnPrimaryText: {
    fontWeight: '700',
  },
  modalBtnSecondaryText: {
    fontWeight: '600',
  },
  modalContent: {
    borderRadius: 24,
    borderWidth: 1,
    elevation: 4,
    maxWidth: 400,
    padding: 24,
    width: '85%',
  },
  modalDesc: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 10,
    textAlign: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIcon: {
    alignItems: 'center',
    borderRadius: 20,
    height: 64,
    justifyContent: 'center',
    marginBottom: 16,
    width: 64,
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    flex: 1,
    justifyContent: 'center',
  },
  modalStrongText: {
    fontWeight: '700',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 80,
  },
  searchInput: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    height: 48,
    paddingHorizontal: 16,
  },
  searchText: {
    flex: 1,
    fontSize: 15,
  },
  secondaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
  },
  statusDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  userCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  userEmail: {
    fontSize: 13,
    marginBottom: 6,
  },
  userMetaWrap: {
    flex: 1,
    marginLeft: 14,
  },
  userName: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  userStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
});
