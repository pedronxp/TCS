import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, ChevronRight, Clock, LogOut, Megaphone, Power, RefreshCw, Smartphone, Unplug, Users, Wifi, WifiOff, XCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/AlertDialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { GuidedTutorial } from '@/components/tutorial/GuidedTutorial';
import {
  botQrUrl,
  criarGrupoPeloBot,
  criarSessaoBotConsole,
  definirStatusComunicadoConsole,
  dispararBotConsole,
  fetchBotOnline,
  fetchBotSessaoStatus,
  fetchBotVerificacao,
  fetchComunicadosOrgConsole,
  mascararTelefone,
  operarSessaoBotConsole,
  salvarCanalConsole,
  salvarComunicadoConsole,
  sincronizarChatsBot,
  vincularCanalChatConsole,
  comunicadoSeverityLabels,
  type ComunicadoEnvio,
  type ComunicadoSeveridade,
  type SessaoBotStatus,
  type SessaoBotAcao,
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
export function ConsoleComunicadoOrgPage({
  backTo = '/app/comunicacoes',
  backLabel = 'Comunicados e comunidades',
  mode = 'communications',
}: {
  backTo?: string;
  backLabel?: string;
  mode?: 'communications' | 'whatsapp';
} = {}) {
  const { orgId } = useParams();
  const isWhatsAppMode = mode === 'whatsapp';
  const queryClient = useQueryClient();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [acaoSessao, setAcaoSessao] = useState<{ id: string; acao: SessaoBotAcao; telefone: string } | null>(null);
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
    const avulsosAprovados = new Set((org?.canais ?? []).map((canal) => canal.chatId).filter(Boolean));
    for (const chat of org?.chats ?? []) {
      if (chat.comunidadeId) {
        const atual = dentro.get(chat.comunidadeId) ?? [];
        atual.push(chat);
        dentro.set(chat.comunidadeId, atual);
      } else {
        if (avulsosAprovados.has(chat.chatId)) avulsos.push(chat);
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
    mutationFn: ({ id, acao }: { id: string; acao: SessaoBotAcao }) => operarSessaoBotConsole(id, acao),
    onSuccess: async (_, variables) => {
      const mensagens: Record<SessaoBotAcao, string> = {
        desconectar: 'Número desconectado. O vínculo foi preservado para uma retomada rápida.',
        reconectar: 'Reconexão solicitada. O status será atualizado automaticamente.',
        sair: 'Saída do WhatsApp solicitada. As credenciais deste número serão removidas com segurança.',
        banir: 'Número marcado como banido e removido do fallback de envio.',
      };
      setStatusMessage(mensagens[variables.acao]);
      setAcaoSessao(null);
      invalidate();
    },
    onError: (error: Error) => setErrorMessage(error.message),
  });
  return (
    <div className="communications-compact page-stack mx-auto max-w-[1220px]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            <Link to={backTo} className="inline-flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> {backLabel}
            </Link>
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{org?.organization.name ?? 'Prefeitura'}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {org?.organization.municipality ?? ''} · {isWhatsAppMode
              ? 'Números conectados, comunidades, grupos por bairro e entregas.'
              : 'Conteúdo oficial, alcance territorial, agendamentos e histórico.'}
          </p>
        </div>
        <GuidedTutorial
          workspace="internal"
          organizationId={orgId ?? null}
          tutorialKey={isWhatsAppMode ? 'console-whatsapp-operations' : 'console-defesa-civil-comunicados'}
          title={isWhatsAppMode ? 'Monitoramento do WhatsApp' : 'Comunicados da Defesa Civil'}
          description={isWhatsAppMode ? 'Confira números, Comunidades, grupos por bairro e falhas da organização.' : 'Prepare e acompanhe alertas oficiais sem misturar a configuração do canal.'}
          steps={isWhatsAppMode ? [
            { title: 'Números e conexão', description: 'Acompanhe a conexão e inicie a recuperação quando necessário.', target: 'console-whatsapp-sessions' },
            { title: 'Comunidades e bairros', description: 'Confira a hierarquia sincronizada e os grupos destinados a cada bairro.', target: 'console-whatsapp-communities' },
            { title: 'Entregas', description: 'Monitore fila, falhas e envios incertos sem repetir automaticamente.', target: 'console-whatsapp-deliveries' },
          ] : [
            { title: 'Nova mensagem', description: 'Crie o conteúdo, defina a severidade e revise os destinos.', target: 'console-communication-composer' },
            { title: 'Programados', description: 'Acompanhe mensagens agendadas antes da publicação.', target: 'console-communication-scheduled' },
            { title: 'Histórico', description: 'Revise comunicados publicados e mantenha a trilha editorial da organização.', target: 'console-communication-history' },
          ]}
        />
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
        <section className={isWhatsAppMode ? 'grid items-start gap-4 2xl:grid-cols-[minmax(0,1.05fr)_minmax(400px,0.95fr)]' : 'grid gap-4'}>
          {isWhatsAppMode && <div className="space-y-6">
            <Card data-tutorial="console-whatsapp-sessions" className="overflow-hidden">
              <CardHeader className="border-b bg-secondary/20 pb-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Smartphone /> Números do bot</CardTitle>
                    <p className="mt-1.5 text-sm text-muted-foreground">Conexões oficiais usadas no envio e na contingência.</p>
                  </div>
                  {botOnlineQuery.isLoading ? (
                    <Badge variant="info">Verificando serviço…</Badge>
                  ) : botOnline ? (
                    <Badge variant="success" className="gap-1.5"><Wifi className="h-3.5 w-3.5" /> Serviço online</Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1.5"><WifiOff className="h-3.5 w-3.5" /> Serviço indisponível</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-5 sm:p-6">
                <p className="mb-5 text-sm leading-6 text-muted-foreground">
                  O disparo usa todos os números online que enxergam o grupo. Se um perder a conexão, o próximo assume o envio.
                </p>

                {wizard === null ? (
                  <div>
                    {!botOnline && (
                      <p className="mb-4 rounded-lg border border-warning/25 bg-warning-soft p-3 text-sm text-warning-foreground">
                        O serviço hospedado está temporariamente indisponível. Os envios permanecem protegidos na fila e serão retomados após a reconexão.
                      </p>
                    )}
                    <Button disabled={sessaoCriarMutation.isPending || !botOnline} onClick={() => orgId && sessaoCriarMutation.mutate(orgId)}>
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

                <ul className="mt-6 space-y-3">
                  {org.sessoes.length === 0 && <li className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Nenhum número vinculado.</li>}
                  {org.sessoes.map((sessao) => (
                    <li key={sessao.id} className="rounded-xl border bg-card p-4">
                      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block break-words text-sm font-semibold">{sessao.telefone ?? 'Número ainda não identificado'}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {sessao.totalChats} grupo{sessao.totalChats === 1 ? '' : 's'} sincronizado{sessao.totalChats === 1 ? '' : 's'}
                          </span>
                        </span>
                        <Badge variant={sessao.status === 'vinculado' ? 'success' : sessao.status === 'aguardando_qr' ? 'info' : sessao.status === 'banido' ? 'destructive' : 'secondary'} className="gap-1.5">
                          {sessao.status === 'vinculado' && <span className="h-2 w-2 rounded-full bg-success" />}
                          {sessao.status === 'vinculado' ? 'Online' : sessaoLabels[sessao.status]}
                        </Badge>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
                        {sessao.status === 'vinculado' && (
                          <Button variant="outline" size="sm" disabled={sessaoStatusMutation.isPending} onClick={() => setAcaoSessao({ id: sessao.id, acao: 'desconectar', telefone: sessao.telefone ?? 'este número' })}>
                            <Unplug />Desconectar
                          </Button>
                        )}
                        {sessao.status === 'desconectado' && (
                          <Button variant="outline" size="sm" disabled={sessaoStatusMutation.isPending || !botOnline} onClick={() => sessaoStatusMutation.mutate({ id: sessao.id, acao: 'reconectar' })}>
                            <RefreshCw />Reconectar
                          </Button>
                        )}
                        {sessao.status !== 'banido' && sessao.status !== 'aguardando_qr' && (
                          <Button variant="ghost" size="sm" disabled={sessaoStatusMutation.isPending} onClick={() => setAcaoSessao({ id: sessao.id, acao: 'sair', telefone: sessao.telefone ?? 'este número' })}>
                            <LogOut />Sair do WhatsApp
                          </Button>
                        )}
                        {sessao.status !== 'banido' && (
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={sessaoStatusMutation.isPending} onClick={() => setAcaoSessao({ id: sessao.id, acao: 'banir', telefone: sessao.telefone ?? 'este número' })}>
                            <Power />Marcar como banido
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card data-tutorial="console-whatsapp-communities" className="overflow-hidden">
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Users className="h-5 w-5" /></span>
                    <div>
                      <h2 className="font-semibold">Comunidades e grupos</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{org.canais.length} comunidade{org.canais.length === 1 ? '' : 's'} no painel · {org.canais.filter((canal) => canal.chatId).length} destino{org.canais.filter((canal) => canal.chatId).length === 1 ? '' : 's'} pronto{org.canais.filter((canal) => canal.chatId).length === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                  <Button asChild variant="outline">
                    <Link to={`/app/whatsapp/${orgId}/comunidades`}>Gerenciar comunidades<ChevronRight /></Link>
                  </Button>
                </div>
                {org.canais.some((canal) => !canal.chatId) && (
                  <p className="mt-4 rounded-lg border border-warning/25 bg-warning-soft p-3 text-sm text-warning-foreground">
                    {org.canais.filter((canal) => !canal.chatId).length} comunidade{org.canais.filter((canal) => !canal.chatId).length === 1 ? '' : 's'} ainda sem grupo de envio vinculado.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>}

          <div className="space-y-6">
            {!isWhatsAppMode && <Card data-tutorial="console-communication-composer">
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
            </Card>}

            {!isWhatsAppMode && programados.length > 0 && (
                <Card data-tutorial="console-communication-scheduled">
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

            {isWhatsAppMode && <Card data-tutorial="console-whatsapp-deliveries">
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
                        {entrega.status === 'processando' && <Badge variant="info">Processando</Badge>}
                        {entrega.status === 'incerto' && <Badge variant="warning">Confirmação pendente</Badge>}
                        {entrega.status === 'falhou' && <Badge variant="destructive">Falhou</Badge>}
                        <span className="min-w-0 flex-1 break-words text-sm font-semibold">{entrega.comunicadoTitulo}</span>
                        <span className="text-xs text-muted-foreground">→ {entrega.canalNome ?? 'comunidade'}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entrega.status === 'enviado'
                          ? `Enviado ${entrega.origem === 'bot' ? 'pelo bot' : 'manualmente'}${entrega.sessaoTelefone ? ` pelo número ${entrega.sessaoTelefone}` : ''} · ${formatDate(entrega.enviadoEm) ?? ''}`
                          : entrega.status === 'pendente'
                            ? 'Aguardando o bot consumir a fila (segundos).'
                            : entrega.status === 'processando'
                              ? 'O bot assumiu este envio e está aguardando a confirmação do WhatsApp.'
                              : entrega.status === 'incerto'
                                ? `O WhatsApp não confirmou o resultado. Verifique antes de tentar novamente${entrega.erro ? `: ${entrega.erro}` : '.'}`
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
            </Card>}

            {!isWhatsAppMode && <Card data-tutorial="console-communication-history">
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
                          {publicavel && <Badge variant="success">Conteúdo aprovado</Badge>}
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
            </Card>}
          </div>
        </section>
      )}

      <AlertDialog open={acaoSessao !== null} onOpenChange={(open) => !open && setAcaoSessao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {acaoSessao?.acao === 'desconectar' && 'Desconectar temporariamente?'}
              {acaoSessao?.acao === 'sair' && 'Sair do WhatsApp neste número?'}
              {acaoSessao?.acao === 'banir' && 'Marcar número como banido?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {acaoSessao?.acao === 'desconectar' && `O número ${acaoSessao.telefone} ficará fora dos envios, mas o vínculo será preservado para reconectar depois.`}
              {acaoSessao?.acao === 'sair' && `O número ${acaoSessao.telefone} será desconectado e as credenciais salvas serão removidas. Para voltar a usá-lo, será necessário ler um novo QR Code.`}
              {acaoSessao?.acao === 'banir' && `O número ${acaoSessao.telefone} será retirado do fallback e identificado como banido no histórico.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={acaoSessao?.acao === 'banir' || acaoSessao?.acao === 'sair' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
              disabled={sessaoStatusMutation.isPending}
              onClick={() => acaoSessao && sessaoStatusMutation.mutate({ id: acaoSessao.id, acao: acaoSessao.acao })}
            >
              {acaoSessao?.acao === 'desconectar' ? 'Desconectar' : acaoSessao?.acao === 'sair' ? 'Sair do WhatsApp' : 'Marcar como banido'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
