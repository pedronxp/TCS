/* eslint-disable react-refresh/only-export-components */
import { createContext, forwardRef, useContext, useId, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import * as RechartsPrimitive from 'recharts';
import { cn } from '@/lib/utils';

export type ChartConfig = Record<string, { label?: ReactNode; icon?: React.ComponentType; color?: string }>;
const ChartContext = createContext<{ config: ChartConfig } | null>(null);
function useChart() { const context = useContext(ChartContext); if (!context) throw new Error('useChart deve ser usado dentro de ChartContainer'); return context; }

export const ChartContainer = forwardRef<HTMLDivElement, ComponentProps<'div'> & { config: ChartConfig; children: ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children'] }>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, '')}`;
  return <ChartContext.Provider value={{ config }}><div data-chart={chartId} ref={ref} className={cn('flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-layer]:outline-none [&_.recharts-surface]:outline-none', className)} {...props}><ChartStyle id={chartId} config={config} /><RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer></div></ChartContext.Provider>;
});
ChartContainer.displayName = 'Chart';

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, value]) => value.color);
  if (!colorConfig.length) return null;
  return <style dangerouslySetInnerHTML={{ __html: `[data-chart=${id}] {${colorConfig.map(([key, item]) => `--color-${key}: ${item.color};`).join('')}}` }} />;
}

export const ChartTooltip = RechartsPrimitive.Tooltip;
export function ChartTooltipContent({ active, payload, label, className }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string; color?: string; dataKey?: string }>; label?: ReactNode; className?: string }) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;
  return <div className={cn('grid min-w-32 gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs shadow-xl', className)}>{label && <div className="font-semibold">{label}</div>}{payload.map((item, index) => { const key = item.dataKey || item.name || `item-${index}`; return <div key={key} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color || config[key]?.color } as CSSProperties} /><span className="text-muted-foreground">{config[key]?.label || item.name}</span><span className="ml-auto font-mono font-semibold tabular-nums">{item.value}</span></div>; })}</div>;
}

export const ChartLegend = RechartsPrimitive.Legend;
export function ChartLegendContent({ payload, className }: { payload?: Array<{ value?: string; color?: string }>; className?: string }) {
  const { config } = useChart();
  if (!payload?.length) return null;
  return <div className={cn('flex items-center justify-center gap-4', className)}>{payload.map((item) => <div key={item.value} className="flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} />{config[item.value || '']?.label || item.value}</div>)}</div>;
}
