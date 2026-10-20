// StatCard.tsx — o mostrador-padrão da sala de controle (J1 · 17/08).
// Número grande, rótulo curto, contexto opcional. Denso e uniforme — os
// cards-resumo artesanais de cada página convergem para este.

import React from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StatCard({
  rotulo,
  valor,
  contexto,
  icone: Icone,
  tom = 'neutro',
}: {
  rotulo: string;
  valor: React.ReactNode;
  contexto?: string;
  icone?: LucideIcon;
  tom?: 'neutro' | 'acento' | 'sucesso' | 'alerta';
}) {
  const tons: Record<string, string> = {
    neutro: 'bg-secondary text-muted-foreground',
    acento: 'bg-primary/15 text-primary',
    sucesso: 'bg-success/15 text-success',
    alerta: 'bg-destructive/15 text-destructive',
  };
  return (
    <div className="bg-card border border-border rounded-md p-4 flex items-center gap-3.5">
      {Icone && (
        <div className={cn('w-9 h-9 rounded-md flex items-center justify-center shrink-0', tons[tom])}>
          <Icone className="w-4.5 h-4.5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-2xl font-bold text-foreground leading-none tabular-nums">{valor}</p>
        <p className="text-[11px] text-muted-foreground mt-1.5 truncate">{rotulo}</p>
        {contexto && <p className="text-[10px] text-muted-foreground/70 truncate">{contexto}</p>}
      </div>
    </div>
  );
}
