import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Bot, CalendarClock, Check, Copy, ExternalLink, Megaphone, Pencil, Send, Smartphone, Trash2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/AlertDialog';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { GuidedTutorial } from '@/components/tutorial/GuidedTutorial';
import {
  comunicadoDestinosLabel,
  comunicadoSeverityLabels,
  comunicadoStatusLabels,
  deleteBairro,
  deleteCanal,
  deleteComunicado,
  dispararBot,
  fetchBairros,
  fetchBotChats,
  fetchCanais,
  fetchComunicados,
  fetchSessoesBot,
  criarSessaoBot,
  definirStatusSessaoBot,
  mensagemWhatsApp,
  registerComunicadoLeitura,
  registrarEnvioCanal,
  saveBairro,
  saveCanal,
  saveComunicado,
  setCanalAtivo,
  setComunicadoStatus,
  vincularCanalChat,
  whatsappShareUrl,
  type Comunicado,
  type ComunicadoSeveridade,
  type SessaoBotStatus,
} from '@/lib/comunicados';

interface DraftState {
  id?: string;
  titulo: string;
  conteudo: string;
  severidade: ComunicadoSeveridade;
  expiraEm: string;
  publicarEm: string;
  bairrosSelecionados: string[];
  todoMunicipio: boolean;
}

const emptyDraft: DraftState = {
  titulo: '',
  conteudo: '',
  severidade: 'informacao',
  expiraEm: '',
  publicarEm: '',
  bairrosSelecionados: [],
  todoMunicipio: true,
};

function severityBadgeVariant(severidade: ComunicadoSeveridade) {
  if (severidade === 'emergencia') return 'destructive' as const;
  if (severidade === 'alerta') return 'warning' as const;
  return 'info' as const;
}

function statusBadgeVariant(status: Comunicado['status']) {
  if (status === 'publicado') return 'success' as const;
  if (status === 'agendado') return 'info' as const;
  if (status === 'rascunho') return 'outline' as const;
  return 'secondary' as const;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}

const sessaoBotLabels: Record<SessaoBotStatus, string> = {
  aguardando_qr: 'Emparelhando (QR aberto)',
  vinculado: 'Vinculado',
  desconectado: 'Desconectado',
  banido: 'Banido',
};

type SubmitMode = 'rascunho' | 'publicar' | 'agendar';

export function PortalComunicadosPage() {
  const { access, can } = usePortalAuth();
  const queryClient = useQueryClient();
  const mayManage = can('communication.write');
  const organizationId = access?.organizationId ?? null;

  const comunicadosQuery = useQuery({
    queryKey: ['portal', 'comunicados', organizationId],
    queryFn: fetchComunicados,
    enabled: Boolean(access),
  });
  const bairrosQuery = useQuery({
    queryKey: ['portal', 'bairros', organizationId],
    queryFn: fetchBairros,
    enabled: Boolean(access),
  });
  const canaisQuery = useQuery({
    queryKey: ['portal', 'canais', organizationId],
    queryFn: fetchCanais,
    enabled: Boolean(access),
  });
  const botChatsQuery = useQuery({
    queryKey: ['portal', 'bot-chats', organizationId],
    queryFn: fetchBotChats,
    enabled: Boolean(access) && mayManage,
    retry: false,
  });
  const sessoesQuery = useQuery({
    queryKey: ['portal', 'bot-sessoes', organizationId],
    queryFn: fetchSessoesBot,
    enabled: Boolean(access) && mayManage,
    refetchInterval: 10_000,
  });

  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [editing, setEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [novoBairro, setNovoBairro] = useState('');
  const [novaComunidade, setNovaComunidade] = useState({ nome: '', linkConvite: '' });

  const comunicados = comunicadosQuery.data ?? [];
  const bairros = bairrosQuery.data ?? [];
  const canais = canaisQuery.data ?? [];
  const publicados = useMemo(() => comunicados.filter((item) => item.status === 'publicado'), [comunicados]);
  const agendados = useMemo(() => comunicados.filter((item) => item.status === 'agendado'), [comunicados]);
  const rascunhos = useMemo(() => comunicados.filter((item) => item.status === 'rascunho'), [comunicados]);
  const arquivados = useMemo(() => comunicados.filter((item) => item.status === 'arquivado'), [comunicados]);
  const canaisAtivos = useMemo(() => canais.filter((canal) => canal.ativo), [canais]);
  const botChats = botChatsQuery.data ?? [];

  const invalidateComunicados = () => queryClient.invalidateQueries({ queryKey: ['portal', 'comunicados'] });

  const saveMutation = useMutation({
    mutationFn: saveComunicado,
    onSuccess: async (_id, variables) => {
      setDraft(emptyDraft);
      setEditing(false);
      setStatusMessage(variables.id ? 'Comunicado atualizado.' : 'Rascunho salvo.');
      await invalidateComunicados();
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status, publicarEm }: { id: string; status: 'agendado' | 'publicado' | 'arquivado' | 'rascunho'; publicarEm?: string | null }) =>
      setComunicadoStatus(id, status, publicarEm),
    onSuccess: async () => {
      setStatusMessage('Status atualizado.');
      await invalidateComunicados();
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteComunicado,
    onSuccess: async () => {
      setStatusMessage('Rascunho excluído.');
      await invalidateComunicados();
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });
  const leituraMutation = useMutation({
    mutationFn: registerComunicadoLeitura,
    onSuccess: async () => {
      await invalidateComunicados();
    },
  });
  const envioMutation = useMutation({
    mutationFn: ({ canalId, comunicadoId }: { canalId: string; comunicadoId: string }) => registrarEnvioCanal(canalId, comunicadoId),
    onSuccess: async () => {
      setStatusMessage('Envio à comunidade registrado.');
      await invalidateComunicados();
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });
  const bairroSaveMutation = useMutation({
    mutationFn: (nome: string) => saveBairro(nome),
    onSuccess: async () => {
      setNovoBairro('');
      setStatusMessage('Bairro salvo.');
      await queryClient.invalidateQueries({ queryKey: ['portal', 'bairros'] });
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });
  const bairroDeleteMutation = useMutation({
    mutationFn: deleteBairro,
    onSuccess: async () => {
      setStatusMessage('Bairro removido.');
      await queryClient.invalidateQueries({ queryKey: ['portal', 'bairros'] });
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });
  const canalSaveMutation = useMutation({
    mutationFn: saveCanal,
    onSuccess: async () => {
      setNovaComunidade({ nome: '', linkConvite: '' });
      setStatusMessage('Comunidade salva.');
      await queryClient.invalidateQueries({ queryKey: ['portal', 'canais'] });
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });
  const canalAtivoMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => setCanalAtivo(id, ativo),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['portal', 'canais'] });
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });
  const vincularChatMutation = useMutation({
    mutationFn: ({ canalId, chatId }: { canalId: string; chatId: string | null }) => vincularCanalChat(canalId, chatId),
    onSuccess: async () => {
      setStatusMessage('Chat vinculado à comunidade.');
      await queryClient.invalidateQueries({ queryKey: ['portal', 'canais'] });
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });
  const botMutation = useMutation({
    mutationFn: ({ comunicadoId, canalId }: { comunicadoId: string; canalId?: string }) => dispararBot(comunicadoId, canalId),
    onSuccess: async (total) => {
      setStatusMessage(total > 0
        ? `${total} disparo${total === 1 ? '' : 's'} na fila do bot — o envio ocorre em segundos.`
        : 'Nenhuma comunidade ativa com chat vinculado. Vincule o chat na seção Comunidades.');
      await invalidateComunicados();
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });
  const canalDeleteMutation = useMutation({
    mutationFn: deleteCanal,
    onSuccess: async () => {
      setStatusMessage('Comunidade removida.');
      await queryClient.invalidateQueries({ queryKey: ['portal', 'canais'] });
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });
  const criarSessaoMutation = useMutation({
    mutationFn: criarSessaoBot,
    onSuccess: async (sessaoId) => {
      setStatusMessage(`Número emparelhando: abra a página do bot em /sessao/${sessaoId} (ex.: http://localhost:8787/sessao/${sessaoId}) e escaneie o QR com o celular da prefeitura.`);
      await queryClient.invalidateQueries({ queryKey: ['portal', 'bot-sessoes'] });
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });
  const sessaoStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'banido' | 'desconectado' }) => definirStatusSessaoBot(id, status),
    onSuccess: async () => {
      setStatusMessage('Status do número atualizado.');
      await queryClient.invalidateQueries({ queryKey: ['portal', 'bot-sessoes'] });
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });

  function beginEdit(comunicado: Comunicado) {
    setDraft({
      id: comunicado.id,
      titulo: comunicado.titulo,
      conteudo: comunicado.conteudo,
      severidade: comunicado.severidade,
      expiraEm: comunicado.expiraEm ? comunicado.expiraEm.slice(0, 10) : '',
      publicarEm: comunicado.publicarEm ? comunicado.publicarEm.slice(0, 16) : '',
      bairrosSelecionados: comunicado.destinos
        .map((destino) => destino.bairroId)
        .filter((bairroId): bairroId is string => bairroId !== null),
      todoMunicipio: comunicado.destinos.some((destino) => destino.todoMunicipio),
    });
    setEditing(true);
    setStatusMessage(null);
    setErrorMessage(null);
  }

  function toggleBairro(bairroId: string) {
    setDraft((current) => {
      const selected = current.bairrosSelecionados.includes(bairroId)
        ? current.bairrosSelecionados.filter((item) => item !== bairroId)
        : [...current.bairrosSelecionados, bairroId];
      return { ...current, bairrosSelecionados: selected, todoMunicipio: selected.length === 0 };
    });
  }

  async function submit(mode: SubmitMode) {
    setErrorMessage(null);
    setStatusMessage(null);
    const publicarIso = mode === 'agendar' && draft.publicarEm
      ? new Date(draft.publicarEm).toISOString()
      : null;
    if (mode === 'agendar' && (!draft.publicarEm || new Date(draft.publicarEm).getTime() <= Date.now())) {
      setErrorMessage('Escolha uma data e hora futura para agendar.');
      return;
    }
    try {
      const comunicadoId = await saveMutation.mutateAsync({
        id: draft.id,
        titulo: draft.titulo.trim(),
        conteudo: draft.conteudo,
        severidade: draft.severidade,
        expiraEm: draft.expiraEm ? new Date(`${draft.expiraEm}T23:59:59`).toISOString() : null,
        publicarEm: publicarIso,
        destinos: draft.todoMunicipio || draft.bairrosSelecionados.length === 0
          ? [{ todoMunicipio: true }]
          : draft.bairrosSelecionados.map((bairroId) => ({ bairroId })),
      });
      if (mode === 'publicar') {
        await setComunicadoStatus(comunicadoId, 'publicado');
        setStatusMessage('Comunicado publicado para a equipe municipal.');
      } else if (mode === 'agendar') {
        await setComunicadoStatus(comunicadoId, 'agendado', publicarIso);
        setStatusMessage(`Comunicado agendado para ${formatDate(publicarIso) ?? 'a data informada'}.`);
      }
      await invalidateComunicados();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível salvar.');
    }
  }

  function expand(comunicado: Comunicado) {
    setExpandedId((current) => (current === comunicado.id ? null : comunicado.id));
    if (expandedId !== comunicado.id && !comunicado.lido) {
      leituraMutation.mutate(comunicado.id);
    }
  }

  async function copiarMensagem(comunicado: Comunicado) {
    await navigator.clipboard.writeText(mensagemWhatsApp(comunicado, access?.organizationName ?? null));
    setStatusMessage('Mensagem copiada. Cole na Comunidade WhatsApp e confirme o envio abaixo.');
  }

  return (
    <div className="communications-compact page-stack mx-auto max-w-[1180px]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Comunicação municipal</p>
          <h1 className="mt-1 text-2xl font-semibold">Comunicados</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Avisos oficiais da prefeitura para a equipe, com destino por bairro ou para todo o município.
          </p>
        </div>
        <GuidedTutorial
          workspace="organization"
          organizationId={organizationId}
          tutorialKey="defesa-civil-comunicados"
          title="Como publicar um alerta da Defesa Civil"
          description="Prepare o conteúdo, selecione município, Comunidade ou bairros e revise o alcance antes do disparo."
          steps={[
            { title: 'Prepare o alerta', description: 'Defina título, orientação, severidade e validade.', target: 'communication-composer' },
            { title: 'Escolha o território', description: 'Selecione todo o município ou os bairros; o sistema resolverá os grupos vinculados.', target: 'communication-targets' },
            { title: 'Acompanhe o histórico', description: 'Publicados, correções, cancelamentos e entregas permanecem registrados.', target: 'communication-history' },
          ]}
        />
      </header>

      {statusMessage && <p className="rounded-md border border-success/25 bg-success-soft p-3 text-sm text-foreground" role="status">{statusMessage}</p>}
      {errorMessage && <p className="rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{errorMessage}</p>}

      <section data-tutorial="communication-composer" className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
        {mayManage ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone />
                  {editing ? 'Editar comunicado' : 'Novo comunicado'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void submit('rascunho'); }}>
                  <label className="block text-sm font-medium">
                    Título
                    <Input
                      className="mt-2"
                      value={draft.titulo}
                      onChange={(event) => setDraft((current) => ({ ...current, titulo: event.target.value }))}
                      minLength={3}
                      maxLength={120}
                      required
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Conteúdo
                    <Textarea
                      className="mt-2 min-h-24"
                      value={draft.conteudo}
                      onChange={(event) => setDraft((current) => ({ ...current, conteudo: event.target.value }))}
                      maxLength={5000}
                      required
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium">
                      Severidade
                      <select
                        className="mt-2 h-11 w-full rounded-md border bg-card px-3 text-sm"
                        value={draft.severidade}
                        onChange={(event) => setDraft((current) => ({ ...current, severidade: event.target.value as ComunicadoSeveridade }))}
                      >
                        <option value="informacao">Informação</option>
                        <option value="alerta">Alerta</option>
                        <option value="emergencia">Emergência</option>
                      </select>
                    </label>
                    <label className="block text-sm font-medium">
                      Expira em (opcional)
                      <Input
                        className="mt-2"
                        type="date"
                        value={draft.expiraEm}
                        onChange={(event) => setDraft((current) => ({ ...current, expiraEm: event.target.value }))}
                      />
                    </label>
                  </div>
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">Destino</legend>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.todoMunicipio}
                        onChange={(event) => setDraft((current) => ({
                          ...current,
                          todoMunicipio: event.target.checked,
                          bairrosSelecionados: event.target.checked ? [] : current.bairrosSelecionados,
                        }))}
                      />
                      Todo o município
                    </label>
                    {!draft.todoMunicipio && (
                      <div className="flex flex-wrap gap-2">
                        {bairros.filter((bairro) => bairro.ativo).length === 0 && (
                          <p className="text-xs text-muted-foreground">Nenhum bairro cadastrado. Cadastre abaixo ou use "Todo o município".</p>
                        )}
                        {bairros.filter((bairro) => bairro.ativo).map((bairro) => (
                          <button
                            key={bairro.id}
                            type="button"
                            aria-pressed={draft.bairrosSelecionados.includes(bairro.id)}
                            className={`rounded-md border px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              draft.bairrosSelecionados.includes(bairro.id)
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'bg-card text-foreground'
                            }`}
                            onClick={() => toggleBairro(bairro.id)}
                          >
                            {bairro.nome}
                          </button>
                        ))}
                      </div>
                    )}
                  </fieldset>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={saveMutation.isPending}>
                      {saveMutation.isPending ? 'Salvando…' : 'Salvar rascunho'}
                    </Button>
                    <Button type="button" variant="outline" disabled={saveMutation.isPending} onClick={() => void submit('publicar')}>
                      <Send />
                      Publicar agora
                    </Button>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarClock className="h-4 w-4" aria-hidden />
                      <Input
                        type="datetime-local"
                        className="h-11"
                        value={draft.publicarEm}
                        onChange={(event) => setDraft((current) => ({ ...current, publicarEm: event.target.value }))}
                        aria-label="Agendar para"
                      />
                    </label>
                    <Button type="button" variant="outline" disabled={saveMutation.isPending} onClick={() => void submit('agendar')}>
                      Agendar
                    </Button>
                    {editing && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setDraft(emptyDraft);
                          setEditing(false);
                        }}
                      >
                        Cancelar edição
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users />
                  Comunidades WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-xs text-muted-foreground">
                  A Comunidade é criada no aplicativo WhatsApp e registrada aqui. O envio é assistido: o painel gera a
                  mensagem pronta e você replica na comunidade — cada envio fica registrado para auditoria.
                </p>
                <form
                  className="grid gap-2 sm:grid-cols-[1.2fr_1.4fr_auto]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (novaComunidade.nome.trim().length >= 3) {
                      canalSaveMutation.mutate({ nome: novaComunidade.nome.trim(), linkConvite: novaComunidade.linkConvite.trim() || null });
                    }
                  }}
                >
                  <Input
                    value={novaComunidade.nome}
                    onChange={(event) => setNovaComunidade((current) => ({ ...current, nome: event.target.value }))}
                    placeholder="Nome da comunidade"
                    minLength={3}
                    maxLength={80}
                    aria-label="Nome da comunidade"
                  />
                  <Input
                    value={novaComunidade.linkConvite}
                    onChange={(event) => setNovaComunidade((current) => ({ ...current, linkConvite: event.target.value }))}
                    placeholder="Link de convite (opcional)"
                    aria-label="Link de convite da comunidade"
                  />
                  <Button type="submit" variant="outline" disabled={canalSaveMutation.isPending}>Adicionar</Button>
                </form>
                <ul className="mt-4 divide-y">
                  {canais.length === 0 && (
                    <li className="py-3 text-sm text-muted-foreground">Nenhuma comunidade registrada.</li>
                  )}
                  {canais.map((canal) => (
                    <li key={canal.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-semibold">
                          {canal.nome}
                          {!canal.ativo && <span className="ml-2 text-xs text-muted-foreground">(inativa)</span>}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {canal.totalEnvios} envio{canal.totalEnvios === 1 ? '' : 's'} registrado{canal.totalEnvios === 1 ? '' : 's'}
                          {canal.chatId ? ' · chat vinculado' : ' · sem chat vinculado'}
                        </span>
                        {mayManage && (
                          <label className="mt-1 block text-xs text-muted-foreground">
                            Chat do bot
                            <select
                              className="mt-1 h-9 w-full rounded-md border bg-card px-2 text-xs"
                              value={canal.chatId ?? ''}
                              aria-label={`Chat vinculado à comunidade ${canal.nome}`}
                              onChange={(event) => vincularChatMutation.mutate({ canalId: canal.id, chatId: event.target.value || null })}
                            >
                              <option value="">
                                {botChatsQuery.isError
                                  ? 'Bot offline ou sem permissão'
                                  : botChats.length === 0
                                    ? 'Nenhum chat sincronizado pelo bot'
                                    : 'Selecionar chat…'}
                              </option>
                              {botChats.map((chat) => (
                                <option key={chat.chatId} value={chat.chatId}>{chat.nome}</option>
                              ))}
                            </select>
                          </label>
                        )}
                      </span>
                      <span className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={canalAtivoMutation.isPending}
                          onClick={() => canalAtivoMutation.mutate({ id: canal.id, ativo: !canal.ativo })}
                        >
                          {canal.ativo ? 'Desativar' : 'Ativar'}
                        </Button>
                        {canal.totalEnvios === 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Remover comunidade ${canal.nome}`}
                            disabled={canalDeleteMutation.isPending}
                            onClick={() => canalDeleteMutation.mutate(canal.id)}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone />
                  Números do bot
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-xs text-muted-foreground">
                  Cada número pertence a esta prefeitura. Vincule o número que criou a Comunidade e um segundo número
                  também admin — o disparo tenta todos os vinculados (um cai, o outro envia). Número banido: marque e
                  vincule outro.
                </p>
                <Button size="sm" disabled={criarSessaoMutation.isPending} onClick={() => criarSessaoMutation.mutate()}>
                  <Smartphone />
                  Vincular número
                </Button>
                <ul className="mt-4 divide-y">
                  {(sessoesQuery.data ?? []).length === 0 && (
                    <li className="py-3 text-sm text-muted-foreground">Nenhum número vinculado ainda.</li>
                  )}
                  {(sessoesQuery.data ?? []).map((sessao) => (
                    <li key={sessao.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-semibold">
                          {sessao.telefone ?? 'número desconhecido'}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {sessaoBotLabels[sessao.status]}
                          {sessao.totalChats > 0 ? ` · ${sessao.totalChats} grupos` : ''}
                          {sessao.vinculadoPorNome ? ` · vinculado por ${sessao.vinculadoPorNome}` : ''}
                          {sessao.status === 'aguardando_qr' ? ` · QR em /sessao/${sessao.id}` : ''}
                        </span>
                      </span>
                      {sessao.status !== 'banido' && (
                        <span className="flex flex-wrap gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={sessaoStatusMutation.isPending}
                            onClick={() => sessaoStatusMutation.mutate({ id: sessao.id, status: 'banido' })}
                          >
                            Marcar banido
                          </Button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card data-tutorial="communication-targets">
              <CardHeader><CardTitle>Bairros do município</CardTitle></CardHeader>
              <CardContent>
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (novoBairro.trim().length >= 2) bairroSaveMutation.mutate(novoBairro.trim());
                  }}
                >
                  <Input
                    value={novoBairro}
                    onChange={(event) => setNovoBairro(event.target.value)}
                    placeholder="Nome do bairro"
                    minLength={2}
                    maxLength={80}
                    aria-label="Nome do bairro"
                  />
                  <Button type="submit" variant="outline" disabled={bairroSaveMutation.isPending}>Adicionar</Button>
                </form>
                <ul className="mt-4 divide-y">
                  {bairros.length === 0 && <li className="py-3 text-sm text-muted-foreground">Nenhum bairro cadastrado.</li>}
                  {bairros.map((bairro) => (
                    <li key={bairro.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0 break-all text-sm">
                        {bairro.nome}
                        {!bairro.ativo && <span className="ml-2 text-xs text-muted-foreground">(inativo)</span>}
                        {bairro.emUso && <span className="ml-2 text-xs text-muted-foreground">em uso</span>}
                      </span>
                      {!bairro.emUso && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Remover bairro ${bairro.nome}`}
                          disabled={bairroDeleteMutation.isPending}
                          onClick={() => bairroDeleteMutation.mutate(bairro.id)}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardHeader><CardTitle>Modo leitura</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Seu papel acompanha os comunicados publicados. A emissão é restrita a administradores municipais.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <Card data-tutorial="communication-history">
            <CardHeader><CardTitle>Publicados ({publicados.length})</CardTitle></CardHeader>
            <CardContent>
              {comunicadosQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
              {comunicadosQuery.isError && (
                <div className="space-y-3 text-sm text-destructive" role="alert">
                  <p>Não foi possível carregar os comunicados.</p>
                  <Button variant="outline" size="sm" onClick={() => void comunicadosQuery.refetch()}>Tentar novamente</Button>
                </div>
              )}
              {!comunicadosQuery.isLoading && publicados.length === 0 && (
                <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Nenhum comunicado publicado no momento.
                </p>
              )}
              <ul className="divide-y">
                {publicados.map((comunicado) => {
                  const enviosPorCanal = new Map(comunicado.envios.map((envio) => [envio.canalId, envio]));
                  return (
                    <li key={comunicado.id} className="py-4">
                      <button
                        type="button"
                        className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-expanded={expandedId === comunicado.id}
                        onClick={() => expand(comunicado)}
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          {!comunicado.lido && <Badge variant="info">Não lido</Badge>}
                          <Badge variant={severityBadgeVariant(comunicado.severidade)}>{comunicadoSeverityLabels[comunicado.severidade]}</Badge>
                          <span className="min-w-0 flex-1 break-words text-sm font-semibold">{comunicado.titulo}</span>
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {comunicadoDestinosLabel(comunicado.destinos)} · {formatDate(comunicado.publicadoEm) ?? formatDate(comunicado.criadoEm) ?? ''}
                          {comunicado.expiraEm ? ` · expira ${formatDate(comunicado.expiraEm)}` : ''}
                          {` · ${comunicado.totalLeituras} leitura${comunicado.totalLeituras === 1 ? '' : 's'}`}
                        </span>
                        {expandedId === comunicado.id && (
                          <span className="mt-3 block whitespace-pre-wrap break-words rounded-md bg-secondary/60 p-3 text-sm">
                            {comunicado.conteudo}
                          </span>
                        )}
                        {expandedId === comunicado.id && comunicado.lido && (
                          <span className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground"><Check className="h-3 w-3" />Lido</span>
                        )}
                      </button>
                      {mayManage && comunicado.podeEditar && expandedId === comunicado.id && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => statusMutation.mutate({ id: comunicado.id, status: 'arquivado' })}>
                            <Archive />
                            Arquivar
                          </Button>
                        </div>
                      )}
                      {mayManage && expandedId === comunicado.id && (
                        <div className="mt-4 rounded-md border bg-card p-3">
                          <p className="text-sm font-semibold">Replicar nas Comunidades WhatsApp</p>
                          {canaisAtivos.length === 0 ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Nenhuma comunidade ativa registrada. Cadastre na coluna ao lado após criar a comunidade no WhatsApp.
                            </p>
                          ) : (
                            <>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  disabled={botMutation.isPending}
                                  onClick={() => botMutation.mutate({ comunicadoId: comunicado.id })}
                                >
                                  <Bot />
                                  Disparar pelo bot
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => void copiarMensagem(comunicado)}>
                                  <Copy />
                                  Copiar mensagem
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(whatsappShareUrl(mensagemWhatsApp(comunicado, access?.organizationName ?? null)), '_blank', 'noopener')}
                                >
                                  <ExternalLink />
                                  Abrir WhatsApp
                                </Button>
                              </div>
                              <ul className="mt-3 divide-y">
                                {canaisAtivos.map((canal) => {
                                  const envio = enviosPorCanal.get(canal.id);
                                  return (
                                    <li key={canal.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-2">
                                      <span className="min-w-0 break-words text-sm">
                                        {canal.nome}
                                        {!canal.chatId && (
                                          <span className="ml-2 text-xs text-muted-foreground">(sem chat vinculado)</span>
                                        )}
                                      </span>
                                      <span className="flex flex-wrap items-center gap-2">
                                        {envio?.status === 'pendente' && <Badge variant="info">Na fila do bot</Badge>}
                                        {envio?.status === 'falhou' && (
                                          <span className="text-xs text-destructive" role="alert">Falhou: {envio.erro ?? 'erro desconhecido'}</span>
                                        )}
                                        {envio?.status === 'enviado' && (
                                          <span className="text-xs text-muted-foreground">
                                            Enviado {envio.origem === 'bot' ? 'pelo bot' : 'manualmente'} {formatDate(envio.enviadoEm) ?? ''}
                                            {envio.origem === 'manual' && envio.registradoPorNome ? ` por ${envio.registradoPorNome}` : ''}
                                          </span>
                                        )}
                                        {!envio && <Badge variant="warning">Pendente</Badge>}
                                        {canal.chatId && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={botMutation.isPending}
                                            onClick={() => botMutation.mutate({ comunicadoId: comunicado.id, canalId: canal.id })}
                                          >
                                            Enviar
                                          </Button>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          disabled={envioMutation.isPending}
                                          onClick={() => envioMutation.mutate({ canalId: canal.id, comunicadoId: comunicado.id })}
                                        >
                                          Marcar enviado
                                        </Button>
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                              <p className="mt-2 text-xs text-muted-foreground">
                                O bot envia sozinho nas comunidades com chat vinculado; o envio manual (copiar/abrir/colar)
                                continua disponível como contingência.
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {mayManage && agendados.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Agendados ({agendados.length})</CardTitle></CardHeader>
              <CardContent>
                <p className="mb-2 text-xs text-muted-foreground">
                  Publicam automaticamente na data marcada (app e portal).
                </p>
                <ul className="divide-y">
                  {agendados.map((comunicado) => (
                    <li key={comunicado.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3">
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge variant={statusBadgeVariant(comunicado.status)}>{comunicadoStatusLabels[comunicado.status]}</Badge>
                          <span className="min-w-0 flex-1 break-words text-sm font-semibold">{comunicado.titulo}</span>
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {formatDate(comunicado.publicarEm) ?? ''} · {comunicadoDestinosLabel(comunicado.destinos)}
                        </span>
                      </span>
                      <span className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => beginEdit(comunicado)}><Pencil />Editar</Button>
                        <Button size="sm" onClick={() => statusMutation.mutate({ id: comunicado.id, status: 'publicado' })}>
                          <Send />
                          Publicar agora
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: comunicado.id, status: 'rascunho' })}>
                          Cancelar
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {mayManage && rascunhos.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Rascunhos ({rascunhos.length})</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {rascunhos.map((comunicado) => (
                    <li key={comunicado.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3">
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-semibold">{comunicado.titulo}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {comunicadoDestinosLabel(comunicado.destinos)} · {formatDate(comunicado.criadoEm) ?? ''}
                        </span>
                      </span>
                      <span className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => beginEdit(comunicado)}><Pencil />Editar</Button>
                        <Button size="sm" onClick={() => statusMutation.mutate({ id: comunicado.id, status: 'publicado' })}>
                          <Send />
                          Publicar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" aria-label={`Excluir rascunho ${comunicado.titulo}`}><Trash2 /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir rascunho?</AlertDialogTitle>
                              <AlertDialogDescription>
                                "{comunicado.titulo}" será removido definitivamente. Publicados não podem ser excluídos, apenas arquivados.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Manter</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(comunicado.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {arquivados.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Arquivados ({arquivados.length})</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {arquivados.map((comunicado) => (
                    <li key={comunicado.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3">
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <Badge variant={statusBadgeVariant(comunicado.status)}>{comunicadoStatusLabels[comunicado.status]}</Badge>
                          <span className="min-w-0 flex-1 break-words text-sm font-semibold">{comunicado.titulo}</span>
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {formatDate(comunicado.publicadoEm) ?? formatDate(comunicado.criadoEm) ?? ''}
                        </span>
                      </span>
                      {mayManage && comunicado.podeEditar && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => statusMutation.mutate({ id: comunicado.id, status: 'publicado' })}
                        >
                          <Send />
                          Republicar
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
