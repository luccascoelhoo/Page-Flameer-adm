import React, { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const BUCKET = 'challenge-covers';
const MAX_SIZE_MB = 2;

interface IconImageUploadProps {
  value: string;
  onChange: (url: string) => void;
}

/**
 * Logo do desafio no lugar do SF Symbol (20/10/2026).
 *
 * A URL mora em `challenges.metadata.appearance.icon_image_url`, junto do
 * carrossel. Quando existe, os apps desenham a imagem onde hoje desenham o
 * símbolo; vazio = o SF Symbol escolhido ao lado, como sempre foi.
 *
 * PNG com fundo transparente é o ideal: o app a coloca sobre o gradiente do
 * tema, sem tingir.
 */
export default function IconImageUpload({ value, onChange }: IconImageUploadProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await (supabase as any).storage
        .from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = (supabase as any).storage.from(BUCKET).getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (err: any) {
      toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {value ? (
          <div className="w-9 h-9 shrink-0 rounded-lg border border-border bg-secondary/30 flex items-center justify-center overflow-hidden">
            <img src={value} alt="Logo do desafio" className="max-w-full max-h-full object-contain" />
          </div>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 text-xs flex-1 gap-1.5"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
          {value ? 'Trocar imagem' : 'Usar uma imagem'}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => onChange('')} title="Voltar ao SF Symbol">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
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
    </div>
  );
}
