import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSupabaseQuery, useSupabaseMutation } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  Users, 
  Loader2, 
  Eye, 
  ExternalLink,
  Info
} from 'lucide-react';
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

export default function ChallengesList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const { toast } = useToast();

  // Fetch challenges with participants count
  const { data: challenges, isLoading, refetch } = useSupabaseQuery<any[]>(
    ['admin', 'challenges', 'list'],
    async () => {
      const { data, error } = await supabase
        .from('challenges')
        .select(`
          *,
          challenge_enrollments(count)
        `)
        .order('created_at', { ascending: false });
      return { data, error };
    }
  );

  // Delete challenge mutation
  const deleteChallenge = useSupabaseMutation<string, null>(
    async (id) => {
      const { data, error } = await supabase
        .from('challenges')
        .delete()
        .eq('id', id);
      return { data, error };
    },
    {
      onSuccess: () => {
        toast({
          title: "Desafio excluído",
          description: "O desafio foi removido do banco de dados.",
        });
        refetch();
      },
      onError: (err) => {
        toast({
          title: "Erro ao excluir",
          description: err.message || "Não foi possível excluir o desafio.",
          variant: "destructive",
        });
      }
    }
  );

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Tem certeza que deseja excluir o desafio "${title}"?`)) {
      deleteChallenge.mutate(id);
    }
  };

  // Filter logic
  const filteredChallenges = challenges?.filter((challenge) => {
    const matchesSearch = 
      challenge.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (challenge.subtitle && challenge.subtitle.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesTier = tierFilter === 'all' || challenge.tier === tierFilter;

    return matchesSearch && matchesTier;
  });

  const getTierLabel = (tier: string) => {
    const map: any = {
      admin: 'Oficial 🏅',
      influencer: 'Influenciador ⭐',
      premium_user: 'Premium 💎',
      free_user: 'Grátis 🔓',
    };
    return map[tier] || tier;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-sans">Desafios</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie os desafios, regras e prêmios dos usuários.</p>
        </div>
        <Button asChild className="gap-2 shrink-0">
          <Link to="/challenges/new">
            <Plus className="w-4 h-4" />
            Novo Desafio
          </Link>
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
          <Input
            placeholder="Pesquisar desafio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="h-10 px-3.5 py-1.5 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">Todas as Categorias (Tiers)</option>
          <option value="admin">Oficial (Admin)</option>
          <option value="influencer">Influenciador</option>
          <option value="premium_user">Premium</option>
          <option value="free_user">Grátis</option>
        </select>
      </div>

      {/* Challenges Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground font-medium">Carregando desafios...</span>
          </div>
        ) : filteredChallenges && filteredChallenges.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Nível (Tier)</TableHead>
                <TableHead className="text-center">Duração</TableHead>
                <TableHead className="text-center">Inscritos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredChallenges.map((challenge) => {
                const enrollmentsCount = challenge.challenge_enrollments?.[0]?.count ?? 0;
                return (
                  <TableRow key={challenge.id}>
                    <TableCell>
                      <div className="font-semibold text-foreground">{challenge.title}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-md mt-0.5">{challenge.subtitle || 'Sem subtítulo'}</div>
                    </TableCell>
                    <TableCell className="capitalize text-foreground font-medium">{challenge.category}</TableCell>
                    <TableCell>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-primary border border-primary/10">
                        {getTierLabel(challenge.tier)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-medium text-foreground">{challenge.duration_days} dias</TableCell>
                    <TableCell className="text-center">
                      <Link 
                        to={`/challenges/${challenge.id}/participants`}
                        className="inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>{enrollmentsCount}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <Link to={`/challenges/${challenge.id}/participants`} title="Ver participantes">
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/5">
                          <Link to={`/challenges/${challenge.id}`} title="Editar desafio">
                            <Edit className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(challenge.id, challenge.title)}
                          disabled={deleteChallenge.isPending}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/5"
                          title="Excluir desafio"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Info className="w-8 h-8 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg text-foreground">Nenhum desafio encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Crie um novo desafio ou ajuste os filtros de pesquisa para visualizar os dados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
