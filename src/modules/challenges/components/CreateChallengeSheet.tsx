import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Copy, Share2, Check, Link2 } from "lucide-react";
import { useChallenges } from "../useChallenges";
import { buildShareUrl, copyToClipboard, shareLink } from "../utils";
import type { Challenge, ChallengeCategory } from "../types";
import { TierBadge } from "./TierBadge";
import { toast } from "sonner";

const COVERS = [
  "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1200&h=800&fit=crop",
];

const CATEGORIES: ChallengeCategory[] = ["Treino", "Nutrição", "Recovery", "Mente"];
const DURATIONS = [7, 14, 30, 90];

export const CreateChallengeSheet = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const { createPrivate } = useChallenges();

  // Create form state
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [duration, setDuration] = useState(14);
  const [category, setCategory] = useState<ChallengeCategory>("Treino");
  const [prize, setPrize] = useState("");
  const [created, setCreated] = useState<Challenge | null>(null);

  const reset = () => {
    setTitle(""); setSubtitle(""); setPrize(""); setDuration(14); setCategory("Treino");
    setCreated(null);
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    const cover = COVERS[Math.floor(Math.random() * COVERS.length)];
    const ch = createPrivate({
      title: title.trim(),
      subtitle: subtitle.trim() || `${duration} dias entre amigos`,
      cover,
      category,
      durationDays: duration,
      prize: prize.trim() || undefined,
    });
    setCreated(ch);
  };

  return (
    <Drawer open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setTimeout(reset, 300); }}>
      <DrawerContent className="max-h-[92vh]">
        <div className="max-w-lg mx-auto w-full px-4 pb-8">
          <DrawerHeader className="px-0">
            <DrawerTitle className="text-xl font-extrabold">Criar desafio entre amigos</DrawerTitle>
          </DrawerHeader>

          <div className="space-y-4 pt-2">
            {!created ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Nome do desafio</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: 30 dias sem refri" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Descrição (opcional)</Label>
                    <Textarea rows={2} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Regras, meta, etc." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Categoria</Label>
                    <div className="flex gap-2 flex-wrap">
                      {CATEGORIES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCategory(c)}
                          className={`px-3 py-1.5 rounded-full text-xs font-extrabold border ${category === c ? "bg-foreground text-background border-foreground" : "bg-card border-border/60 text-muted-foreground"}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Duração</Label>
                    <div className="flex gap-2">
                      {DURATIONS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDuration(d)}
                          className={`flex-1 py-2 rounded-2xl text-sm font-extrabold border ${duration === d ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/60 text-muted-foreground"}`}
                        >
                          {d}d
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prêmio simbólico (opcional)</Label>
                    <Input value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="Ex: O perdedor paga o açaí" />
                  </div>
                  <Button onClick={handleCreate} disabled={!title.trim()} className="w-full h-12 text-sm font-extrabold uppercase tracking-wider">
                    <Link2 size={16} className="mr-2" /> Gerar link
                  </Button>
                </>
              ) : (
                <div className="space-y-4 text-center">
                  <div className="mx-auto w-14 h-14 rounded-full bg-success/15 text-success flex items-center justify-center">
                    <Check size={28} strokeWidth={2.6} />
                  </div>
                  <div>
                    <p className="text-base font-extrabold">Desafio criado!</p>
                    <p className="text-sm text-muted-foreground">Compartilhe o link com seus amigos</p>
                  </div>
                  <div className="bento-card text-left space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-extrabold">{created.title}</p>
                      <TierBadge tier="friend" />
                    </div>
                    <div className="rounded-xl bg-muted px-3 py-2 text-xs font-mono break-all">
                      {buildShareUrl(created.code)}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" onClick={async () => { (await copyToClipboard(buildShareUrl(created.code))) && toast.success("Link copiado"); }}>
                        <Copy size={14} className="mr-1.5" /> Copiar
                      </Button>
                      <Button onClick={() => shareLink(created.title, buildShareUrl(created.code))}>
                        <Share2 size={14} className="mr-1.5" /> Compartilhar
                      </Button>
                    </div>
                  </div>
                  <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">Concluído</Button>
                </div>
              )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};