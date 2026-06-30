import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSupabaseQuery, useSupabaseMutation } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Trash2, Edit, Loader2, Apple, Link as LinkIcon, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

export default function DietsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  // Fetch diets list
  const { data: diets, isLoading, refetch } = useSupabaseQuery<any[]>(
    ['admin', 'diets', 'list'],
    async () => {
      const { data, error } = await supabase
        .from('diets')
        .select(`
          *,
          challenges(id, title)
        `)
        .order('created_at', { ascending: false });
      return { data, error };
    }
  );

  // Delete diet mutation
  const deleteDiet = useSupabaseMutation<string, null>(
    async (id) => {
      const { data, error } = await supabase
        .from('diets')
        .delete()
        .eq('id', id);
      return { data, error };
    },
    {
      onSuccess: () => {
        toast({
          title: "Dieta excluída",
          description: "O plano alimentar foi removido com sucesso.",
        });
        refetch();
      },
      onError: (err) => {
        toast({
          title: "Erro ao excluir",
          description: err.message || "Não foi possível excluir a dieta.",
          variant: "destructive",
        });
      }
    }
  );

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Tem certeza que deseja excluir a dieta "${title}"? Todas as refeições e alimentos vinculados serão apagados.`)) {
      deleteDiet.mutate(id);
    }
  };

  // Search logic
  const filteredDiets = diets?.filter((d) =>
    d.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-sans">Dietas</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie os planos de nutrição, refeições e alimentos.</p>
        </div>
        <span />
      </div>

      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
        <Input
          placeholder="Pesquisar dieta pelo título..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground font-medium">Carregando dietas...</span>
          </div>
        ) : filteredDiets && filteredDiets.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Desafio Vinculado</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDiets.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-primary/10 text-primary rounded">
                        <Apple className="w-4.5 h-4.5" />
                      </div>
                      <span className="font-semibold text-foreground">{d.title}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {d.challenges ? (
                      <Link 
                        to={`/challenges/${d.challenges.id}`}
                        className="inline-flex items-center gap-1 text-xs text-primary font-bold hover:underline truncate max-w-[200px]"
                      >
                        <LinkIcon className="w-3 h-3" />
                        <span>{d.challenges.title}</span>
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Nenhum</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      d.is_template 
                        ? 'bg-blue-500/10 text-blue-500' 
                        : 'bg-secondary text-secondary-foreground'
                    }`}>
                      {d.is_template ? 'Template' : 'Personalizado'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {d.challenges ? (
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/5">
                          <Link to={`/challenges/${d.challenges.id}`} title="Editar dieta no desafio">
                            <Edit className="w-4 h-4" />
                          </Link>
                        </Button>
                      ) : null}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(d.id, d.title)}
                        disabled={deleteDiet.isPending}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/5"
                        title="Excluir dieta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Info className="w-8 h-8 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg text-foreground">Nenhuma dieta encontrada</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Crie um novo plano alimentar ou mude os filtros para buscar dietas cadastradas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
