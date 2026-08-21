import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Modal, TextInput
} from 'react-native';
import { validarSenha } from '../../../utils/passwordValidation';
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
import { AppHeader, Badge, Button, ConfirmSheet, FormField, MetricCard, StateBanner } from '../../../components/ui';
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
  const [accessUser, setAccessUser] = useState<any>(null);
  
  // States para redefinição de senha
  const [passModalVisible, setPassModalVisible] = useState(false);
  const [passUser, setPassUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const loadUsers = async (append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const { data, error } = await supabase.rpc('list_operational_users', {
        p_role: null,
        p_municipio: null,
        p_include_unapproved: true,
        p_offset: append ? users.length : 0,
        p_limit: PAGE_SIZE,
      });
      if (error) throw error;
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

  useFocusEffect(useCallback(() => { loadUsers(); }, []));

  const toggleAprovacao = (user: any) => {
    // Defesa em profundidade: checar role antes de executar a ação,
    // independente da guarda de navegação em _layout.tsx.
    if (!profile?.role || !['admin', 'master_admin'].includes(profile.role)) {
      Alert.alert('Sem permissão', 'Você não tem permissão para alterar o acesso de usuários.');
      return;
    }
    setAccessUser(user);
  };

  const confirmToggleAprovacao = async () => {
    const user = accessUser;
    if (!user) return;
    setAccessUser(null);
    setToggling(user.uid);
    try {
      const { error: updateError } = await supabase.rpc('set_user_approval', {
        p_target_uid: user.uid,
        p_is_approved: !user.isApproved,
      });
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
  };

  const handleOpenPasswordModal = (user: any) => {
    setPassUser(user);
    setNewPassword('');
    setPassModalVisible(true);
  };

  const handleChangePassword = async () => {
    // Defesa em profundidade: checar role antes de executar ação sensível.
    if (!profile?.role || !['admin', 'master_admin'].includes(profile.role)) {
      Alert.alert('Sem permissão', 'Você não tem permissão para redefinir senhas.');
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
  const ativosTotal = users.filter(u => u.isApproved).length;
  const pendentesTotal = users.length - ativosTotal;

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
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title="Acessos da equipe"
          subtitle={`${filtrados.length} de ${users.length} pessoas`}
          onBack={() => router.back()}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.metricsRow}>
          <MetricCard value={ativosTotal} label="Acessos ativos" tone="success" style={styles.metric} />
          <MetricCard value={pendentesTotal} label="Aguardando análise" tone="warning" style={styles.metric} />
        </View>

        {pendentesTotal > 0 ? (
          <StateBanner
            title={`${pendentesTotal} ${pendentesTotal === 1 ? 'acesso pendente' : 'acessos pendentes'}`}
            description="Confirme o perfil e o município antes de liberar cada conta."
            variant="warning"
            actionLabel="Ver"
            onAction={() => setFiltro('pendentes')}
          />
        ) : null}

        <View style={styles.controls}>
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

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
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
                  <Feather name={f.icon as any} size={14} color={isActive ? theme.onPrimary : theme.textSecondary} />
                  <Text style={{ 
                    color: isActive ? theme.onPrimary : theme.textSecondary,
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
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      marginTop: index === 0 ? 8 : 12
                    }
                  ]}
                >
                  <View style={styles.cardInfo}>
                    <View style={[styles.avatar, { backgroundColor: u.isApproved ? theme.primaryLight : theme.warningLight }]}>
                      <Feather name={u.isApproved ? 'user-check' : 'user-plus'} size={22} color={u.isApproved ? theme.primary : theme.warning} />
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
                      
                      <Badge
                        label={u.isApproved ? 'Acesso liberado' : 'Aguardando aprovação'}
                        variant={u.isApproved ? 'success' : 'warning'}
                        size="sm"
                      />
                    </View>
                  </View>

                  <View style={[styles.cardActions, { borderTopColor: theme.border }]}>
                    <Button
                      label={u.isApproved ? 'Bloquear acesso' : 'Aprovar acesso'}
                      variant={u.isApproved ? 'secondary' : 'primary'}
                      size="sm"
                      loading={toggling === u.uid}
                      disabled={toggling === u.uid}
                      onPress={() => toggleAprovacao(u)}
                    />

                    {profile?.role === 'master_admin' && (
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
            
            <FormField
              label="Nova senha"
              required
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Digite a nova senha"
              helperText="Use ao menos 8 caracteres, com letras e números."
              secureTextEntry
              autoCapitalize="none"
              autoFocus
            />

            <View style={styles.modalActions}>
              <Button
                label="Cancelar"
                variant="ghost"
                onPress={() => setPassModalVisible(false)}
                disabled={changingPass}
                style={styles.modalBtn}
              />
              <Button
                label="Salvar senha"
                variant="primary"
                onPress={handleChangePassword}
                disabled={changingPass}
                loading={changingPass}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
      <ConfirmSheet
        visible={Boolean(accessUser)}
        title={accessUser?.isApproved ? 'Bloquear acesso?' : 'Aprovar acesso?'}
        description={accessUser?.isApproved
          ? `${accessUser?.name} deixará de acessar os módulos do TCS.`
          : `${accessUser?.name} terá acesso como ${ROLE_LABELS[accessUser?.role] ?? accessUser?.role} em ${accessUser?.municipio ?? 'seu município'}.`}
        onDismiss={() => setAccessUser(null)}
        actions={[
          { label: accessUser?.isApproved ? 'Bloquear acesso' : 'Aprovar acesso', variant: accessUser?.isApproved ? 'danger' : 'primary', onPress: confirmToggleAprovacao },
          { label: 'Cancelar', variant: 'ghost', onPress: () => setAccessUser(null) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  metricsRow: { flexDirection: 'row', gap: 12 },
  metric: { flex: 1 },
  controls: { gap: 12 },
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
  chipRow: { gap: 8 },
  scrollContent: { padding: 20, paddingBottom: 80, gap: 18 },
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  userName: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  userEmail: { fontSize: 13, marginBottom: 6 },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
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
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalBtn: { flex: 1 },
});

