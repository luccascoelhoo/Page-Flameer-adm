import React, { useState } from 'react';
import { useSupabaseQuery, useSupabaseMutation } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, 
  Trash2, 
  Loader2, 
  Sparkles, 
  Copy, 
  Search, 
  Gift, 
  Calendar, 
  Users, 
  Info,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

interface ReferralCode {
  id: string;
  code: string;
  expires_at: string | null;
  max_redemptions: number | null;
  redemptions_count: number;
  created_at: string;
  created_by: string;
  challenge_id?: string | null;
  challenge?: { id: string; title: string } | null;
  profiles: {
    name: string;
    email: string;
  } | null;
}

export default function ReferralCodes() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Form states for creating a new referral code
  const [codeValue, setCodeValue] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [selectedChallengeId, setSelectedChallengeId] = useState('none');
  // false when the challenge_id column doesn't exist yet (migration pending)
  const [linkSupported, setLinkSupported] = useState(true);

  // 1. Fetch all referral codes — tries the challenge join first, falls back
  //    gracefully if migration 20260714120000 hasn't been applied yet.
  const { data: codes, isLoading, refetch } = useSupabaseQuery<ReferralCode[]>(
    ['admin', 'referrals', 'list'],
    async () => {
      const full = await (supabase as any)
        .from('referral_codes')
        .select(`
          id, code, expires_at, max_redemptions, redemptions_count,
          created_at, created_by, challenge_id,
          challenge:challenge_id ( id, title ),
          profiles:created_by ( name, email )
        `)
        .order('created_at', { ascending: false });

      if (full.error && /challenge/i.test(full.error.message ?? '')) {
        setLinkSupported(false);
        const basic = await supabase
          .from('referral_codes')
          .select(`
            id, code, expires_at, max_redemptions, redemptions_count,
            created_at, created_by,
            profiles:created_by ( name, email )
          `)
          .order('created_at', { ascending: false });
        return { data: basic.data as any, error: basic.error };
      }
      return { data: full.data as any, error: full.error };
    }
  );

  // Challenges for the coupon↔challenge picker
  const { data: challengeOptions } = useSupabaseQuery<{ id: string; title: string }[]>(
    ['admin', 'referrals', 'challenge-options'],
    async () => {
      const { data, error } = await (supabase as any)
        .from('challenges')
        .select('id, title')
        .order('title');
      return { data, error };
    }
  );

  // 2. Mutation for creating a new referral code
  const createCode = useSupabaseMutation<any, any>(
    async (payload) => {
      const { data: { session } } = await supabase.auth.getSession();
      const adminUserId = session?.user?.id;
      if (!adminUserId) throw new Error("Sessão admin expirada. Faça login novamente.");

      const referralData: Record<string, any> = {
        code: payload.code.toUpperCase().trim(),
        expires_at: payload.expires_at ? new Date(payload.expires_at).toISOString() : null,
        max_redemptions: payload.max_redemptions ? parseInt(payload.max_redemptions, 10) : null,
        created_by: adminUserId
      };
      // Cupom vinculado a um desafio específico (opcional)
      if (linkSupported && payload.challenge_id && payload.challenge_id !== 'none') {
        referralData.challenge_id = payload.challenge_id;
      }

      const { data, error } = await supabase
        .from('referral_codes')
        .insert([referralData]);
      return { data, error };
    },
    {
      onSuccess: () => {
        toast({
          title: "Código criado",
          description: "O código de indicação foi criado com sucesso.",
        });
        setIsDialogOpen(false);
        resetForm();
        refetch();
      },
      onError: (err) => {
        toast({
          title: "Erro ao criar",
          description: err.message || "Falha ao criar o código de indicação.",
          variant: "destructive",
        });
      }
    }
  );

  // 3. Mutation for deleting a referral code
  const deleteCode = useSupabaseMutation<string, any>(
    async (id) => {
      const { data, error } = await supabase
        .from('referral_codes')
        .delete()
        .eq('id', id);
      return { data, error };
    },
    {
      onSuccess: () => {
        toast({
          title: "Código excluído",
          description: "O código de indicação foi removido com sucesso.",
        });
        refetch();
      },
      onError: (err) => {
        toast({
          title: "Erro ao excluir",
          description: err.message || "Falha ao remover o código de indicação.",
          variant: "destructive",
        });
      }
    }
  );

  const resetForm = () => {
    setCodeValue('');
    setExpiresAt('');
    setMaxRedemptions('');
    setSelectedChallengeId('none');
  };

  const handleGenerateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCodeValue(result);
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    toast({
      title: "Copiado!",
      description: `Código "${text}" copiado para a área de transferência.`,
    });
    setTimeout(() => {
      setCopiedCodeId(null);
    }, 2000);
  };

  const handleDelete = (id: string, codeText: string) => {
    if (window.confirm(`Deseja realmente excluir o código de indicação "${codeText}"?`)) {
      deleteCode.mutate(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeValue.trim()) {
      toast({
        title: "Campo Obrigatório",
        description: "Por favor, digite ou gere um código de indicação.",
        variant: "destructive",
      });
      return;
    }
    createCode.mutate({
      code: codeValue,
      expires_at: expiresAt,
      max_redemptions: maxRedemptions,
      challenge_id: selectedChallengeId
    });
  };

  // Filter list
  const filteredCodes = codes?.filter((c) => {
    const term = searchTerm.toLowerCase();
    const codeMatch = c.code.toLowerCase().includes(term);
    const creatorNameMatch = c.profiles?.name?.toLowerCase().includes(term) ?? false;
    const creatorEmailMatch = c.profiles?.email?.toLowerCase().includes(term) ?? false;
    return codeMatch || creatorNameMatch || creatorEmailMatch;
  });

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Gift className="w-8 h-8 text-primary" />
            Códigos de Indicação
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie códigos promocionais e de indicação para o onboarding de novos usuários.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2">
              <Plus className="w-4 h-4" />
              Novo Código
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-card border border-border rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <Gift className="w-5 h-5 text-primary" />
                Criar Código de Indicação
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-xs font-bold text-foreground">Código de Indicação</Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    placeholder="EX: FLAMMER50"
                    value={codeValue}
                    onChange={(e) => setCodeValue(e.target.value.toUpperCase())}
                    className="flex-1 uppercase font-mono tracking-wider"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleGenerateCode} 
                    className="border-primary/20 hover:bg-primary/5 text-primary font-semibold gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Gerar
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiresAt" className="text-xs font-bold text-foreground">Data de Expiração (Opcional)</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxRedemptions" className="text-xs font-bold text-foreground">Limite Máximo de Resgates (Opcional)</Label>
                <Input
                  id="maxRedemptions"
                  type="number"
                  placeholder="EX: 100"
                  min="1"
                  value={maxRedemptions}
                  onChange={(e) => setMaxRedemptions(e.target.value)}
                  className="w-full"
                />
              </div>

              {linkSupported && (
                <div className="space-y-2">
                  <Label htmlFor="challengeLink" className="text-xs font-bold text-foreground">Vincular a um Desafio (Opcional)</Label>
                  <select
                    id="challengeLink"
                    value={selectedChallengeId}
                    onChange={(e) => setSelectedChallengeId(e.target.value)}
                    className="h-10 w-full px-3 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="none">Nenhum — cupom geral</option>
                    {(challengeOptions ?? []).map((ch) => (
                      <option key={ch.id} value={ch.id}>{ch.title}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground">
                    Cupons vinculados servem para campanhas de um desafio específico.
                  </p>
                </div>
              )}

              <DialogFooter className="pt-4 border-t border-border flex sm:justify-end gap-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setIsDialogOpen(false)}
                  className="text-muted-foreground hover:bg-secondary"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                  disabled={createCode.isPending}
                >
                  {createCode.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Criando...
                    </>
                  ) : 'Criar Código'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por código ou criador (nome/email)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 max-w-md border-border bg-card text-foreground focus:ring-primary"
        />
      </div>

      {/* Referral Codes Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground font-medium">Carregando códigos de indicação...</span>
          </div>
        ) : filteredCodes && filteredCodes.length > 0 ? (
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow>
                <TableHead className="font-bold text-foreground">Código</TableHead>
                {linkSupported && <TableHead className="font-bold text-foreground">Desafio</TableHead>}
                <TableHead className="font-bold text-foreground">Criado Por</TableHead>
                <TableHead className="font-bold text-foreground">Data de Criação</TableHead>
                <TableHead className="font-bold text-foreground">Expiração</TableHead>
                <TableHead className="font-bold text-foreground text-center">Resgates / Limite</TableHead>
                <TableHead className="font-bold text-foreground text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCodes.map((c) => (
                <TableRow key={c.id} className="hover:bg-secondary/10">
                  <TableCell className="font-mono font-bold text-primary">
                    <div className="flex items-center gap-2">
                      <span className="bg-primary/5 px-2.5 py-1 rounded border border-primary/10 tracking-wider">
                        {c.code}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(c.id, c.code)}
                        className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/5"
                        title="Copiar código"
                      >
                        {copiedCodeId === c.id ? (
                          <Check className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  {linkSupported && (
                    <TableCell>
                      {c.challenge ? (
                        <span className="text-xs font-semibold text-primary truncate max-w-[160px] inline-block">
                          {c.challenge.title}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Geral</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    {c.profiles ? (
                      <div>
                        <div className="font-semibold text-foreground">{c.profiles.name}</div>
                        <div className="text-[10px] text-muted-foreground">{c.profiles.email}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">Sistema</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-foreground">
                    {new Date(c.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-xs text-foreground">
                    {c.expires_at ? (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        {new Date(c.expires_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">Nunca expira</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="inline-flex items-center gap-1 text-xs">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-bold text-foreground">{c.redemptions_count}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-muted-foreground">
                        {c.max_redemptions !== null ? c.max_redemptions : '∞'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(c.id, c.code)}
                      disabled={deleteCode.isPending}
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/5"
                      title="Excluir código"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Info className="w-8 h-8 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg text-foreground font-sans">Nenhum código encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Não há correspondência com os critérios de filtro informados ou nenhum código foi criado ainda.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
