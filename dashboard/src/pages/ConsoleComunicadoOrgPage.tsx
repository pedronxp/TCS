import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bot, CheckCircle2, Clock, Megaphone, Smartphone, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import {
  criarSessaoBotConsole,
  definirStatusSessaoBotConsole,
  dispararBotConsole,
  fetchComunicadosOrgConsole,
  salvarCanalConsole,
  vincularCanalChatConsole,
  comunicadoSeverityLabels,
  type ComunicadoEnvio,
  type SessaoBotStatus,
} from '@/lib/comunicados';

const sessaoLabels: Record<SessaoBotStatus, string> = {
  aguardando_qr: 'Emparelhando (QR aberto)',
  vinculado: 'Vinculado',
  desconectado: 'Desconectado',
  banido: 'Banido',
};

function formatDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}

// Espaço de operação de UMA prefeitura: entregas com motivo e fallback,
// programados, números vinculados e comunidades com admins/membros.
export function ConsoleComunicadoOrgPage() {
  const { orgId } = useParams();
  const queryClient = useQueryClient();
  const [novaComunidade, setNovaComunidade] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const orgQuery = useQuery({
    queryKey: ['console', 'comunicados', 'org', orgId],
    queryFn: () => fetchComunicadosOrgConsole(orgId as string),
    enabled: Boolean(orgId),
    refetchInterval: 10_000,
  });
  const org = orgQuery.data ?? null;

  const entregas = useMemo(() => {
    if (!org) return [] as Array<ComunicadoEnvio & { comunicadoTitulo: string }>;
    return org.comunicados
      .flatMap((comunicado) =>
        comunicado.envios.map((envio) => ({ ...envio, comunicadoTitulo: comunicado.titulo })),
      )
      .sort((a, b) => {
        const peso = (envio: ComunicadoEnvio) => (envio.status === 'pendente' ? 0 : 1);
        if (peso(a) !== peso(b)) return peso(a) - peso(b);
        return (b.enviadoEm ?? '').localeCompare(a.enviadoEm ?? '');
      });
  }, [org]);

  const programados = useMemo(
    () => (org ? org.comunicados.filter((comunicado) => comunicado.status === 'agendado') : []),
    [org],
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['console', 'comunicados'] });
  };

  const sessaoCriarMutation = useMutation({
    mutationFn: criarSessaoBotConsole,
    onSuccess: async (sessaoId) => {
      setStatusMessage(`QR aberto no bot: http://localhost:8787/sessao/${sessaoId} — escaneie com o celular da prefeitura.`);
      invalidate();
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });
  const sessaoStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'banido' | 'desconectado' }) => definirStatusSessaoBotConsole(id, status),
    onSuccess: async () => {
      setStatusMessage('Status do número atualizado.');
      invalidate();
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });
  const canalSalvarMutation = useMutation({
    mutationFn: ({ nome }: { nome: string }) => salvarCanalConsole(orgId as string, nome),
    onSuccess: async () => {
      setNovaComunidade('');
      setStatusMessage('Comunidade registrada.');
      invalidate();
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });
  const chatVincularMutation = useMutation({
    mutationFn: ({ canalId, chatId }: { canalId: string; chatId: string | null }) => vincularCanalChatConsole(canalId, chatId),
    onSuccess: async () => {
      setStatusMessage('Chat vinculado à comunidade.');
      invalidate();
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });
  const dispararMutation = useMutation({
    mutationFn: ({ comunicadoId }: { comunicadoId: string }) => dispararBotConsole(comunicadoId),
    onSuccess: async (total) => {
      setStatusMessage(total > 0
        ? `${total} disparo${total === 1 ? '' : 's'} na fila do bot.`
        : 'Nenhuma comunidade ativa com chat vinculado.');
      invalidate();
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });

  return (
    <div className="page-stack">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
          <Link to="/app/comunicacoes" className="inline-flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Comunicados e comunidades
          </Link>
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{org?.organization.name ?? 'Prefeitura'}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {org?.organization.municipality ?? ''} · Números do bot, comunidades, disparo com fallback e entregas.
        </p>
      </header>

      {statusMessage && <p className="rounded-md border border-success/25 bg-success-soft p-3 text-sm text-foreground" role="status">{statusMessage}</p>}
      {errorMessage && <p className="rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{errorMessage}</p>}

      {orgQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {orgQuery.isError && (
        <div className="space-y-3 text-sm text-destructive" role="alert">
          <p>Não foi possível carregar a prefeitura.</p>
          <Button variant="outline" size="sm" onClick={() => void orgQuery.refetch()}>Tentar novamente</Button>
        </div>
      )}

      {org && (
        <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Smartphone /> Números do bot</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-muted-foreground">
                  O disparo tenta todos os vinculados que enxergam o chat (um cai, o outro envia).
                </p>
                <Button size="sm" disabled={sessaoCriarMutation.isPending} onClick={() => orgId && sessaoCriarMutation.mutate(orgId)}>
                  <Smartphone />
                  Vincular número
                </Button>
                <ul className="mt-4 divide-y">
                  {org.sessoes.length === 0 && <li className="py-3 text-sm text-muted-foreground">Nenhum número vinculado.</li>}
                  {org.sessoes.map((sessao) => (
                    <li key={sessao.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-semibold">{sessao.telefone ?? 'número desconhecido'}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {sessaoLabels[sessao.status]}
                          {sessao.totalChats > 0 ? ` · ${sessao.totalChats} grupos` : ''}
                          {sessao.status === 'aguardando_qr' ? ` · QR em /sessao/${sessao.id}` : ''}
                          {sessao.vinculadoEm ? ` · desde ${formatDate(sessao.vinculadoEm)}` : ''}
                        </span>
                      </span>
                      {sessao.status !== 'banido' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={sessaoStatusMutation.isPending}
                          onClick={() => sessaoStatusMutation.mutate({ id: sessao.id, status: 'banido' })}
                        >
                          Marcar banido
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Megaphone /> Comunidades</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (novaComunidade.trim().length >= 3 && orgId) {
                      canalSalvarMutation.mutate({ nome: novaComunidade.trim() });
                    }
                  }}
                >
                  <Input
                    value={novaComunidade}
                    onChange={(event) => setNovaComunidade(event.target.value)}
                    placeholder="Nome da comunidade"
                    minLength={3}
                    maxLength={80}
                    aria-label="Nome da comunidade"
                  />
                  <Button type="submit" variant="outline" disabled={canalSalvarMutation.isPending}>Adicionar</Button>
                </form>
                <ul className="mt-4 divide-y">
                  {org.canais.length === 0 && <li className="py-3 text-sm text-muted-foreground">Nenhuma comunidade registrada.</li>}
                  {org.canais.map((canal) => {
                    const chat = org.chats.find((item) => item.chatId === canal.chatId);
                    return (
                      <li key={canal.id} className="py-2.5">
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0 break-words text-sm font-semibold">
                            {canal.nome}
                            {!canal.ativo && <span className="ml-2 text-xs text-muted-foreground">(inativa)</span>}
                          </span>
                          {chat
                            ? <Badge variant="success">{chat.totalAdmins} admin{chat.totalAdmins === 1 ? '' : 's'} · {chat.totalParticipantes} membros</Badge>
                            : <Badge variant="warning">Sem chat</Badge>}
                        </div>
                        <label className="mt-1 block text-xs text-muted-foreground">
                          Chat do bot
                          <select
                            className="mt-1 h-9 w-full rounded-md border bg-card px-2 text-xs"
                            value={canal.chatId ?? ''}
                            aria-label={`Chat vinculado à comunidade ${canal.nome}`}
                            onChange={(event) => chatVincularMutation.mutate({ canalId: canal.id, chatId: event.target.value || null })}
                          >
                            <option value="">
                              {org.chats.length === 0 ? 'Nenhum chat sincronizado' : 'Selecionar chat…'}
                            </option>
                            {org.chats.map((item) => (
                              <option key={item.chatId} value={item.chatId}>
                                {item.nome} (nº {item.sessaoTelefone ?? '—'} · {item.totalAdmins} admin{item.totalAdmins === 1 ? '' : 's'} · {item.totalParticipantes} membros)
                              </option>
                            ))}
                          </select>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {programados.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Clock /> Programados ({programados.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y">
                    {programados.map((comunicado) => (
                      <li key={comunicado.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-2.5">
                        <span className="min-w-0">
                          <span className="block break-words text-sm font-semibold">{comunicado.titulo}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Publica automaticamente em {formatDate(comunicado.publicarEm) ?? '—'} (app e portal)
                          </span>
                        </span>
                        <Badge variant="info">Agendado</Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {entregas.some((entrega) => entrega.status === 'falhou') ? <XCircle /> : <CheckCircle2 />}
                  Entregas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {entregas.length === 0 && (
                  <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Nenhum disparo ainda. Use "Disparar pelo bot" em um comunicado publicado.
                  </p>
                )}
                <ul className="divide-y">
                  {entregas.map((entrega) => (
                    <li key={`${entrega.canalId}-${entrega.comunicadoTitulo}`} className="py-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {entrega.status === 'enviado' && <Badge variant="success">Entregue</Badge>}
                        {entrega.status === 'pendente' && <Badge variant="info">Na fila do bot</Badge>}
                        {entrega.status === 'falhou' && <Badge variant="destructive">Falhou</Badge>}
                        <span className="min-w-0 flex-1 break-words text-sm font-semibold">{entrega.comunicadoTitulo}</span>
                        <span className="text-xs text-muted-foreground">→ {entrega.canalNome ?? 'comunidade'}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entrega.status === 'enviado'
                          ? `Enviado ${entrega.origem === 'bot' ? 'pelo bot' : 'manualmente'}${entrega.sessaoTelefone ? ` pelo número ${entrega.sessaoTelefone}` : ''} · ${formatDate(entrega.enviadoEm) ?? ''}`
                          : entrega.status === 'pendente'
                            ? 'Aguardando o bot consumir a fila (segundos).'
                            : `Motivo: ${entrega.erro ?? 'erro desconhecido'}`}
                      </p>
                      {(entrega.tentativas?.length ?? 0) > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground" aria-label="Trilha de fallback">
                          Fallback: {entrega.tentativas.map((tentativa) => `${tentativa.telefone} (${tentativa.erro})`).join(' → ')}
                          {entrega.status === 'enviado' && entrega.sessaoTelefone
                            ? ` → ${entrega.sessaoTelefone} enviou ✓`
                            : ''}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Comunicados</CardTitle></CardHeader>
              <CardContent>
                {org.comunicados.length === 0 && (
                  <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Nenhum comunicado emitido por esta prefeitura.
                  </p>
                )}
                <ul className="divide-y">
                  {org.comunicados.map((comunicado) => {
                    const enviosPorCanal = new Map(comunicado.envios.map((envio) => [envio.canalId, envio]));
                    const publicavel = comunicado.status === 'publicado' || comunicado.status === 'arquivado';
                    return (
                      <li key={comunicado.id} className="py-4">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <Badge variant={comunicado.severidade === 'emergencia' ? 'destructive' : comunicado.severidade === 'alerta' ? 'warning' : 'info'}>
                            {comunicadoSeverityLabels[comunicado.severidade]}
                          </Badge>
                          <span className="min-w-0 flex-1 break-words text-sm font-semibold">{comunicado.titulo}</span>
                          {publicavel && (
                            <Button
                              size="sm"
                              disabled={dispararMutation.isPending}
                              onClick={() => dispararMutation.mutate({ comunicadoId: comunicado.id })}
                            >
                              <Bot />
                              Disparar pelo bot
                            </Button>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {comunicado.status === 'agendado'
                            ? `Agendado para ${formatDate(comunicado.publicarEm) ?? '—'}`
                            : `${comunicado.status} · ${formatDate(comunicado.publicadoEm) ?? formatDate(comunicado.criadoEm) ?? ''}`}
                        </p>
                        {comunicado.envios.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {[...enviosPorCanal.values()].map((envio) => (
                              <li key={`${comunicado.id}-${envio.canalId}`} className="text-xs text-muted-foreground">
                                {envio.canalNome ?? 'Comunidade'}: {envio.status === 'enviado'
                                  ? `enviado ${envio.origem === 'bot' ? 'pelo bot' : 'manualmente'} ${formatDate(envio.enviadoEm) ?? ''}`
                                  : envio.status === 'pendente'
                                    ? 'na fila do bot'
                                    : `falhou — ${envio.erro ?? 'erro desconhecido'}`}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </div>
  );
}
