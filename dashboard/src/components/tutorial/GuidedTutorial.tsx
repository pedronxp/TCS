import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CircleHelp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
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
      <Dialog open={open} onOpenChange={(next) => void handleOpenChange(next)}>
        <DialogContent>
          <DialogHeader>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Tutorial {step + 1} de {steps.length}</p>
            <DialogTitle>{step === 0 ? title : current.title}</DialogTitle>
            <DialogDescription>{step === 0 ? description : current.description}</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-secondary/45 p-4 text-sm">
            <p className="font-semibold">{current.title}</p>
            <p className="mt-1 text-muted-foreground">{current.description}</p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={suppress} onCheckedChange={(checked) => setSuppress(checked === true)} />
            Não mostrar novamente neste dispositivo e nos meus outros acessos
          </label>
          <DialogFooter className="items-center sm:justify-between">
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

