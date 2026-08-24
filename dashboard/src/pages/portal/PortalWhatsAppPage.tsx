import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, CheckCircle2, ExternalLink, KeyRound, Link2, LogOut, MessageCircleMore, Plus, QrCode, RefreshCw, ShieldCheck, Smartphone, Trash2, Unplug, Users, Wifi, WifiOff } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/AlertDialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { GuidedTutorial } from '@/components/tutorial/GuidedTutorial';
import {
  openBotQr,
  criarSessaoBot,
  deleteCanal,
  fetchBotChats,
  fetchPortalBotRuntimeStatus,
  fetchCanais,
  fetchSessoesBot,
  operarSessaoBot,
  requestBotPairingCode,
  saveCanal,
  setCanalAtivo,
  vincularCanalChat,
  type SessaoBotStatus,
  type SessaoBotAcao,
} from '@/lib/comunicados';

type CommunityConfirmation =
  | { action: 'create'; name: string; inviteUrl: string | null }
  | { action: 'toggle'; id: string; name: string; active: boolean }
  | { action: 'delete'; id: string; name: string }
  | { action: 'unlink'; id: string; name: string };

const sessaoLabels: Record<SessaoBotStatus, string> = {
  aguardando_qr: 'Aguardando leitura do QR',
  vinculado: 'Conectado',
  desconectado: 'Desconectado',
  banido: 'Número banido',
};

function sessionVariant(status: SessaoBotStatus) {
  if (status === 'vinculado') return 'success' as const;
  if (status === 'aguardando_qr') return 'info' as const;
  if (status === 'banido') return 'destructive' as const;
  return 'secondary' as const;
}

export function PortalWhatsAppPage() {
  const { access, can } = usePortalAuth();
  const queryClient = useQueryClient();
  const mayManage = can('whatsapp.write');
  const organizationId = access?.organizationId ?? null;
  const [newCommunity, setNewCommunity] = useState({ name: '', inviteUrl: '' });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pairingSessionId, setPairingSessionId] = useState<string | null>(null);
  const [pairingMethod, setPairingMethod] = useState<'qr' | 'code'>('qr');
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [communityConfirmation, setCommunityConfirmation] = useState<CommunityConfirmation | null>(null);

  const channelsQuery = useQuery({
    queryKey: ['portal', 'canais', organizationId],
    queryFn: fetchCanais,
    enabled: Boolean(organizationId),
  });
  const sessionsQuery = useQuery({
    queryKey: ['portal', 'bot-sessoes', organizationId],
    queryFn: fetchSessoesBot,
    enabled: Boolean(organizationId) && mayManage,
    refetchInterval: 10_000,
  });
  const runtimeQuery = useQuery({
    queryKey: ['portal', 'bot-runtime', organizationId],
    queryFn: fetchPortalBotRuntimeStatus,
    enabled: mayManage,
    refetchInterval: 10_000,
    retry: false,
  });
  const groupsVisible = !mayManage || (runtimeQuery.data?.sessionsOnline ?? 0) > 0;
  const chatsQuery = useQuery({
    queryKey: ['portal', 'bot-chats', organizationId],
    queryFn: fetchBotChats,
    enabled: Boolean(organizationId) && mayManage && groupsVisible,
    retry: false,
  });

  const channels = channelsQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const allChats = groupsVisible ? chatsQuery.data ?? [] : [];
  const approvedStandaloneChats = new Set(channels.map((channel) => channel.chatId).filter(Boolean));
  const chats = allChats.filter((chat) => Boolean(chat.comunidadeId) || approvedStandaloneChats.has(chat.chatId));
  const activeChannels = channels.filter((channel) => channel.ativo);
  const linkedChannels = activeChannels.filter((channel) => channel.chatId);
  const awaitingSession = sessions.find((session) => session.status === 'aguardando_qr');
  const readiness = useMemo(() => {
    if (!mayManage) return null;
    const runtime = runtimeQuery.data;
    if (!runtime || runtime.state === 'service_offline') return { tone: 'warning', title: 'Serviço do bot indisponível', detail: 'O painel continua funcionando, mas os disparos automáticos ficam pausados até o Docker voltar.' };
    if (runtime.state === 'reconnecting') return { tone: 'warning', title: 'Reconectando o WhatsApp', detail: 'O serviço está online e tenta restabelecer a conexão automaticamente.' };
    if (runtime.state === 'paused') return { tone: 'warning', title: 'WhatsApp pausado', detail: 'Reative um dos números para retomar os disparos desta organização.' };
    if (runtime.state === 'offline' || runtime.state === 'banned') return { tone: 'warning', title: 'Números fora do ar', detail: 'O Docker está online, mas nenhum número desta organização está conectado.' };
    if (runtime.sessionsOnline === 0) return { tone: 'info', title: 'Conecte um número', detail: 'Vincule o WhatsApp da organização para sincronizar os grupos disponíveis.' };
    if (runtime.state === 'degraded') return { tone: 'warning', title: 'Operação parcial', detail: `${runtime.sessionsOnline} de ${runtime.sessionsTotal} números estão online; os disparos ainda possuem contingência limitada.` };
    if (linkedChannels.length === 0) return { tone: 'info', title: 'Vincule uma comunidade', detail: 'Escolha o grupo correspondente em cada comunidade para habilitar os disparos.' };
    return { tone: 'success', title: 'WhatsApp pronto para disparos', detail: `${linkedChannels.length} comunidade${linkedChannels.length === 1 ? '' : 's'} com envio automático habilitado.` };
  }, [linkedChannels.length, mayManage, runtimeQuery.data]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['portal', 'canais'] }),
      queryClient.invalidateQueries({ queryKey: ['portal', 'bot-sessoes'] }),
      queryClient.invalidateQueries({ queryKey: ['portal', 'bot-chats'] }),
      queryClient.invalidateQueries({ queryKey: ['portal', 'bot-runtime'] }),
    ]);
  };

  const createChannel = useMutation({
    mutationFn: saveCanal,
    onSuccess: async () => {
      setNewCommunity({ name: '', inviteUrl: '' });
      setNotice('Comunidade adicionada. Agora vincule o grupo sincronizado pelo bot.');
      await refresh();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });
  const toggleChannel = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setCanalAtivo(id, active),
    onSuccess: refresh,
    onError: (mutationError: Error) => setError(mutationError.message),
  });
  const linkChat = useMutation({
    mutationFn: ({ channelId, chatId }: { channelId: string; chatId: string | null }) => vincularCanalChat(channelId, chatId),
    onSuccess: async () => {
      setNotice('Vínculo do WhatsApp atualizado.');
      await refresh();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });
  const removeChannel = useMutation({
    mutationFn: (id: string) => deleteCanal(id),
    onSuccess: refresh,
    onError: (mutationError: Error) => setError(mutationError.message),
  });
  const createSession = useMutation({
    mutationFn: criarSessaoBot,
    onSuccess: async (sessionId) => {
      setPairingSessionId(sessionId);
      setPairingMethod('qr');
      setPairingCode(null);
      setNotice('Sessão criada. Escolha QR Code ou código de vinculação para conectar o número.');
      await refresh();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });
  const updateSession = useMutation({
    mutationFn: ({ id, action }: { id: string; action: SessaoBotAcao }) => operarSessaoBot(id, action),
    onSuccess: refresh,
    onError: (mutationError: Error) => setError(mutationError.message),
  });
  const pairingCodeMutation = useMutation({
    mutationFn: ({ id, phone }: { id: string; phone: string }) => requestBotPairingCode(id, phone),
    onSuccess: (code) => {
      setPairingCode(code);
      setError(null);
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const confirmCommunityAction = () => {
    if (!communityConfirmation) return;
    if (communityConfirmation.action === 'create') {
      createChannel.mutate({ nome: communityConfirmation.name, linkConvite: communityConfirmation.inviteUrl });
    } else if (communityConfirmation.action === 'toggle') {
      toggleChannel.mutate({ id: communityConfirmation.id, active: communityConfirmation.active });
    } else if (communityConfirmation.action === 'delete') {
      removeChannel.mutate(communityConfirmation.id);
    } else {
      linkChat.mutate({ channelId: communityConfirmation.id, chatId: null });
    }
    setCommunityConfirmation(null);
  };

  return (
    <div className="page-stack">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Organização · Comunicação</p>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold"><MessageCircleMore className="h-8 w-8 text-success" />WhatsApp</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Conecte os números da organização e associe cada comunidade ao grupo correto para automatizar os comunicados.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GuidedTutorial
            workspace="organization"
            organizationId={organizationId}
            tutorialKey="whatsapp-operations"
            title="Como operar o WhatsApp da organização"
            description="Este tour mostra como conectar números, sincronizar a Comunidade e acompanhar os grupos de cada bairro."
            steps={[
              { title: 'Confira a saúde', description: 'Comece verificando se o serviço e pelo menos um número estão conectados.', target: 'whatsapp-health' },
              { title: 'Conecte os números', description: 'Use números oficiais administrados pela organização e mantenha um segundo número de contingência.', target: 'whatsapp-sessions' },
              { title: 'Organize os bairros', description: 'Sincronize os grupos criados no aplicativo oficial e associe cada grupo ao bairro correto.', target: 'whatsapp-communities' },
            ]}
          />
          {mayManage && <Button variant="outline" onClick={() => void refresh()}><RefreshCw />Atualizar status</Button>}
        </div>
      </header>

      {notice && <p className="rounded-md border border-success/25 bg-success-soft p-3 text-sm" role="status">{notice}</p>}
      {error && <p className="rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{error}</p>}

      {!mayManage && (
        <div className="flex gap-3 rounded-lg border bg-secondary/35 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div><p className="text-sm font-semibold">Acesso de consulta</p><p className="mt-1 text-sm text-muted-foreground">Você pode acompanhar as comunidades da organização. A conexão de números e os vínculos são administrados por responsáveis autorizados.</p></div>
        </div>
      )}

      {readiness && (
        <div data-tutorial="whatsapp-health" className={`flex gap-3 rounded-lg border p-4 ${readiness.tone === 'success' ? 'border-success/25 bg-success-soft' : readiness.tone === 'warning' ? 'border-warning/30 bg-warning-soft' : 'border-primary/20 bg-primary/5'}`}>
          {readiness.tone === 'success' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : readiness.tone === 'warning' ? <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-warning" /> : <Bot className="mt-0.5 h-5 w-5 shrink-0 text-primary" />}
          <div><p className="text-sm font-semibold">{readiness.title}</p><p className="mt-1 text-sm text-muted-foreground">{readiness.detail}</p></div>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo do WhatsApp">
        <Summary label="Serviço" value={!mayManage ? 'Restrito' : runtimeQuery.data?.serviceOnline ? 'Online' : 'Offline'} icon={runtimeQuery.data?.serviceOnline ? Wifi : WifiOff} />
        <Summary label="Números online" value={mayManage ? String(runtimeQuery.data?.sessionsOnline ?? 0) : '—'} icon={Smartphone} />
        <Summary label="Comunidades ativas" value={String(activeChannels.length)} icon={Users} />
        <Summary label="Envio automático" value={mayManage ? `${linkedChannels.length}/${activeChannels.length}` : '—'} icon={Link2} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.3fr]">
        <Card data-tutorial="whatsapp-sessions">
          <CardHeader><CardTitle className="flex items-center gap-2"><Smartphone />Números conectados</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">Use um número administrado pela organização. Um segundo número reduz interrupções em caso de bloqueio ou perda da sessão.</p>
            {mayManage && (
              <Button className="mt-4" disabled={createSession.isPending} onClick={() => createSession.mutate()}>
                <Plus />{createSession.isPending ? 'Criando sessão…' : 'Conectar número'}
              </Button>
            )}
            {mayManage && pairingSessionId && (
              <div className="mt-5 space-y-4 rounded-xl border bg-secondary/20 p-4" aria-label="Método de vinculação do WhatsApp">
                <div>
                  <p className="text-sm font-semibold">Vincular número ao WhatsApp</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Escolha como deseja conectar o aparelho oficial da organização.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant={pairingMethod === 'qr' ? 'default' : 'outline'} onClick={() => setPairingMethod('qr')}><QrCode />Usar QR Code</Button>
                  <Button type="button" size="sm" variant={pairingMethod === 'code' ? 'default' : 'outline'} onClick={() => setPairingMethod('code')}><KeyRound />Usar código de vinculação</Button>
                </div>
                {pairingMethod === 'qr' ? (
                  <div className="space-y-3">
                    <p className="text-xs leading-5 text-muted-foreground">No celular, abra WhatsApp → Aparelhos conectados → Conectar aparelho.</p>
                    <Button type="button" size="sm" variant="outline" onClick={() => void openBotQr(pairingSessionId).catch((qrError: Error) => setError(qrError.message))}><ExternalLink />Abrir QR Code</Button>
                  </div>
                ) : (
                  <form className="space-y-3" onSubmit={(event) => {
                    event.preventDefault();
                    setError(null);
                    setPairingCode(null);
                    pairingCodeMutation.mutate({ id: pairingSessionId, phone: pairingPhone });
                  }}>
                    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Telefone do WhatsApp
                      <Input value={pairingPhone} onChange={(event) => setPairingPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="(32) 98479-2322" />
                    </label>
                    <Button type="submit" size="sm" disabled={pairingCodeMutation.isPending || pairingPhone.replace(/\D/g, '').length < 10}><KeyRound />{pairingCodeMutation.isPending ? 'Gerando código…' : 'Gerar código'}</Button>
                    {pairingCode && <div className="rounded-lg border border-success/25 bg-success-soft p-3" role="status"><p className="text-xs text-muted-foreground">Digite este código em Aparelhos conectados → Vincular com número de telefone.</p><p className="mt-2 font-mono text-xl font-semibold tracking-[0.2em]">{pairingCode}</p></div>}
                  </form>
                )}
              </div>
            )}
            {mayManage && <ul className="mt-4 divide-y">
              {sessionsQuery.isLoading && <li className="py-4 text-sm text-muted-foreground">Carregando números…</li>}
              {!sessionsQuery.isLoading && sessions.length === 0 && <li className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">Nenhum número conectado.</li>}
              {sessions.map((session) => {
                const liveSession = runtimeQuery.data?.sessions.find((item) => item.id === session.id);
                const liveLabel = liveSession?.runtimeState === 'online' ? 'Online'
                  : liveSession?.runtimeState === 'reconnecting' ? 'Reconectando'
                    : liveSession?.runtimeState === 'starting' ? 'Iniciando'
                      : liveSession?.runtimeState === 'paused' ? 'Pausado'
                        : liveSession?.runtimeState === 'offline' ? 'Fora do ar'
                          : liveSession?.runtimeState === 'banned' ? 'Banido'
                            : liveSession?.runtimeState === 'awaiting_qr' ? 'Aguardando QR'
                              : sessaoLabels[session.status];
                return (
                <li key={session.id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0"><p className="break-words text-sm font-semibold">{session.telefone ?? 'Número ainda não identificado'}</p><p className="mt-1 text-xs text-muted-foreground">{session.totalChats} grupo{session.totalChats === 1 ? '' : 's'} sincronizado{session.totalChats === 1 ? '' : 's'}{session.vinculadoPorNome ? ` · por ${session.vinculadoPorNome}` : ''}</p></div>
                    <Badge variant={liveSession?.runtimeState === 'online' ? 'success' : liveSession?.runtimeState === 'offline' || liveSession?.runtimeState === 'banned' ? 'destructive' : sessionVariant(session.status)}>{liveLabel}</Badge>
                  </div>
                  {liveSession?.lastSeenAt && <p className="mt-2 text-xs text-muted-foreground">Último sinal: {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(liveSession.lastSeenAt))}</p>}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {(session.status === 'aguardando_qr' || liveSession?.runtimeState === 'awaiting_qr') && <Button size="sm" variant="outline" onClick={() => { setPairingSessionId(session.id); setPairingMethod('qr'); setPairingCode(null); }}><QrCode />Vincular novamente</Button>}
                    {session.status === 'vinculado' && liveSession?.runtimeState !== 'offline' && <Button size="sm" variant="outline" disabled={updateSession.isPending} onClick={() => updateSession.mutate({ id: session.id, action: 'desconectar' })}><Unplug />Desconectar</Button>}
                    {session.status === 'desconectado' && <Button size="sm" variant="outline" disabled={updateSession.isPending || !runtimeQuery.data?.serviceOnline} onClick={() => updateSession.mutate({ id: session.id, action: 'reconectar' })}><RefreshCw />Reconectar</Button>}
                    {session.status === 'vinculado' && liveSession?.runtimeState === 'offline' && <Button size="sm" variant="outline" disabled={updateSession.isPending || !runtimeQuery.data?.serviceOnline} onClick={() => updateSession.mutate({ id: session.id, action: 'reconectar' })}><RefreshCw />Reconectar</Button>}
                    {session.status !== 'banido' && session.status !== 'aguardando_qr' && <Button size="sm" variant="ghost" disabled={updateSession.isPending} onClick={() => window.confirm('Sair do WhatsApp removerá as credenciais deste número. Continuar?') && updateSession.mutate({ id: session.id, action: 'sair' })}><LogOut />Sair do WhatsApp</Button>}
                    {session.status !== 'banido' && <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={updateSession.isPending} onClick={() => window.confirm('Marcar este número como banido?') && updateSession.mutate({ id: session.id, action: 'banir' })}>Marcar como banido</Button>}
                  </div>
                </li>
                );
              })}
            </ul>}
            {mayManage && awaitingSession && <p className="mt-4 text-xs leading-5 text-muted-foreground">O QR expira rapidamente. Se preferir, vincule o número usando o código gerado pelo telefone.</p>}
          </CardContent>
        </Card>

        <Card data-tutorial="whatsapp-communities">
          <CardHeader><CardTitle className="flex items-center gap-2"><Users />Comunidades e grupos</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">Cadastre o nome usado no painel e associe o grupo que o número conectado enxerga no WhatsApp.</p>
            {mayManage && groupsVisible && (
              <form className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); setError(null); if (newCommunity.name.trim().length >= 3) setCommunityConfirmation({ action: 'create', name: newCommunity.name.trim(), inviteUrl: newCommunity.inviteUrl.trim() || null }); }}>
                <Input value={newCommunity.name} onChange={(event) => setNewCommunity((current) => ({ ...current, name: event.target.value }))} placeholder="Nome da comunidade" minLength={3} maxLength={80} aria-label="Nome da comunidade" />
                <Input value={newCommunity.inviteUrl} onChange={(event) => setNewCommunity((current) => ({ ...current, inviteUrl: event.target.value }))} placeholder="Link de convite (opcional)" aria-label="Link de convite" />
                <Button type="submit" variant="outline" disabled={createChannel.isPending}><Plus />Adicionar</Button>
              </form>
            )}
            {!groupsVisible && <p className="mt-5 rounded-xl border border-dashed bg-secondary/20 p-5 text-sm leading-6 text-muted-foreground" role="status"><ShieldCheck className="mb-2 h-5 w-5 text-primary" />Dados protegidos até um número reconectar. Os nomes, grupos, links de convite e vínculos permanecem ocultos.</p>}
            {groupsVisible && <ul className="mt-5 space-y-4">
              {channelsQuery.isLoading && <li className="text-sm text-muted-foreground">Carregando comunidades…</li>}
              {!channelsQuery.isLoading && channels.length === 0 && <li className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma comunidade cadastrada.</li>}
              {channels.map((channel) => (
                <li key={channel.id} className="rounded-xl border p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0"><p className="break-words text-sm font-semibold">{channel.nome}</p><p className="mt-1 text-xs text-muted-foreground">{channel.totalEnvios} envio{channel.totalEnvios === 1 ? '' : 's'} · {channel.chatId ? 'grupo vinculado' : 'aguardando vínculo'}{!channel.ativo ? ' · inativa' : ''}</p></div>
                    <Badge variant={!channel.ativo ? 'secondary' : channel.chatId ? 'success' : 'warning'}>{!channel.ativo ? 'Inativa' : channel.chatId ? 'Pronta' : 'Configurar'}</Badge>
                  </div>
                  {mayManage && <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                    <label className="text-xs font-medium text-muted-foreground">Grupo sincronizado
                      <select className="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm text-foreground" value={channel.chatId ?? ''} aria-label={`Grupo vinculado a ${channel.nome}`} onChange={(event) => event.target.value ? linkChat.mutate({ channelId: channel.id, chatId: event.target.value }) : setCommunityConfirmation({ action: 'unlink', id: channel.id, name: channel.nome })}>
                        <option value="">{chatsQuery.isError ? 'Bot offline ou indisponível' : chats.length === 0 ? 'Nenhum grupo sincronizado' : 'Selecionar grupo…'}</option>
                        {chats.map((chat) => <option key={chat.chatId} value={chat.chatId}>{chat.nome}{chat.sessaoTelefone ? ` · ${chat.sessaoTelefone}` : ''}</option>)}
                      </select>
                    </label>
                    <div className="flex items-end gap-2"><Button size="sm" variant="ghost" disabled={toggleChannel.isPending} onClick={() => setCommunityConfirmation({ action: 'toggle', id: channel.id, name: channel.nome, active: !channel.ativo })}>{channel.ativo ? 'Desativar' : 'Ativar'}</Button>{channel.totalEnvios === 0 && <Button size="sm" variant="ghost" aria-label={`Remover ${channel.nome}`} disabled={removeChannel.isPending} onClick={() => setCommunityConfirmation({ action: 'delete', id: channel.id, name: channel.nome })}><Trash2 /></Button>}</div>
                  </div>}
                  {!mayManage && channel.linkConvite && <a className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline" href={channel.linkConvite} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Abrir comunidade</a>}
                </li>
              ))}
            </ul>}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Bot />Como o envio funciona</CardTitle></CardHeader>
        <CardContent><ol className="grid gap-4 md:grid-cols-3"><Step number="1" title="Conecte o número" detail="Leia o QR Code ou informe o código de vinculação no WhatsApp da organização." /><Step number="2" title="Vincule os grupos" detail="Associe cada comunidade cadastrada ao grupo sincronizado correspondente." /><Step number="3" title="Publique e envie" detail="Em Comunicados, publique a mensagem e escolha o disparo automático ou manual." /></ol></CardContent>
      </Card>

      <AlertDialog open={communityConfirmation !== null} onOpenChange={(open) => !open && setCommunityConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {communityConfirmation?.action === 'create' && 'Criar comunidade?'}
              {communityConfirmation?.action === 'toggle' && (communityConfirmation.active ? 'Ativar comunidade?' : 'Desativar comunidade?')}
              {communityConfirmation?.action === 'delete' && 'Excluir comunidade?'}
              {communityConfirmation?.action === 'unlink' && 'Desvincular grupo do WhatsApp?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {communityConfirmation?.action === 'create' && `A comunidade “${communityConfirmation.name}” será adicionada ao painel desta organização.`}
              {communityConfirmation?.action === 'toggle' && `A comunidade “${communityConfirmation.name}” será ${communityConfirmation.active ? 'reativada para os envios' : 'desativada e deixará de receber novos envios'}.`}
              {communityConfirmation?.action === 'delete' && `A comunidade “${communityConfirmation.name}” será removida definitivamente do painel.`}
              {communityConfirmation?.action === 'unlink' && `O grupo associado a “${communityConfirmation.name}” será desvinculado e os envios automáticos serão interrompidos.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className={communityConfirmation?.action === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined} onClick={confirmCommunityAction}>
              {communityConfirmation?.action === 'create' && 'Confirmar criação'}
              {communityConfirmation?.action === 'toggle' && (communityConfirmation.active ? 'Confirmar ativação' : 'Confirmar desativação')}
              {communityConfirmation?.action === 'delete' && 'Confirmar exclusão'}
              {communityConfirmation?.action === 'unlink' && 'Confirmar desvinculação'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Summary({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Wifi }) {
  return <Card><CardContent className="flex items-center justify-between gap-4 p-5"><div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div><span className="rounded-lg bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></span></CardContent></Card>;
}

function Step({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{number}</span><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p></div></li>;
}
