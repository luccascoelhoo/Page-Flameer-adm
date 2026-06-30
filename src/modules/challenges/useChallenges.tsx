import { useCallback, useEffect, useState } from "react";
import type { Challenge } from "./types";
import { MOCK_CHALLENGES } from "./mockChallenges";
import { generateCode } from "./utils";

const STORAGE_KEY = "challenges:v1";

const loadInitial = (): Challenge[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Challenge[];
  } catch {}
  return MOCK_CHALLENGES;
};

export const useChallenges = () => {
  const [challenges, setChallenges] = useState<Challenge[]>(loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(challenges));
    } catch {}
  }, [challenges]);

  const createPrivate = useCallback(
    (input: Omit<Challenge, "id" | "code" | "visibility" | "tier" | "participants" | "startsAt" | "hostName" | "joined">): Challenge => {
      const ch: Challenge = {
        ...input,
        id: `ch-${Date.now()}`,
        code: generateCode(),
        visibility: "private",
        tier: "friend",
        participants: 1,
        startsAt: new Date().toISOString().slice(0, 10),
        hostName: "Você",
        joined: true,
      };
      setChallenges((prev) => [ch, ...prev]);
      return ch;
    },
    [],
  );

  const findByCode = useCallback(
    (code: string) => challenges.find((c) => c.code.toUpperCase() === code.toUpperCase()) ?? null,
    [challenges],
  );

  const join = useCallback((id: string) => {
    setChallenges((prev) =>
      prev.map((c) => (c.id === id ? { ...c, joined: true, participants: c.participants + (c.joined ? 0 : 1) } : c)),
    );
  }, []);

  const publicChallenges = challenges.filter((c) => c.visibility === "public");
  const featured = publicChallenges.filter((c) => c.featured);
  const privateJoined = challenges.filter((c) => c.visibility === "private" && c.joined);

  return { challenges, publicChallenges, featured, privateJoined, createPrivate, findByCode, join };
};