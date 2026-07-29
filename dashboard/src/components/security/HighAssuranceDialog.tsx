import { HighRiskDialog } from '@/components/ui/HighRiskDialog';

export interface HighAssuranceDialogProps {
  open: boolean;
  title: string;
  impact: string;
  confirmLabel: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function HighAssuranceDialog({ open, title, impact, confirmLabel, onOpenChange, onConfirm }: HighAssuranceDialogProps) {
  return <HighRiskDialog open={open} title={title} description={impact} confirmLabel={confirmLabel} onClose={() => onOpenChange(false)} onConfirm={onConfirm} />;
}
