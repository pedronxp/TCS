import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SendHorizonal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/AsyncState';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { iaApi, type ChatbotConfig } from '@/lib/ia';
import { useAuth } from '@/contexts/AuthContext';
import { IaNav } from './IaNav';

interface ChatMessage { from: 'user' | 'bot'; text: string }

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
                  {m.text}
                </div>
              ))}
              <div ref={chatEndRef} />
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
    </div>
  );
}
