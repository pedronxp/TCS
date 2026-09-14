import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, CircleAlert, Link2, Megaphone, Plus, Radio, RefreshCw, Search, ShieldCheck, Trash2, Users } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/AlertDialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { GuidedTutorial } from '@/components/tutorial/GuidedTutorial';
import { criarSalaTransmissaoPeloBot, fetchBotContatoSyncStatus, fetchComunicadosOrgConsole, limparContatosWhatsAppConsole, mascararTelefone, removerContatoWhatsAppConsole, salvarCanalConsole, sincronizarChatsBot, testarSalaTransmissaoPeloBot, vincularCanalChatConsole } from '@/lib/comunicados';

export function ConsoleWhatsAppCommunitiesPage() {
  const { orgId } = useParams();
  const queryClient = useQueryClient();
  const [nome, setNome] = useState('');
  const [chatId, setChatId] = useState('');
  const [broadcastName, setBroadcastName] = useState('');
  const [broadcastDescription, setBroadcastDescription] = useState('');
  const [broadcastTestText, setBroadcastTestText] = useState('Teste do Canal TCS: envio confirmado.');
  const [contactSearch, setContactSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: 'create' | 'create_room' | 'test_room' | 'unlink' | 'clear_contacts'; channelId?: string; chatId?: string; name: string } | null>(null);
  const [showAccessNotice, setShowAccessNotice] = useState(false);

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
  const contactsStatusQuery = useQuery({
    queryKey: ['bot', 'contacts-status', linkedSession?.id],
    queryFn: () => fetchBotContatoSyncStatus(linkedSession?.id as string),
    enabled: Boolean(linkedSession),
    refetchInterval: 15_000,
  });
  const contactsStatus = contactsStatusQuery.data;
  const visibleContacts = useMemo(() => {
    const term = contactSearch.trim().toLocaleLowerCase('pt-BR');
    if (!term) return organization?.contatos ?? [];
    return (organization?.contatos ?? []).filter((contact) => `${contact.nome ?? ''} ${contact.telefone}`.toLocaleLowerCase('pt-BR').includes(term));
  }, [contactSearch, organization?.contatos]);

  useEffect(() => {
    if (!linkedSession || typeof window === 'undefined') return;
    const key = `tcs:whatsapp-access-notice:${linkedSession.id}`;
    if (!window.localStorage.getItem(key)) setShowAccessNotice(true);
  }, [linkedSession?.id]);

  const hierarchy = useMemo(() => {
    const communities = new Map<string, { name: string; chats: NonNullable<typeof organization>['chats'] }>();
    const standalone: NonNullable<typeof organization>['chats'] = [];
    for (const chat of groupsVisible ? organization?.chats ?? [] : []) {
      if (chat.chatId.endsWith('@newsletter')) continue;
      if (!chat.comunidadeId) {
        standalone.push(chat);
        continue;
      }
      const current = communities.get(chat.comunidadeId) ?? { name: chat.comunidadeNome ?? 'Comunidade WhatsApp', chats: [] };
      current.chats.push(chat);
      communities.set(chat.comunidadeId, current);
    }
    return { communities: [...communities.entries()], standalone };
  }, [groupsVisible, organization]);
  const transmissionRooms = useMemo(() => (groupsVisible ? organization?.chats.filter((chat) => chat.chatId.endsWith('@newsletter')) ?? [] : []), [groupsVisible, organization]);

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

  const testBroadcastRoom = useMutation({
    mutationFn: async ({ chatId }: { chatId: string }) => {
      if (!linkedSession) throw new Error('Conecte um número antes de testar o Canal.');
      await testarSalaTransmissaoPeloBot(linkedSession.id, chatId, broadcastTestText.trim());
    },
    onSuccess: () => { setError(null); setNotice('Texto de teste enviado ao Canal. Confira a publicação no WhatsApp.'); },
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

  const deleteContact = useMutation({
    mutationFn: (contactId: string) => removerContatoWhatsAppConsole(contactId),
    onSuccess: async () => { setNotice('Contato removido da agenda do painel.'); await refresh(); },
    onError: (mutationError: Error) => setError(mutationError.message),
  });
  const clearContacts = useMutation({
    mutationFn: () => limparContatosWhatsAppConsole(orgId as string, linkedSession?.id ?? null),
    onSuccess: async (total) => { setNotice(`${total} contato(s) removido(s) da agenda do painel.`); await refresh(); },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  function chatOptions() {
    return (
      <>
        <option value="">Selecionar depois</option>
        {hierarchy.communities.map(([communityId, community]) => (
          <optgroup key={communityId} label={`Comunidade: ${community.name}`}>
            {community.chats.map((chat) => <option key={chat.chatId} value={chat.chatId}>{chat.nome} · {chat.totalParticipantes} membros · conta {mascararTelefone(chat.sessaoTelefone)}</option>)}
          </optgroup>
        ))}
        {hierarchy.standalone.length > 0 && (
          <optgroup label="Grupos avulsos">
            {hierarchy.standalone.map((chat) => <option key={chat.chatId} value={chat.chatId}>{chat.nome} · {chat.totalParticipantes} membros · conta {mascararTelefone(chat.sessaoTelefone)}</option>)}
          </optgroup>
        )}
        {transmissionRooms.length > 0 && (
          <optgroup label="Canais de transmissão">
            {transmissionRooms.map((room) => <option key={room.chatId} value={room.chatId}>{room.nome} · Canal · conta {mascararTelefone(room.sessaoTelefone)}</option>)}
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
      {linkedSession && <p className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground"><ShieldCheck className="mb-2 h-5 w-5 text-primary" />O número vinculado permite ao bot consultar os grupos e, mediante sua autorização, sincronizar a agenda para a criação de listas no painel. Os contatos ficam restritos à organização e podem ser removidos a qualquer momento; a exclusão não altera a agenda do celular.</p>}

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
                  <label className="block text-sm font-medium">Destino de envio<select className="mt-1.5 h-11 w-full rounded-md border bg-card px-3 text-sm" value={chatId} onChange={(event) => setChatId(event.target.value)}>{chatOptions()}</select></label>
                  <p className="text-xs leading-5 text-muted-foreground">Escolha um grupo ou um Canal já detectado. Listas de contatos aparecerão aqui quando forem criadas a partir da agenda.</p>
                  <Button type="submit" disabled={createCommunity.isPending || nome.trim().length < 3}><Plus />{createCommunity.isPending ? 'Cadastrando…' : 'Cadastrar comunidade'}</Button>
                </form>
              </CardContent>
            </Card>}

            <Card className="overflow-hidden"><CardHeader className="border-b bg-secondary/15"><CardTitle className="flex items-center gap-2"><Megaphone />Sala de transmissão</CardTitle></CardHeader><CardContent className="space-y-4 pt-5"><div className="flex gap-3 rounded-xl bg-primary/5 p-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p className="text-xs leading-5 text-muted-foreground">Canais oficiais do WhatsApp não mostram os números dos seguidores para os demais participantes.</p></div>{!linkedSession && <p className="rounded-xl border border-dashed bg-secondary/20 p-4 text-sm leading-6 text-muted-foreground">Conecte um número autorizado para criar e visualizar salas de transmissão.</p>}<form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (linkedSession && broadcastName.trim().length >= 3) setConfirmation({ action: 'create_room', name: broadcastName.trim() }); }}><label className="block text-sm font-medium">Nome da sala<Input className="mt-1.5" value={broadcastName} onChange={(event) => setBroadcastName(event.target.value)} placeholder="Ex.: Alertas oficiais" minLength={3} maxLength={80} disabled={!linkedSession} required /></label><label className="block text-sm font-medium">Descrição<Input className="mt-1.5" value={broadcastDescription} onChange={(event) => setBroadcastDescription(event.target.value)} placeholder="Opcional" maxLength={280} disabled={!linkedSession} /></label><Button type="submit" disabled={!linkedSession || createBroadcastRoom.isPending || broadcastName.trim().length < 3}><Plus />{createBroadcastRoom.isPending ? 'Criando sala…' : 'Criar sala de transmissão'}</Button></form></CardContent></Card></div>

            {groupsVisible && <div className="space-y-6" data-tutorial="community-list">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Radio />Canais detectados</CardTitle><p className="pt-1 text-sm font-normal leading-6 text-muted-foreground">Canais confirmados pelo WhatsApp nesta conta, mesmo que a criação tenha retornado erro no painel.</p></CardHeader>
                <CardContent>{transmissionRooms.length === 0 ? <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Nenhum Canal confirmado nesta sessão ainda. Depois de criar um Canal, aguarde alguns segundos e clique em “Sincronizar grupos”.</p> : <ul className="space-y-3">{transmissionRooms.map((room) => <li key={room.chatId} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{room.nome}</p><p className="mt-1 text-xs text-muted-foreground">Canal oficial · conta {mascararTelefone(room.sessaoTelefone)} · seguidores protegidos</p></div><Badge variant="success">Confirmado</Badge></div><div className="mt-4 flex flex-wrap items-end gap-2"><label className="min-w-60 flex-1 text-xs font-medium text-muted-foreground">Texto de teste<Input className="mt-1.5" value={broadcastTestText} onChange={(event) => setBroadcastTestText(event.target.value)} maxLength={1000} /></label><Button variant="outline" disabled={!linkedSession || testBroadcastRoom.isPending || broadcastTestText.trim().length === 0} onClick={() => setConfirmation({ action: 'test_room', chatId: room.chatId, name: room.nome })}>{testBroadcastRoom.isPending ? 'Enviando…' : 'Enviar teste'}</Button></div></li>)}</ul>}</CardContent>
              </Card>
              <Card>
                <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="flex items-center gap-2"><Users />Agenda autorizada</CardTitle><p className="mt-2 max-w-2xl text-sm font-normal leading-6 text-muted-foreground">Contatos entregues pelo WhatsApp ao dispositivo vinculado. Eles ficam restritos à organização e podem ser removidos do painel sem alterar a agenda do celular.</p></div><Button variant="outline" size="sm" disabled={clearContacts.isPending || organization.contatos.length === 0} onClick={() => setConfirmation({ action: 'clear_contacts', name: 'agenda sincronizada' })}><Trash2 />Limpar agenda</Button></CardHeader>
                <CardContent>
                  {organization.contatos.length === 0 ? <div className="rounded-lg border border-dashed p-5 text-sm"><p className="flex items-center gap-2 font-medium"><CircleAlert className="h-4 w-4 text-warning-foreground" />{contactsStatus?.estado === 'indisponivel' ? 'A agenda não foi disponibilizada pelo WhatsApp' : contactsStatus?.estado === 'aguardando' ? 'Aguardando a agenda do WhatsApp' : 'Nenhum contato sincronizado ainda'}</p><p className="mt-2 leading-6 text-muted-foreground">{contactsStatus?.motivo ?? 'O bot ainda não recebeu contatos da conta vinculada. “Sincronizar grupos” atualiza grupos; ele não força o WhatsApp a enviar a agenda.'}</p></div> : <><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-success">{organization.contatos.length} contato(s) sincronizado(s) {contactsStatus?.atualizadoEm ? `· atualização ${new Date(contactsStatus.atualizadoEm).toLocaleTimeString('pt-BR')}` : ''}</p><label className="relative block sm:w-72"><span className="sr-only">Pesquisar agenda</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-9 pl-9" value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} placeholder="Buscar nome ou número" /></label></div>{visibleContacts.length === 0 ? <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Nenhum contato corresponde à busca.</p> : <ul className="grid gap-2 sm:grid-cols-2">{visibleContacts.map((contact) => <li key={contact.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border px-3 py-2.5"><div className="min-w-0"><p className="truncate text-sm font-medium">{contact.nome || 'Nome não informado pelo WhatsApp'}</p><p className="mt-0.5 text-xs text-muted-foreground">{contact.telefone}</p></div><Button variant="ghost" size="icon" aria-label={`Remover ${contact.nome || contact.telefone}`} disabled={deleteContact.isPending} onClick={() => deleteContact.mutate(contact.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></li>)}</ul>}<p className="mt-3 text-xs leading-5 text-muted-foreground">Quando o WhatsApp não envia o nome do contato, o painel mostra o número e deixa isso explícito; nenhum nome é criado artificialmente.</p></>}
                </CardContent>
              </Card>
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
                          {isBroadcastRoom ? <div className="mt-4 flex flex-wrap items-end gap-2"><label className="min-w-60 flex-1 text-xs font-medium text-muted-foreground">Texto de teste<Input className="mt-1.5" value={broadcastTestText} onChange={(event) => setBroadcastTestText(event.target.value)} maxLength={1000} /></label><Button variant="outline" disabled={!linkedSession || testBroadcastRoom.isPending || broadcastTestText.trim().length === 0} onClick={() => setConfirmation({ action: 'test_room', chatId: channel.chatId ?? undefined, name: channel.nome })}>{testBroadcastRoom.isPending ? 'Enviando…' : 'Enviar teste'}</Button></div> : <label className="mt-4 block text-xs font-medium text-muted-foreground">Grupo vinculado<select className="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm text-foreground" value={channel.chatId ?? ''} disabled={linkCommunity.isPending} onChange={(event) => event.target.value ? linkCommunity.mutate({ channelId: channel.id, nextChatId: event.target.value }) : setConfirmation({ action: 'unlink', channelId: channel.id, name: channel.nome })}>{chatOptions()}</select></label>}
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Users />Estrutura sincronizada</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm leading-6 text-muted-foreground">Mostra os grupos visíveis para o número vinculado. Para cada grupo, o painel exibe somente nome, quantidade de participantes e administradores — nunca a lista de números.</p>
                  {hierarchy.communities.map(([communityId, community]) => <div key={communityId} className="rounded-xl border p-4"><p className="font-semibold">{community.name}</p><ul className="mt-3 divide-y">{community.chats.map((chat) => <li key={chat.chatId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{chat.nome}</span><span className="text-xs text-muted-foreground">Conta {mascararTelefone(chat.sessaoTelefone)} · {chat.totalAdmins} admin · {chat.totalParticipantes} membros</span></li>)}</ul></div>)}
                  {hierarchy.standalone.length > 0 && <div className="rounded-xl border p-4"><p className="font-semibold">Grupos fora de Comunidades</p><ul className="mt-3 divide-y">{hierarchy.standalone.map((chat) => <li key={chat.chatId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{chat.nome}</span><span className="text-xs text-muted-foreground">Conta {mascararTelefone(chat.sessaoTelefone)} · {chat.totalAdmins} admin · {chat.totalParticipantes} membros</span></li>)}</ul></div>}
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
            <AlertDialogTitle>{confirmation?.action === 'create' ? 'Cadastrar comunidade?' : confirmation?.action === 'create_room' ? 'Criar sala de transmissão?' : confirmation?.action === 'test_room' ? 'Enviar texto de teste?' : confirmation?.action === 'clear_contacts' ? 'Apagar agenda sincronizada?' : 'Desvincular grupo do WhatsApp?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.action === 'create'
                ? `A comunidade “${confirmation.name}” será cadastrada nesta organização.`
                : confirmation?.action === 'create_room'
                  ? `A sala “${confirmation.name}” será criada como um Canal oficial do WhatsApp, com os números dos participantes protegidos.`
                  : confirmation?.action === 'test_room'
                    ? `A mensagem “${broadcastTestText.trim()}” será publicada no Canal “${confirmation.name}”.`
                  : confirmation?.action === 'clear_contacts'
                    ? 'Todos os contatos sincronizados deste número serão removidos do painel. O WhatsApp do celular não será alterado.'
                  : `O grupo associado a “${confirmation?.name ?? ''}” será removido dos envios automáticos.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (confirmation?.action === 'create') createCommunity.mutate();
              else if (confirmation?.action === 'create_room') createBroadcastRoom.mutate();
              else if (confirmation?.action === 'test_room' && confirmation.chatId) testBroadcastRoom.mutate({ chatId: confirmation.chatId });
              else if (confirmation?.action === 'clear_contacts') clearContacts.mutate();
              else if (confirmation?.channelId) linkCommunity.mutate({ channelId: confirmation.channelId, nextChatId: null });
              setConfirmation(null);
            }}>{confirmation?.action === 'create' || confirmation?.action === 'create_room' ? 'Confirmar criação' : confirmation?.action === 'test_room' ? 'Enviar texto' : confirmation?.action === 'clear_contacts' ? 'Apagar contatos' : 'Confirmar desvinculação'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={showAccessNotice} onOpenChange={setShowAccessNotice}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>WhatsApp vinculado com acesso aos grupos</AlertDialogTitle>
            <AlertDialogDescription>
              O bot poderá consultar os grupos visíveis e sincronizar nome e telefone dos contatos disponibilizados pela conta vinculada. Esses dados ficam restritos a esta organização para criação de listas no painel e podem ser removidos individualmente ou apagados por completo sem alterar a agenda do celular.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              if (linkedSession) window.localStorage.setItem(`tcs:whatsapp-access-notice:${linkedSession.id}`, 'acknowledged');
              setShowAccessNotice(false);
            }}>Entendi e continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Summary({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return <Card><CardContent className="flex items-center justify-between gap-4 p-5"><div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div><span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></span></CardContent></Card>;
}
