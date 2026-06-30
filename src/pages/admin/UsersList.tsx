import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, User, Flame, Award, Eye, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

export default function UsersList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Fetch all user profiles
  const { data: users, isLoading } = useSupabaseQuery<any[]>(
    ['admin', 'users', 'list'],
    async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      return { data, error };
    }
  );

  // Filter logic
  const filteredUsers = users?.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'professional':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'bg-secondary text-secondary-foreground border-border';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground font-sans">Usuários</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie e analise as estatísticas e permissões dos usuários do Flameer.</p>
      </div>

      {/* Search and filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome de usuário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-10 px-3.5 py-1.5 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">Todos os Níveis de Acesso</option>
          <option value="user">Usuário Comum</option>
          <option value="professional">Profissional / Personal</option>
          <option value="admin">Administrador</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground font-medium">Carregando usuários...</span>
          </div>
        ) : filteredUsers && filteredUsers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Perfil</TableHead>
                <TableHead>Permissão</TableHead>
                <TableHead className="text-center">Fogo (Streak)</TableHead>
                <TableHead className="text-center">Total XP</TableHead>
                <TableHead className="text-center">Nível</TableHead>
                <TableHead className="text-right">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-border">
                        {u.avatar_url ? (
                          <AvatarImage src={u.avatar_url} alt={u.name} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                          {u.name?.substring(0, 2).toUpperCase() || 'AD'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold text-foreground">{u.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Cadastrado em {new Date(u.created_at).toLocaleDateString('pt-BR')}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border capitalize ${getRoleBadgeClass(u.role)}`}>
                      {u.role}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="inline-flex items-center gap-1 font-bold text-amber-500 text-sm">
                      <Flame className="w-4 h-4" />
                      <span>{u.streak}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-semibold text-foreground">{u.xp} XP</TableCell>
                  <TableCell className="text-center">
                    <div className="inline-flex items-center gap-1 text-xs font-bold text-foreground">
                      <Award className="w-3.5 h-3.5 text-primary" />
                      <span>{u.level}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/5">
                      <Link to={`/users/${u.id}`} title="Ver perfil detalhado">
                        <Eye className="w-4 h-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Info className="w-8 h-8 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg text-foreground">Nenhum usuário encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Não há correspondência com os critérios de filtro informados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
