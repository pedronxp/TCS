import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/Command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useBrazilianMunicipalities } from '@/hooks/useBrazilianMunicipalities';
import { cn } from '@/lib/utils';

type BrazilMunicipalityPickerProps = {
  uf: string;
  value: string;
  onValueChange: (municipality: string) => void;
  id?: string;
  includeAll?: boolean;
  allValue?: string;
  allLabel?: string;
  placeholder?: string;
  className?: string;
};

type BrazilStateSelectProps = {
  value: string;
  onValueChange: (uf: string) => void;
  id?: string;
  includeAll?: boolean;
  allLabel?: string;
};

const brazilianStates = [
  ['AC', 'Acre'], ['AL', 'Alagoas'], ['AP', 'Amapá'], ['AM', 'Amazonas'], ['BA', 'Bahia'], ['CE', 'Ceará'], ['DF', 'Distrito Federal'], ['ES', 'Espírito Santo'], ['GO', 'Goiás'], ['MA', 'Maranhão'], ['MT', 'Mato Grosso'], ['MS', 'Mato Grosso do Sul'], ['MG', 'Minas Gerais'], ['PA', 'Pará'], ['PB', 'Paraíba'], ['PR', 'Paraná'], ['PE', 'Pernambuco'], ['PI', 'Piauí'], ['RJ', 'Rio de Janeiro'], ['RN', 'Rio Grande do Norte'], ['RS', 'Rio Grande do Sul'], ['RO', 'Rondônia'], ['RR', 'Roraima'], ['SC', 'Santa Catarina'], ['SP', 'São Paulo'], ['SE', 'Sergipe'], ['TO', 'Tocantins'],
] as const;

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export function BrazilStateSelect({ value, onValueChange, id, includeAll = false, allLabel = 'Todos os estados' }: BrazilStateSelectProps) {
  return <Select value={value || (includeAll ? '__all__' : undefined)} onValueChange={(nextValue) => onValueChange(nextValue === '__all__' ? '' : nextValue)}>
    <SelectTrigger id={id}><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
    <SelectContent>
      {includeAll && <SelectItem value="__all__">{allLabel}</SelectItem>}
      {brazilianStates.map(([uf, name]) => <SelectItem key={uf} value={uf}>{name} ({uf})</SelectItem>)}
    </SelectContent>
  </Select>;
}

export function BrazilMunicipalityPicker({ uf, value, onValueChange, id, includeAll = false, allValue = 'all', allLabel = 'Todos os municípios', placeholder = 'Pesquisar município', className }: BrazilMunicipalityPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const municipalities = useBrazilianMunicipalities(open && Boolean(uf));
  const selected = municipalities.data?.find((municipality) => municipality.name === value && municipality.uf === uf);
  const matches = useMemo(() => {
    const term = normalize(search.trim());
    return (municipalities.data ?? []).filter((municipality) => municipality.uf === uf && (!term || normalize(municipality.name).includes(term))).slice(0, 80);
  }, [municipalities.data, search, uf]);
  const label = value === allValue && includeAll ? allLabel : selected?.label ?? value;

  return <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setSearch(''); }}>
    <PopoverTrigger asChild>
      <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} disabled={!uf} className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground', className)}>
        <span className="truncate">{label || placeholder}</span><ChevronsUpDown className="opacity-60" />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[18rem] p-0" align="start">
      <Command shouldFilter={false}>
        <CommandInput value={search} onValueChange={setSearch} placeholder="Nome ou UF, ex.: Aurora RO" />
        <CommandList>
          {municipalities.isLoading && <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Consultando municípios…</p>}
          {municipalities.isError && <p className="px-3 py-4 text-sm text-destructive">Não foi possível carregar a base do IBGE. Tente novamente.</p>}
          {!municipalities.isLoading && !municipalities.isError && includeAll && <CommandItem value="all-municipalities" onSelect={() => { onValueChange(allValue); setOpen(false); }}><Check className={cn('h-4 w-4', value === allValue ? 'opacity-100' : 'opacity-0')} />{allLabel}</CommandItem>}
          {!municipalities.isLoading && !municipalities.isError && <CommandEmpty>Nenhum município encontrado.</CommandEmpty>}
          {matches.map((municipality) => <CommandItem key={municipality.id} value={`${municipality.name} ${municipality.uf}`} onSelect={() => { onValueChange(municipality.name); setOpen(false); }}><Check className={cn('h-4 w-4', value === municipality.name ? 'opacity-100' : 'opacity-0')} /><MapPin className="h-4 w-4 text-muted-foreground" /><span>{municipality.name}</span><span className="ml-auto text-xs text-muted-foreground">{municipality.uf}</span></CommandItem>)}
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>;
}
