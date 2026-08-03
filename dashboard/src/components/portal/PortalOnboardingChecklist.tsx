import { useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { supabase } from '@/lib/supabase';
import { portalHome } from '@/lib/portal';
import type { CustomerOnboardingItem } from '@/types/portal';

const items: Array<{ key: CustomerOnboardingItem; label: string }> = [
  { key: 'identity', label: 'Identidade confirmada' },
  { key: 'organization', label: 'Organização criada' },
  { key: 'plan', label: 'Plano ou trial definido' },
  { key: 'team', label: 'Primeiro integrante da equipe' },
  { key: 'configuration', label: 'Configuração inicial' },
  { key: 'first_operation', label: 'Primeira vistoria' },
];

export function PortalOnboardingChecklist() {
  const { access, entryContext, refreshAccess } = usePortalAuth();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onboarding = entryContext?.onboarding;
  if (!access || !onboarding || onboarding.progressPercent === 100) return null;

  const root = portalHome(access.accountKind);
  const completeConfiguration = async () => {
    setUpdating(true);
    setError(null);
    const result = await supabase.rpc('update_customer_onboarding_checklist', {
      p_item: 'configuration',
      p_completed: true,
      p_request_id: crypto.randomUUID(),
      p_source: 'web',
    });
    if (result.error) setError('Não foi possível concluir a configuração inicial.');
    else await refreshAccess();
    setUpdating(false);
  };

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Primeiros passos</p>
          <CardTitle className="mt-2">Conclua sua implantação</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            O trial permite preparar a operação; a ativação comercial definitiva permanece separada.
          </p>
        </div>
        <span className="text-2xl font-bold text-primary">{onboarding.progressPercent}%</span>
      </CardHeader>
      <CardContent>
        <div className="h-2 overflow-hidden rounded-full bg-secondary" aria-label={`${onboarding.progressPercent}% concluído`}>
          <div className="h-full rounded-full bg-primary" style={{ width: `${onboarding.progressPercent}%` }} />
        </div>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {items.map((item) => {
            const done = onboarding.checklist[item.key] === true;
            return (
              <li key={item.key} className="flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-sm">
                {done ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                <span className={done ? 'text-muted-foreground' : 'font-medium'}>{item.label}</span>
                {!done && item.key === 'team' && access.accountKind === 'organization' && <Button asChild variant="ghost" size="sm" className="ml-auto"><Link to={`${root}/equipe`}>Abrir</Link></Button>}
                {!done && item.key === 'configuration' && <Button variant="ghost" size="sm" className="ml-auto" disabled={updating} onClick={() => void completeConfiguration()}>Concluir</Button>}
                {!done && item.key === 'first_operation' && <Button asChild variant="ghost" size="sm" className="ml-auto"><Link to={`${root}/vistorias?nova=1`}>Iniciar</Link></Button>}
              </li>
            );
          })}
        </ul>
        {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
      </CardContent>
    </Card>
  );
}
