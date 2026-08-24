import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CircleHelp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import type { InboxWorkspace } from '@/lib/inbox';
import { getTutorialPreference, saveTutorialPreference } from '@/lib/tutorials';

export interface TutorialStep {
  title: string;
  description: string;
  target?: string;
}

interface GuidedTutorialProps {
  workspace: InboxWorkspace;
  organizationId: string | null;
  tutorialKey: string;
  version?: number;
  title: string;
  description: string;
  steps: TutorialStep[];
}

export function GuidedTutorial({
  workspace,
  organizationId,
  tutorialKey,
  version = 1,
  title,
  description,
  steps,
}: GuidedTutorialProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [suppress, setSuppress] = useState(false);
  const preference = useQuery({
    queryKey: ['tutorial-preference', workspace, organizationId, tutorialKey, version],
    queryFn: () => getTutorialPreference({ workspace, organizationId, tutorialKey, version }),
  });
  const save = useMutation({ mutationFn: saveTutorialPreference });

  useEffect(() => {
    if (preference.isSuccess && !preference.data.suppressed) setOpen(true);
  }, [preference.data?.suppressed, preference.isSuccess]);

  useEffect(() => {
    const target = open ? steps[step]?.target : undefined;
    if (!target) return;
    const element = document.querySelector<HTMLElement>(`[data-tutorial="${target}"]`);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add('ring-2', 'ring-primary', 'ring-offset-4', 'ring-offset-background');
    return () => element.classList.remove('ring-2', 'ring-primary', 'ring-offset-4', 'ring-offset-background');
  }, [open, step, steps]);

  async function finish() {
    await save.mutateAsync({ workspace, organizationId, tutorialKey, version, suppressed: suppress, completed: true });
    setOpen(false);
  }

  async function handleOpenChange(next: boolean) {
    if (!next && suppress) {
      await save.mutateAsync({ workspace, organizationId, tutorialKey, version, suppressed: true, completed: false });
    }
    setOpen(next);
    if (next) setStep(0);
  }

  const current = steps[step];
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => void handleOpenChange(true)}>
        <CircleHelp /> Ajuda
      </Button>
      {open && (
        <aside
          aria-label={`Tutorial: ${title}`}
          className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border bg-background p-4 shadow-2xl sm:bottom-6 sm:right-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Tutorial {step + 1} de {steps.length}</p>
              <h2 className="mt-1 text-base font-semibold">{step === 0 ? title : current.title}</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{step === 0 ? description : current.description}</p>
            </div>
            <Button variant="ghost" size="sm" className="-mr-2 -mt-2 h-8 px-2" onClick={() => void handleOpenChange(false)} aria-label="Fechar tutorial">
              Fechar
            </Button>
          </div>
          <div className="mt-3 rounded-xl border bg-secondary/45 p-3 text-sm">
            <p className="font-semibold">{current.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{current.description}</p>
          </div>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs leading-5 text-muted-foreground">
            <Checkbox checked={suppress} onCheckedChange={(checked) => setSuppress(checked === true)} />
            Não mostrar este tutorial novamente
          </label>
          <div className="mt-3 flex items-center justify-between gap-2">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>
              <ChevronLeft /> Voltar
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}>
                Próximo <ChevronRight />
              </Button>
            ) : (
              <Button disabled={save.isPending} onClick={() => void finish()}>{save.isPending ? 'Salvando…' : 'Concluir tutorial'}</Button>
            )}
          </div>
        </aside>
      )}
    </>
  );
}
