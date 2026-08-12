import React from 'react';
import { Check, Palette } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import type { Theme } from '@/hooks/useTheme';

export interface ThemeOption {
  id: Theme;
  name: string;
  description: string;
  colors: [string, string, string]; // [Background, Surface/Card, Primary Accent]
  isLight?: boolean;
}

const THEMES: ThemeOption[] = [
  {
    id: 'light',
    name: 'Light (Padrão)',
    description: 'Superfícies claras e límpidas com alto contraste e acabamento profissional.',
    colors: ['#FAFAFA', '#FFFFFF', '#171717'],
    isLight: true,
  },
  {
    id: 'dark',
    name: 'Dark (Padrão)',
    description: 'Fundo escuro neutro e elegante, reduzindo o estresse visual.',
    colors: ['#171717', '#1F1F1F', '#FAFAFA'],
  },
  {
    id: 'orca',
    name: 'Padrão 3',
    description: 'Fundo preto fosco com destaques operacionais em verde vibrante.',
    colors: ['#0F1411', '#171D19', '#22C55E'],
  },
  {
    id: 'dracula',
    name: 'Padrão 4',
    description: 'Tons roxos e cianos inspirados na paleta clássica de alto contraste.',
    colors: ['#282A36', '#343746', '#BD93F9'],
  },
  {
    id: 'nord',
    name: 'Padrão 5',
    description: 'Azuis árticos e contraste suave para rotinas estendidas.',
    colors: ['#2E3440', '#3B4252', '#88C0D0'],
  },
  {
    id: 'gruvbox',
    name: 'Padrão 6',
    description: 'Paleta acolhedora com tons quentes e terrosos.',
    colors: ['#282828', '#3C3836', '#FABD2F'],
  },
];

interface ThemePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTheme: Theme;
  onSelectTheme: (themeId: Theme) => void;
}

export function ThemePickerModal({
  open,
  onOpenChange,
  currentTheme,
  onSelectTheme,
}: ThemePickerModalProps) {
  const [selectedId, setSelectedId] = React.useState<Theme>(currentTheme);

  React.useEffect(() => {
    setSelectedId(currentTheme);
  }, [currentTheme]);

  const handleApply = () => {
    onSelectTheme(selectedId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl p-6 shadow-2xl">
        <DialogHeader className="pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">Aparência do Console</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Escolha a paleta visual mais confortável para a sua operação.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {THEMES.map((theme) => {
            const isSelected = selectedId === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => setSelectedId(theme.id)}
                className={`group relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all duration-200 hover:border-primary/50 focus:outline-none ${
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/40 shadow-sm'
                    : 'border-border/70 bg-card/60 hover:bg-secondary/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-3.5 w-6 rounded-full border border-black/20 shadow-xs"
                        style={{ backgroundColor: theme.colors[0] }}
                      />
                      <span
                        className="h-3.5 w-6 rounded-full border border-black/20 shadow-xs"
                        style={{ backgroundColor: theme.colors[1] }}
                      />
                      <span
                        className="h-3.5 w-6 rounded-full border border-black/20 shadow-xs"
                        style={{ backgroundColor: theme.colors[2] }}
                      />
                    </div>
                    {isSelected && (
                      <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {theme.name}
                  </h4>

                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {theme.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="pt-4 border-t border-border/60 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            A preferência é salva localmente e pode ser alterada a qualquer momento.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleApply}>
              Aplicar Tema
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
