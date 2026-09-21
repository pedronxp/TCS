import { Fragment, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SendHorizonal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { ErrorState, LoadingState } from '@/components/ui/AsyncState';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { iaApi, type ChatbotConfig } from '@/lib/ia';
import { useAuth } from '@/contexts/AuthContext';
import { IaNav } from './IaNav';

interface ChatMessage { from: 'user' | 'bot'; text: string }

const BOT_FUNCTIONS = [
  { key: 'buscar_vistoria', label: 'Buscar vistoria', help: 'Por protocolo, rua, solicitante, agente, cidade ou UF.' },
  { key: 'baixar_laudo', label: 'Baixar laudo/relatório', help: 'Gera link temporário (30 min) do documento mais recente da vistoria.' },
  { key: 'minhas_vistorias', label: 'Minhas vistorias recentes', help: 'Lista as últimas 5 vistorias feitas pelo próprio agente.' },
  { key: 'vistorias_equipe', label: 'Vistorias da equipe', help: 'Lista vistorias de toda a organização (para quem gerencia).' },
  { key: 'estatisticas', label: 'Estatísticas do mês', help: 'Contagem de vistorias e de risco alto no mês corrente.' },
] as const;

const ORG_ROLES = [
  { key: 'agent', label: 'Agente' },
  { key: 'supervisor', label: 'Supervisor' },
  { key: 'admin', label: 'Admin da org' },
  { key: 'master', label: 'Master' },
] as const;

const DEFAULT_PERMS: Record<string, string[]> = {
  buscar_vistoria: ['agent', 'supervisor', 'admin', 'master'],
  baixar_laudo: ['agent', 'supervisor', 'admin', 'master'],
  minhas_vistorias: ['agent', 'supervisor', 'admin', 'master'],
  vistorias_equipe: ['supervisor', 'admin', 'master'],
  estatisticas: ['supervisor', 'admin', 'master'],
};

export function IaAgentPage() {
  const { can, user } = useAuth();
  const mayManage = can('ia.manage');
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Parameters<typeof iaApi.chatbotConfigUpdate>[0]>({});
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const simPhone = `sim-${user?.id ?? 'anon'}`;

  const config = useQuery({ queryKey: ['ia', 'chatbot-config'], queryFn: iaApi.chatbotConfigGet });
  const current: Partial<ChatbotConfig> = { ...(config.data ?? {}), ...draft };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat]);

  const save = useMutation({
    mutationFn: () => iaApi.chatbotConfigUpdate(draft),
    onSuccess: () => {
      toast.success('Configuração do agente salva.');
      setDraft({});
      void queryClient.invalidateQueries({ queryKey: ['ia', 'chatbot-config'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendSim = useMutation({
    mutationFn: (message: string) => iaApi.simulateBot(simPhone, message),
    onSuccess: (r) => {
      setChat((c) => [
        ...c,
        ...r.replies.map((text) => ({ from: 'bot' as const, text })),
        ...r.documents.map((d) => ({ from: 'bot' as const, text: `📄 ${d.name}: ${d.url}` })),
      ]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (config.isLoading) return <LoadingState label="Carregando configuração do agente" />;
  if (config.isError) return <ErrorState error="Não foi possível carregar" onRetry={() => void config.refetch()} />;

  const set = <K extends keyof ChatbotConfig>(key: K, value: ChatbotConfig[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Agente WhatsApp</h1>
        <p className="text-sm text-muted-foreground">Configurações do bot global e simulador de conversa.</p>
      </header>

      <IaNav />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Configuração geral</CardTitle>
            <CardDescription>Alterações valem imediatamente para novas mensagens recebidas pelo bot.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="numero">Número do bot</Label>
              <Input
                id="numero"
                value={current.numero_bot ?? ''}
                onChange={(e) => mayManage && set('numero_bot', e.target.value)}
                placeholder="5541..."
                disabled={!mayManage}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="welcome">Mensagem de boas-vindas</Label>
              <Textarea
                id="welcome"
                rows={2}
                value={current.welcome_message ?? ''}
                onChange={(e) => mayManage && set('welcome_message', e.target.value)}
                disabled={!mayManage}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ttl">Sessão expira em (horas)</Label>
              <Input
                id="ttl"
                type="number"
                min={1}
                max={720}
                value={current.session_ttl_hours ?? 24}
                onChange={(e) => mayManage && set('session_ttl_hours', Number(e.target.value) || 24)}
                disabled={!mayManage}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prompt">Prompt mestre (interpretação das mensagens)</Label>
              <Textarea
                id="prompt"
                rows={4}
                value={current.master_prompt ?? ''}
                onChange={(e) => mayManage && set('master_prompt', e.target.value)}
                placeholder="Vazio = usa o padrão do sistema"
                disabled={!mayManage}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">IA habilitada</p>
                <p className="text-xs text-muted-foreground">Desligando, o bot opera só com o menu numérico.</p>
              </div>
              <Switch checked={current.ia_enabled ?? true} onCheckedChange={(v) => mayManage && set('ia_enabled', v)} disabled={!mayManage} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Aceitar imagens</p>
                <p className="text-xs text-muted-foreground">Leitura de protocolo por foto (modelo de visão).</p>
              </div>
              <Switch checked={current.accept_images ?? false} onCheckedChange={(v) => mayManage && set('accept_images', v)} disabled={!mayManage} />
            </div>
            {mayManage && (
              <Button onClick={() => save.mutate()} disabled={save.isPending || Object.keys(draft).length === 0}>
                {save.isPending ? 'Salvando…' : 'Salvar configurações'}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Simulador</CardTitle>
            <CardDescription>
              Testa o fluxo real do bot (consentimento → login por e-mail → menu/IA). Sessão de teste: <code className="text-xs">{simPhone}</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex h-[480px] flex-col gap-3">
            <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border bg-muted/40 p-3">
              {chat.length === 0 && (
                <p className="text-sm text-muted-foreground">Envie uma mensagem para iniciar a simulação (ex.: “oi”).</p>
              )}
              {chat.map((m, i) => (
                <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${m.from === 'user' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-card border'}`}>
                  {renderWhatsAppText(m.text)}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['ACEITO', 'menu', 'cancelar', 'sair'].map((label) => (
                <Button
                  key={label}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 rounded-full px-3 text-xs"
                  disabled={sendSim.isPending}
                  onClick={() => {
                    setChat((c) => [...c, { from: 'user', text: label }]);
                    sendSim.mutate(label);
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const text = input.trim();
                if (!text) return;
                setChat((c) => [...c, { from: 'user', text }]);
                setInput('');
                sendSim.mutate(text);
              }}
            >
              <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Mensagem do usuário…" />
              <Button type="submit" disabled={sendSim.isPending} aria-label="Enviar">
                <SendHorizonal className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>O que o bot oferece — por perfil</CardTitle>
          <CardDescription>
            Cada linha é uma função do bot; cada coluna é um perfil dentro da organização.
            Desmarque para esconder a opção do menu daquele perfil. Sem marcação, valem os padrões do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4">Função</th>
                  {ORG_ROLES.map((r) => <th key={r.key} className="pb-2 pr-4 text-center">{r.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {BOT_FUNCTIONS.map((f) => {
                  const perms = (current.feature_permissions as Record<string, string[]>) ?? {};
                  const allowed = perms[f.key] ?? DEFAULT_PERMS[f.key];
                  return (
                    <tr key={f.key} className="border-t">
                      <td className="py-2.5 pr-4">
                        <p className="font-medium">{f.label}</p>
                        <p className="text-xs text-muted-foreground">{f.help}</p>
                      </td>
                      {ORG_ROLES.map((r) => (
                        <td key={r.key} className="text-center">
                          <Checkbox
                            checked={allowed.includes(r.key)}
                            disabled={!mayManage}
                            aria-label={`${f.label} para ${r.label}`}
                            onCheckedChange={(checked) => {
                              if (!mayManage) return;
                              const next = checked
                                ? [...new Set([...allowed, r.key])]
                                : allowed.filter((x) => x !== r.key);
                              set('feature_permissions', { ...perms, [f.key]: next });
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="handoff">Telefone de atendimento humano (opcional)</Label>
              <Input
                id="handoff"
                value={current.human_handoff_phone ?? ''}
                onChange={(e) => mayManage && set('human_handoff_phone', e.target.value)}
                placeholder="5541..."
                disabled={!mayManage}
              />
              <p className="text-xs text-muted-foreground">Quando o usuário pedir “falar com humano”, o bot envia este contato.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model_nlu">Modelo de interpretação do WhatsApp</Label>
              <Input
                id="model_nlu"
                value={((current.model_overrides as Record<string, string> | null)?.whatsapp_nlu) ?? ''}
                onChange={(e) => mayManage && set('model_overrides', { ...((current.model_overrides as Record<string, string> | null) ?? {}), whatsapp_nlu: e.target.value })}
                placeholder="vazio = modelo da chave ativa"
                disabled={!mayManage}
              />
              <p className="text-xs text-muted-foreground">Usado só para entender o que o usuário escreveu. Ex.: z-ai/glm-5.3</p>
            </div>
          </div>
          </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mensagens do bot</CardTitle>
          <CardDescription>
            Textos enviados em cada situação. Edite e salve — vale na hora, sem deploy.
            Variáveis disponíveis aparecem na descrição (ex.: {'{email}'}, {'{tentativa}'}, {'{minutos}'}).
            Botão “Padrão” restaura o texto original do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BotTemplatesEditor mayManage={mayManage} />
        </CardContent>
      </Card>
    </div>
  );
}

/** Renderiza texto estilo WhatsApp: \n vira quebra de linha, *texto* vira negrito, _texto_ vira itálico. */
function renderWhatsAppText(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const parts = line.split(/(\*[^*]+\*|_[^_]+_)/g);
    return (
      <Fragment key={i}>
        {i > 0 && <br />}
        {parts.map((part, j) => {
          if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
            return <strong key={j}>{part.slice(1, -1)}</strong>;
          }
          if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
            return <em key={j}>{part.slice(1, -1)}</em>;
          }
          return <Fragment key={j}>{part}</Fragment>;
        })}
      </Fragment>
    );
  });
}

function BotTemplatesEditor({ mayManage }: { mayManage: boolean }) {
  const queryClient = useQueryClient();
  const templates = useQuery({ queryKey: ['ia', 'templates'], queryFn: iaApi.botTemplates });
  const [edited, setEdited] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: ({ key, texto }: { key: string; texto: string | null }) => iaApi.botTemplateSet(key, texto),
    onSuccess: (_d, v) => {
      toast.success(v.texto === null ? 'Template restaurado ao padrão.' : 'Mensagem atualizada — já vale no bot.');
      setEdited((e) => {
        const next = { ...e };
        delete next[v.key];
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ['ia', 'templates'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (templates.isLoading) return <LoadingState label="Carregando mensagens" />;
  if (templates.isError) return <ErrorState error="Erro ao carregar templates" onRetry={() => void templates.refetch()} />;

  return (
    <ul className="space-y-4">
      {(templates.data ?? []).map((tpl) => {
        const value = edited[tpl.key] ?? tpl.texto;
        const isCustom = tpl.texto !== tpl.default_text;
        const dirty = edited[tpl.key] !== undefined && edited[tpl.key] !== tpl.texto;
        return (
          <li key={tpl.key} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{tpl.description ?? tpl.key}</p>
                <p className="text-xs text-muted-foreground">
                  <code>{tpl.key}</code>
                  {isCustom && <span className="ml-2 rounded bg-warning-soft px-1.5 py-0.5 text-xs">personalizado</span>}
                </p>
              </div>
              <div className="flex gap-2">
                {mayManage && isCustom && (
                  <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => save.mutate({ key: tpl.key, texto: null })}>
                    Padrão
                  </Button>
                )}
                {mayManage && (
                  <Button size="sm" disabled={save.isPending || !dirty} onClick={() => save.mutate({ key: tpl.key, texto: value })}>
                    Salvar
                  </Button>
                )}
              </div>
            </div>
            <Textarea
              className="mt-2"
              rows={3}
              value={value}
              disabled={!mayManage}
              onChange={(e) => setEdited((prev) => ({ ...prev, [tpl.key]: e.target.value }))}
              aria-label={`Mensagem ${tpl.key}`}
            />
          </li>
        );
      })}
    </ul>
  );
}

