import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Users,
  Key,
  Search,
  X,
  Plus,
  Trash2,
  RotateCcw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Lock,
  Unlock,
  Send,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useUsuarios,
  useToggleAprovacao,
  useResetSenha,
  type FiltroUsuario,
  type UserAccessAction,
  type UserRecord,
} from '@/hooks/useUsuarios';
import {
  useTokens,
  useCriarToken,
  useCancelarToken,
  useLimparTokens,
  type TokenRecord,
} from '@/hooks/useTokens';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// ─── helpers ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  agent: 'Agente',
  supervisor: 'Supervisor',
  admin: 'Admin',
  master_admin: 'Master',
};

const ROLE_COLORS: Record<string, string> = {
  agent: 'bg-secondary text-secondary-foreground',
  supervisor: 'bg-secondary text-secondary-foreground',
  admin: 'bg-warning-soft text-warning',
  master_admin: 'bg-destructive-soft text-destructive',
};

function tempoRestante(expiresAt: string | null): { texto: string; cor: string; expirado: boolean } {
  if (!expiresAt) return { texto: 'Sem prazo', cor: 'text-muted-foreground', expirado: false };
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { texto: 'Expirado', cor: 'text-destructive', expirado: true };
  const horas = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const dias = Math.floor(horas / 24);
  const texto =
    dias > 0 ? `${dias}d ${horas % 24}h` : horas > 0 ? `${horas}h ${mins}min` : `${mins}min`;
  const cor =
    diff < 2 * 3_600_000
      ? 'text-destructive'
      : diff < 24 * 3_600_000
        ? 'text-warning'
        : 'text-success';
  return { texto, cor, expirado: false };
}

function iniciais(name: string) {
  return (name ?? '?')
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

// ─── Papel · Município ─────────────────────────────────────────────────────────

function papelMunicipio(u: UserRecord, isMaster: boolean): string {
  const papel = ROLE_LABELS[u.role] ?? u.role;
  if (isMaster && u.municipio) return `${papel} · ${u.municipio}`;
  if (u.municipio) return `${papel} · ${u.municipio}`;
  return papel;
}

// ─── Confirmação auditável de acesso ──────────────────────────────────────────

type AccessAction = UserAccessAction;

function accessActionCopy(action: AccessAction): { title: string; description: string; confirmLabel: string } {
  switch (action) {
    case 'release':
      return {
        title: 'Liberar acesso deste agente?',
        description:
          'A pessoa voltará a operar dentro do município autorizado. A liberação exige justificativa e horário da operação. Confirme apenas após validar a identidade.',
        confirmLabel: 'Liberar acesso',
      };
    case 'block':
      return {
        title: 'Bloquear acesso deste agente?',
        description:
          'O acesso será suspenso e as sessões ativas serão encerradas. A pessoa continua cadastrada e pode ser liberada novamente. Ação exige justificativa e horário da operação.',
        confirmLabel: 'Bloquear acesso',
      };
  }
}

function AccessConfirmDialog({
  action,
  user,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  action: AccessAction;
  user: UserRecord;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const copy = accessActionCopy(action);
  const valid = reason.trim().length >= 8;
  return (
    <div className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg w-full max-w-sm p-6 border border-border">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-secondary grid place-items-center">
            <ShieldCheck className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-foreground text-sm">{copy.title}</h2>
            <p className="text-xs text-muted-foreground">{user.name}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground mb-4">{copy.description}</p>
        <label className="text-sm font-medium text-foreground block mb-1.5">Justificativa</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explique por que esta ação é necessária (mínimo 8 caracteres)"
          minLength={8}
          rows={3}
          autoFocus
          className="w-full rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={busy || !valid}
            onClick={() => onConfirm(reason.trim())}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : copy.confirmLabel}
          </Button>
        </div>
        {error && (
          <p className="mt-3 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Modal Reset Senha ────────────────────────────────────────────────────────

function ModalResetSenha({
  user,
  onClose,
}: {
  user: UserRecord;
  onClose: () => void;
}) {
  const [senha, setSenha] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [ok, setOk] = useState(false);
  const reset = useResetSenha();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8 || justificativa.trim().length < 8) return;
    await reset.mutateAsync({ uid: user.uid, password: senha });
    setOk(true);
    setTimeout(onClose, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg w-full max-w-sm p-6 border border-border">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-secondary grid place-items-center">
            <Key className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-foreground">Enviar recuperação de senha</h2>
            <p className="text-xs text-muted-foreground">{user.name}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {ok ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-success font-medium">
              <Check className="w-5 h-5" /> Senha redefinida com sucesso!
            </div>
            <p className="text-xs text-muted-foreground leading-5">
              Compartilhe a nova senha com {user.name.split(' ')[0]} em canal seguro. As sessões
              ativas foram encerradas e a operação foi registrada.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Nova senha provisória</label>
              <Input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Justificativa</label>
              <textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Explique por que a recuperação é necessária (mínimo 8 caracteres)"
                minLength={8}
                rows={2}
                className="w-full rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={reset.isPending || senha.length < 8 || justificativa.trim().length < 8}
              >
                {reset.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar recuperação'}
              </Button>
            </div>
            {reset.isError && (
              <p className="text-xs text-destructive">Erro ao redefinir senha. Tente novamente.</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Modal Novo Token ─────────────────────────────────────────────────────────

function useMunicipios() {
  const [municipios, setMunicipios] = useState<string[]>([]);
  useEffect(() => {
    supabase
      .from('municipios')
      .select('nome')
      .order('nome')
      .then(({ data }) => setMunicipios((data ?? []).map((m: { nome: string }) => m.nome)));
  }, []);
  return municipios;
}

const ROLES_DISPONIVEIS = [
  { value: 'agent', label: 'Agente' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'admin', label: 'Admin' },
];

function ModalNovoToken({
  municipioPadrao,
  onClose,
}: {
  municipioPadrao: string | null;
  onClose: (codigo?: string) => void;
}) {
  const municipios = useMunicipios();
  const [role, setRole] = useState('agent');
  const [municipio, setMunicipio] = useState(municipioPadrao ?? '');
  const [horas, setHoras] = useState(72);
  const [codigoGerado, setCodigoGerado] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const criar = useCriarToken();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const codigo = await criar.mutateAsync({ role, municipio, horasValidade: horas });
    setCodigoGerado(codigo);
  }

  function copiar() {
    if (!codigoGerado) return;
    navigator.clipboard.writeText(codigoGerado);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg w-full max-w-sm p-6 border border-border">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-primary/10 grid place-items-center">
            <Plus className="w-5 h-5 text-primary" />
          </div>
          <h2 className="font-bold text-foreground">Novo Token de Convite</h2>
          <button onClick={() => onClose()} className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {codigoGerado ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Token criado com sucesso! Compartilhe:</p>
            <div className="flex items-center gap-2 bg-muted rounded-lg p-3">
              <span className="flex-1 font-mono font-bold text-foreground tracking-widest text-sm">
                {codigoGerado}
              </span>
              <button
                onClick={copiar}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <Button className="w-full" onClick={() => onClose(codigoGerado)}>
              Fechar
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Perfil</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                {ROLES_DISPONIVEIS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Município</label>
              {municipioPadrao ? (
                <Input value={municipioPadrao} readOnly className="bg-muted text-muted-foreground" />
              ) : (
                <select
                  value={municipio}
                  onChange={(e) => setMunicipio(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                >
                  <option value="">Selecionar município</option>
                  {municipios.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">
                Validade: <span className="text-primary font-bold">{horas}h</span>
              </label>
              <input
                type="range"
                min={1}
                max={168}
                value={horas}
                onChange={(e) => setHoras(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1h</span>
                <span>7 dias</span>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onClose()}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={criar.isPending || (!municipioPadrao && !municipio)}
              >
                {criar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Token'}
              </Button>
            </div>
            {criar.isError && (
              <p className="text-xs text-destructive">Erro ao criar token. Tente novamente.</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Aba Usuários ─────────────────────────────────────────────────────────────

function AbaUsuarios() {
  const { profile } = useAuth();
  const isMaster = profile?.role === 'master_admin';

  const [filtro, setFiltro] = useState<FiltroUsuario>('todos');
  const [busca, setBusca] = useState('');
  const [resetUser, setResetUser] = useState<UserRecord | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [accessAction, setAccessAction] = useState<{ action: AccessAction; user: UserRecord } | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);

  const { data: usuarios = [], isLoading, isError, refetch } = useUsuarios(filtro, busca);
  const toggle = useToggleAprovacao();

  const filtros: { key: FiltroUsuario; label: string; count?: number }[] = [
    { key: 'todos', label: 'Todos', count: usuarios.length },
    { key: 'ativos', label: 'Ativos' },
    { key: 'pendentes', label: 'Pendentes' },
  ];

  function runAccess(action: AccessAction, user: UserRecord, reason: string) {
    setAccessError(null);
    toggle.mutate(
      { uid: user.uid, action, reason },
      {
        onSuccess: () => setAccessAction(null),
        onError: () => setAccessError('Não foi possível alterar o acesso. Tente novamente.'),
      },
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de busca e filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, email ou cidade..."
            className="pl-9"
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {filtros.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap',
                filtro === f.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-secondary'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Carregando usuários...</span>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p>Falha ao carregar usuários.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCcw className="w-4 h-4" /> Tentar novamente
          </Button>
        </div>
      ) : usuarios.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''}
          </p>
          {usuarios.map((u) => {
            const isExpanded = expandido === u.uid;
            const aprovando = toggle.isPending && toggle.variables?.uid === u.uid;

            return (
              <div
                key={u.uid}
                className="bg-card border border-border rounded-lg overflow-hidden"
              >
                {/* Linha principal */}
                <div className="flex items-center gap-4 p-4">
                  {/* Avatar */}
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl shrink-0 grid place-items-center font-bold text-sm',
                      u.isApproved
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {iniciais(u.name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground text-sm truncate">
                        {u.name}
                      </span>
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          ROLE_COLORS[u.role] ?? 'bg-muted text-muted-foreground'
                        )}
                      >
                        {papelMunicipio(u, isMaster)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{u.email}</p>
                  </div>

                  {/* Status + expandir */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={cn(
                        'text-xs font-semibold px-2.5 py-1 rounded-full',
                        u.isApproved
                          ? 'bg-success-soft text-success'
                          : 'bg-warning-soft text-warning'
                      )}
                    >
                      {u.isApproved ? 'Ativo' : 'Pendente'}
                    </span>
                    <button
                      onClick={() => setExpandido(isExpanded ? null : u.uid)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Ações (expandido) */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted px-4 py-3 space-y-3">
                    <p className="text-xs text-muted-foreground leading-5">
                      {u.isApproved
                        ? 'Acesso ativo. Bloqueie se houver necessidade de suspender temporariamente a operação deste agente.'
                        : 'Acesso pendente. Libere após validar a identidade e o vínculo municipal.'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Liberar / Bloquear */}
                      {u.isApproved ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={aprovando}
                          onClick={() => {
                            setAccessError(null);
                            setAccessAction({ action: 'block', user: u });
                          }}
                        >
                          <Lock className="w-3.5 h-3.5" />
                          Bloquear acesso
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={aprovando}
                          onClick={() => {
                            setAccessError(null);
                            setAccessAction({ action: 'release', user: u });
                          }}
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          Liberar acesso
                        </Button>
                      )}

                      {/* Redefinir senha (master_admin) — enviar recuperação */}
                      {isMaster && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setResetUser(u)}
                        >
                          <Send className="w-3.5 h-3.5" />
                          Enviar recuperação
                        </Button>
                      )}

                      {/* Data de cadastro */}
                      {u.createdAt && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          Desde {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal reset senha */}
      {resetUser && (
        <ModalResetSenha user={resetUser} onClose={() => setResetUser(null)} />
      )}

      {/* Confirmação auditável de liberar/bloquear */}
      {accessAction && (
        <AccessConfirmDialog
          action={accessAction.action}
          user={accessAction.user}
          busy={toggle.isPending}
          error={accessError}
          onClose={() => setAccessAction(null)}
          onConfirm={(reason) => runAccess(accessAction.action, accessAction.user, reason)}
        />
      )}
    </div>
  );
}

// ─── Aba Tokens ───────────────────────────────────────────────────────────────

function AbaTokens() {
  const { profile } = useAuth();
  const [novoTokenOpen, setNovoTokenOpen] = useState(false);

  const { data: tokens = [], isLoading, isError, refetch } = useTokens();
  const cancelar = useCancelarToken();
  const limpar = useLimparTokens();

  const agora = Date.now();

  const ativos = tokens.filter(
    (t) => !t.usado && (!t.expiresAt || new Date(t.expiresAt).getTime() > agora)
  );
  const expirados = tokens.filter(
    (t) => !t.usado && t.expiresAt && new Date(t.expiresAt).getTime() <= agora
  );
  const usados = tokens.filter((t) => t.usado);

  function TokenCard({ t, secao }: { t: TokenRecord; secao: 'ativo' | 'expirado' | 'usado' }) {
    const [copied, setCopied] = useState(false);
    const { texto, cor } = tempoRestante(t.expiresAt);
    const podeConcelar = secao === 'ativo';

    function copiar() {
      navigator.clipboard.writeText(t.codigo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }

    return (
      <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono font-bold text-foreground text-sm tracking-wide">
              {t.codigo}
            </span>
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium',
                ROLE_COLORS[t.role] ?? 'bg-muted text-muted-foreground'
              )}
            >
              {ROLE_LABELS[t.role] ?? t.role}
            </span>
            {t.municipio && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                {t.municipio}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Criado {new Date(t.criadoEm).toLocaleDateString('pt-BR')}</span>
            <span className={cor}>{texto}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {secao === 'ativo' && (
            <button
              onClick={copiar}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Copiar código"
            >
              {copied ? (
                <Check className="w-4 h-4 text-success" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          )}
          {podeConcelar && (
            <button
              onClick={() => cancelar.mutate(t.codigo)}
              disabled={cancelar.isPending}
              className="text-muted-foreground hover:text-destructive transition-colors"
              title="Cancelar token"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  function Secao({
    titulo,
    tipo,
    lista,
    podeLimpar,
  }: {
    titulo: string;
    tipo: 'ativo' | 'expirado' | 'usado';
    lista: TokenRecord[];
    podeLimpar?: 'expirados' | 'usados';
  }) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            {titulo}{' '}
            <span className="font-normal text-muted-foreground normal-case">({lista.length})</span>
          </h3>
          {podeLimpar && lista.length > 0 && (
            <button
              onClick={() => limpar.mutate(podeLimpar)}
              disabled={limpar.isPending}
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Limpar todos
            </button>
          )}
        </div>
        {lista.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum token.</p>
        ) : (
          <div className="space-y-2">
            {lista.map((t) => (
              <TokenCard key={t.codigo} t={t} secao={tipo} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Gerencie tokens de convite para novos usuários.
        </p>
        <Button onClick={() => setNovoTokenOpen(true)}>
          <Plus className="w-4 h-4" />
          Novo Token
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Carregando tokens...</span>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p>Falha ao carregar tokens.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCcw className="w-4 h-4" /> Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          <Secao titulo="Ativos" tipo="ativo" lista={ativos} />
          <Secao titulo="Expirados" tipo="expirado" lista={expirados} podeLimpar="expirados" />
          <Secao titulo="Utilizados" tipo="usado" lista={usados} podeLimpar="usados" />
        </div>
      )}

      {novoTokenOpen && (
        <ModalNovoToken
          municipioPadrao={profile?.role !== 'master_admin' ? (profile?.municipio ?? null) : null}
          onClose={() => setNovoTokenOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

type Aba = 'usuarios' | 'tokens';

export function UsuariosPage() {
  const [aba, setAba] = useState<Aba>('usuarios');

  const abas: { key: Aba; label: string; icon: typeof Users }[] = [
    { key: 'usuarios', label: 'Usuários', icon: Users },
    { key: 'tokens', label: 'Tokens de Convite', icon: Key },
  ];

  return (
    <div>
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie usuários e tokens de convite do sistema
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        {abas.map((a) => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              aba === a.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <a.icon className="w-4 h-4" />
            {a.label}
          </button>
        ))}
      </div>

      {aba === 'usuarios' ? <AbaUsuarios /> : <AbaTokens />}
    </div>
  );
}
