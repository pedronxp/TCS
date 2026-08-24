import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, CheckCircle2, ExternalLink, Link2, LogOut, MessageCircleMore, Plus, RefreshCw, ShieldCheck, Smartphone, Trash2, Unplug, Users, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { GuidedTutorial } from '@/components/tutorial/GuidedTutorial';
import {
  botQrUrl,
  criarSessaoBot,
  deleteCanal,
  fetchBotChats,
  fetchBotOnline,
  fetchCanais,
  fetchSessoesBot,
  operarSessaoBot,
  saveCanal,
  setCanalAtivo,
  vincularCanalChat,
  type SessaoBotStatus,
  type SessaoBotAcao,
} from '@/lib/comunicados';

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
  const chatsQuery = useQuery({
    queryKey: ['portal', 'bot-chats', organizationId],
    queryFn: fetchBotChats,
    enabled: Boolean(organizationId) && mayManage,
    retry: false,
  });
  const onlineQuery = useQuery({
    queryKey: ['portal', 'bot-online'],
    queryFn: fetchBotOnline,
    enabled: mayManage,
    refetchInterval: 10_000,
    retry: false,
  });

  const channels = channelsQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const allChats = chatsQuery.data ?? [];
  const approvedStandaloneChats = new Set(channels.map((channel) => channel.chatId).filter(Boolean));
  const chats = allChats.filter((chat) => Boolean(chat.comunidadeId) || approvedStandaloneChats.has(chat.chatId));
  const activeChannels = channels.filter((channel) => channel.ativo);
  const linkedChannels = activeChannels.filter((channel) => channel.chatId);
  const connectedSessions = sessions.filter((session) => session.status === 'vinculado');
  const awaitingSession = sessions.find((session) => session.status === 'aguardando_qr');
  const readiness = useMemo(() => {
    if (!mayManage) return null;
    if (!onlineQuery.data) return { tone: 'warning', title: 'Serviço do bot indisponível', detail: 'O painel continua funcionando, mas os disparos automáticos ficam pausados até o serviço voltar.' };
    if (connectedSessions.length === 0) return { tone: 'info', title: 'Conecte um número', detail: 'Vincule o WhatsApp da organização para sincronizar os grupos disponíveis.' };
    if (linkedChannels.length === 0) return { tone: 'info', title: 'Vincule uma comunidade', detail: 'Escolha o grupo correspondente em cada comunidade para habilitar os disparos.' };
    return { tone: 'success', title: 'WhatsApp pronto para disparos', detail: `${linkedChannels.length} comunidade${linkedChannels.length === 1 ? '' : 's'} com envio automático habilitado.` };
  }, [connectedSessions.length, linkedChannels.length, mayManage, onlineQuery.data]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['portal', 'canais'] }),
      queryClient.invalidateQueries({ queryKey: ['portal', 'bot-sessoes'] }),
      queryClient.invalidateQueries({ queryKey: ['portal', 'bot-chats'] }),
      queryClient.invalidateQueries({ queryKey: ['portal', 'bot-online'] }),
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
    mutationFn: deleteCanal,
    onSuccess: refresh,
    onError: (mutationError: Error) => setError(mutationError.message),
  });
  const createSession = useMutation({
    mutationFn: criarSessaoBot,
    onSuccess: async (sessionId) => {
      setNotice('Sessão criada. Abra o QR Code e faça a leitura no celular da organização.');
      await refresh();
      window.open(botQrUrl(sessionId), '_blank', 'noopener,noreferrer');
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });
  const updateSession = useMutation({
    mutationFn: ({ id, action }: { id: string; action: SessaoBotAcao }) => operarSessaoBot(id, action),
    onSuccess: refresh,
    onError: (mutationError: Error) => setError(mutationError.message),
  });

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
        <Summary label="Serviço" value={!mayManage ? 'Restrito' : onlineQuery.data ? 'Online' : 'Offline'} icon={onlineQuery.data ? Wifi : WifiOff} />
        <Summary label="Números conectados" value={mayManage ? String(connectedSessions.length) : '—'} icon={Smartphone} />
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
            {mayManage && <ul className="mt-4 divide-y">
              {sessionsQuery.isLoading && <li className="py-4 text-sm text-muted-foreground">Carregando números…</li>}
              {!sessionsQuery.isLoading && sessions.length === 0 && <li className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">Nenhum número conectado.</li>}
              {sessions.map((session) => (
                <li key={session.id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0"><p className="break-words text-sm font-semibold">{session.telefone ?? 'Número ainda não identificado'}</p><p className="mt-1 text-xs text-muted-foreground">{session.totalChats} grupo{session.totalChats === 1 ? '' : 's'} sincronizado{session.totalChats === 1 ? '' : 's'}{session.vinculadoPorNome ? ` · por ${session.vinculadoPorNome}` : ''}</p></div>
                    <Badge variant={sessionVariant(session.status)}>{sessaoLabels[session.status]}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {session.status === 'aguardando_qr' && <Button size="sm" variant="outline" onClick={() => window.open(botQrUrl(session.id), '_blank', 'noopener,noreferrer')}><ExternalLink />Abrir QR Code</Button>}
                    {session.status === 'vinculado' && <Button size="sm" variant="outline" disabled={updateSession.isPending} onClick={() => updateSession.mutate({ id: session.id, action: 'desconectar' })}><Unplug />Desconectar</Button>}
                    {session.status === 'desconectado' && <Button size="sm" variant="outline" disabled={updateSession.isPending || !onlineQuery.data} onClick={() => updateSession.mutate({ id: session.id, action: 'reconectar' })}><RefreshCw />Reconectar</Button>}
                    {session.status !== 'banido' && session.status !== 'aguardando_qr' && <Button size="sm" variant="ghost" disabled={updateSession.isPending} onClick={() => window.confirm('Sair do WhatsApp removerá as credenciais deste número. Continuar?') && updateSession.mutate({ id: session.id, action: 'sair' })}><LogOut />Sair do WhatsApp</Button>}
                    {session.status !== 'banido' && <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={updateSession.isPending} onClick={() => window.confirm('Marcar este número como banido?') && updateSession.mutate({ id: session.id, action: 'banir' })}>Marcar como banido</Button>}
                  </div>
                </li>
              ))}
            </ul>}
            {mayManage && awaitingSession && <p className="mt-3 text-xs text-muted-foreground">O QR expira rapidamente. Se não funcionar, crie uma nova sessão.</p>}
          </CardContent>
        </Card>

        <Card data-tutorial="whatsapp-communities">
          <CardHeader><CardTitle className="flex items-center gap-2"><Users />Comunidades e grupos</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">Cadastre o nome usado no painel e associe o grupo que o número conectado enxerga no WhatsApp.</p>
            {mayManage && (
              <form className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); setError(null); if (newCommunity.name.trim().length >= 3) createChannel.mutate({ nome: newCommunity.name.trim(), linkConvite: newCommunity.inviteUrl.trim() || null }); }}>
                <Input value={newCommunity.name} onChange={(event) => setNewCommunity((current) => ({ ...current, name: event.target.value }))} placeholder="Nome da comunidade" minLength={3} maxLength={80} aria-label="Nome da comunidade" />
                <Input value={newCommunity.inviteUrl} onChange={(event) => setNewCommunity((current) => ({ ...current, inviteUrl: event.target.value }))} placeholder="Link de convite (opcional)" aria-label="Link de convite" />
                <Button type="submit" variant="outline" disabled={createChannel.isPending}><Plus />Adicionar</Button>
              </form>
            )}
            <ul className="mt-4 space-y-3">
              {channelsQuery.isLoading && <li className="text-sm text-muted-foreground">Carregando comunidades…</li>}
              {!channelsQuery.isLoading && channels.length === 0 && <li className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma comunidade cadastrada.</li>}
              {channels.map((channel) => (
                <li key={channel.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0"><p className="break-words text-sm font-semibold">{channel.nome}</p><p className="mt-1 text-xs text-muted-foreground">{channel.totalEnvios} envio{channel.totalEnvios === 1 ? '' : 's'} · {channel.chatId ? 'grupo vinculado' : 'aguardando vínculo'}{!channel.ativo ? ' · inativa' : ''}</p></div>
                    <Badge variant={!channel.ativo ? 'secondary' : channel.chatId ? 'success' : 'warning'}>{!channel.ativo ? 'Inativa' : channel.chatId ? 'Pronta' : 'Configurar'}</Badge>
                  </div>
                  {mayManage && <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                    <label className="text-xs font-medium text-muted-foreground">Grupo sincronizado
                      <select className="mt-1 h-10 w-full rounded-md border bg-card px-3 text-sm text-foreground" value={channel.chatId ?? ''} aria-label={`Grupo vinculado a ${channel.nome}`} onChange={(event) => linkChat.mutate({ channelId: channel.id, chatId: event.target.value || null })}>
                        <option value="">{chatsQuery.isError ? 'Bot offline ou indisponível' : chats.length === 0 ? 'Nenhum grupo sincronizado' : 'Selecionar grupo…'}</option>
                        {chats.map((chat) => <option key={chat.chatId} value={chat.chatId}>{chat.nome}{chat.sessaoTelefone ? ` · ${chat.sessaoTelefone}` : ''}</option>)}
                      </select>
                    </label>
                    <div className="flex items-end gap-1"><Button size="sm" variant="ghost" disabled={toggleChannel.isPending} onClick={() => toggleChannel.mutate({ id: channel.id, active: !channel.ativo })}>{channel.ativo ? 'Desativar' : 'Ativar'}</Button>{channel.totalEnvios === 0 && <Button size="sm" variant="ghost" aria-label={`Remover ${channel.nome}`} disabled={removeChannel.isPending} onClick={() => removeChannel.mutate(channel.id)}><Trash2 /></Button>}</div>
                  </div>}
                  {!mayManage && channel.linkConvite && <a className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline" href={channel.linkConvite} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Abrir comunidade</a>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Bot />Como o envio funciona</CardTitle></CardHeader>
        <CardContent><ol className="grid gap-4 md:grid-cols-3"><Step number="1" title="Conecte o número" detail="Leia o QR Code com o WhatsApp administrado pela organização." /><Step number="2" title="Vincule os grupos" detail="Associe cada comunidade cadastrada ao grupo sincronizado correspondente." /><Step number="3" title="Publique e envie" detail="Em Comunicados, publique a mensagem e escolha o disparo automático ou manual." /></ol></CardContent>
      </Card>
    </div>
  );
}

function Summary({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Wifi }) {
  return <Card><CardContent className="flex items-center justify-between gap-4 p-5"><div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div><span className="rounded-lg bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></span></CardContent></Card>;
}

function Step({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{number}</span><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p></div></li>;
}
