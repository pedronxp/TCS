import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Check, Megaphone, Pencil, Send, Trash2 } from 'lucide-react';
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
import {
  comunicadoDestinosLabel,
  comunicadoSeverityLabels,
  comunicadoStatusLabels,
  deleteBairro,
  deleteComunicado,
  fetchBairros,
  fetchComunicados,
  registerComunicadoLeitura,
  saveBairro,
  saveComunicado,
  setComunicadoStatus,
  type Comunicado,
  type ComunicadoSeveridade,
} from '@/lib/comunicados';

interface DraftState {
  id?: string;
  titulo: string;
  conteudo: string;
  severidade: ComunicadoSeveridade;
  expiraEm: string;
  bairrosSelecionados: string[];
  todoMunicipio: boolean;
}

const emptyDraft: DraftState = {
  titulo: '',
  conteudo: '',
  severidade: 'informacao',
  expiraEm: '',
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
  if (status === 'rascunho') return 'outline' as const;
  return 'secondary' as const;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}

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

  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [editing, setEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [novoBairro, setNovoBairro] = useState('');

  const comunicados = comunicadosQuery.data ?? [];
  const bairros = bairrosQuery.data ?? [];
  const publicados = useMemo(() => comunicados.filter((item) => item.status === 'publicado'), [comunicados]);
  const rascunhos = useMemo(() => comunicados.filter((item) => item.status === 'rascunho'), [comunicados]);
  const arquivados = useMemo(() => comunicados.filter((item) => item.status === 'arquivado'), [comunicados]);

  const saveMutation = useMutation({
    mutationFn: saveComunicado,
    onSuccess: async (_id, variables) => {
      setDraft(emptyDraft);
      setEditing(false);
      setStatusMessage(variables.id ? 'Comunicado atualizado.' : 'Rascunho salvo.');
      await queryClient.invalidateQueries({ queryKey: ['portal', 'comunicados'] });
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'publicado' | 'arquivado' }) => setComunicadoStatus(id, status),
    onSuccess: async () => {
      setStatusMessage('Status atualizado.');
      await queryClient.invalidateQueries({ queryKey: ['portal', 'comunicados'] });
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteComunicado,
    onSuccess: async () => {
      setStatusMessage('Rascunho excluído.');
      await queryClient.invalidateQueries({ queryKey: ['portal', 'comunicados'] });
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });
  const leituraMutation = useMutation({
    mutationFn: registerComunicadoLeitura,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['portal', 'comunicados'] });
    },
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

  function beginEdit(comunicado: Comunicado) {
    setDraft({
      id: comunicado.id,
      titulo: comunicado.titulo,
      conteudo: comunicado.conteudo,
      severidade: comunicado.severidade,
      expiraEm: comunicado.expiraEm ? comunicado.expiraEm.slice(0, 10) : '',
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

  function submit(event: FormEvent, publish: boolean) {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    const id = saveMutation.mutateAsync({
      id: draft.id,
      titulo: draft.titulo.trim(),
      conteudo: draft.conteudo,
      severidade: draft.severidade,
      expiraEm: draft.expiraEm ? new Date(`${draft.expiraEm}T23:59:59`).toISOString() : null,
      destinos: draft.todoMunicipio || draft.bairrosSelecionados.length === 0
        ? [{ todoMunicipio: true }]
        : draft.bairrosSelecionados.map((bairroId) => ({ bairroId })),
    });
    void id.then(async (comunicadoId) => {
      if (publish) {
        try {
          await setComunicadoStatus(comunicadoId, 'publicado');
          setStatusMessage('Comunicado publicado para a equipe municipal.');
          await queryClient.invalidateQueries({ queryKey: ['portal', 'comunicados'] });
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : 'Não foi possível publicar.');
        }
      }
    });
  }

  function expand(comunicado: Comunicado) {
    setExpandedId((current) => (current === comunicado.id ? null : comunicado.id));
    if (expandedId !== comunicado.id && !comunicado.lido) {
      leituraMutation.mutate(comunicado.id);
    }
  }

  return (
    <div className="page-stack">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Comunicação municipal</p>
        <h1 className="mt-2 text-3xl font-semibold">Comunicados</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Avisos oficiais da prefeitura para a equipe, com destino por bairro ou para todo o município.
        </p>
      </header>

      {statusMessage && <p className="rounded-md border border-success/25 bg-success-soft p-3 text-sm text-foreground" role="status">{statusMessage}</p>}
      {errorMessage && <p className="rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{errorMessage}</p>}

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        {mayManage ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone />
                  {editing ? 'Editar rascunho' : 'Novo comunicado'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={(event) => submit(event, false)}>
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
                      className="mt-2 min-h-32"
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
                    <Button type="button" variant="outline" disabled={saveMutation.isPending} onClick={(event) => submit(event, true)}>
                      <Send />
                      Salvar e publicar
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
          <Card>
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
                {publicados.map((comunicado) => (
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
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

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
