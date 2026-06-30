import type { FlameState } from "./flameMotor";

const morningMessages: Record<FlameState, string[]> = {
  ativa: [
    "🔥 Chama acesa! Hoje é dia de dominar.",
    "💪 Streak ativa. Vamos manter o ritmo!",
    "⚡ Energia máxima. Bora treinar!",
  ],
  tregua: [
    "⏳ Sua chama está em trégua. Treine hoje para mantê-la!",
    "🕐 Falta pouco pra perder o streak. Vai lá!",
  ],
  extinta: [
    "💀 A chama apagou. Hora de reacender!",
    "🔄 Novo começo. Todo campeão já recomeçou.",
  ],
  normal: [
    "👊 Bora construir sua sequência!",
    "🌅 Bom dia! Cada dia conta.",
  ],
};

const eveningMessages: Record<FlameState, string[]> = {
  ativa: [
    "🌙 Ainda dá tempo de fechar o dia forte!",
    "🔥 Chama acesa. Não deixe pra amanhã!",
  ],
  tregua: [
    "⚠️ URGENTE: Sua chama apaga à meia-noite!",
    "🚨 Treine AGORA ou perde o streak!",
  ],
  extinta: [
    "🌃 Ainda dá tempo de recomeçar hoje.",
  ],
  normal: [
    "🌆 Ainda dá tempo. Bora!",
  ],
};

export function getMotivationalMessage(flameState: FlameState): string {
  const hour = new Date().getHours();
  const pool = hour >= 18 ? eveningMessages[flameState] : morningMessages[flameState];
  return pool[Math.floor(Math.random() * pool.length)];
}
