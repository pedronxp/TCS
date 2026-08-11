import { useState } from 'react';
import { Check, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { supabase } from '@/lib/supabase';
import { portalHome } from '@/lib/portal';
import type { CustomerOnboardingItem, PortalAccessContext } from '@/types/portal';

interface OnboardingStep {
  key: CustomerOnboardingItem;
  label: string;
  description: string;
}

const baseSteps: OnboardingStep[] = [
  { key: 'identity', label: 'Identidade confirmada', description: 'Seu acesso seguro está associado à conta correta.' },
  { key: 'organization', label: 'Tipo de acesso definido', description: 'O portal reconhece se o uso é individual ou municipal.' },
  { key: 'plan', label: 'Plano ou avaliação definidos', description: 'Limites e recursos disponíveis ficam claros antes da operação.' },
  { key: 'team', label: 'Equipe preparada', description: 'O município pode distribuir o trabalho entre os integrantes.' },
  { key: 'configuration', label: 'Configuração inicial revisada', description: 'Confirme que os dados básicos estão prontos para uso.' },
  { key: 'first_operation', label: 'Primeira vistoria iniciada', description: 'Registre a primeira atividade para colocar o portal em operação.' },
];

export function PortalOnboardingChecklist() {
  const { access, entryContext, refreshAccess } = usePortalAuth();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onboarding = entryContext?.onboarding;
  if (!access || !onboarding || onboarding.progressPercent === 100) return null;

  const root = portalHome(access.accountKind);
  const steps = baseSteps.map((step) => getAudienceStep(step, access));
  const incompleteSteps = steps.filter((step) => onboarding.checklist[step.key] !== true);
  const declaredCurrent = incompleteSteps.find((step) => step.key === onboarding.currentStep);
  const nextStep = declaredCurrent ?? incompleteSteps[0];

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

  const nextAction = nextStep ? getNextAction(nextStep.key, access, root) : null;

  return (
    <Card aria-labelledby="onboarding-title">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground">Ativação do portal</p>
          <CardTitle id="onboarding-title" className="mt-2">Coloque sua operação em andamento</CardTitle>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {access.accountKind === 'organization'
              ? 'Conclua a preparação municipal e avance até a primeira vistoria.'
              : 'Conclua os dados essenciais e avance até sua primeira vistoria.'}
          </p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-2xl font-bold text-primary">{onboarding.progressPercent}%</p>
          <p className="mt-1 text-xs text-muted-foreground">{onboarding.completedItems} de {onboarding.totalItems} etapas</p>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="h-2 overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-label="Progresso da ativação"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={onboarding.progressPercent}
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${onboarding.progressPercent}%` }} />
        </div>

        {nextStep && (
          <section className="mt-5 rounded-lg border border-primary/25 bg-success-soft p-4" aria-labelledby="next-step-title">
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">
                <Check className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">Próximo passo</p>
                <h2 id="next-step-title" className="mt-1 font-semibold">{nextStep.label}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{nextStep.description}</p>
                <NextStepAction
                  action={nextAction}
                  updating={updating}
                  onCompleteConfiguration={completeConfiguration}
                />
              </div>
            </div>
          </section>
        )}

        <ul className="mt-5 grid gap-2 sm:grid-cols-2" aria-label="Etapas da ativação">
          {steps.map((step) => {
            const done = onboarding.checklist[step.key] === true;
            const current = step.key === nextStep?.key;
            return (
              <li key={step.key} className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                {done
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                <span className={done ? 'text-muted-foreground' : 'font-medium'}>{step.label}</span>
                <span className="sr-only">{done ? 'Concluída' : current ? 'Próxima etapa' : 'Pendente'}</span>
              </li>
            );
          })}
        </ul>
        {error && <p className="mt-3 rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-foreground" role="alert">{error}</p>}
      </CardContent>
    </Card>
  );
}

type NextAction =
  | { kind: 'link'; label: string; path: string }
  | { kind: 'configuration'; label: string }
  | { kind: 'unavailable'; message: string }
  | null;

function getNextAction(step: CustomerOnboardingItem, access: PortalAccessContext, root: string): NextAction {
  const permissions = new Set(access.permissions);
  if (step === 'configuration') {
    if (access.accountKind === 'organization' && !permissions.has('settings.manage')) {
      return { kind: 'unavailable', message: 'A configuração municipal está disponível somente para a coordenação. Você pode acompanhar o progresso em modo de consulta.' };
    }
    return { kind: 'configuration', label: 'Confirmar configuração' };
  }
  if (step === 'first_operation') {
    if (access.creationAllowed && permissions.has('inspection.create')) {
      return { kind: 'link', label: 'Iniciar primeira vistoria', path: `${root}/vistorias?nova=1` };
    }
    return { kind: 'unavailable', message: 'A criação de vistorias não está liberada para este acesso.' };
  }
  if (step === 'team' && access.accountKind === 'organization') {
    if (permissions.has('team.read')) return { kind: 'link', label: 'Abrir equipe', path: `${root}/equipe` };
    return { kind: 'unavailable', message: 'A gestão da equipe depende de uma permissão municipal.' };
  }
  if (step === 'plan' && permissions.has('billing.read')) {
    return { kind: 'link', label: 'Consultar plano', path: `${root}/assinatura` };
  }
  return { kind: 'unavailable', message: 'Esta etapa é atualizada automaticamente quando os dados forem confirmados.' };
}

function NextStepAction({
  action,
  updating,
  onCompleteConfiguration,
}: {
  action: NextAction;
  updating: boolean;
  onCompleteConfiguration: () => Promise<void>;
}) {
  if (!action) return null;
  if (action.kind === 'unavailable') return <p className="mt-3 text-xs font-medium text-muted-foreground">{action.message}</p>;
  if (action.kind === 'link') {
    return <Button asChild size="sm" className="mt-4 min-h-10"><Link to={action.path}>{action.label}</Link></Button>;
  }
  return (
    <Button size="sm" className="mt-4 min-h-10" disabled={updating} onClick={() => void onCompleteConfiguration()}>
      {updating && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      {updating ? 'Confirmando…' : action.label}
    </Button>
  );
}

function getAudienceStep(step: OnboardingStep, access: PortalAccessContext): OnboardingStep {
  if (step.key === 'organization' && access.accountKind === 'organization') {
    return { ...step, label: 'Organização municipal criada', description: 'O município e o primeiro administrador estão associados ao portal.' };
  }
  if (step.key === 'team' && access.accountKind === 'individual') {
    return { ...step, label: 'Uso individual preparado', description: 'Seu acesso está pronto para operar sem uma equipe municipal.' };
  }
  return step;
}
