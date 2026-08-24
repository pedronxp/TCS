import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Link2, Megaphone, Plus, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/AlertDialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { GuidedTutorial } from '@/components/tutorial/GuidedTutorial';
import { criarSalaTransmissaoPeloBot, fetchComunicadosOrgConsole, salvarCanalConsole, sincronizarChatsBot, vincularCanalChatConsole } from '@/lib/comunicados';

export function ConsoleWhatsAppCommunitiesPage() {
  const { orgId } = useParams();
  const queryClient = useQueryClient();
  const [nome, setNome] = useState('');
  const [chatId, setChatId] = useState('');
  const [broadcastName, setBroadcastName] = useState('');
  const [broadcastDescription, setBroadcastDescription] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: 'create' | 'create_room' | 'unlink'; channelId?: string; name: string } | null>(null);

  const organizationQuery = useQuery({
    queryKey: ['console', 'comunicados', 'org', orgId],
    queryFn: () => fetchComunicadosOrgConsole(orgId as string),
    enabled: Boolean(orgId),
    refetchInterval: 15_000,
  });
  const organization = organizationQuery.data ?? null;
  const linkedSession = organization?.sessoes.find((session) => session.runtimeState === 'online'
    || (!organization.runtime && session.status === 'vinculado')) ?? null;
  const groupsVisible = Boolean(linkedSession);

  const hierarchy = useMemo(() => {
    const communities = new Map<string, { name: string; chats: NonNullable<typeof organization>['chats'] }>();
    const standalone: NonNullable<typeof organization>['chats'] = [];
    const approvedStandalone = new Set((organization?.canais ?? []).map((channel) => channel.chatId).filter(Boolean));
    for (const chat of groupsVisible ? organization?.chats ?? [] : []) {
      if (chat.chatId.endsWith('@newsletter')) continue;
      if (!chat.comunidadeId) {
        if (approvedStandalone.has(chat.chatId)) standalone.push(chat);
        continue;
      }
      const current = communities.get(chat.comunidadeId) ?? { name: chat.comunidadeNome ?? 'Comunidade WhatsApp', chats: [] };
      current.chats.push(chat);
      communities.set(chat.comunidadeId, current);
    }
    return { communities: [...communities.entries()], standalone };
  }, [groupsVisible, organization]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['console', 'comunicados', 'org', orgId] });
  };

  const createCommunity = useMutation({
    mutationFn: async () => {
      const channelId = await salvarCanalConsole(orgId as string, nome.trim());
      if (chatId) await vincularCanalChatConsole(channelId, chatId);
    },
    onSuccess: async () => {
      setNome('');
      setChatId('');
      setError(null);
      setNotice('Comunidade cadastrada. O destino de envio já está disponível para os comunicados.');
      await refresh();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const createBroadcastRoom = useMutation({
    mutationFn: async () => {
      if (!linkedSession) throw new Error('Conecte um número antes de criar a sala de transmissão.');
      const room = await criarSalaTransmissaoPeloBot(linkedSession.id, broadcastName.trim(), broadcastDescription.trim());
      const channelId = await salvarCanalConsole(orgId as string, room.nome);
      await vincularCanalChatConsole(channelId, room.chatId);
    },
    onSuccess: async () => {
      setBroadcastName('');
      setBroadcastDescription('');
      setError(null);
      setNotice('Sala de transmissão criada. Os números dos participantes permanecem protegidos.');
      await refresh();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const linkCommunity = useMutation({
    mutationFn: ({ channelId, nextChatId }: { channelId: string; nextChatId: string | null }) => vincularCanalChatConsole(channelId, nextChatId),
    onSuccess: async () => {
      setError(null);
      setNotice('Grupo de envio atualizado.');
      await refresh();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const syncChats = useMutation({
    mutationFn: () => sincronizarChatsBot(linkedSession?.id as string),
    onSuccess: async (ok) => {
      setNotice(ok ? 'Grupos sincronizados com o WhatsApp.' : 'A sincronização não respondeu agora. Tente novamente em instantes.');
      await refresh();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  function chatOptions() {
    return (
      <>
        <option value="">Selecionar depois</option>
        {hierarchy.communities.map(([communityId, community]) => (
          <optgroup key={communityId} label={`Comunidade: ${community.name}`}>
            {community.chats.map((chat) => <option key={chat.chatId} value={chat.chatId}>{chat.nome} · {chat.totalParticipantes} membros</option>)}
          </optgroup>
        ))}
        {hierarchy.standalone.length > 0 && (
          <optgroup label="Grupos avulsos">
            {hierarchy.standalone.map((chat) => <option key={chat.chatId} value={chat.chatId}>{chat.nome} · {chat.totalParticipantes} membros</option>)}
          </optgroup>
        )}
      </>
    );
  }

  return (
    <div className="page-stack">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to={`/app/whatsapp/${orgId}`} className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.12em] text-primary"><ArrowLeft className="h-3.5 w-3.5" />Operação do WhatsApp</Link>
          <h1 className="mt-2 text-3xl font-semibold">Comunidades e transmissão</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{organization?.organization.name ?? 'Organização'} · organize os destinos usados nos alertas da Defesa Civil e confira a estrutura sincronizada do WhatsApp.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GuidedTutorial
            workspace="internal"
            organizationId={orgId ?? null}
            tutorialKey="console-whatsapp-communities"
            title="Como configurar Comunidades"
            description="Aprenda a sincronizar os grupos oficiais, cadastrar um destino e conferir se ele está pronto para receber alertas. Você pode marcar para não mostrar este tutorial novamente."
            steps={[
              { title: 'Sincronize o WhatsApp', description: 'Atualize a lista depois de criar ou alterar grupos no aplicativo oficial.', target: 'community-sync' },
              { title: 'Cadastre o destino', description: 'Dê um nome claro e selecione o grupo que receberá os comunicados.', target: 'community-create' },
              { title: 'Revise os vínculos', description: 'Verifique membros, administradores e destinos sem grupo.', target: 'community-list' },
            ]}
          />
          <Button data-tutorial="community-sync" variant="outline" disabled={!linkedSession || syncChats.isPending} onClick={() => syncChats.mutate()}><RefreshCw />{syncChats.isPending ? 'Sincronizando…' : 'Sincronizar grupos'}</Button>
        </div>
      </header>

      {notice && <p className="rounded-lg border border-success/25 bg-success-soft p-3 text-sm" role="status">{notice}</p>}
      {error && <p className="rounded-lg border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{error}</p>}
      {!linkedSession && organization && <p className="rounded-lg border border-warning/25 bg-warning-soft p-4 text-sm text-warning-foreground"><ShieldCheck className="mb-2 h-5 w-5" />Dados protegidos até um número reconectar. Comunidades, grupos, convites e vínculos permanecem ocultos.</p>}

      {organizationQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando comunidades…</p>}
      {organizationQuery.isError && <p className="text-sm text-destructive">Não foi possível carregar as comunidades.</p>}

      {organization && (
        <>
          <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo de comunidades">
            <Summary label="Comunidades no painel" value={organization.canais.length} icon={Megaphone} />
            <Summary label="Destinos prontos" value={groupsVisible ? organization.canais.filter((channel) => channel.ativo && channel.chatId).length : 0} icon={CheckCircle2} />
            <Summary label="Grupos oficiais visíveis" value={groupsVisible ? hierarchy.communities.reduce((total, [, community]) => total + community.chats.length, hierarchy.standalone.length) : 0} icon={Users} />
          </section>

          <section className="grid items-start gap-6 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
            <div className="space-y-6">{groupsVisible && <Card data-tutorial="community-create">
              <CardHeader><CardTitle className="flex items-center gap-2"><Plus />Nova comunidade</CardTitle></CardHeader>
              <CardContent>
                <p className="mb-5 text-sm leading-6 text-muted-foreground">Cadastre o nome que aparecerá nos comunicados e associe o grupo oficial de anúncios.</p>
                <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (nome.trim().length >= 3) setConfirmation({ action: 'create', name: nome.trim() }); }}>
                  <label className="block text-sm font-medium">Nome no painel<Input className="mt-1.5" value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Ex.: Alertas — Bairro Centro" minLength={3} maxLength={80} required /></label>
                  <label className="block text-sm font-medium">Grupo de envio<select className="mt-1.5 h-11 w-full rounded-md border bg-card px-3 text-sm" value={chatId} onChange={(event) => setChatId(event.target.value)}>{chatOptions()}</select></label>
                  <Button type="submit" disabled={createCommunity.isPending || nome.trim().length < 3}><Plus />{createCommunity.isPending ? 'Cadastrando…' : 'Cadastrar comunidade'}</Button>
                </form>
              </CardContent>
            </Card>}

            <Card className="overflow-hidden"><CardHeader className="border-b bg-secondary/15"><CardTitle className="flex items-center gap-2"><Megaphone />Sala de transmissão</CardTitle></CardHeader><CardContent className="space-y-4 pt-5"><div className="flex gap-3 rounded-xl bg-primary/5 p-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p className="text-xs leading-5 text-muted-foreground">Canais oficiais do WhatsApp não mostram os números dos seguidores para os demais participantes.</p></div>{!linkedSession && <p className="rounded-xl border border-dashed bg-secondary/20 p-4 text-sm leading-6 text-muted-foreground">Conecte um número autorizado para criar e visualizar salas de transmissão.</p>}<form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (linkedSession && broadcastName.trim().length >= 3) setConfirmation({ action: 'create_room', name: broadcastName.trim() }); }}><label className="block text-sm font-medium">Nome da sala<Input className="mt-1.5" value={broadcastName} onChange={(event) => setBroadcastName(event.target.value)} placeholder="Ex.: Alertas oficiais" minLength={3} maxLength={80} disabled={!linkedSession} required /></label><label className="block text-sm font-medium">Descrição<Input className="mt-1.5" value={broadcastDescription} onChange={(event) => setBroadcastDescription(event.target.value)} placeholder="Opcional" maxLength={280} disabled={!linkedSession} /></label><Button type="submit" disabled={!linkedSession || createBroadcastRoom.isPending || broadcastName.trim().length < 3}><Plus />{createBroadcastRoom.isPending ? 'Criando sala…' : 'Criar sala de transmissão'}</Button></form></CardContent></Card></div>

            {groupsVisible && <div className="space-y-6" data-tutorial="community-list">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Link2 />Destinos configurados</CardTitle></CardHeader>
                <CardContent>
                  {organization.canais.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma comunidade cadastrada.</p>}
                  <ul className="space-y-3">
                    {organization.canais.map((channel) => {
                      const linkedChat = organization.chats.find((item) => item.chatId === channel.chatId);
                      const isBroadcastRoom = Boolean(channel.chatId?.endsWith('@newsletter'));
                      return (
                        <li key={channel.id} className="rounded-xl border p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{channel.nome}</p><p className="mt-1 text-xs text-muted-foreground">{isBroadcastRoom ? 'Canal oficial · números dos seguidores protegidos' : linkedChat ? `${linkedChat.nome} · ${linkedChat.totalAdmins} administrador${linkedChat.totalAdmins === 1 ? '' : 'es'} · ${linkedChat.totalParticipantes} membros` : 'Escolha um grupo para habilitar o envio automático.'}</p></div><Badge variant={linkedChat ? 'success' : 'warning'}>{linkedChat ? isBroadcastRoom ? 'Transmissão pronta' : 'Pronto para envio' : 'Sem grupo'}</Badge></div>
                          {!isBroadcastRoom && <label className="mt-4 block text-xs font-medium text-muted-foreground">Grupo vinculado<select className="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm text-foreground" value={channel.chatId ?? ''} disabled={linkCommunity.isPending} onChange={(event) => event.target.value ? linkCommunity.mutate({ channelId: channel.id, nextChatId: event.target.value }) : setConfirmation({ action: 'unlink', channelId: channel.id, name: channel.nome })}>{chatOptions()}</select></label>}
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Users />Estrutura sincronizada</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm leading-6 text-muted-foreground">Por privacidade, esta área mostra apenas grupos dentro de Comunidades do WhatsApp ou destinos já aprovados no painel.</p>
                  {hierarchy.communities.map(([communityId, community]) => <div key={communityId} className="rounded-xl border p-4"><p className="font-semibold">{community.name}</p><ul className="mt-3 divide-y">{community.chats.map((chat) => <li key={chat.chatId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{chat.nome}</span><span className="text-xs text-muted-foreground">{chat.totalAdmins} admin · {chat.totalParticipantes} membros</span></li>)}</ul></div>)}
                  {hierarchy.standalone.length > 0 && <div className="rounded-xl border p-4"><p className="font-semibold">Grupos fora de Comunidades</p><ul className="mt-3 divide-y">{hierarchy.standalone.map((chat) => <li key={chat.chatId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{chat.nome}</span><span className="text-xs text-muted-foreground">{chat.totalAdmins} admin · {chat.totalParticipantes} membros</span></li>)}</ul></div>}
                  {organization.chats.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum grupo sincronizado ainda.</p>}
                </CardContent>
              </Card>
            </div>}
          </section>
        </>
      )}

      <AlertDialog open={confirmation !== null} onOpenChange={(open) => !open && setConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.action === 'create' ? 'Cadastrar comunidade?' : confirmation?.action === 'create_room' ? 'Criar sala de transmissão?' : 'Desvincular grupo do WhatsApp?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.action === 'create'
                ? `A comunidade “${confirmation.name}” será cadastrada nesta organização.`
                : confirmation?.action === 'create_room'
                  ? `A sala “${confirmation.name}” será criada como um Canal oficial do WhatsApp, com os números dos participantes protegidos.`
                : `O grupo associado a “${confirmation?.name ?? ''}” será removido dos envios automáticos.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (confirmation?.action === 'create') createCommunity.mutate();
              else if (confirmation?.action === 'create_room') createBroadcastRoom.mutate();
              else if (confirmation?.channelId) linkCommunity.mutate({ channelId: confirmation.channelId, nextChatId: null });
              setConfirmation(null);
            }}>{confirmation?.action === 'create' || confirmation?.action === 'create_room' ? 'Confirmar criação' : 'Confirmar desvinculação'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Summary({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return <Card><CardContent className="flex items-center justify-between gap-4 p-5"><div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div><span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></span></CardContent></Card>;
}
