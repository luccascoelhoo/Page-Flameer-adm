// PageHeader.tsx — o cabeçalho-padrão da sala de controle (J1 · 17/08).
// Toda página do painel abre igual: título firme, subtítulo curto, ações à
// direita. Densidade sobe (text-2xl, não 3xl) — cabeçalho não é outdoor.

import React from 'react';

export default function PageHeader({
  titulo,
  subtitulo,
  acoes,
}: {
  titulo: string;
  subtitulo?: string;
  acoes?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{titulo}</h1>
        {subtitulo && (
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{subtitulo}</p>
        )}
      </div>
      {acoes && <div className="flex items-center gap-2 shrink-0">{acoes}</div>}
    </div>
  );
}
