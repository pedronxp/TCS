import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bot, CheckCircle2, Clock, Megaphone, Smartphone, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import {
  botQrUrl,
  criarSessaoBotConsole,
  definirStatusSessaoBotConsole,
  dispararBotConsole,
  fetchBotOnline,
  fetchBotSessaoStatus,
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

// Erros do pareamento traduzidos em orientação: o que aconteceu e o que fazer.
function explicarErroPareamento(erro: string | null): string {
  if (!erro) return '';
  const texto = erro.toLowerCase();
  if (texto.includes('não foi possível') || texto.includes('nao foi possivel') || texto.includes('auth_failure')) {
    return 'O celular recusou a conexão. Na ordem: atualize o aplicativo do WhatsApp; remova aparelhos antigos em "Aparelhos conectados" (limite de 4); troque Wi-Fi por 4G (ou o contrário); escaneie o próximo QR em até 20 segundos. Se o web.whatsapp.com em um navegador também recusar o mesmo celular, o problema está na conta/aparelho — não no bot.';
  }
  if (texto.includes('nao_encontrada') || texto.includes('não encontrada')) {
    return 'Esta sessão de pareamento expirou no bot. Clique em "Gerar QR" novamente para criar outra.';
  }
  if (texto.includes('sessão caiu') || texto.includes('sessao caiu')) {
    return 'A sessão caiu — se o número foi banido, marque-o como banido abaixo e vincule outro número.';
  }
  return `O bot reportou: ${erro}. Escaneie o próximo QR quando ele aparecer; se persistir, acione o time TCS com esta mensagem.`;
}

// Espaço de operação de UMA prefeitura: entregas com motivo e fallback,
// programados, números vinculados e comunidades com admins/membros.
export function ConsoleComunicadoOrgPage() {
  const { orgId } = useParams();
  const queryClient = useQueryClient();
  const [novaComunidade, setNovaComunidade] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pareamentoId, setPareamentoId] = useState<string | null>(null);
  const [qrTick, setQrTick] = useState(0);

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

  // Pareamento: painel consulta o bot diretamente (QR embutido + status ao vivo).
  const botOnlineQuery = useQuery({
    queryKey: ['console', 'bot', 'online'],
    queryFn: fetchBotOnline,
    enabled: pareamentoId !== null,
    refetchInterval: 15_000,
  });
  const botStatusQuery = useQuery({
    queryKey: ['console', 'bot', 'sessao', pareamentoId],
    queryFn: () => fetchBotSessaoStatus(pareamentoId as string),
    enabled: pareamentoId !== null,
    refetchInterval: 5_000,
  });
  const botStatus = botStatusQuery.data ?? null;
  const pareamentoConcluido = botStatus?.fase === 'vinculado';

  useEffect(() => {
    if (!pareamentoId || pareamentoConcluido) return undefined;
    const timer = setInterval(() => setQrTick((atual) => atual + 1), 5_000);
    return () => clearInterval(timer);
  }, [pareamentoId, pareamentoConcluido]);

  useEffect(() => {
    if (pareamentoConcluido && botStatus?.telefone) {
      setStatusMessage(`Número ${botStatus.telefone} vinculado — grupos sincronizados em instantes.`);
      void queryClient.invalidateQueries({ queryKey: ['console', 'comunicados'] });
    }
  }, [pareamentoConcluido, botStatus?.telefone, queryClient]);

  const sessaoCriarMutation = useMutation({
    mutationFn: criarSessaoBotConsole,
    onSuccess: async (sessaoId) => {
      setStatusMessage(null);
      setErrorMessage(null);
      setPareamentoId(sessaoId);
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

                {pareamentoId === null ? (
                  <Button size="sm" disabled={sessaoCriarMutation.isPending} onClick={() => orgId && sessaoCriarMutation.mutate(orgId)}>
                    <Smartphone />
                    Vincular número
                  </Button>
                ) : (
                  <div className="rounded-md border bg-card p-3" aria-label="Painel de vinculação de número">
                    <p className="text-sm font-semibold">Vincular número desta prefeitura</p>

                    <ul className="mt-2 space-y-1.5 text-xs">
                      <li className="flex items-start gap-2">
                        {botOnlineQuery.data === false
                          ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                          : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />}
                        <span>
                          <b>Bot WhatsApp ligado</b> —{' '}
                          {botOnlineQuery.isLoading
                            ? 'verificando…'
                            : botOnlineQuery.data === false
                              ? <>OFFLINE. Ligue o bot na máquina dele (<code>cd bot-whatsapp && npm start</code>) e esta verificação fica verde em segundos. Sem o bot, o QR não é gerado.</>
                              : 'online e pronto para gerar o QR.'}
                        </span>
                      </li>
                      <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /><span><b>WhatsApp atualizado</b> no celular (loja de aplicativos) — versão velha recusa aparelho novo.</span></li>
                      <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /><span><b>Celular do número da prefeitura em mãos</b> — quem escaneia assume o disparo desta prefeitura.</span></li>
                      <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /><span><b>Menos de 4 aparelhos conectados</b> — em "Aparelhos conectados", remova os antigos (limite da Meta).</span></li>
                    </ul>

                    {botOnlineQuery.data === false ? (
                      <p className="mt-3 rounded-md border border-warning/30 bg-warning-soft p-2 text-xs">
                        O bot está offline. Gere o QR somente depois de ligá-lo — do contrário a leitura não chega a lugar nenhum.
                      </p>
                    ) : pareamentoConcluido ? (
                      <div className="mt-3 rounded-md border border-success/25 bg-success-soft p-2 text-xs" role="status">
                        <p className="font-semibold">Número {botStatus?.telefone ?? ''} vinculado ✓</p>
                        <p className="mt-1">Os grupos que ele enxerga aparecem no campo "Chat do bot" das comunidades em instantes.</p>
                        <Button size="sm" variant="outline" className="mt-2" onClick={() => setPareamentoId(null)}>Concluir</Button>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-center rounded-md bg-white p-2">
                          <img
                            src={`${botQrUrl(pareamentoId)}?t=${qrTick}`}
                            alt="QR Code de vinculação do WhatsApp — escaneie em até 20 segundos"
                            className="h-56 w-56"
                          />
                        </div>
                        <p className="text-center text-xs text-muted-foreground">
                          WhatsApp → Aparelhos conectados → Conectar aparelho → escaneie <b>em até 20 segundos</b>.
                          O QR acima se renova sozinho a cada 5 segundos — espere trocar em vez de escanear um velho.
                        </p>
                        {botStatus?.ultimoErro && (
                          <p className="rounded-md border border-destructive/30 bg-destructive-soft p-2 text-xs text-destructive" role="alert">
                            {explicarErroPareamento(botStatus.ultimoErro)}
                          </p>
                        )}
                        <p className="text-center text-xs text-muted-foreground">Aguardando a leitura do QR…</p>
                        <div className="flex justify-center">
                          <Button size="sm" variant="ghost" onClick={() => setPareamentoId(null)}>Cancelar vinculação</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
