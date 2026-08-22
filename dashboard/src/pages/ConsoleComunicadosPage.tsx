import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Building2, Megaphone, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import {
  criarSessaoBotConsole,
  definirStatusSessaoBotConsole,
  dispararBotConsole,
  fetchComunicadosOrgConsole,
  fetchOrgsComunicadosConsole,
  salvarCanalConsole,
  vincularCanalChatConsole,
  comunicadoSeverityLabels,
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

export function ConsoleComunicadosPage() {
  const queryClient = useQueryClient();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [novaComunidade, setNovaComunidade] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const orgsQuery = useQuery({
    queryKey: ['console', 'comunicados', 'orgs'],
    queryFn: fetchOrgsComunicadosConsole,
  });
  const orgs = orgsQuery.data ?? [];
  const selectedOrgId = orgId ?? orgs[0]?.organizationId ?? null;

  const orgQuery = useQuery({
    queryKey: ['console', 'comunicados', 'org', selectedOrgId],
    queryFn: () => fetchComunicadosOrgConsole(selectedOrgId as string),
    enabled: Boolean(selectedOrgId),
    refetchInterval: 10_000,
  });
  const org = orgQuery.data ?? null;

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
    mutationFn: ({ nome }: { nome: string }) => salvarCanalConsole(selectedOrgId as string, nome),
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
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Operação TCS</p>
        <h1 className="mt-2 text-3xl font-semibold">Comunicados e comunidades</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Supervisão e operação por prefeitura: números do bot, comunidades WhatsApp e disparo com fallback.
        </p>
      </header>

      {statusMessage && <p className="rounded-md border border-success/25 bg-success-soft p-3 text-sm text-foreground" role="status">{statusMessage}</p>}
      {errorMessage && <p className="rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{errorMessage}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 /> Prefeituras</CardTitle>
        </CardHeader>
        <CardContent>
          {orgsQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {orgsQuery.isError && (
            <div className="space-y-3 text-sm text-destructive" role="alert">
              <p>Não foi possível carregar as prefeituras.</p>
              <Button variant="outline" size="sm" onClick={() => void orgsQuery.refetch()}>Tentar novamente</Button>
            </div>
          )}
          {!orgsQuery.isLoading && orgs.length === 0 && (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhuma organização encontrada.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {orgs.map((item) => (
              <button
                key={item.organizationId}
                type="button"
                aria-pressed={item.organizationId === selectedOrgId}
                className={`rounded-md border px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  item.organizationId === selectedOrgId ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-foreground'
                }`}
                onClick={() => setOrgId(item.organizationId)}
              >
                <span className="block font-semibold">{item.organizationName}</span>
                <span className={`block text-xs ${item.organizationId === selectedOrgId ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  {item.numerosVinculados} nº · {item.comunidadesAtivas} comunidades · {item.comunicadosPublicados} publicados
                  {item.enviosPendentes + item.enviosFalhas > 0 ? ` · ${item.enviosPendentes} na fila, ${item.enviosFalhas} falhas` : ''}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {org && (
        <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Smartphone /> Números do bot · {org.organization.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-muted-foreground">
                  O disparo tenta todos os vinculados que enxergam o chat (um cai, o outro envia).
                </p>
                <Button size="sm" disabled={sessaoCriarMutation.isPending} onClick={() => selectedOrgId && sessaoCriarMutation.mutate(selectedOrgId)}>
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
                <CardTitle className="flex items-center gap-2"><Megaphone /> Comunidades · {org.organization.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (novaComunidade.trim().length >= 3 && selectedOrgId) {
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
                  {org.canais.map((canal) => (
                    <li key={canal.id} className="py-2.5">
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 break-words text-sm font-semibold">
                          {canal.nome}
                          {!canal.ativo && <span className="ml-2 text-xs text-muted-foreground">(inativa)</span>}
                        </span>
                        {!canal.chatId && <Badge variant="warning">Sem chat</Badge>}
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
                          {org.chats.map((chat) => (
                            <option key={chat.chatId} value={chat.chatId}>
                              {chat.nome}{chat.sessaoTelefone ? ` (nº ${chat.sessaoTelefone})` : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Comunicados · {org.organization.name}</CardTitle></CardHeader>
            <CardContent>
              {orgQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
              {org.comunicados.length === 0 && !orgQuery.isLoading && (
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
                        {comunicado.status} · {formatDate(comunicado.publicadoEm) ?? formatDate(comunicado.publicarEm) ?? formatDate(comunicado.criadoEm) ?? ''}
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
        </section>
      )}
    </div>
  );
}
