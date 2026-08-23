import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bot, CheckCircle2, Clock, Megaphone, Smartphone, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import {
  botQrUrl,
  criarGrupoPeloBot,
  criarSessaoBotConsole,
  definirStatusComunicadoConsole,
  definirStatusSessaoBotConsole,
  dispararBotConsole,
  fetchBotOnline,
  fetchBotSessaoStatus,
  fetchBotVerificacao,
  fetchComunicadosOrgConsole,
  mascararTelefone,
  salvarCanalConsole,
  salvarComunicadoConsole,
  sincronizarChatsBot,
  vincularCanalChatConsole,
  comunicadoSeverityLabels,
  type ComunicadoEnvio,
  type ComunicadoSeveridade,
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
  const [qrTick, setQrTick] = useState(0);
  // Assistente de vinculação: qr -> verificando (sem falso positivo) -> comunidade -> pronto.
  const [wizard, setWizard] = useState<{ etapa: 'qr' | 'verificando' | 'comunidade' | 'pronto'; sessaoId: string } | null>(null);
  const [nomeComunidadeManual, setNomeComunidadeManual] = useState('');
  const [chatManual, setChatManual] = useState('');
  const [rascunho, setRascunho] = useState<{ titulo: string; conteudo: string; severidade: ComunicadoSeveridade; publicarEm: string }>({
    titulo: '',
    conteudo: '',
    severidade: 'informacao',
    publicarEm: '',
  });
  const [comunidadeDestino, setComunidadeDestino] = useState('');
  const [destinoCanal, setDestinoCanal] = useState('');
  const [enviarAposPublicar, setEnviarAposPublicar] = useState(true);

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

  // Verificação PRÉVIA: o bot é checado antes de liberar a vinculação.
  const botOnlineQuery = useQuery({
    queryKey: ['console', 'bot', 'online'],
    queryFn: fetchBotOnline,
    refetchInterval: 15_000,
  });
  const botOnline = botOnlineQuery.data !== false;

  const wizardAberto = wizard !== null;
  const botStatusQuery = useQuery({
    queryKey: ['console', 'bot', 'sessao', wizard?.sessaoId],
    queryFn: () => fetchBotSessaoStatus(wizard?.sessaoId as string),
    enabled: wizardAberto && wizard?.etapa === 'qr',
    refetchInterval: 5_000,
  });
  const botStatus = botStatusQuery.data ?? null;

  // Etapa de verificação sem falso positivo: pergunta ao WhatsApp via /verify.
  const verificacaoQuery = useQuery({
    queryKey: ['console', 'bot', 'verificacao', wizard?.sessaoId],
    queryFn: () => fetchBotVerificacao(wizard?.sessaoId as string),
    enabled: wizardAberto && wizard?.etapa === 'verificando',
    refetchInterval: 3_000,
  });
  const verificacao = verificacaoQuery.data ?? null;

  const comunidadeAtiva = useMemo(
    () => (org ? org.canais.find((canal) => canal.ativo && canal.chatId) ?? null : null),
    [org],
  );

  // Comunidades reais detectadas pelo bot (grupos com pai no protocolo).
  const comunidades = useMemo(() => {
    if (!org) return [] as Array<{ id: string; nome: string }>;
    const mapa = new Map<string, string>();
    for (const chat of org.chats) {
      if (chat.comunidadeId && chat.comunidadeNome) mapa.set(chat.comunidadeId, chat.comunidadeNome);
    }
    return [...mapa.entries()].map(([id, nome]) => ({ id, nome }));
  }, [org]);

  const chatsPorComunidade = useMemo(() => {
    const dentro = new Map<string, NonNullable<typeof org>['chats']>();
    const avulsos: Array<NonNullable<typeof org>['chats'][number]> = [];
    for (const chat of org?.chats ?? []) {
      if (chat.comunidadeId) {
        const atual = dentro.get(chat.comunidadeId) ?? [];
        atual.push(chat);
        dentro.set(chat.comunidadeId, atual);
      } else {
        avulsos.push(chat);
      }
    }
    return { dentro, avulsos };
  }, [org]);

  useEffect(() => {
    if (!wizard) return;
    if (wizard.etapa === 'qr' && botStatus?.fase === 'vinculado') {
      setWizard({ ...wizard, etapa: 'verificando' });
    }
  }, [wizard, botStatus?.fase]);

  useEffect(() => {
    if (!wizard) return;
    if (wizard.etapa === 'verificando' && verificacao?.conectado && verificacao.telefone) {
      setStatusMessage(`Conexão confirmada com o WhatsApp: número ${mascararTelefone(verificacao.telefone)} enxerga ${verificacao.totalChats} conversas.`);
      void queryClient.invalidateQueries({ queryKey: ['console', 'comunicados'] });
      setWizard({ ...wizard, etapa: 'comunidade' });
    }
  }, [wizard, verificacao?.conectado, verificacao?.telefone, verificacao?.totalChats, queryClient]);

  useEffect(() => {
    if (!wizard) return;
    if (wizard.etapa === 'comunidade' && comunidadeAtiva) {
      setWizard({ ...wizard, etapa: 'pronto' });
    }
  }, [wizard, comunidadeAtiva]);

  useEffect(() => {
    if (!wizard || wizard.etapa !== 'qr') return undefined;
    const timer = setInterval(() => setQrTick((atual) => atual + 1), 5_000);
    return () => clearInterval(timer);
  }, [wizard]);

  const sessaoCriarMutation = useMutation({
    mutationFn: criarSessaoBotConsole,
    onSuccess: async (sessaoId) => {
      setStatusMessage(null);
      setErrorMessage(null);
      setWizard({ etapa: 'qr', sessaoId });
      invalidate();
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });

  // Criação via web: grupo criado pelo bot — dentro da Comunidade quando o
  // protocolo suporta; senão o bot devolve orientação para criar no celular.
  const criarGrupoMutation = useMutation({
    mutationFn: async () => {
      const nome = `Comunicados ${org?.organization.name ?? ''}`.trim().slice(0, 80);
      const chatId = await criarGrupoPeloBot(wizard?.sessaoId as string, nome, comunidadeDestino || null);
      const canalId = await salvarCanalConsole(orgId as string, nome);
      if (chatId) await vincularCanalChatConsole(canalId, chatId);
    },
    onSuccess: async () => {
      setStatusMessage('Grupo criado pelo bot e vinculado como comunidade.');
      await invalidate();
      if (wizard) setWizard({ ...wizard, etapa: 'pronto' });
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });

  const sincronizarMutation = useMutation({
    mutationFn: () => sincronizarChatsBot(wizard?.sessaoId as string),
    onSuccess: async (ok) => {
      setStatusMessage(ok ? 'Grupos sincronizados — escolha o chat da sua comunidade abaixo.' : 'Não consegui sincronizar agora; o bot sincroniza sozinho a cada 10 minutos.');
      await invalidate();
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });

  const vincularManualMutation = useMutation({
    mutationFn: async () => {
      const canalId = await salvarCanalConsole(orgId as string, nomeComunidadeManual.trim());
      await vincularCanalChatConsole(canalId, chatManual || null);
    },
    onSuccess: async () => {
      setStatusMessage('Comunidade cadastrada e chat vinculado.');
      setNomeComunidadeManual('');
      setChatManual('');
      await invalidate();
      if (wizard) setWizard({ ...wizard, etapa: 'pronto' });
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });

  async function enviarMensagem(modo: 'rascunho' | 'publicar' | 'agendar') {
    if (!orgId) return;
    setErrorMessage(null);
    setStatusMessage(null);
    const publicarIso = modo === 'agendar' && rascunho.publicarEm
      ? new Date(rascunho.publicarEm).toISOString()
      : null;
    if (modo === 'agendar' && (!rascunho.publicarEm || new Date(rascunho.publicarEm).getTime() <= Date.now())) {
      setErrorMessage('Escolha uma data e hora futura para agendar.');
      return;
    }
    try {
      const comunicadoId = await salvarComunicadoConsole({
        organizationId: orgId,
        titulo: rascunho.titulo.trim(),
        conteudo: rascunho.conteudo,
        severidade: rascunho.severidade,
        publicarEm: publicarIso,
      });
      if (modo === 'publicar') {
        await definirStatusComunicadoConsole(comunicadoId, 'publicado');
        let extras = 'Mensagem publicada no app e portal.';
        if (enviarAposPublicar) {
          try {
            const total = await dispararBotConsole(comunicadoId, destinoCanal || undefined);
            extras += total > 0
              ? ` ${total} disparo${total === 1 ? '' : 's'} na fila do bot.`
              : ' Nenhuma comunidade ativa com chat vinculado para o WhatsApp.';
          } catch (erroDisparo) {
            extras += ` Disparo não entrou na fila: ${erroDisparo instanceof Error ? erroDisparo.message : 'erro desconhecido'}.`;
          }
        }
        setStatusMessage(extras);
      } else if (modo === 'agendar') {
        await definirStatusComunicadoConsole(comunicadoId, 'agendado', publicarIso);
        setStatusMessage(`Mensagem agendada para ${formatDate(publicarIso) ?? 'a data informada'}.`);
      } else {
        setStatusMessage('Rascunho salvo.');
      }
      setRascunho({ titulo: '', conteudo: '', severidade: 'informacao', publicarEm: '' });
      await invalidate();
    } catch (erro) {
      setErrorMessage(erro instanceof Error ? erro.message : 'Não foi possível salvar a mensagem.');
    }
  }
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
        <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Smartphone /> Números do bot</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-muted-foreground">
                  O disparo tenta todos os vinculados que enxergam o chat (um cai, o outro envia).
                </p>

                {wizard === null ? (
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                      {botOnlineQuery.isLoading ? (
                        <Badge variant="info">Verificando o bot…</Badge>
                      ) : botOnline ? (
                        <Badge variant="success">Bot online</Badge>
                      ) : (
                        <Badge variant="destructive">Bot offline</Badge>
                      )}
                      {!botOnline && (
                        <span className="text-muted-foreground">
                          Ligue o bot na máquina dele (<code>cd bot-whatsapp && npm start</code>) — a verificação refaz sozinha.
                        </span>
                      )}
                    </div>
                    <Button size="sm" disabled={sessaoCriarMutation.isPending || !botOnline} onClick={() => orgId && sessaoCriarMutation.mutate(orgId)}>
                      <Smartphone />
                      Vincular número
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border bg-card p-3" aria-label="Assistente de vinculação de número">
                    <p className="text-sm font-semibold">
                      Assistente de vinculação — etapa {wizard.etapa === 'qr' ? '1 de 3: ler o QR' : wizard.etapa === 'verificando' ? '2 de 3: confirmar conexão' : wizard.etapa === 'comunidade' ? '3 de 3: comunidade' : 'concluído'}
                    </p>

                    {wizard.etapa === 'qr' && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-center rounded-md bg-white p-2">
                          <img
                            src={`${botQrUrl(wizard.sessaoId)}?t=${qrTick}`}
                            alt="QR Code de vinculação do WhatsApp — escaneie em até 20 segundos"
                            className="h-56 w-56"
                          />
                        </div>
                        <p className="text-center text-xs text-muted-foreground">
                          WhatsApp → Aparelhos conectados → Conectar aparelho → escaneie <b>em até 20 segundos</b>.
                          O QR se renova a cada 5 segundos — espere trocar em vez de escanear um velho.
                          Antes: WhatsApp atualizado, celular da prefeitura em mãos e menos de 4 aparelhos conectados.
                        </p>
                        {botStatus?.ultimoErro && (
                          <p className="rounded-md border border-destructive/30 bg-destructive-soft p-2 text-xs text-destructive" role="alert">
                            {explicarErroPareamento(botStatus.ultimoErro)}
                          </p>
                        )}
                        <p className="text-center text-xs text-muted-foreground">Aguardando a leitura do QR…</p>
                        <div className="flex justify-center">
                          <Button size="sm" variant="ghost" onClick={() => setWizard(null)}>Cancelar</Button>
                        </div>
                      </div>
                    )}

                    {wizard.etapa === 'verificando' && (
                      <div className="mt-3 space-y-2 text-xs">
                        <p className="text-muted-foreground">
                          {verificacao
                            ? verificacao.conectado
                              ? 'Conexão confirmada…'
                              : `Confirmando com o WhatsApp (estado atual: ${verificacao.estado ?? '—'})… só avançamos com confirmação real, sem falso positivo.`
                            : 'Confirmando a conexão direto com o WhatsApp…'}
                        </p>
                        {verificacao?.motivo && (
                          <p className="rounded-md border border-destructive/30 bg-destructive-soft p-2 text-destructive" role="alert">
                            {verificacao.motivo}
                          </p>
                        )}
                      </div>
                    )}

                    {wizard.etapa === 'comunidade' && !comunidadeAtiva && (
                      <div className="mt-3 space-y-3 text-xs">
                        <p className="text-muted-foreground">
                          Nenhuma comunidade ativa com chat vinculado. Escolha como criar a que recebe os avisos:
                        </p>
                        <div className="rounded-md border p-2">
                          <p className="font-semibold">Opção A — criar pela web agora (grupo de avisos)</p>
                          <p className="mt-1 text-muted-foreground">
                            O bot cria o grupo <b>“Comunicados {org?.organization.name}”</b>, o número vinculado fica admin dele e já cadastramos como comunidade pronta para disparar.
                            {comunidades.length > 0 && ' Quando a Comunidade suportar, o grupo nasce dentro dela.'}
                          </p>
                          {comunidades.length > 0 && (
                            <label className="mt-2 block text-xs text-muted-foreground">
                              Criar dentro da comunidade
                              <select
                                className="mt-1 h-9 w-full rounded-md border bg-card px-2 text-xs"
                                value={comunidadeDestino}
                                onChange={(event) => setComunidadeDestino(event.target.value)}
                                aria-label="Comunidade de destino do novo grupo"
                              >
                                <option value="">Grupo avulso (fora de comunidade)</option>
                                {comunidades.map((comunidade) => (
                                  <option key={comunidade.id} value={comunidade.id}>{comunidade.nome}</option>
                                ))}
                              </select>
                            </label>
                          )}
                          <Button size="sm" className="mt-2" disabled={criarGrupoMutation.isPending} onClick={() => criarGrupoMutation.mutate()}>
                            <Smartphone />
                            Criar grupo de avisos pelo bot
                          </Button>
                        </div>
                        <div className="rounded-md border p-2">
                          <p className="font-semibold">Opção B — criar a Comunidade no seu celular</p>
                          <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-muted-foreground">
                            <li>No WhatsApp, abra a aba <b>Comunidades</b> → <b>Nova comunidade</b>.</li>
                            <li>Dê o nome da prefeitura e adicione o grupo de anúncios.</li>
                            <li>Adicione o número vinculado como <b>admin</b> da comunidade (ele é quem dispara).</li>
                          </ol>
                          <Button size="sm" variant="outline" className="mt-2" disabled={sincronizarMutation.isPending} onClick={() => sincronizarMutation.mutate()}>
                            Já criei — sincronizar agora
                          </Button>
                          {org && org.chats.length > 0 && (
                            <form
                              className="mt-2 space-y-2"
                              onSubmit={(event) => {
                                event.preventDefault();
                                if (nomeComunidadeManual.trim().length >= 3 && chatManual) {
                                  vincularManualMutation.mutate();
                                }
                              }}
                            >
                              <Input
                                value={nomeComunidadeManual}
                                onChange={(event) => setNomeComunidadeManual(event.target.value)}
                                placeholder="Nome da comunidade no painel"
                                minLength={3}
                                maxLength={80}
                                aria-label="Nome da comunidade no painel"
                              />
                              <select
                                className="h-9 w-full rounded-md border bg-card px-2 text-xs"
                                value={chatManual}
                                onChange={(event) => setChatManual(event.target.value)}
                                aria-label="Chat da comunidade criada no celular"
                              >
                                <option value="">Selecionar o grupo de anúncios da comunidade…</option>
                                {comunidades.map((comunidade) => (
                                  <optgroup key={comunidade.id} label={`Comunidade: ${comunidade.nome}`}>
                                    {(chatsPorComunidade.dentro.get(comunidade.id) ?? []).map((item) => (
                                      <option key={item.chatId} value={item.chatId}>{item.nome}</option>
                                    ))}
                                  </optgroup>
                                ))}
                                {chatsPorComunidade.avulsos.length > 0 && (
                                  <optgroup label="Grupos avulsos">
                                    {chatsPorComunidade.avulsos.map((item) => (
                                      <option key={item.chatId} value={item.chatId}>{item.nome}</option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                              <Button type="submit" size="sm" disabled={vincularManualMutation.isPending || !chatManual || nomeComunidadeManual.trim().length < 3}>
                                Cadastrar e vincular
                              </Button>
                            </form>
                          )}
                        </div>
                      </div>
                    )}

                    {wizard.etapa === 'pronto' && (
                      <div className="mt-3 space-y-2 rounded-md border border-success/25 bg-success-soft p-2 text-xs" role="status">
                        <p className="font-semibold">Tudo pronto ✓</p>
                        <p>Número {mascararTelefone(verificacao?.telefone ?? org?.sessoes.find((s) => s.id === wizard.sessaoId)?.telefone)} conectado e comunidade {comunidadeAtiva?.nome ?? 'ativa'} vinculada — o disparo pelo bot já pode ser usado nos comunicados publicados.</p>
                        <Button size="sm" variant="outline" onClick={() => setWizard(null)}>Concluir</Button>
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
                          {comunidades.map((comunidade) => (
                            <optgroup key={comunidade.id} label={`Comunidade: ${comunidade.nome}`}>
                              {(chatsPorComunidade.dentro.get(comunidade.id) ?? []).map((item) => (
                                <option key={item.chatId} value={item.chatId}>
                                  {item.nome} ({item.totalAdmins} admin{item.totalAdmins === 1 ? '' : 's'} · {item.totalParticipantes} membros)
                                </option>
                              ))}
                            </optgroup>
                          ))}
                          {chatsPorComunidade.avulsos.length > 0 && (
                            <optgroup label="Grupos avulsos">
                              {chatsPorComunidade.avulsos.map((item) => (
                                <option key={item.chatId} value={item.chatId}>
                                  {item.nome} ({item.totalAdmins} admin{item.totalAdmins === 1 ? '' : 's'} · {item.totalParticipantes} membros)
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </label>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Megaphone /> Nova mensagem</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void enviarMensagem('rascunho'); }}>
                  <label className="block text-sm font-medium">
                    Título
                    <Input
                      className="mt-1.5"
                      value={rascunho.titulo}
                      onChange={(event) => setRascunho((atual) => ({ ...atual, titulo: event.target.value }))}
                      minLength={3}
                      maxLength={120}
                      required
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Mensagem
                    <Textarea
                      className="mt-1.5 min-h-28"
                      value={rascunho.conteudo}
                      onChange={(event) => setRascunho((atual) => ({ ...atual, conteudo: event.target.value }))}
                      maxLength={5000}
                      required
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Tipo de mensagem
                    <select
                      className="mt-1.5 h-11 w-full rounded-md border bg-card px-3 text-sm"
                      value={rascunho.severidade}
                      onChange={(event) => setRascunho((atual) => ({ ...atual, severidade: event.target.value as ComunicadoSeveridade }))}
                    >
                      <option value="informacao">Informação — avisos gerais</option>
                      <option value="alerta">Alerta — atenção preventiva</option>
                      <option value="emergencia">Emergência — risco imediato</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium">
                    Agendar para (opcional)
                    <Input
                      className="mt-1.5"
                      type="datetime-local"
                      value={rascunho.publicarEm}
                      onChange={(event) => setRascunho((atual) => ({ ...atual, publicarEm: event.target.value }))}
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Destino no WhatsApp
                    <select
                      className="mt-1.5 h-11 w-full rounded-md border bg-card px-3 text-sm"
                      value={destinoCanal}
                      onChange={(event) => setDestinoCanal(event.target.value)}
                      aria-label="Comunidade ou grupo de destino no WhatsApp"
                    >
                      <option value="">
                        Todas as comunidades ativas ({org.canais.filter((canal) => canal.ativo && canal.chatId).length})
                      </option>
                      {org.canais.filter((canal) => canal.ativo && canal.chatId).map((canal) => {
                        const chat = org.chats.find((item) => item.chatId === canal.chatId);
                        return (
                          <option key={canal.id} value={canal.id}>
                            {canal.nome}{chat?.comunidadeNome ? ` · Comunidade: ${chat.comunidadeNome}` : ''}{chat ? ` (grupo: ${chat.nome})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  {org.canais.filter((canal) => canal.ativo && canal.chatId).length === 0 && (
                    <p className="text-xs text-warning">
                      Nenhuma comunidade com chat vinculado: a mensagem sai no app/portal; vincule a comunidade no cartão ao lado para o WhatsApp.
                    </p>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={enviarAposPublicar}
                      onChange={(event) => setEnviarAposPublicar(event.target.checked)}
                    />
                    Disparar pelo bot ao publicar
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" variant="outline">Salvar rascunho</Button>
                    <Button type="button" onClick={() => void enviarMensagem('publicar')}>Publicar agora</Button>
                    <Button type="button" variant="outline" onClick={() => void enviarMensagem('agendar')}>Agendar</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No app e portal a mensagem vai para todo o município; no WhatsApp, para o destino escolhido acima.
                  </p>
                </form>
              </CardContent>
            </Card>

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
