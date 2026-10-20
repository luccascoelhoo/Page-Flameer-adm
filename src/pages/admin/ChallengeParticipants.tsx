import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Loader2, Users, Calendar, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

export default function ChallengeParticipants() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Fetch challenge title
  const { data: challenge } = useSupabaseQuery<any>(
    ['admin', 'challenges', 'title-only', id],
    async () => {
      const { data, error } = await supabase
        .from('challenges')
        .select('title')
        .eq('id', id)
        .single();
      return { data, error };
    }
  );

  // Fetch participants
  const { data: participants, isLoading } = useSupabaseQuery<any[]>(
    ['admin', 'challenges', 'participants', id],
    async () => {
      const { data, error } = await supabase
        .from('challenge_enrollments')
        .select(`
          joined_at,
          completed_at,
          current_day,
          active,
          profiles(id, name, avatar_url, streak, level)
        `)
        .eq('challenge_id', id)
        .order('joined_at', { ascending: false });
      return { data, error };
    }
  );

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="h-9 w-9 text-muted-foreground hover:text-foreground">
          <Link to="/challenges">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
            Participantes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inscritos no desafio: <span className="font-semibold text-foreground">{challenge?.title || 'Carregando...'}</span>
          </p>
        </div>
      </div>

      {/* Participants Table */}
      <div className="bg-card border border-border rounded-md overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground font-medium">Carregando participantes...</span>
          </div>
        ) : participants && participants.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Data de Entrada</TableHead>
                <TableHead className="text-center">Dia Atual</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Conclusão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((enrollment, idx) => {
                const userProfile = enrollment.profiles;
                return (
                  <TableRow key={idx}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-border">
                          {userProfile?.avatar_url ? (
                            <AvatarImage src={userProfile.avatar_url} alt={userProfile.name} />
                          ) : null}
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                            {userProfile?.name?.substring(0, 2).toUpperCase() || 'AD'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-foreground">{userProfile?.name || 'Recruta'}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Level {userProfile?.level || 1} • Fogo: {userProfile?.streak || 0} dias
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm font-medium">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{new Date(enrollment.joined_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-bold text-foreground">
                      Dia {enrollment.current_day}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${
                        enrollment.active 
                          ? 'bg-green-500/10 text-green-500' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {enrollment.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm font-medium">
                      {enrollment.completed_at ? (
                        <div className="flex items-center gap-1.5 text-amber-500">
                          <Award className="w-3.5 h-3.5" />
                          <span>{new Date(enrollment.completed_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Em andamento</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Users className="w-8 h-8 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg text-foreground">Nenhum participante ainda</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Nenhum usuário se inscreveu neste desafio no aplicativo até o momento.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
