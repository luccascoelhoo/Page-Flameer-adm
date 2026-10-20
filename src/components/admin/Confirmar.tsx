// Confirmar.tsx — o fim do confirm() do browser no painel (J1 · 17/08).
//
// O confirm() nativo era a cara do "genérico": popup do sistema, sem tema,
// sem hierarquia, texto espremido. Este provider dá um AlertDialog do design
// system com a MESMA ergonomia de uma linha:
//
//   const confirmar = useConfirmar();
//   if (await confirmar({ titulo: 'Excluir treino?', descricao: '…',
//                         destrutivo: true })) { … }
//
// Uma promessa por vez (fila de 1): confirmação é modal por natureza.

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface OpcoesDeConfirmacao {
  titulo: string;
  descricao?: string;
  confirmar?: string;   // rótulo do botão de ação (default "Confirmar")
  cancelar?: string;    // default "Cancelar"
  destrutivo?: boolean; // pinta a ação de destructive
}

const ConfirmarContext = createContext<(o: OpcoesDeConfirmacao) => Promise<boolean>>(
  async () => true);

export function ConfirmarProvider({ children }: { children: React.ReactNode }) {
  const [opcoes, setOpcoes] = useState<OpcoesDeConfirmacao | null>(null);
  const resolver = useRef<(v: boolean) => void>();

  const confirmar = useCallback((o: OpcoesDeConfirmacao) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOpcoes(o);
    });
  }, []);

  const fechar = (resultado: boolean) => {
    resolver.current?.(resultado);
    resolver.current = undefined;
    setOpcoes(null);
  };

  return (
    <ConfirmarContext.Provider value={confirmar}>
      {children}
      <AlertDialog open={opcoes !== null} onOpenChange={(aberto) => { if (!aberto) fechar(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opcoes?.titulo}</AlertDialogTitle>
            {opcoes?.descricao && (
              <AlertDialogDescription>{opcoes.descricao}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => fechar(false)}>
              {opcoes?.cancelar ?? 'Cancelar'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => fechar(true)}
              className={opcoes?.destrutivo
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : undefined}
            >
              {opcoes?.confirmar ?? 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmarContext.Provider>
  );
}

export const useConfirmar = () => useContext(ConfirmarContext);
