import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Check, Gift } from "lucide-react";
import { useBounty } from "../useBounty";
import RewardCard from "../components/RewardCard";
import CreateRewardDialog from "../components/CreateRewardDialog";
import { REWARD_ICONS } from "../components/icons";

const BountyPage = () => {
  const navigate = useNavigate();
  const {
    state, availableVouchers, usedVouchers,
    createReward, deleteReward, useVoucher,
  } = useBounty();

  const [openCreate, setOpenCreate] = useState(false);

  const rewardOf = (id: string) => state.rewards.find((r) => r.id === id);
  const recentUsed = [...usedVouchers]
    .sort((a, b) => (b.usedAt ?? "").localeCompare(a.usedAt ?? ""))
    .slice(0, 10);

  const rewardsWithFlag = state.rewards.map((r) => ({
    reward: r,
    hasAvailable: availableVouchers.some((v) => v.rewardId === r.id),
  }));

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border/60">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 -ml-1 rounded-full hover:bg-secondary flex items-center justify-center"
            aria-label="Voltar"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-extrabold tracking-tight text-foreground">Recompensas</h1>
          <button
            onClick={() => setOpenCreate(true)}
            className="w-10 h-10 -mr-1 rounded-full hover:bg-secondary flex items-center justify-center"
            aria-label="Criar"
          >
            <Plus size={22} />
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-5">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl p-5 text-white shadow-xl"
          style={{ background: "linear-gradient(135deg, hsl(27,100%,50%), hsl(15,100%,55%))" }}
        >
          <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-90">
            Para usar agora
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Gift size={28} strokeWidth={2.4} />
            <span className="text-4xl font-extrabold tabular-nums">{availableVouchers.length}</span>
            <span className="text-sm font-bold opacity-90 mb-1">
              {availableVouchers.length === 1 ? "recompensa" : "recompensas"}
            </span>
          </div>
          <p className="mt-3 text-[11px] font-bold opacity-90 leading-relaxed">
            Conquistou cumprindo seus hábitos. Aproveite sem culpa.
          </p>
        </motion.div>

        {/* Vouchers prontos */}
        {availableVouchers.length > 0 && (
          <section className="space-y-2">
            <h2 className="px-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Disponíveis
            </h2>
            <div className="space-y-2">
              {availableVouchers.map((v) => {
                const rw = rewardOf(v.rewardId);
                if (!rw) return null;
                const Icon = REWARD_ICONS[rw.icon] ?? REWARD_ICONS.gift;
                return (
                  <motion.div
                    key={v.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-card rounded-2xl border border-primary/30 p-3 flex items-center gap-3"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `color-mix(in srgb, ${rw.color} 18%, transparent)` }}
                    >
                      <Icon size={18} style={{ color: rw.color }} strokeWidth={2.4} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold text-foreground truncate">{rw.name}</p>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                        {new Date(v.unlockedAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <button
                      onClick={() => useVoucher(v.id)}
                      className="px-3 h-8 rounded-full bg-primary text-primary-foreground text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1"
                    >
                      <Check size={13} strokeWidth={3} />
                      Usei
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* Catálogo */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Minhas recompensas
            </h2>
            <button
              onClick={() => setOpenCreate(true)}
              className="text-[11px] font-bold text-primary uppercase tracking-wider"
            >
              + Nova
            </button>
          </div>
          {rewardsWithFlag.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-8 text-center">
              <p className="text-sm font-bold text-muted-foreground">
                Nenhuma recompensa ainda. Crie a primeira.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {rewardsWithFlag.map(({ reward, hasAvailable }) => (
                <RewardCard
                  key={reward.id}
                  reward={reward}
                  hasAvailableVoucher={hasAvailable}
                  onDelete={deleteReward}
                />
              ))}
            </div>
          )}
        </section>

        {/* Histórico */}
        {recentUsed.length > 0 && (
          <section className="space-y-2">
            <h2 className="px-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Aproveitadas
            </h2>
            <div className="space-y-2">
              {recentUsed.map((v) => {
                const rw = rewardOf(v.rewardId);
                if (!rw) return null;
                const Icon = REWARD_ICONS[rw.icon] ?? REWARD_ICONS.gift;
                const date = v.usedAt ? new Date(v.usedAt).toLocaleDateString("pt-BR") : "";
                return (
                  <div
                    key={v.id}
                    className="bg-card rounded-2xl border border-border/40 p-3 flex items-center gap-3 opacity-80"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `color-mix(in srgb, ${rw.color} 14%, transparent)` }}
                    >
                      <Icon size={16} style={{ color: rw.color }} strokeWidth={2.4} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-extrabold text-foreground truncate">{rw.name}</p>
                      <p className="text-[10px] text-muted-foreground font-bold">{date}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <CreateRewardDialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreate={createReward}
      />
    </div>
  );
};

export default BountyPage;
