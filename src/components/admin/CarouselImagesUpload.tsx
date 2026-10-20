import React, { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ArrowDown, ArrowUp, ImagePlus, Link2, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const BUCKET = 'challenge-covers';
const MAX_SIZE_MB = 5;
const MAX_IMAGES = 6;

interface CarouselImagesUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
}

/**
 * Editor do CARROSSEL do preview do desafio (11/08/2026).
 *
 * As imagens vão para o mesmo bucket público `challenge-covers` da capa e a
 * lista de URLs mora em `challenges.metadata.appearance.cover_images` — o app
 * iOS passa uma por vez no topo do preview. A ordem daqui é a ordem de lá,
 * daí as setas de reordenação.
 */
export default function CarouselImagesUpload({ value, onChange }: CarouselImagesUploadProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const [pastedUrl, setPastedUrl] = useState('');

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
      onChange([...value, data.publicUrl]);
    } catch (err: any) {
      toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const move = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {value.map((url, i) => (
            <div key={`${url}-${i}`} className="relative rounded-lg overflow-hidden border border-border group">
              <img src={url} alt={`Imagem ${i + 1} do carrossel`} className="w-full h-20 object-cover" />
              <span className="absolute top-1 left-1 text-[10px] font-bold bg-black/60 text-white rounded px-1.5 py-0.5">
                {i + 1}
              </span>
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <Button type="button" variant="secondary" size="icon" className="h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0} title="Mover para a esquerda">
                  <ArrowUp className="w-3.5 h-3.5 -rotate-90" />
                </Button>
                <Button type="button" variant="secondary" size="icon" className="h-7 w-7" onClick={() => move(i, +1)} disabled={i === value.length - 1} title="Mover para a direita">
                  <ArrowDown className="w-3.5 h-3.5 -rotate-90" />
                </Button>
                <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => onChange(value.filter((_, k) => k !== i))} title="Remover">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {value.length < MAX_IMAGES && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className={cn(
            'w-full h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center gap-2',
            'text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors bg-secondary/20'
          )}
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <ImagePlus className="w-5 h-5" />
              <span className="text-xs font-medium">
                Adicionar imagem ao carrossel ({value.length}/{MAX_IMAGES})
              </span>
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
        <div className="flex items-center gap-2">
          <Input
            value={pastedUrl}
            onChange={(e) => setPastedUrl(e.target.value)}
            placeholder="https://exemplo.com/imagem.png"
            className="text-xs"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 text-xs shrink-0"
            disabled={!pastedUrl.trim() || value.length >= MAX_IMAGES}
            onClick={() => {
              onChange([...value, pastedUrl.trim()]);
              setPastedUrl('');
            }}
          >
            Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}
