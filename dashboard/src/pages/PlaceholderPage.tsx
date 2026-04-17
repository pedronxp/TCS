import { Construction } from 'lucide-react';

interface Props {
  titulo: string;
  fase: string;
  descricao?: string;
}

export function PlaceholderPage({ titulo, fase, descricao }: Props) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
        {descricao && <p className="text-sm text-muted-foreground mt-1">{descricao}</p>}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 mb-4">
          <Construction className="w-7 h-7 text-amber-600" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Em desenvolvimento</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Esta tela será implementada na <strong>{fase}</strong>.
        </p>
      </div>
    </div>
  );
}
