import { useId, useMemo, useRef, useState } from 'react';
import { AlignLeft, Search, Smile, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { Textarea } from '@/components/ui/Textarea';

const MESSAGE_LIMIT = 5000;

const MESSAGE_EMOJIS = [
  { emoji: '⚠️', label: 'Alerta' },
  { emoji: '🚨', label: 'Emergência' },
  { emoji: '📢', label: 'Comunicado' },
  { emoji: '📍', label: 'Local' },
  { emoji: '🕒', label: 'Horário' },
  { emoji: '🌧️', label: 'Chuva' },
  { emoji: '🌊', label: 'Enchente' },
  { emoji: '⛈️', label: 'Tempestade' },
  { emoji: '✅', label: 'Confirmação' },
  { emoji: '❌', label: 'Interdição' },
  { emoji: '☎️', label: 'Contato' },
  { emoji: '🏥', label: 'Atendimento' },
  { emoji: '🏠', label: 'Abrigo' },
  { emoji: '🤝', label: 'Apoio' },
  { emoji: '🙏', label: 'Agradecimento' },
] as const;

const CONTEXT_SUGGESTIONS = [
  { label: 'Local e horário', text: '📍 Local: \n🕒 Horário: ' },
  { label: 'Orientações', text: '✅ Orientações:\n• \n• ' },
  { label: 'Contato', text: '☎️ Contato para apoio: ' },
] as const;

interface ComunicadoMessageFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ComunicadoMessageField({ label, value, onChange }: ComunicadoMessageFieldProps) {
  const textareaId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function insertText(text: string, separateParagraph = false) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? start;
    const prefix = separateParagraph && start > 0 && !value.slice(0, start).endsWith('\n\n')
      ? value.slice(0, start).endsWith('\n') ? '\n' : '\n\n'
      : '';
    const insertion = `${prefix}${text}`;
    const nextValue = `${value.slice(0, start)}${insertion}${value.slice(end)}`.slice(0, MESSAGE_LIMIT);
    onChange(nextValue);

    requestAnimationFrame(() => {
      if (!textarea) return;
      const cursor = Math.min(start + insertion.length, nextValue.length);
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="space-y-2">
      <label htmlFor={textareaId} className="block text-sm font-medium">{label}</label>
      <Textarea
        id={textareaId}
        ref={textareaRef}
        className="min-h-36 resize-y"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Explique a situação, informe os locais afetados e oriente a população."
        maxLength={MESSAGE_LIMIT}
        required
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Smile aria-hidden /> Emojis
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(19rem,calc(100vw-2rem))]">
              <p className="mb-2 text-sm font-semibold">Adicionar emoji</p>
              <div className="grid grid-cols-5 gap-1">
                {MESSAGE_EMOJIS.map(({ emoji, label: emojiLabel }) => (
                  <button
                    key={emojiLabel}
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-xl hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Inserir emoji ${emojiLabel}`}
                    onClick={() => insertText(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <AlignLeft aria-hidden /> Adicionar contexto
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(21rem,calc(100vw-2rem))]">
              <p className="mb-2 text-sm font-semibold">Completar a mensagem</p>
              <div className="grid gap-1">
                {CONTEXT_SUGGESTIONS.map(({ label: suggestionLabel, text }) => (
                  <Button
                    key={suggestionLabel}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    onClick={() => insertText(text, true)}
                  >
                    {suggestionLabel}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {value.length.toLocaleString('pt-BR')} / 5.000
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Use emojis, quebras de linha e *negrito* para deixar o aviso mais claro no WhatsApp.
      </p>
    </div>
  );
}

export interface WhatsAppDestination {
  id: string;
  nome: string;
  grupoNome?: string | null;
  comunidadeNome?: string | null;
}

interface WhatsAppDestinationPickerProps {
  destinations: WhatsAppDestination[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  disabled?: boolean;
}

export function WhatsAppDestinationPicker({
  destinations,
  selectedIds,
  onChange,
  disabled = false,
}: WhatsAppDestinationPickerProps) {
  const [filter, setFilter] = useState('');
  const matchingDestinations = useMemo(() => {
    const search = filter.trim().toLocaleLowerCase('pt-BR');
    if (!search) return destinations;
    return destinations.filter((destination) =>
      [destination.nome, destination.grupoNome, destination.comunidadeNome]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(search),
    );
  }, [destinations, filter]);

  function toggleDestination(destinationId: string) {
    onChange(selectedIds.includes(destinationId)
      ? selectedIds.filter((id) => id !== destinationId)
      : [...selectedIds, destinationId]);
  }

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium">Grupos e comunidades do WhatsApp</legend>
      {destinations.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Nenhum grupo ou comunidade ativo com chat vinculado.
        </p>
      ) : (
        <>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              className="pl-9"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filtrar grupos ou comunidades"
              aria-label="Filtrar grupos e comunidades do WhatsApp"
            />
          </label>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-secondary/70">
              <input
                type="checkbox"
                checked={selectedIds.length === 0}
                onChange={() => onChange([])}
              />
              <Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>Todos os grupos e comunidades ({destinations.length})</span>
            </label>
            {matchingDestinations.map((destination) => (
              <label
                key={destination.id}
                className="flex min-h-11 cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-secondary/70"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selectedIds.includes(destination.id)}
                  onChange={() => toggleDestination(destination.id)}
                />
                <span className="min-w-0 break-words">
                  <span className="block font-medium">{destination.nome}</span>
                  {(destination.grupoNome || destination.comunidadeNome) && (
                    <span className="block text-xs text-muted-foreground">
                      {destination.comunidadeNome ? `Comunidade: ${destination.comunidadeNome}` : 'Grupo independente'}
                      {destination.grupoNome ? ` · Grupo: ${destination.grupoNome}` : ''}
                    </span>
                  )}
                </span>
              </label>
            ))}
            {matchingDestinations.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted-foreground">Nenhum destino encontrado com esse filtro.</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {selectedIds.length === 0
              ? 'O disparo alcançará todos os destinos ativos.'
              : `${selectedIds.length} ${selectedIds.length === 1 ? 'destino selecionado' : 'destinos selecionados'} para o disparo.`}
          </p>
        </>
      )}
    </fieldset>
  );
}
