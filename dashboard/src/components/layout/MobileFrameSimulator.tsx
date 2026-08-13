import React from 'react';
import { useViewport } from '@/contexts/ViewportContext';
import { Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface MobileFrameSimulatorProps {
  children: React.ReactNode;
}

export function MobileFrameSimulator({ children }: MobileFrameSimulatorProps) {
  const { viewportMode, toggleViewportMode } = useViewport();

  if (viewportMode === 'desktop') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen w-full bg-slate-900/90 py-6 px-4 flex flex-col items-center justify-center transition-colors duration-300">
      {/* Barra de controle superior fora da moldura */}
      <div className="mb-4 flex items-center justify-between w-full max-w-[410px] px-2 text-slate-300">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Smartphone className="h-4 w-4 text-primary" />
          <span>Simulador Mobile (393 × 852px)</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleViewportMode}
          className="h-8 text-xs bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200 gap-1.5"
        >
          <Monitor className="h-3.5 w-3.5" />
          Voltar para Web
        </Button>
      </div>

      {/* Moldura de Smartphone */}
      <div className="relative w-[393px] h-[852px] bg-background rounded-[48px] shadow-2xl border-[10px] border-slate-800 ring-1 ring-slate-700/50 overflow-hidden flex flex-col">
        {/* Notch / Dynamic Island */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-slate-900 rounded-b-2xl z-50 flex items-center justify-center pointer-events-none">
          <div className="w-3 h-3 rounded-full bg-slate-950/80 mr-2" />
          <div className="w-2 h-2 rounded-full bg-blue-900/50" />
        </div>

        {/* Conteúdo com Scroll da Tela Mobile */}
        <div className="flex-1 w-full h-full overflow-y-auto overflow-x-hidden pt-6">
          {children}
        </div>
      </div>
    </div>
  );
}
