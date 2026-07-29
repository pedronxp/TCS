import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search, Settings2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/DropdownMenu';
import { PaginationControls } from '@/components/ui/Pagination';

export function DataTableToolbar({ query, onQueryChange, placeholder = 'Buscar…', activeFilterCount = 0, onClear, filters, viewOptions }: { query: string; onQueryChange: (value: string) => void; placeholder?: string; activeFilterCount?: number; onClear?: () => void; filters?: ReactNode; viewOptions?: ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="relative min-w-0 flex-1 sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={placeholder} className="pl-9" /></div>{filters}{activeFilterCount > 0 && onClear && <Button variant="ghost" size="sm" onClick={onClear}>Limpar {activeFilterCount} <X /></Button>}{viewOptions}</div>;
}

export function DataTableColumnHeader({ title, direction, onSort }: { title: string; direction?: false | 'asc' | 'desc'; onSort?: () => void }) {
  if (!onSort) return <span>{title}</span>;
  const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ArrowUpDown;
  return <button type="button" onClick={onSort} className="inline-flex items-center gap-1.5 rounded text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{title}<Icon className="h-3.5 w-3.5" /></button>;
}

export function DataTableViewOptions({ columns }: { columns: Array<{ id: string; label: string; visible: boolean; onVisibleChange: (value: boolean) => void }> }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Settings2 />Colunas</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>Exibir colunas</DropdownMenuLabel><DropdownMenuSeparator />{columns.map((column) => <DropdownMenuCheckboxItem key={column.id} checked={column.visible} onCheckedChange={(value) => column.onVisibleChange(Boolean(value))}>{column.label}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu>;
}

export { PaginationControls as DataTablePagination };
