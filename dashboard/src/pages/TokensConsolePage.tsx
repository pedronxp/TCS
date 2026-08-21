import { useDeferredValue, useMemo, useState } from 'react';
import { BarChart3, Copy, KeyRound, Loader2, Plus, RefreshCw, RotateCcw, Search, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { BrazilMunicipalityPicker, BrazilStateSelect } from '@/components/BrazilMunicipalityPicker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { HighRiskDialog } from '@/components/ui/HighRiskDialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useAdministrativeMutation } from '@/hooks/useAdministrativeMutation';
import { useTokenAnalytics, type TokenStatus } from '@/hooks/useTokenAnalytics';
import { supabase } from '@/lib/supabase';

type TokenRow = {
  management_id: string;
  role: string;
  municipio: string;
  created_at: string;
  expires_at: string;
  used: boolean;
  revoked_at: string | null;
  status: TokenStatus;
  created_by_name: string;
};
type TokenDraft = { role: 'agent' | 'supervisor' | 'admin'; municipio: string; uf: string; expiresInMinutes: string };
type CreatedToken = { token: string; managementId: string; expiresAt: string };
type CreateTokenResult = { token?: string; management_id?: string; expires_at?: string };
type RevealTokenResult = { token?: string; management_id?: string; expires_at?: string };

const roleLabels: Record<TokenDraft['role'], string> = {
  agent: 'Agente', supervisor: 'Supervisor', admin: 'Administrador',
};
const roleDescriptions: Record<TokenDraft['role'], string> = {
  agent: 'Executa vistorias e atividades operacionais no município selecionado, sem gerir usuários ou configurações.',
  supervisor: 'Acompanha a operação e a equipe do município, com acesso ampliado para supervisão.',
  admin: 'Administra usuários, convites e configurações operacionais do município selecionado.',
};
const statusLabels: Record<TokenStatus, string> = {
  active: 'Ativo', used: 'Utilizado', expired: 'Expirado', revoked: 'Revogado',
};
const tokenSessionStorageKey = 'tcs.console.last-active-invite-token';

export function TokensConsolePage() {
  const [filterMunicipio, setFilterMunicipio] = useState('');
  const [filterUf, setFilterUf] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | TokenStatus>('all');
  const [filterSearch, setFilterSearch] = useState('');
  const deferredSearch = useDeferredValue(filterSearch);
  const [draft, setDraft] = useState<TokenDraft | null>(null);
  const [confirmingCreate, setConfirmingCreate] = useState(false);
  const [tokenToRevoke, setTokenToRevoke] = useState<TokenRow | null>(null);
  const [revealedToken, setRevealedToken] = useState<CreatedToken | null>(() => readRecoverableToken());
  const [revealError, setRevealError] = useState<string | null>(null);
  const tokens = useTokenAnalytics(filterMunicipio, filterUf);
  const create = useAdministrativeMutation<{ draft: TokenDraft; reason: string }, CreateTokenResult>({
    mutationFn: async ({ draft: nextDraft, reason }, operationId) => {
      const { data, error } = await (supabase.rpc as (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: CreateTokenResult | null; error: { message: string } | null }>)('create_console_invite_token', {
        p_role: nextDraft.role,
        p_municipio: nextDraft.municipio.trim(),
        p_expires_in_minutes: Number(nextDraft.expiresInMinutes),
        p_reason: reason,
        p_operation_id: operationId,
      });
      if (error) throw error;
      return data ?? {};
    },
    invalidate: [['console-invite-tokens'], ['console-token-analytics'], ['audit-timeline']],
  });
  const revoke = useAdministrativeMutation<{ token: TokenRow; reason: string }, unknown>({
    mutationFn: async ({ token, reason }, operationId) => {
      const { data, error } = await (supabase.rpc as (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>)('revoke_console_invite_token', {
        p_management_id: token.management_id,
        p_reason: reason,
        p_operation_id: operationId,
      });
      if (error) throw error;
      return data;
    },
    invalidate: [['console-invite-tokens'], ['console-token-analytics'], ['audit-timeline']],
  });
  const reveal = useAdministrativeMutation<{ token: TokenRow }, RevealTokenResult>({
    mutationFn: async ({ token }, operationId) => {
      const { data, error } = await (supabase.rpc as (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: RevealTokenResult | null; error: { message: string } | null }>)('reveal_console_invite_token', {
        p_management_id: token.management_id,
        p_operation_id: operationId,
      });
      if (error) throw error;
      return data ?? {};
    },
    invalidate: [['audit-timeline']],
  });
  const rows = useMemo(
    () => (tokens.data?.items ?? []).map((token): TokenRow => ({
      management_id: token.managementId, role: token.role, municipio: token.municipio, created_at: token.createdAt,
      expires_at: token.expiresAt ?? '', used: token.used, revoked_at: token.revokedAt, status: token.status, created_by_name: token.createdByName,
    })).filter((token) => {
      if (filterStatus !== 'all' && token.status !== filterStatus) return false;
      const term = deferredSearch.trim().toLocaleLowerCase('pt-BR');
      return !term || [roleLabels[token.role as TokenDraft['role']] ?? token.role, token.municipio, token.created_by_name]
        .some((value) => value.toLocaleLowerCase('pt-BR').includes(term));
    }),
    [deferredSearch, filterStatus, tokens.data],
  );
  const hasFilters = Boolean(filterUf || filterMunicipio || filterSearch || filterStatus !== 'all');
  const clearFilters = () => { setFilterUf(''); setFilterMunicipio(''); setFilterStatus('all'); setFilterSearch(''); };
  const rememberedTokenRecord = tokens.data?.items.find((token) => token.managementId === revealedToken?.managementId);
  const rememberedTokenIsActive = Boolean(
    revealedToken
    && new Date(revealedToken.expiresAt).getTime() > Date.now()
    && (!rememberedTokenRecord || rememberedTokenRecord.status === 'active'),
  );
  const forgetRevealedToken = () => { setRevealedToken(null); clearRecoverableToken(); };
  const revealToken = async (token: TokenRow) => {
    setRevealError(null);
    const result = await reveal.mutateAsync({ token });
    if (!result.ok) { setRevealError(result.error || 'Não foi possível revelar este token agora.'); return; }
    const code = result.data?.token;
    const managementId = result.data?.management_id;
    const expiresAt = result.data?.expires_at;
    if (!code || !managementId || !expiresAt) { setRevealError('O servidor não retornou um código copiável.'); return; }
    const nextToken = { token: code, managementId, expiresAt };
    setRevealedToken(nextToken); saveRecoverableToken(nextToken);
  };

  return (
    <section className="page-stack mx-auto w-full max-w-[1200px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Segurança operacional</p>
          <h1 className="mt-2 text-[30px] font-bold tracking-[-0.035em]">Tokens de convite</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gere, acompanhe, copie enquanto ativos e revogue convites com registro de auditoria.</p>
        </div>
        <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/app/tokens/analise"><BarChart3 />Análise</Link></Button><Button onClick={() => { setDraft({ role: 'agent', municipio: filterMunicipio, uf: filterUf, expiresInMinutes: '1440' }); forgetRevealedToken(); }}><Plus />Gerar token</Button></div>
      </div>

      {revealedToken && rememberedTokenIsActive && (
        <Alert>
          <KeyRound className="h-4 w-4" />
          <AlertTitle>Código do token ativo</AlertTitle>
          <AlertDescription className="mt-2 flex flex-wrap items-center gap-3">
            <code className="rounded bg-muted px-2 py-1 font-mono font-semibold tracking-wider">{revealedToken.token}</code>
            <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(revealedToken.token)}><Copy />Copiar</Button>
            <Button size="sm" variant="ghost" onClick={forgetRevealedToken}>Remover desta aba</Button>
            <span className="text-xs">Disponível só nesta aba até expirar ou ser revogado.</span>
          </AlertDescription>
        </Alert>
      )}
      {revealedToken && !rememberedTokenIsActive && <Alert><KeyRound className="h-4 w-4" /><AlertTitle>Token não disponível para cópia</AlertTitle><AlertDescription>Ele expirou, foi usado, foi revogado ou não está mais disponível neste recorte.</AlertDescription></Alert>}
      {revealError && <Alert variant="destructive"><AlertTitle>Não foi possível revelar o token</AlertTitle><AlertDescription>{revealError}</AlertDescription></Alert>}

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><CardTitle>Monitoramento</CardTitle><p className="mt-1 text-sm text-muted-foreground">Acompanhe a situação sem listar o segredo do convite.</p></div>
            <Button variant="outline" size="sm" aria-label="Atualizar tokens" onClick={() => void tokens.refetch()}><RefreshCw className={tokens.isFetching ? 'animate-spin motion-reduce:animate-none' : ''} />Atualizar</Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.35fr)_minmax(10rem,.8fr)_minmax(14rem,1fr)_auto]">
            <BrazilStateSelect value={filterUf} onValueChange={(uf) => { setFilterUf(uf); setFilterMunicipio(''); }} includeAll />
            <BrazilMunicipalityPicker uf={filterUf} value={filterMunicipio} onValueChange={setFilterMunicipio} includeAll allValue="" allLabel="Todos os municípios" placeholder={filterUf ? 'Filtrar município' : 'Selecione um estado primeiro'} />
            <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as 'all' | TokenStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={filterSearch} onChange={(event) => setFilterSearch(event.target.value)} className="pl-9" placeholder="Município, perfil ou emissor" aria-label="Pesquisar tokens" /></div>
            {hasFilters && <Button variant="ghost" size="sm" className="justify-self-start" onClick={clearFilters}><RotateCcw />Limpar</Button>}
          </div>
        </CardHeader>
        <CardContent>
          {tokens.data && <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Summary label="Ativos" value={tokens.data.summary.active} /><Summary label="Utilizados" value={tokens.data.summary.used} /><Summary label="Expirados" value={tokens.data.summary.expired} /><Summary label="Revogados" value={tokens.data.summary.revoked} /><Summary label="Emissões em 7 dias" value={tokens.data.summary.createdLast7Days} /></div>}
          {tokens.isLoading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando tokens…</p> : tokens.isError ? <div className="space-y-1 text-sm text-destructive"><p>Não foi possível carregar os tokens.</p><p className="text-xs">{readError(tokens.error)}</p></div> : rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum token corresponde aos filtros. Use “Limpar” para ver todo o histórico.</p> : (
            <>
            <p className="mb-3 text-xs text-muted-foreground">Exibindo {rows.length.toLocaleString('pt-BR')} de {(tokens.data?.items.length ?? 0).toLocaleString('pt-BR')} token(s) no recorte selecionado.</p>
            <div className="overflow-x-auto"><table className="w-full min-w-[870px] text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-3">Perfil</th><th className="p-3">Município</th><th className="p-3">Emitido por</th><th className="p-3">Criado</th><th className="p-3">Expira</th><th className="p-3">Situação</th><th className="p-3" /></tr></thead><tbody>{rows.map((token) => <tr key={token.management_id} className="border-b last:border-0"><td className="p-3 font-medium">{roleLabels[token.role as TokenDraft['role']] ?? token.role}</td><td className="p-3">{token.municipio}</td><td className="p-3">{token.created_by_name}</td><td className="p-3">{formatDate(token.created_at)}</td><td className="p-3">{formatDate(token.expires_at)}</td><td className="p-3"><Status value={token.status} /></td><td className="p-3 text-right"><div className="flex justify-end gap-2">{token.status === 'active' && <Button size="sm" variant="outline" disabled={reveal.isPending} onClick={() => void revealToken(token)}><Copy />{reveal.isPending ? 'Abrindo…' : 'Ver e copiar'}</Button>}{token.status === 'active' && <Button size="sm" variant="outline" onClick={() => setTokenToRevoke(token)}><XCircle />Revogar</Button>}</div></td></tr>)}</tbody></table></div>
            </>
          )}
        </CardContent>
      </Card>

      <TokenDraftDialog draft={draft} onChange={setDraft} onClose={() => setDraft(null)} onContinue={() => setConfirmingCreate(true)} />
      {draft && <HighRiskDialog open={confirmingCreate} title="Confirmar geração do token" description="O token ficará disponível para copiar nesta aba até expirar ou ser revogado, com registro de auditoria." confirmLabel="Gerar token" onClose={() => setConfirmingCreate(false)} onConfirm={async (reason) => { const result = await create.mutateAsync({ draft, reason }); if (!result.ok) throw new Error(result.error); const token = result.data?.token; const managementId = result.data?.management_id; const expiresAt = result.data?.expires_at; if (token && managementId && expiresAt) { const nextToken = { token, managementId, expiresAt }; setRevealedToken(nextToken); saveRecoverableToken(nextToken); } setConfirmingCreate(false); setDraft(null); }} />}
      {tokenToRevoke && <HighRiskDialog open title="Revogar token de convite" description="O convite deixará de ser válido imediatamente. A revogação será auditada." confirmLabel="Revogar token" onClose={() => setTokenToRevoke(null)} onConfirm={async (reason) => { const result = await revoke.mutateAsync({ token: tokenToRevoke, reason }); if (!result.ok) throw new Error(result.error); if (revealedToken?.managementId === tokenToRevoke.management_id) forgetRevealedToken(); setTokenToRevoke(null); }} />}
    </section>
  );
}

function TokenDraftDialog({ draft, onChange, onClose, onContinue }: { draft: TokenDraft | null; onChange: (draft: TokenDraft) => void; onClose: () => void; onContinue: () => void }) {
  if (!draft) return null;
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent><DialogHeader><DialogTitle>Gerar token de convite</DialogTitle><DialogDescription>Selecione o perfil, o estado, o município e o prazo de validade.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Perfil</Label><Select value={draft.role} onValueChange={(role) => onChange({ ...draft, role: role as TokenDraft['role'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(roleLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">{roleLabels[draft.role]}:</strong> {roleDescriptions[draft.role]}</p></div><div className="space-y-2"><Label htmlFor="token-uf">Estado</Label><BrazilStateSelect id="token-uf" value={draft.uf} onValueChange={(uf) => onChange({ ...draft, uf, municipio: '' })} /></div><div className="space-y-2"><Label htmlFor="token-municipio">Município</Label><BrazilMunicipalityPicker id="token-municipio" uf={draft.uf} value={draft.municipio} onValueChange={(municipio) => onChange({ ...draft, municipio })} /></div><div className="space-y-2"><Label>Validade</Label><Select value={draft.expiresInMinutes} onValueChange={(expiresInMinutes) => onChange({ ...draft, expiresInMinutes })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="60">1 hora</SelectItem><SelectItem value="1440">24 horas</SelectItem><SelectItem value="4320">3 dias</SelectItem><SelectItem value="10080">7 dias</SelectItem></SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={draft.municipio.trim().length < 2} onClick={onContinue}>Revisar geração</Button></DialogFooter></DialogContent></Dialog>;
}

function Status({ value }: { value: TokenStatus }) {
  const tone: Record<TokenStatus, string> = { active: 'bg-success-soft text-foreground', used: 'bg-info-soft text-foreground', expired: 'bg-muted text-muted-foreground', revoked: 'bg-destructive-soft text-destructive' };
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${tone[value]}`}>{statusLabels[value]}</span>;
}

function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-lg border bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold tabular-nums">{value.toLocaleString('pt-BR')}</p></div>; }

function formatDate(value: string) { if (!value) return 'Não informado'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Não informado' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
function readError(error: unknown) { return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : 'A consulta de monitoramento falhou. Tente novamente.'; }
function readRecoverableToken(): CreatedToken | null { try { const value = window.sessionStorage.getItem(tokenSessionStorageKey); if (!value) return null; const token = JSON.parse(value) as Partial<CreatedToken>; if (typeof token.token !== 'string' || typeof token.managementId !== 'string' || typeof token.expiresAt !== 'string' || new Date(token.expiresAt).getTime() <= Date.now()) { clearRecoverableToken(); return null; } return { token: token.token, managementId: token.managementId, expiresAt: token.expiresAt }; } catch { return null; } }
function saveRecoverableToken(token: CreatedToken) { try { window.sessionStorage.setItem(tokenSessionStorageKey, JSON.stringify(token)); } catch { /* Session storage may be disabled by the browser. */ } }
function clearRecoverableToken() { try { window.sessionStorage.removeItem(tokenSessionStorageKey); } catch { /* Nothing to clear. */ } }
