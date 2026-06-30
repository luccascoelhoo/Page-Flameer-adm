import React, { useState } from 'react';
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
  Calendar
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
  const [filter, setFilter] = useState<'pending' | 'resolved' | 'dismissed'>('pending');

  // Fetch reports list
  const { data: reports, isLoading, refetch } = useSupabaseQuery<any[]>(
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
    }
  );

  // Review report mutation
  const resolveReport = useSupabaseMutation<any, any>(
    async ({ id, status }) => {
      const { data, error } = await supabase
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
        refetch();
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
      if (type === 'post') {
        const { error } = await supabase.from('posts').delete().eq('id', contentId);
        if (error) throw error;
      } else if (type === 'comment') {
        const { error } = await supabase.from('post_comments').delete().eq('id', contentId);
        if (error) throw error;
      }
      // Auto-resolve report once content is deleted
      const { error: reportError } = await supabase
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
        refetch();
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

  const handleReview = (id: string, status: 'resolved' | 'dismissed') => {
    resolveReport.mutate({ id, status });
  };

  const handleDeleteContent = (type: 'post' | 'comment', contentId: string, reportId: string) => {
    if (confirm(`Tem certeza que deseja excluir este ${type === 'post' ? 'post' : 'comentário'} permanentemente?`)) {
      deleteContent.mutate({ type, contentId, reportId });
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground font-sans">Moderação da Comunidade</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie denúncias de posts, comentários e abusos na rede social.</p>
      </div>

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
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
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
                  {/* Reporter */}
                  <TableCell className="font-semibold text-foreground">
                    {report.reporter?.name || 'Recruta'}
                  </TableCell>

                  {/* Target Details */}
                  <TableCell className="py-4">
                    {report.reported_user_id && (
                      <div className="flex items-center gap-1.5 text-foreground text-xs font-semibold">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Usuário: <strong className="text-primary font-bold">{report.reported_user?.name}</strong></span>
                      </div>
                    )}
                    {report.post_id && (
                      <div className="space-y-1.5">
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
                      <div className="space-y-1.5">
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

                  {/* Reason */}
                  <TableCell className="text-foreground text-sm font-medium max-w-xs leading-normal">
                    {report.reason}
                  </TableCell>

                  {/* Created At */}
                  <TableCell className="text-muted-foreground text-xs">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{new Date(report.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </TableCell>

                  {/* Action buttons (only for pending) */}
                  {filter === 'pending' && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Remove content buttons */}
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

                        {/* General report reviews */}
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
  );
}
