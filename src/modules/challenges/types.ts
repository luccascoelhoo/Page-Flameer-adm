export type ChallengeVisibility = "public" | "private";
export type ChallengeTier = "admin" | "influencer" | "premium_user" | "friend";
export type ChallengeCategory = "Treino" | "Nutrição" | "Recovery" | "Mente";

export type Challenge = {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  cover: string;
  category: ChallengeCategory;
  visibility: ChallengeVisibility;
  tier: ChallengeTier;
  featured?: boolean;
  prize?: string;
  durationDays: number;
  participants: number;
  startsAt: string;
  hostName: string;
  hostAvatar?: string;
  joined?: boolean;
};