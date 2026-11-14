import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { AppHeader, Button, ModuleCard, SectionHeader, StateBanner } from '../../../components/ui';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';
import { supabase } from '../../../utils/supabase';
import { generateUUID } from '../../../utils/uuid';
import { listOwnerAdminSection, listOwnerCustomers, OWNER_ADMIN_CAPABILITIES, ownerActionError, ownerItems, ownerMutation, ownerRpc, type OwnerRecord } from '../../../services/OwnerAdministrationService';
import { OWNER_CONSOLE_SECTIONS } from '../../../services/OwnerConsoleService';

type PendingAction = { title: string; rpc: string; args: OwnerRecord; operationId: string };
const labels: Record<string, string> = { active: 'Ativo', suspended: 'Suspenso', archived: 'Arquivado', canceled: 'Cancelado', trial: 'Em teste', onboarding: 'Em cadastro', owner: 'Proprietário', developer: 'Desenvolvimento', support: 'Suporte', auditor: 'Auditoria' };
const display = (value: unknown) => typeof value === 'string' ? labels[value] || value : typeof value === 'number' ? String(value) : '—';

export default function OwnerAdministrationScreen() {
  return <OwnerAdministration />;
}

export function OwnerAdministration({ initialSection = 'home' }: { initialSection?: 'home' | 'tokens' | 'staff' }) {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const bottom = useBottomTabPadding();
  const [section, setSection] = useState<string>(initialSection);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<OwnerRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OwnerRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const mutationLock = useRef(false);
  const request = useRef(0);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaMessage, setMfaMessage] = useState<string | null>(null);
  const [staffDraft, setStaffDraft] = useState<OwnerRecord | null>(null);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticeCity, setNoticeCity] = useState('');
  const [staffRole, setStaffRole] = useState('support');
  const [permissionCode, setPermissionCode] = useState('mobile.inspection.manage');
  const [permissionEffect, setPermissionEffect] = useState('grant');
  const [tokenRole, setTokenRole] = useState('agent');
  const [tokenCity, setTokenCity] = useState<{ nome: string; uf: string } | null>(null);
  const [cities, setCities] = useState<{ nome: string; uf: string }[]>([]);
  const [showCities, setShowCities] = useState(false);
  const [citiesError, setCitiesError] = useState('');
  const openCities = async () => {
    setShowCities(true);
    setCitiesError('');
    try {
      const { data, error } = await supabase.from('municipios').select('nome,uf').order('nome').order('uf');
      if (error) throw error;
      const names = (data ?? []).filter(row => row.nome?.trim() && /^[A-Z]{2}$/.test(row.uf));
      setCities(names);
      if (!names.length) setCitiesError('Nenhum município cadastrado.');
    } catch {
      setCitiesError('Não foi possível carregar os municípios.');
    }
  };
  const [tokenHours, setTokenHours] = useState('24');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const tokenMinutes = Number(tokenHours.replace(',', '.')) * 60;

  const load = useCallback(async () => {
    const token = ++request.current;
    if (profile?.role !== 'owner' || ['home', 'security'].includes(section)) return;
    setLoading(true); setError(null);
    try {
      if (section === 'customers') {
        const data = await listOwnerCustomers(search, offset);
        if (token === request.current) { setRows(ownerItems(data)); setTotal(data?.total ?? 0); }
      } else if (section === 'customer' && customerId) {
        const data = await ownerRpc('get_internal_customer_detail', { p_customer_id: customerId });
        if (token === request.current) setDetail(data);
      } else {
        const data = await listOwnerAdminSection(section);
        if (token === request.current) setRows(data);
      }
    } catch (cause) { if (token === request.current) setError(ownerActionError(cause)); }
    finally { if (token === request.current) setLoading(false); }
  }, [customerId, offset, profile?.role, search, section]);
  useEffect(() => { void load(); return () => { request.current++; }; }, [load]);

  const begin = (title: string, rpc: string, args: OwnerRecord) => {
    setReason(''); setActionError(null); setMfaCode(''); setMfaMessage(null);
    setAction({ title, rpc, args, operationId: generateUUID() });
  };
  const execute = async () => {
    if (!action || mutationLock.current || reason.trim().length < 8) return;
    mutationLock.current = true; setSaving(true); setActionError(null);
    try {
      const result = await ownerMutation(action.rpc, action.args, reason, action.operationId);
      if (action.rpc === 'create_notification_campaign') {
        setNoticeTitle('');
        setNoticeBody('');
        setNoticeCity('');
      }
      if (action.rpc === 'create_console_invite_token') {
        if (typeof result?.token !== 'string' || !result.token) throw new Error('O servidor não retornou o código do convite.');
        setCreatedToken(result.token);
      }
      setAction(null); setStaffDraft(null); await load();
      Alert.alert('Atualizado', 'A ação foi registrada no histórico administrativo.');
    } catch (cause) { setActionError(ownerActionError(cause)); }
    finally { mutationLock.current = false; setSaving(false); }
  };
  const verifyMfa = async () => {
    if (mfaBusy) return;
    setMfaBusy(true); setMfaMessage(null);
    try {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      const factor = data.totp.find(item => item.status === 'verified');
      if (!factor) throw new Error('Esta conta ainda não tem um autenticador configurado. Configure o segundo fator na segurança da conta antes de executar ações protegidas.');
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: mfaCode });
      if (verifyError) throw verifyError;
      setMfaCode(''); setActionError(null); setMfaMessage('Acesso confirmado. Você já pode repetir a ação administrativa.');
    } catch (cause) { setMfaMessage(ownerActionError(cause)); }
    finally { setMfaBusy(false); }
  };
  const card = { backgroundColor: theme.surface, borderColor: theme.border };
  const textStyle = { color: theme.text };
  const muted = { color: theme.textSecondary };
  const inputStyle = [styles.input, card, textStyle];
  const link = (title: string, onPress: () => void) => <TouchableOpacity key={title} accessibilityRole="button" onPress={onPress} style={[styles.link, { borderColor: theme.border }]}><Text style={[textStyle, { fontWeight: '700' }]}>{title}</Text></TouchableOpacity>;
  const line = (label: string, value: unknown) => <View key={label} style={styles.line}><Text style={muted}>{label}</Text><Text selectable style={[textStyle, { flex: 1, textAlign: 'right' }]}>{display(value)}</Text></View>;

  if (profile?.role !== 'owner') return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}><StateBanner variant="warning" title="Acesso restrito" description="Esta área é exclusiva do proprietário TCS." /></SafeAreaView>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
    <AppHeader title={section === 'home' ? 'Administração TCS' : OWNER_ADMIN_CAPABILITIES.find(item => item.key === section)?.title || 'Cliente e operação'} subtitle="Escopo global · proprietário" onBack={() => section === initialSection ? router.back() : (setSection('home'), setDetail(null), setRows([]))} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + 20 }]} keyboardShouldPersistTaps="handled">
      {section === 'home' ? OWNER_ADMIN_CAPABILITIES.map(item => <ModuleCard key={item.key} title={item.title} description={item.detail} icon={item.icon} onPress={() => {
        if (item.key === 'quality') router.push('/(panel)/qe');
        else if (item.key === 'inspections') router.push('/(panel)/inspecoes');
        else if (item.key === 'tokens') router.push('/(panel)/internal/tokens');
        else if (item.key === 'staff') router.push('/(panel)/internal/equipe');
        else { setRows([]); setOffset(0); setSection(item.key); }
      }} />) : null}
      {section === 'home' ? <>
        <SectionHeader title="Todas as ferramentas do console" subtitle="Recursos avançados dentro do app, com o login protegido do painel" />
        {OWNER_CONSOLE_SECTIONS.map(item => <ModuleCard key={`console-${item.key}`} title={item.title} description={item.key === 'home' ? 'Acessar o painel completo sem sair do aplicativo' : 'Abrir ferramenta no console integrado'} icon="monitor" onPress={() => router.push({ pathname: '/(panel)/internal/console', params: { section: item.key } })} />)}
      </> : null}
      {section === 'customers' ? <>
        <TextInput style={inputStyle} placeholder="Buscar cliente ou município" placeholderTextColor={theme.textSecondary} value={search} onChangeText={value => { setOffset(0); setSearch(value); }} accessibilityLabel="Buscar clientes" />
        <Text style={muted}>{total} clientes · todos os estados de conta</Text>
      </> : null}
      {loading ? <ActivityIndicator color={theme.primary} /> : null}
      {error ? <StateBanner variant="warning" title="Não foi possível atualizar" description={error} actionLabel="Tentar novamente" onAction={() => void load()} /> : null}
      {!loading && !error && !['home', 'customer', 'security'].includes(section) && rows.length === 0 ? <Text style={muted}>Nenhum registro encontrado.</Text> : null}
      {!loading && !error && section === 'customers' ? <>
        {rows.map(item => <TouchableOpacity key={item.customer_id} style={[styles.card, card]} accessibilityRole="button" onPress={() => { setDetail(null); setCustomerId(item.customer_id); setSection('customer'); }}>
          <Text style={[styles.title, textStyle]}>{item.display_name}</Text><Text style={muted}>{item.kind === 'organization' ? 'Organização' : 'Profissional individual'} · {display(item.status)}</Text>
          <Text style={muted}>{item.municipality_name || ''} {item.state_code || ''} · {item.plan_name || 'Sem plano'}</Text>
        </TouchableOpacity>)}
        <View style={styles.line}>{offset > 0 ? link('Anterior', () => setOffset(Math.max(0, offset - 25))) : null}{offset + 25 < total ? link('Próxima página', () => setOffset(offset + 25)) : null}</View>
      </> : null}
      {!loading && !error && section === 'customer' && detail ? <>
        <View style={[styles.card, card]}><Text style={[styles.title, textStyle]}>{detail.customer?.display_name}</Text>
          {line('Situação', detail.customer?.status)}{line('Município', detail.customer?.municipality_name)}{line('Contato', detail.customer?.contact_email)}
          {detail.customer?.kind === 'organization' ? link(detail.customer?.status === 'suspended' ? 'Reativar organização' : 'Suspender organização', () => begin('Alterar situação da organização', 'mutate_internal_organization', { p_organization_id: detail.customer.subject_id, p_action: 'update', p_payload: { status: detail.customer.status === 'suspended' ? 'active' : 'suspended' } })) : null}
        </View>
        <SectionHeader title="Assinatura" subtitle="Situação comercial da conta" />
        {detail.subscription ? <View style={[styles.card, card]}>{line('Plano', detail.subscription.plan_name)}{line('Situação', detail.subscription.status)}{line('Fim do período', detail.subscription.current_period_end)}
          {link(detail.subscription.status === 'suspended' ? 'Reativar assinatura' : 'Suspender assinatura', () => begin('Alterar situação da assinatura', 'mutate_internal_subscription', { p_customer_id: customerId, p_subscription_id: detail.subscription.id, p_action: 'update', p_payload: { status: detail.subscription.status === 'suspended' ? 'active' : 'suspended' } }))}
        </View> : <Text style={muted}>Sem assinatura cadastrada.</Text>}
        <SectionHeader title="Equipe e acesso" subtitle="O bloqueio é reversível e fica registrado" />
        {(detail.users || []).map((member: OwnerRecord) => <View key={member.user_id} style={[styles.card, card]}><Text style={[styles.title, textStyle]}>{member.name || member.email || 'Profissional'}</Text>{line('Papel', member.role)}{line('Situação', member.status)}
          {link('Bloquear acesso', () => begin('Bloquear acesso do profissional', 'set_account_lock_state', { p_target_uid: member.user_id, p_locked: true }))}
          {link('Desbloquear acesso', () => begin('Desbloquear acesso do profissional', 'set_account_lock_state', { p_target_uid: member.user_id, p_locked: false }))}
          {link('Aprovar cadastro', () => begin('Aprovar cadastro do profissional', 'set_user_approval', { p_target_uid: member.user_id, p_is_approved: true }))}
        </View>)}
        <SectionHeader title="Vistorias" subtitle="Abrir a coleta, documentos e evidências" />
        {(detail.inspections || []).map((inspection: OwnerRecord) => <View key={inspection.id} style={[styles.card, card]}><Text style={[styles.title, textStyle]}>{inspection.protocol || 'Vistoria sem protocolo'}</Text><Text style={muted}>{inspection.agent_name} · {inspection.address}</Text>{link('Abrir vistoria', () => router.push({ pathname: '/(panel)/inspecoes/[id]', params: { id: inspection.id } }))}{link('Excluir por arquivamento', () => begin('Arquivar vistoria (exclusão reversível)', 'set_owner_inspection_archived', { p_inspection_id: inspection.id, p_archived: true }))}</View>)}
        <SectionHeader title="Histórico do cliente" />
        {(detail.audit || []).map((event: OwnerRecord, index: number) => <View style={[styles.card, card]} key={event.id || index}><Text style={textStyle}>{event.summary || event.event_type}</Text><Text style={muted}>{event.created_at}</Text></View>)}
      </> : null}
      {!loading && !error && section === 'tokens' ? <View style={[styles.card, card]}>
        <Text style={[styles.title, textStyle]}>Criar convite</Text>
        <View style={styles.wrap}>{[['agent', 'Agente'], ['supervisor', 'Supervisor'], ['admin', 'Administrador']].map(([role, label]) => link(`${tokenRole === role ? '✓ ' : ''}${label}`, () => setTokenRole(role)))}</View>
        <Text style={muted}>Acesso por convite (chave)</Text>
        {link(tokenCity ? `${tokenCity.nome} – ${tokenCity.uf}` : 'Selecionar município', () => showCities ? setShowCities(false) : void openCities())}
        {showCities ? <ScrollView nestedScrollEnabled style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled">
          {citiesError ? <Text style={muted}>{citiesError}</Text> : null}
          {cities.map(city => link(`${city.nome} – ${city.uf}`, () => { setTokenCity(city); setShowCities(false); }))}
        </ScrollView> : null}
        <TextInput style={inputStyle} accessibilityLabel="Validade em horas" placeholder="Validade em horas" keyboardType="decimal-pad" value={tokenHours} onChangeText={setTokenHours} />
        <Button label="Criar token" disabled={!tokenCity || !Number.isFinite(tokenMinutes) || tokenMinutes < 15 || tokenMinutes > 10080} onPress={() => tokenCity && begin('Criar token de acesso', 'create_console_invite_token', { p_role: tokenRole, p_municipio: tokenCity.nome.trim(), p_uf: tokenCity.uf, p_expires_in_minutes: Math.round(tokenMinutes) })} />
      </View> : null}
      {section === 'tokens' && createdToken ? <View style={[styles.card, card]}>
        <Text style={[styles.title, textStyle]}>Código do convite</Text>
        <Text selectable style={textStyle}>{createdToken}</Text>
        <Button label="Fechar código" variant="secondary" onPress={() => setCreatedToken(null)} />
      </View> : null}
      {!loading && !error && section === 'tokens' ? rows.map(token => <View key={token.management_id} style={[styles.card, card]}>
        {line('Perfil', token.role)}{line('Município', token.municipio)}{line('Situação', ({ active: 'Disponível', used: 'Usado', expired: 'Vencido', revoked: 'Revogado' } as Record<string, string>)[token.status])}{line('Validade', token.expires_at ? new Date(token.expires_at).toLocaleString('pt-BR') : 'Sem data informada')}
        {token.status === 'active' ? link('Revogar token', () => begin('Revogar token de acesso', 'revoke_console_invite_token', { p_management_id: token.management_id })) : null}
      </View>) : null}
      {section === 'campaigns' ? <View style={[styles.card, card]}>
        <Text style={[styles.title, textStyle]}>Criar aviso</Text>
        <TextInput style={inputStyle} accessibilityLabel="Título do aviso" placeholder="Título" value={noticeTitle} onChangeText={setNoticeTitle} maxLength={120} />
        <TextInput style={inputStyle} accessibilityLabel="Mensagem do aviso" placeholder="Mensagem" value={noticeBody} onChangeText={setNoticeBody} maxLength={1000} multiline />
        <TextInput style={inputStyle} accessibilityLabel="Município do aviso" placeholder="Município (opcional)" value={noticeCity} onChangeText={setNoticeCity} />
        <Text style={muted}>{noticeCity.trim() ? `Público: ${noticeCity.trim()}` : 'Público: todos os municípios'} · Android e iPhone</Text>
        <Button label="Revisar envio" disabled={!noticeTitle.trim() || !noticeBody.trim()} onPress={() => begin('Enviar aviso · ' + (noticeCity.trim() || 'Todos os municípios'), 'create_notification_campaign', {
          p_title: noticeTitle.trim(), p_body: noticeBody.trim(), p_municipio: noticeCity.trim() || null,
          p_category: 'operational', p_priority: 'normal', p_platforms: ['android', 'ios'], p_roles: [], p_payload: {}, p_scheduled_at: null,
        })} />
      </View> : null}
      {!loading && !error && section === 'campaigns' ? rows.map(campaign => <View key={campaign.id} style={[styles.card, card]}>
        <Text style={[styles.title, textStyle]}>{campaign.title}</Text>
        {campaign.body ? <Text style={muted}>{campaign.body}</Text> : null}
        {line('Público', campaign.municipio || 'Todos os municípios')}
        {line('Enviados', Number(campaign.sent_count ?? 0))}
        {line('Falhas', Number(campaign.failed_count ?? 0))}
        {line('Situação', ({ queued: 'Na fila', processing: 'Enviando', completed: 'Concluída', failed: 'Falha no envio', scheduled: 'Agendada' } as Record<string, string>)[campaign.status] ?? campaign.status)}
      </View>) : null}
      {!loading && !error && section === 'versions' ? rows.map(release => <View key={release.version} style={[styles.card, card]}>
        {line('Versão disponível', release.version)}
        {release.minimumVersion ? line('Versão mínima para usar o app', release.minimumVersion) : null}
        {typeof release.changelog === 'string' && release.changelog.trim() ? <><Text style={[styles.title, textStyle]}>O que mudou</Text><Text style={muted}>{release.changelog}</Text></> : null}
      </View>) : null}
      {!loading && !error && ['tokens', 'campaigns', 'versions'].includes(section) && rows.length === 0 ? <Text style={muted}>Nenhum registro encontrado.</Text> : null}
      {!loading && !error && section === 'staff' ? rows.map(member => <View key={member.user_id} style={[styles.card, card]}>
        <Text style={[styles.title, textStyle]}>{member.display_name || member.user_id}</Text>{line('Papel', member.role)}{line('Situação', member.status)}
        {member.user_id !== profile.uid ? <>
          {link(member.status === 'active' ? 'Suspender membro' : 'Reativar membro', () => begin('Alterar acesso da equipe interna', 'manage_internal_staff', { p_user_id: member.user_id, p_role: member.role, p_status: member.status === 'active' ? 'suspended' : 'active' }))}
          {link('Alterar papel e permissões', () => { setStaffDraft(member); setStaffRole(member.role); })}
        </> : <Text style={muted}>Sua própria conta não pode ser suspensa por esta tela.</Text>}
      </View>) : null}
      {section === 'staff' && staffDraft ? <View style={[styles.card, card]}><Text style={[styles.title, textStyle]}>Permissões · {staffDraft.display_name}</Text>
        <Text style={muted}>Papel interno</Text><View style={styles.wrap}>{['owner', 'developer', 'support', 'auditor'].map(role => link(`${staffRole === role ? '✓ ' : ''}${display(role)}`, () => setStaffRole(role)))}</View>
        {link('Salvar papel', () => begin('Alterar papel interno', 'manage_internal_staff', { p_user_id: staffDraft.user_id, p_role: staffRole, p_status: staffDraft.status }))}
        <Text style={muted}>Permissão específica</Text><TextInput style={inputStyle} value={permissionCode} onChangeText={setPermissionCode} autoCapitalize="none" accessibilityLabel="Código da permissão" />
        <View style={styles.wrap}>{link(permissionEffect === 'grant' ? '✓ Conceder' : 'Conceder', () => setPermissionEffect('grant'))}{link(permissionEffect === 'revoke' ? '✓ Revogar' : 'Revogar', () => setPermissionEffect('revoke'))}</View>
        {link('Salvar permissão', () => { void (async () => {
          try {
            const current = ownerItems(await ownerRpc('list_internal_staff_permission_overrides'));
            const overrides = new Map<string, string>(current.filter(item => item.staff_user_id === staffDraft.user_id).map(item => [item.permission, item.effect]));
            overrides.set(permissionCode.trim(), permissionEffect);
            begin('Alterar permissão interna', 'manage_internal_staff_permissions', { p_user_id: staffDraft.user_id, p_grants: [...overrides].filter(([, effect]) => effect === 'grant').map(([code]) => code), p_revokes: [...overrides].filter(([, effect]) => effect === 'revoke').map(([code]) => code) });
          } catch (cause) { Alert.alert('Permissões não carregadas', ownerActionError(cause)); }
        })(); })}
        {link('Fechar edição', () => setStaffDraft(null))}
      </View> : null}
      {!loading && !error && section === 'plans' ? rows.map(plan => <View key={plan.id} style={[styles.card, card]}><Text style={[styles.title, textStyle]}>{plan.name}</Text><Text style={muted}>{plan.description}</Text>{line('Situação', plan.status)}{line('Público', plan.audience)}
        <Text style={[textStyle, { fontWeight: '700' }]}>Módulos</Text>{(plan.plan_features || []).map((feature: OwnerRecord) => line(feature.feature_code, feature.enabled ? 'Liberado' : 'Desativado'))}
        <Text style={[textStyle, { fontWeight: '700' }]}>Limites</Text>{(plan.plan_limits || []).map((limit: OwnerRecord) => line(limit.resource_code, limit.hard_limit == null ? 'Sem limite' : limit.hard_limit))}
      </View>) : null}
      {!loading && !error && section === 'forms' ? rows.map((form, index) => <View key={form.id || index} style={[styles.card, card]}><Text style={[styles.title, textStyle]}>{form.title || form.nome || form.name || 'Formulário'}</Text>{line('Versão', form.version || form.versao)}{line('Situação', form.status || (form.active ? 'Ativo' : 'Inativo'))}{link(form.active ? 'Desativar formulário' : 'Ativar formulário', () => begin('Alterar disponibilidade do formulário', 'mutate_internal_form', { p_form_id: form.id, p_action: 'set_status', p_payload: { status: form.active ? 'inactive' : 'active' } }))}</View>) : null}
      {!loading && !error && section === 'support' ? rows.map((ticket, index) => <View key={ticket.id || index} style={[styles.card, card]}><Text style={[styles.title, textStyle]}>{ticket.subject || ticket.public_code || 'Chamado'}</Text>{line('Situação', ticket.status)}{line('Prioridade', ticket.priority)}{line('Responsável', ticket.assigned_to)}</View>) : null}
      {!loading && !error && section === 'audit' ? rows.map((event, index) => <View key={event.id || index} style={[styles.card, card]}><Text style={[styles.title, textStyle]}>{event.summary || event.action || event.event_type}</Text>{line('Responsável', event.actor_name || event.actor_id)}{line('Resultado', event.result)}{line('Motivo', event.reason)}{line('Data', event.occurred_at || event.created_at)}</View>) : null}
      {!loading && !error && section === 'archived' ? rows.map(inspection => <View key={inspection.id} style={[styles.card, card]}><Text style={[styles.title, textStyle]}>{inspection.protocolo}</Text><Text style={muted}>{inspection.agenteNome} · {inspection.endereco}</Text>{line('Arquivada em', inspection.owner_archived_at)}{link('Consultar vistoria', () => router.push({ pathname: '/(panel)/inspecoes/[id]', params: { id: inspection.id } }))}{link('Restaurar vistoria', () => begin('Restaurar vistoria arquivada', 'set_owner_inspection_archived', { p_inspection_id: inspection.id, p_archived: false }))}</View>) : null}
      {section === 'security' ? <View style={[styles.card, card]}><Text style={muted}>Informe o código atual do autenticador vinculado à sua conta. Esta confirmação mantém as mesmas proteções usadas pelo painel web.</Text><TextInput style={inputStyle} value={mfaCode} onChangeText={setMfaCode} keyboardType="number-pad" maxLength={6} accessibilityLabel="Código do autenticador" />{mfaMessage ? <Text style={textStyle}>{mfaMessage}</Text> : null}<Button label={mfaBusy ? 'Confirmando…' : 'Confirmar segundo fator'} disabled={mfaBusy || mfaCode.length !== 6} onPress={() => void verifyMfa()} /></View> : null}
    </ScrollView>
    <Modal visible={!!action} animationType="slide" onRequestClose={() => { if (!saving) setAction(null); }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Text style={[styles.heading, textStyle]}>{action?.title}</Text>
        {action?.rpc === 'create_notification_campaign' ? <Text style={textStyle}>{action.args.p_title}{'\n'}{action.args.p_body}</Text> : null}
        <Text style={muted}>Informe o motivo para confirmar.</Text><TextInput accessibilityLabel="Motivo da ação" multiline value={reason} onChangeText={setReason} maxLength={500} placeholder="Motivo (mínimo de 8 caracteres)" placeholderTextColor={theme.textSecondary} style={[inputStyle, { minHeight: 110, textAlignVertical: 'top' }]} />
        {actionError ? <Text accessibilityRole="alert" style={{ color: theme.error }}>{actionError}</Text> : null}
        {actionError?.includes('segundo fator') ? <>
          <TextInput style={inputStyle} value={mfaCode} onChangeText={setMfaCode} keyboardType="number-pad" maxLength={6} accessibilityLabel="Código do autenticador" />
          <Button label={mfaBusy ? 'Confirmando…' : 'Confirmar segundo fator'} disabled={mfaBusy || mfaCode.length !== 6} onPress={() => void verifyMfa()} />
        </> : null}
        {mfaMessage ? <Text accessibilityRole="alert" style={textStyle}>{mfaMessage}</Text> : null}
        <Button label={saving ? 'Salvando…' : 'Confirmar ação'} disabled={saving || reason.trim().length < 8} onPress={() => void execute()} />
        <Button label="Cancelar" variant="secondary" disabled={saving} onPress={() => setAction(null)} />
      </ScrollView></KeyboardAvoidingView></SafeAreaView>
    </Modal>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ content: { padding: 20, gap: 16 }, card: { padding: 16, borderWidth: 1, borderRadius: 16, gap: 10 }, title: { fontSize: 17, fontWeight: '700' }, heading: { fontSize: 25, fontWeight: '800' }, input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 }, line: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, alignItems: 'center' }, link: { paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, minHeight: 44 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 } });
