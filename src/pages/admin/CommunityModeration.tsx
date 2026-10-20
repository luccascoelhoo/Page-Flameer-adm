import React, { useState, useEffect } from 'react';
import { useConfirmar } from '@/components/admin/Confirmar';
import { useSupabaseQuery, useSupabaseMutation } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { 
  ShieldAlert, 
  Loader2, 
  Check, 
  X, 
  Trash2, 
  User, 
  MessageSquare, 
  Image, 
  Info,
  Calendar,
  Camera,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

export default function CommunityModeration() {
  const { toast } = useToast();
  const confirmar = useConfirmar();
  const [activeSubTab, setActiveSubTab] = useState<'posts' | 'checkins'>('posts');
  const [filter, setFilter] = useState<'pending' | 'resolved' | 'dismissed'>('pending');

  // ----------------------------------------------------
  // QUERIES & MUTATIONS: Social Network (Posts & Comments)
  // ----------------------------------------------------

  // Fetch reports list
  const { data: reports, isLoading: isLoadingReports, refetch: refetchReports } = useSupabaseQuery<any[]>(
    ['admin', 'community', 'reports', filter],
    async () => {
      const { data, error } = await supabase
        .from('user_reports')
        .select(`
          id,
          reason,
          status,
          created_at,
          reported_user_id,
          post_id,
          comment_id,
          reporter:profiles!user_reports_reporter_id_fkey(name),
          reported_user:profiles!user_reports_reported_user_id_fkey(name),
          posts(id, caption, image_url),
          post_comments(id, content)
        `)
        .eq('status', filter)
        .order('created_at', { ascending: false });
      return { data, error };
    },
    {
      enabled: activeSubTab === 'posts'
    }
  );

  // Review report mutation
  const resolveReport = useSupabaseMutation<any, any>(
    async ({ id, status }) => {
      const { data, error } = await (supabase as any)
        .from('user_reports')
        .update({ status } as any)
        .eq('id', id);
      return { data, error };
    },
    {
      onSuccess: (_, variables) => {
        toast({
          title: variables.status === 'resolved' ? "Denúncia Resolvida" : "Denúncia Ignorada",
          description: "O status da denúncia foi atualizado com sucesso.",
        });
        refetchReports();
      },
      onError: (err) => {
        toast({
          title: "Erro ao processar",
          description: err.message || "Falha ao gravar alteração.",
          variant: "destructive",
        });
      }
    }
  );

  // Delete reported post/comment mutation
  const deleteContent = useSupabaseMutation<any, any>(
    async ({ type, contentId, reportId }) => {
      // `.select()` no delete devolve as linhas removidas. Sem ele, um DELETE
      // barrado pela RLS não vira erro — ele casa ZERO linhas e volta com
      // sucesso, e o painel avisava "Conteúdo Excluído" com o post intacto no
      // app. Zero linhas aqui é falha explícita.
      if (type === 'post') {
        const { data, error } = await supabase
          .from('posts').delete().eq('id', contentId).select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('A publicação não foi removida — seu usuário não tem permissão de moderação no banco.');
        }
      } else if (type === 'comment') {
        const { data, error } = await supabase
          .from('post_comments').delete().eq('id', contentId).select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('O comentário não foi removido — seu usuário não tem permissão de moderação no banco.');
        }
      }
      const { error: reportError } = await (supabase as any)
        .from('user_reports')
        .update({ status: 'resolved' } as any)
        .eq('id', reportId);
      if (reportError) throw reportError;
      return { data: null, error: null };
    },
    {
      onSuccess: () => {
        toast({
          title: "Conteúdo Excluído",
          description: "O item ofensivo foi removido e a denúncia foi dada como resolvida.",
        });
        refetchReports();
      },
      onError: (err) => {
        toast({
          title: "Falha ao excluir",
          description: err.message || "Não foi possível remover o conteúdo.",
          variant: "destructive",
        });
      }
    }
  );

  // ----------------------------------------------------
  // QUERIES & MUTATIONS: Challenge Photo Check-ins
  // ----------------------------------------------------

  // Fetch reported checkins
  const { data: reportedCheckins, isLoading: isLoadingCheckins, refetch: refetchCheckins } = useSupabaseQuery<any[]>(
    ['admin', 'checkins', 'reported'],
    async () => {
      const { data, error } = await supabase
        // `challenge_checkins` NÃO EXISTE. A tabela é `challenge_daily_logs`,
        // e ela não tem policy de UPDATE nenhuma — os botões abaixo afetavam
        // zero linhas em silêncio. A moderação agora entra pela mesma porta que
        // o resto desta tabela: RPC SECURITY DEFINER com guarda is_admin().
        .rpc('admin_checkins_denunciados');
      return { data, error };
    },
    {
      enabled: activeSubTab === 'checkins'
    }
  );

  // Approve reported photo checkin (validates it, set back to 'valid')
  const approveCheckin = useSupabaseMutation<any, any>(
    async (id: string) => {
      const { error } = await (supabase as any)
        .rpc('admin_moderar_checkin', { p_log_id: id, p_status: 'valid' });
      if (error) throw error;
      return { data: null, error: null };
    },
    {
      onSuccess: () => {
        toast({
          title: "Check-in Aprovado",
          description: "A foto foi homologada como legítima e retornada ao status ativo.",
        });
        refetchCheckins();
      },
      onError: (err) => {
        toast({
          title: "Erro ao aprovar check-in",
          description: err.message || "Não foi possível atualizar o status.",
          variant: "destructive",
        });
      }
    }
  );

  // Invalidate reported photo checkin (marks it 'invalid' -> trigger auto estorna points & streak)
  const invalidateCheckin = useSupabaseMutation<any, any>(
    async (id: string) => {
      const { error } = await (supabase as any)
        .rpc('admin_moderar_checkin', { p_log_id: id, p_status: 'invalid' });
      if (error) throw error;
      return { data: null, error: null };
    },
    {
      onSuccess: () => {
        toast({
          title: "Check-in Invalidado 🚫",
          description: "A foto foi rejeitada, os pontos foram estornados e a ofensiva recalculada a partir dos check-ins válidos.",
        });
        refetchCheckins();
      },
      onError: (err) => {
        toast({
          title: "Erro ao invalidar check-in",
          description: err.message || "Não foi possível atualizar o status.",
          variant: "destructive",
        });
      }
    }
  );

  // ----------------------------------------------------
  // HANDLERS
  // ----------------------------------------------------

  const handleReview = (id: string, status: 'resolved' | 'dismissed') => {
    resolveReport.mutate({ id, status });
  };

  const handleDeleteContent = async (type: 'post' | 'comment', contentId: string, reportId: string) => {
    if (await confirmar({
      titulo: type === 'post' ? 'Excluir post permanentemente?' : 'Excluir comentário permanentemente?',
      descricao: 'A exclusão é definitiva e recalcula o dia do autor. Não há como desfazer.',
      confirmar: 'Excluir', destrutivo: true,
    })) {
      deleteContent.mutate({ type, contentId, reportId });
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">Moderação do Ecossistema</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie denúncias de posts, comentários e comprovações de fotos de check-in.</p>
      </div>

      {/* Main Tab selector */}
      <div className="flex border-b border-border gap-6">
        <button
          onClick={() => setActiveSubTab('posts')}
          className={`pb-3 font-bold text-sm flex items-center gap-2 transition-colors ${
            activeSubTab === 'posts' 
              ? 'border-b-2 border-primary text-foreground' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Rede Social ({filter === 'pending' ? 'Pendente' : 'Geral'})
        </button>
        
        <button
          onClick={() => setActiveSubTab('checkins')}
          className={`pb-3 font-bold text-sm flex items-center gap-2 transition-colors ${
            activeSubTab === 'checkins' 
              ? 'border-b-2 border-primary text-foreground' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Camera className="w-4 h-4" />
          Fotos de Desafios ({reportedCheckins?.length || 0} denúncias)
        </button>
      </div>

      {activeSubTab === 'posts' ? (
        <div className="space-y-4">
          {/* Tabs / Filter Selector */}
          <div className="flex gap-2 bg-card border border-border p-1 rounded-xl w-fit shadow-sm">
            <Button
              variant={filter === 'pending' ? 'default' : 'ghost'}
              onClick={() => setFilter('pending')}
              size="sm"
              className="h-8.5 font-bold text-xs"
            >
              Pendentes
            </Button>
            <Button
              variant={filter === 'resolved' ? 'default' : 'ghost'}
              onClick={() => setFilter('resolved')}
              size="sm"
              className="h-8.5 font-bold text-xs"
            >
              Resolvidos
            </Button>
            <Button
              variant={filter === 'dismissed' ? 'default' : 'ghost'}
              onClick={() => setFilter('dismissed')}
              size="sm"
              className="h-8.5 font-bold text-xs"
            >
              Ignorados
            </Button>
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded-md overflow-hidden">
            {isLoadingReports ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
                <span className="text-sm text-muted-foreground font-medium">Carregando denúncias...</span>
              </div>
            ) : reports && reports.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Denunciante</TableHead>
                    <TableHead>Alvo / Conteúdo</TableHead>
                    <TableHead>Motivo da Denúncia</TableHead>
                    <TableHead>Data</TableHead>
                    {filter === 'pending' && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-semibold text-foreground">
                        {report.reporter?.name || 'Recruta'}
                      </TableCell>

                      <TableCell className="py-4">
                        {report.reported_user_id && (
                          <div className="flex items-center gap-1.5 text-foreground text-xs font-semibold">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>Usuário: <strong className="text-primary font-bold">{report.reported_user?.name}</strong></span>
                          </div>
                        )}
                        {report.post_id && (
                          <div className="space-y-1.5 mt-1">
                            <div className="flex items-center gap-1.5 text-foreground text-xs font-semibold">
                              <Image className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>Post ID: <span className="font-mono text-[9px]">{report.post_id.substring(0, 8)}...</span></span>
                            </div>
                            {report.posts && (
                              <div className="bg-secondary/40 border border-border/50 p-2 rounded text-xs space-y-1">
                                {report.posts.caption && <p className="italic text-muted-foreground">"{report.posts.caption}"</p>}
                                {report.posts.image_url && (
                                  <a href={report.posts.image_url} target="_blank" rel="noreferrer" className="text-xs text-primary font-bold underline flex items-center gap-0.5">
                                    Ver imagem original
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {report.comment_id && (
                          <div className="space-y-1.5 mt-1">
                            <div className="flex items-center gap-1.5 text-foreground text-xs font-semibold">
                              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>Comentário ID: <span className="font-mono text-[9px]">{report.comment_id.substring(0, 8)}...</span></span>
                            </div>
                            {report.post_comments && (
                              <p className="bg-secondary/40 border border-border/50 p-2 rounded text-xs italic text-muted-foreground">
                                "{report.post_comments.content}"
                              </p>
                            )}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="text-foreground text-sm font-medium max-w-xs leading-normal">
                        {report.reason}
                      </TableCell>

                      <TableCell className="text-muted-foreground text-xs">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{new Date(report.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </TableCell>

                      {filter === 'pending' && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {report.post_id && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDeleteContent('post', report.post_id, report.id)}
                                disabled={deleteContent.isPending}
                                className="h-8 gap-1.5 text-xs border-destructive/20 text-destructive hover:bg-destructive/5 hover:border-destructive/30"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Excluir Post
                              </Button>
                            )}
                            {report.comment_id && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDeleteContent('comment', report.comment_id, report.id)}
                                disabled={deleteContent.isPending}
                                className="h-8 gap-1.5 text-xs border-destructive/20 text-destructive hover:bg-destructive/5 hover:border-destructive/30"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Excluir Comentário
                              </Button>
                            )}

                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleReview(report.id, 'resolved')}
                              disabled={resolveReport.isPending}
                              className="h-8 w-8 text-green-600 hover:bg-green-50"
                              title="Aprovar/Dar como Resolvido"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleReview(report.id, 'dismissed')}
                              disabled={resolveReport.isPending}
                              className="h-8 w-8 text-destructive hover:bg-destructive/5"
                              title="Ignorar/Recusar denúncia"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <ShieldAlert className="w-8 h-8 text-muted-foreground mb-3" />
                <h3 className="font-semibold text-lg text-foreground">Nenhuma denúncia nesta aba</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Nenhuma ocorrência pendente ou reportada foi registrada no aplicativo para o filtro selecionado.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-md overflow-hidden">
            {isLoadingCheckins ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
                <span className="text-sm text-muted-foreground font-medium">Carregando denúncias de fotos...</span>
              </div>
            ) : reportedCheckins && reportedCheckins.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atleta</TableHead>
                    <TableHead>Desafio</TableHead>
                    <TableHead>Data do Check-in</TableHead>
                    <TableHead>Comprovação (Foto)</TableHead>
                    <TableHead className="text-right">Ações de Moderação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportedCheckins.map((checkin) => (
                    <TableRow key={checkin.id}>
                      {/* Athlete name */}
                      <TableCell className="font-semibold text-foreground">
                        {checkin.user_name || 'Recruta'}
                      </TableCell>

                      {/* Challenge Title */}
                      <TableCell className="font-medium text-foreground">
                        {checkin.challenge_title || 'Desafio Desconhecido'}
                      </TableCell>

                      {/* Date of check-in */}
                      <TableCell className="text-muted-foreground text-sm">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{new Date(checkin.checkin_date).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </TableCell>

                      {/* Lazily loaded private image check-in preview */}
                      <TableCell className="py-2">
                        <CheckinPhoto path={checkin.photo_url} />
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => approveCheckin.mutate(checkin.id)}
                            disabled={approveCheckin.isPending}
                            className="h-8 gap-1.5 text-xs border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Manter Foto
                          </Button>
                          
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => {
                              if (confirm(`Atenção: invalidar esta foto vai estornar ${checkin.points_earned ?? 0} pontos e recalcular a ofensiva do participante a partir dos check-ins válidos. Prosseguir?`)) {
                                invalidateCheckin.mutate(checkin.id);
                              }
                            }}
                            disabled={invalidateCheckin.isPending}
                            className="h-8 gap-1.5 text-xs"
                          >
                            <X className="w-3.5 h-3.5" />
                            Invalidar (Estorno)
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <ShieldAlert className="w-8 h-8 text-muted-foreground mb-3" />
                <h3 className="font-semibold text-lg text-foreground">Nenhuma denúncia de check-in</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  O feed de desafios está limpo. Não há comprovações com denúncias ativas na plataforma.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// LAZY-IMAGE COMPONENT FOR STORAGE SignedUrls
// ----------------------------------------------------
function CheckinPhoto({ path }: { path: string }) {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  
  useEffect(() => {
    let active = true;
    async function loadUrl() {
      try {
        const { data, error } = await supabase.storage
          .from('challenge_photos')
          .createSignedUrl(path, 3600);
          
        if (active && data?.signedUrl) {
          setUrl(data.signedUrl);
        }
      } catch (err) {
        console.error("Error creating signed URL for admin:", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadUrl();
    return () => { active = false; };
  }, [path]);

  if (loading) {
    return <div className="w-20 h-25 bg-secondary animate-pulse rounded-lg border border-border" />;
  }
  
  if (!url) {
    return (
      <div className="w-20 h-25 bg-secondary rounded-lg border border-border flex flex-col items-center justify-center text-[9px] text-muted-foreground">
        <ShieldAlert className="w-4 h-4 mb-1 text-destructive" />
        Erro Img
      </div>
    );
  }
  
  return (
    <img 
      src={url} 
      alt="Check-in Target" 
      className="w-20 h-25 object-cover rounded-lg shadow-sm border border-border cursor-pointer hover:scale-105 transition-transform" 
      onClick={() => window.open(url, '_blank')} 
    />
  );
}
