// generate-workout
// Gera um treino REAL com LLM a partir do perfil do usuário.
//
// Antes desta função, o botão "Com IA" do app era teatro: um `Task.sleep(2s)`
// seguido de uma escolha de catálogo local. Aqui a geração acontece de fato —
// e a chave da API fica no servidor, nunca no binário do app.
//
// Mesmo gateway/modelo do `chat-mentor` (Lovable → Gemini), pra não introduzir
// um segundo provedor e reaproveitar a LOVABLE_API_KEY já configurada.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SYSTEM = `Você é o montador de treinos do Flameer, um personal trainer especialista em periodização e biomecânica.

Monte UM treino para a sessão de hoje. Regras inegociáveis:
- NUNCA inclua exercício que force uma região lesionada informada. Prefira variação segura.
- NUNCA inclua exercício da lista de odiados.
- Respeite o local: só use equipamento que existe lá.
- O volume total deve caber na duração informada (conte ~3min por série, incluindo descanso).
- Priorize os grupos de foco no INÍCIO do treino, quando a energia é maior.
- Séries/repetições coerentes com o nível e o objetivo (força: 3-6 reps; hipertrofia: 8-12; resistência: 15-20).
- "weight" é orientação de carga: use "BW" para peso corporal, ou texto curto como "moderada", "leve", "pesada".
- Responda em português do Brasil. Nomes de exercícios usuais de academia brasileira.

Responda SOMENTE com JSON válido, sem markdown, neste formato exato:
{"name":"Peito e Tríceps","focus":"Superiores","duration":"55 min","exercises":[{"name":"Supino reto","muscle":"Peitoral","rest":"90s","sets":[{"reps":"10","weight":"moderada"},{"reps":"10","weight":"moderada"}]}]}`;

function buildUserPrompt(p: Record<string, unknown>): string {
  const list = (v: unknown) =>
    Array.isArray(v) && v.length ? (v as string[]).join(", ") : "nenhum";

  const placeLabel: Record<string, string> = {
    full_gym: "Academia completa (máquinas, halteres, polias)",
    basic_gym: "Academia básica de prédio (equipamento limitado)",
    home: "Em casa (peso corporal, halteres, elásticos)",
  };
  const timeLabel: Record<string, string> = {
    "30_45": "30 a 45 minutos",
    "60": "1 hora",
    "90_plus": "1 hora e 30 ou mais",
  };
  const goalLabel: Record<string, string> = {
    lose: "emagrecimento",
    gain: "ganho de massa muscular",
    maintain: "manutenção e recomposição",
  };
  const levelLabel: Record<string, string> = {
    beginner: "iniciante",
    intermediate: "intermediário",
    advanced: "avançado",
  };

  const place = placeLabel[String(p.place ?? "")] ?? "Academia completa";
  const time = timeLabel[String(p.sessionTime ?? "")] ?? "1 hora";
  const goal = goalLabel[String(p.goal ?? "")] ?? "ganho de massa muscular";
  const level = levelLabel[String(p.level ?? "")] ?? "iniciante";

  const cardioLabel: Record<string, string> = {
    post_15: "15 min de cardio após o treino de força",
    session_30_45: "30 a 45 min de cardio dentro da sessão",
    separate_days: "cardio em dias separados (não incluir hoje)",
    none: "não faz cardio (NÃO incluir nada aeróbico)",
  };

  const bio = [
    p.age ? `${p.age} anos` : null,
    p.weightKg ? `${p.weightKg} kg` : null,
    p.heightCm ? `${p.heightCm} cm` : null,
  ].filter(Boolean).join(", ");

  return `Perfil do aluno:
- Objetivo: ${goal}
- Nível: ${level}
${bio ? `- Dados: ${bio}` : ""}
- Local de treino: ${place}
- Tempo disponível na sessão: ${time}
- Cardio: ${cardioLabel[String(p.cardio ?? "")] ?? "a critério"}
- Lesões / limitações (BLOQUEAR): ${list(p.injuries)}
- Exercícios que odeia (BLOQUEAR): ${list(p.hates)}
- Grupos de foco (priorizar): ${list(p.focus)}
- Grupos musculares pedidos para hoje: ${list(p.muscles)}
- Intensidade desejada: ${p.intensity ?? "moderada"}
${p.durationMin ? `- Duração alvo: ${p.durationMin} minutos` : ""}

Monte o treino de hoje.`;
}

/** O modelo às vezes embrulha o JSON em ```json … ``` mesmo instruído a não fazer. */
function extractJSON(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/** O app confia no formato — validar aqui evita crash/tela vazia no cliente. */
function validate(w: any): string | null {
  if (!w || typeof w !== "object") return "resposta não é objeto";
  if (typeof w.name !== "string" || !w.name.trim()) return "sem name";
  if (!Array.isArray(w.exercises) || w.exercises.length === 0) return "sem exercises";
  for (const ex of w.exercises) {
    if (typeof ex?.name !== "string" || !ex.name.trim()) return "exercício sem name";
    if (!Array.isArray(ex.sets) || ex.sets.length === 0) return `exercício "${ex.name}" sem sets`;
    for (const s of ex.sets) {
      if (typeof s?.reps !== "string" || !s.reps.trim()) return `série inválida em "${ex.name}"`;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const profile = await req.json();

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: buildUserPrompt(profile) },
        ],
        // Sem stream: o app precisa do JSON inteiro pra montar o treino.
        stream: false,
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("AI gateway error:", response.status, detail);
      if (response.status === 429) {
        return json({ error: "Muitas gerações agora. Tente de novo em instantes." }, 429);
      }
      if (response.status === 402) {
        return json({ error: "Créditos de IA esgotados." }, 402);
      }
      return json({ error: "Erro no gateway de IA" }, 502);
    }

    const payload = await response.json();
    const content: string = payload?.choices?.[0]?.message?.content ?? "";
    const workout = extractJSON(content);

    const problem = validate(workout);
    if (problem) {
      console.error("Treino inválido do modelo:", problem, content.slice(0, 500));
      return json({ error: "A IA devolveu um treino inválido." }, 502);
    }

    return json({ workout });
  } catch (e) {
    console.error("generate-workout error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
