import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/Command';
import { useAuth } from '@/contexts/AuthContext';
import { resolveNavigation } from '@/config/navigation';
import type { Theme } from '@/hooks/useTheme';

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
};

/**
 * Paleta global de comandos (Ctrl/⌘ K): navega entre páginas liberadas para o
 * perfil e alterna tema. Complementa a busca de clientes do cabeçalho, que
 * continua dedicada ao cadastro.
 */
export function CommandPalette({ open, onOpenChange, theme, onThemeChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const groups = useMemo(
    () =>
      resolveNavigation(
        profile?.role === 'developer' ? 'developer' : 'owner',
        profile?.permissions ?? [],
      ),
    [profile],
  );

  function close() {
    onOpenChange(false);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar páginas e ações… (Esc para fechar)" />
      <CommandList>
        <CommandEmpty>Nenhuma página corresponde à busca.</CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group.label} heading={group.label}>
            {group.items.map((item) => (
              <CommandItem
                key={item.to}
                value={`${item.label} ${item.to}`}
                onSelect={() => {
                  close();
                  navigate(item.to);
                }}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Preferências">
          <CommandItem
            value="alternar tema claro escuro"
            onSelect={() => {
              close();
              onThemeChange(theme === 'light' ? 'dark' : 'light');
            }}
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Sun className="h-4 w-4" aria-hidden="true" />
            )}
            Alternar para tema {theme === 'light' ? 'escuro' : 'claro'}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
