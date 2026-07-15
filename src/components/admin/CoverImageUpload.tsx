import React, { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ImagePlus, Link2, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const BUCKET = 'challenge-covers';
const MAX_SIZE_MB = 5;

interface CoverImageUploadProps {
  value: string;
  onChange: (url: string) => void;
}

/**
 * Cover picker: uploads to the public `challenge-covers` bucket (created by
 * migration 20260714120000) and stores the public URL, or accepts a pasted
 * URL. The iOS app consumes challenges.cover_image_url as a plain URL.
 */
export default function CoverImageUpload({ value, onChange }: CoverImageUploadProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlMode, setUrlMode] = useState(false);

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Arquivo inválido', description: 'Envie uma imagem (PNG, JPG, WebP).', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast({ title: 'Imagem muito grande', description: `Máximo ${MAX_SIZE_MB} MB.`, variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await (supabase as any).storage
        .from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = (supabase as any).storage.from(BUCKET).getPublicUrl(path);
      onChange(data.publicUrl);
      toast({ title: 'Capa enviada', description: 'Imagem hospedada no Storage do Flameer.' });
    } catch (err: any) {
      const missingBucket = /bucket.*not.*found/i.test(err.message ?? '');
      toast({
        title: 'Erro no upload',
        description: missingBucket
          ? 'Bucket "challenge-covers" não existe — aplique a migração 20260714120000 (supabase db push).'
          : err.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative rounded-lg overflow-hidden border border-border group">
          <img src={value} alt="Capa do desafio" className="w-full h-36 object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button type="button" variant="secondary" size="sm" className="h-8 text-xs gap-1.5" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <UploadCloud className="w-3.5 h-3.5" />
              Trocar
            </Button>
            <Button type="button" variant="destructive" size="sm" className="h-8 text-xs gap-1.5" onClick={() => onChange('')}>
              <Trash2 className="w-3.5 h-3.5" />
              Remover
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className={cn(
            'w-full h-36 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2',
            'text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors bg-secondary/20'
          )}
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <ImagePlus className="w-6 h-6" />
              <span className="text-xs font-medium">Clique para enviar a capa (até {MAX_SIZE_MB} MB)</span>
            </>
          )}
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setUrlMode((v) => !v)}
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <Link2 className="w-3 h-3" />
          {urlMode ? 'Ocultar URL' : 'Ou colar uma URL'}
        </button>
      </div>
      {urlMode && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://exemplo.com/imagem.png"
          className="text-xs"
        />
      )}
    </div>
  );
}
