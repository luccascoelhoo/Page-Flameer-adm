import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSupabaseQuery, useSupabaseMutation } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, 
  Loader2, 
  Save, 
  Plus, 
  Trash2, 
  Dumbbell, 
  Apple, 
  CheckSquare, 
  Sparkles,
  Info,
  Award,
  AlertTriangle,
  FolderOpen,
  X,
  Copy,
  CalendarRange,
  Palette,
  KeyRound,
  SlidersHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import EscolhaDaBase from '@/components/admin/EscolhaDaBase';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CoverImageUpload from '@/components/admin/CoverImageUpload';
import CarouselImagesUpload from '@/components/admin/CarouselImagesUpload';
import RegrasDeAcessoDoProduto from '@/components/admin/RegrasDeAcessoDoProduto';
import {
  REGRAS_DE_ACESSO_PADRAO,
  normalizarRegrasDeAcesso,
  type RegrasDeAcesso,
} from '@/components/admin/regrasDeAcesso';

// Curated SF Symbols the iOS app renders well as challenge icons
const CHALLENGE_ICONS = [
  'trophy', 'trophy.fill', 'flame.fill', 'bolt.fill', 'heart.fill',
  'dumbbell.fill', 'figure.run', 'figure.strengthtraining.traditional',
  'fork.knife', 'leaf.fill', 'moon.stars.fill', 'drop.fill',
  'star.fill', 'crown.fill', 'medal.fill', 'target',
];

/**
 * A RPC não existe no banco (migration ainda não aplicada) — e não um erro de
 * permissão ou de dado.
 *
 * PostgREST devolve `PGRST202` quando não acha a função no cache de schema;
 * o Postgres devolve `42883` quando a função não existe mesmo. Os dois casos
 * significam a mesma coisa para o painel: a porta ainda não foi construída.
 * Qualquer outro erro é erro de verdade e precisa aparecer.
 */
function funcaoAusenteNoBanco(err: any): boolean {
  if (!err) return false;
  if (err.code === 'PGRST202' || err.code === '42883') return true;
  // O texto é a rede de segurança para quando o código não vier. Ele exige a
  // palavra "function"/"função" JUNTO do "não existe" de propósito: um
  // `column "x" does not exist` é erro de verdade e não pode ser engolido
  // como "a migration ainda não chegou".
  const texto = `${err.message ?? ''} ${err.hint ?? ''} ${err.details ?? ''}`.toLowerCase();
  if (texto.includes('could not find the function')) return true;
  const faltando = texto.includes('does not exist') || texto.includes('não existe');
  return faltando && (texto.includes('function') || texto.includes('função'));
}

// Local types for unified state
interface LocalHabit {
  label: string;
  icon_name: string;
  color: string;
  kind: 'units' | 'quantity' | 'single';
  unit?: string;
  target: number;
  metadata?: any;
}

interface LocalSet {
  reps: string;
  weight: string;
}

interface LocalExercise {
  name: string;
  muscle: string;
  rest_seconds: number;
  sets: LocalSet[];
  metadata?: {
    informacoes_adicionais?: string;
  };
}

interface LocalWorkout {
  title: string;
  duration_minutes: number;
  focus: string;
  days: number[];
  exercises: LocalExercise[];
  /// Carregado e reenviado sem alteração. Se não fizer o round-trip,
  /// `save_challenge_package` cai no default da coluna e reinsere tudo como
  /// `published` — ver o comentário no mapping.
  status?: string;
  metadata?: {
    week_number?: number;
    video_url?: string;
    hiit_protocol?: {
      aquecimento?: string;
      treino_hiit?: string;
      resfriamento?: string;
    };
  };
}

interface LocalMealItem {
  name: string;
  quantity: string;
}

interface LocalMeal {
  name: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  items: LocalMealItem[];
  metadata?: {
    observacoes?: string;
    substituicoes?: string[];
  };
}

interface LocalDiet {
  title: string;
  meals: LocalMeal[];
  metadata?: {
    patient_name?: string;
    prescription_date?: string;
    professional_name?: string;
    professional_role?: string;
    professional_crn?: string;
    shopping_list?: string[];
    nutrient_report?: any;
  };
}

export default function ChallengeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<string>('details');

  // Tab 1: Details
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [tier, setTier] = useState<'admin' | 'influencer' | 'premium_user' | 'free_user'>('admin');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [category, setCategory] = useState('Treino');
  // A RÉGUA DA DISPUTA. Até 13/08 o painel não tinha este campo, e
  // `save_challenge_package` nem gravava a coluna — por isso os 11 desafios do
  // banco estão todos em `days_active`: não foi escolha, foi a única saída.
  const [scoringMode, setScoringMode] = useState('days_active');
  const [durationDays, setDurationDays] = useState(30);
  const [prize, setPrize] = useState('');
  const [iconName, setIconName] = useState('trophy');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  // A capa pode apontar para um objeto que NÃO EXISTE no storage — foi o caso
  // do Abdômen Insano (14/08): o app caía no fundo de erro e o admin não via
  // nada de errado aqui. Uma sonda <img> escondida testa a URL de verdade.
  const [capaQuebrada, setCapaQuebrada] = useState(false);
  const [shareCode, setShareCode] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [challengeType, setChallengeType] = useState<'individual' | 'group_private' | 'group_public'>('group_public');
  const [maxParticipants, setMaxParticipants] = useState(50);
  // `null` = SEM LIMITE. A coluna aceita null e `lotacao_do_desafio` trata
  // ausência como vaga livre — antes o limite só existia para grupo privado,
  // e um desafio público não tinha como declarar teto nem "ilimitado".
  const [semLimite, setSemLimite] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);

  // ── J2 (17/08): o que o banco ganhou e o painel passa a controlar ────────
  const [goalType, setGoalType] = useState('activity');
  const [statusDesafio, setStatusDesafio] = useState('draft');
  const [pesoTreino, setPesoTreino] = useState(1);
  const [pesoDieta, setPesoDieta] = useState(1);
  const [pesoHabito, setPesoHabito] = useState(1);
  const [habitosImpostos, setHabitosImpostos] = useState(true);
  const [periodizacaoAdaptativa, setPeriodizacaoAdaptativa] = useState(false);
  // Segmento: arrays vazios = desafio para todos (estado de todos os atuais).
  const [segObjetivo, setSegObjetivo] = useState<string[]>([]);
  const [segNivel, setSegNivel] = useState<string[]>([]);
  const [segLocal, setSegLocal] = useState<string[]>([]);

  // ── Aparência do preview (11/08): carrossel + o que o aluno vê ────────────
  // Mora em challenges.metadata.appearance, gravado pela RPC dedicada
  // salvar_aparencia_do_desafio (save_challenge_package não toca em metadata).
  const [coverImages, setCoverImages] = useState<string[]>([]);
  const [carouselSeconds, setCarouselSeconds] = useState(4);
  const [mostrarDias, setMostrarDias] = useState(true);
  const [mostrarAtletas, setMostrarAtletas] = useState(true);
  const [mostrarCriador, setMostrarCriador] = useState(true);
  // Appearance: [primary, background] hex pair consumed by the iOS app
  const [themeColors, setThemeColors] = useState<[string, string]>(['#6B1D2F', '#F7F4EF']);

  // ── O que este produto libera (27/08): challenge_access_rules ────────────
  // A matriz existe desde 03/08 e `tenho_acesso()` já a usa como porteiro,
  // mas até hoje só dava para escrevê-la por SQL na mão. Mora em RPCs
  // próprias — `save_challenge_package` e `salvar_regras_do_desafio` gravam
  // em `public.challenges`, não nesta tabela.
  const [regrasDeAcesso, setRegrasDeAcesso] = useState<RegrasDeAcesso>(REGRAS_DE_ACESSO_PADRAO);
  // Ligado quando o banco ainda não tem as RPCs. A tela avisa em vez de
  // quebrar — e o resto do formulário continua salvando.
  const [portaDeAcessoAusente, setPortaDeAcessoAusente] = useState(false);

  // Tab 2: Habits
  const [habits, setHabits] = useState<LocalHabit[]>([]);

  // Tab 3: Workouts (Splits)
  const [workouts, setWorkouts] = useState<LocalWorkout[]>([]);

  // Tab 4: Diet
  const [diets, setDiets] = useState<LocalDiet[]>([]);

  // Import modal states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importType, setImportType] = useState<'diet' | 'workout'>('diet');
  const [importText, setImportText] = useState('');
  const [importFormat, setImportFormat] = useState<'json' | 'spreadsheet' | 'pdf'>('json');
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');

  // Fetch all package details if editing
  const { data: pkgData, isLoading } = useSupabaseQuery<any>(
    ['admin', 'challenges', 'package', id],
    async () => {
      if (!id) return { data: null, error: null };

      const { data, error } = await supabase
        .from('challenges')
        .select(`
          *,
          habits(*),
          workouts(
            id, title, duration_minutes, focus, is_template, metadata, status,
            workout_days(day_of_week),
            exercises(
              id, name, muscle, rest_seconds, order_index, metadata,
              exercise_sets(id, reps, weight, order_index)
            )
          ),
          diets(
            id, title, is_template, metadata,
            meals(
              id, name, time, calories, protein, carbs, fat, order_index, metadata,
              meal_items(id, name, quantity, order_index)
            )
          )
        `)
        .eq('id', id)
        .single();
      return { data, error };
    },
    { enabled: !!id }
  );

  // As regras de acesso vêm numa RPC própria: `challenge_access_rules` não é
  // filha de `challenges` no PostgREST embed, e a policy dela é de admin.
  const { data: acessoBruto, error: acessoErro } = useSupabaseQuery<any>(
    ['admin', 'challenges', 'regras-de-acesso', id],
    async () => {
      if (!id) return { data: null, error: null };
      const { data, error } = await (supabase as any).rpc('admin_regras_de_acesso', {
        p_challenge_id: id,
      });
      return { data, error };
    },
    { enabled: !!id, retry: false }
  );

  // Load AI prefilled challenge if any
  useEffect(() => {
    if (id) return; // Only for new challenges creation

    const prefilledRaw = localStorage.getItem('flameer_prefilled_challenge');
    if (prefilledRaw) {
      try {
        const data = JSON.parse(prefilledRaw);
        localStorage.removeItem('flameer_prefilled_challenge');

        setTitle(data.title || '');
        setSubtitle(data.subtitle || '');
        setTier(data.tier || 'admin');
        setVisibility(data.visibility || 'public');
        setCategory(data.category || 'Treino');
        setDurationDays(data.duration_days || 30);
        setPrize(data.prize || '');
        setIconName(data.icon_name || 'trophy');
        setCoverImageUrl(data.cover_image_url || '');
        setShareCode(data.share_code || '');
        setIsFeatured(data.is_featured || false);
        if (Array.isArray(data.theme_colors) && data.theme_colors.length >= 2) {
          setThemeColors([data.theme_colors[0], data.theme_colors[1]]);
        }

        if (data.habits) setHabits(data.habits);
        if (data.workouts) setWorkouts(data.workouts);
        if (data.diets) setDiets(data.diets);

        toast({
          title: "Dados importados da IA",
          description: "Os treinos, dietas e hábitos gerados pela IA foram carregados com sucesso.",
        });
      } catch (err) {
        console.error("Erro ao carregar dados pré-preenchidos da IA:", err);
      }
    }
  }, [id]);

  // Load existing package data into state
  useEffect(() => {
    if (pkgData) {
      setTitle(pkgData.title || '');
      setSubtitle(pkgData.subtitle || '');
      setTier(pkgData.tier || 'admin');
      setVisibility(pkgData.visibility || 'public');
      setCategory(pkgData.category || 'Treino');
      setScoringMode(pkgData.scoring_mode || 'days_active');
      setDurationDays(pkgData.duration_days || 30);
      setPrize(pkgData.prize || '');
      setIconName(pkgData.icon_name || 'trophy');
      setCoverImageUrl(pkgData.cover_image_url || '');
      setShareCode(pkgData.share_code || '');
      setInviteCode(pkgData.invite_code || pkgData.share_code || '');
      setChallengeType(pkgData.challenge_type || 'group_public');
      setMaxParticipants(pkgData.max_participants || 50);
      setSemLimite(pkgData.max_participants == null);
      setIsFeatured(pkgData.is_featured || false);
      // J2
      setGoalType(pkgData.goal_type || 'activity');
      setStatusDesafio(pkgData.status || 'draft');
      setPesoTreino(pkgData.peso_treino ?? 1);
      setPesoDieta(pkgData.peso_dieta ?? 1);
      setPesoHabito(pkgData.peso_habito ?? 1);
      setHabitosImpostos(pkgData.habitos_impostos ?? true);
      setPeriodizacaoAdaptativa(pkgData.periodizacao_adaptativa ?? false);
      const seg = pkgData.segmento ?? {};
      setSegObjetivo(Array.isArray(seg.objetivo) ? seg.objetivo : []);
      setSegNivel(Array.isArray(seg.nivel) ? seg.nivel : []);
      setSegLocal(Array.isArray(seg.local) ? seg.local : []);
      const ap = pkgData.metadata?.appearance ?? {};
      setCoverImages(Array.isArray(ap.cover_images) ? ap.cover_images : []);
      setCarouselSeconds(typeof ap.carousel_seconds === 'number' ? ap.carousel_seconds : 4);
      setMostrarDias(ap.mostrar_dias !== false);
      setMostrarAtletas(ap.mostrar_atletas !== false);
      setMostrarCriador(ap.mostrar_criador !== false);
      if (Array.isArray(pkgData.theme_colors) && pkgData.theme_colors.length >= 2) {
        setThemeColors([pkgData.theme_colors[0], pkgData.theme_colors[1]]);
      }

      // Load Habits
      const mappedHabits = pkgData.habits?.map((h: any) => ({
        label: h.label,
        icon_name: h.icon_name,
        color: h.color,
        kind: h.kind,
        unit: h.unit || '',
        target: Number(h.target) || 1,
        metadata: h.metadata || {}
      })) || [];
      setHabits(mappedHabits);

      // Load Workouts
      const mappedWorkouts = pkgData.workouts?.map((w: any) => ({
        title: w.title,
        duration_minutes: w.duration_minutes || 45,
        focus: w.focus || 'Hipertrofia',
        days: w.workout_days?.map((d: any) => d.day_of_week) || [],
        metadata: w.metadata || {},
        // O `status` PRECISA fazer o round-trip. Sem ele, `save_challenge_package`
        // cai no default da coluna e reinsere TUDO como `published` —
        // ressuscitando o conteúdo arquivado de propósito.
        //
        // No Abdômen Insano isso tem consequência clínica: as 8 linhas
        // arquivadas carregam os 7 dias da semana, e `dia_e_planejado_para_treino`
        // passaria a contar DOMINGO como dia planejado. Quem descansa no
        // domingo — isto é, quem segue o programa — leva falta, e falta congela
        // a chama. Um save do painel desfazia a migration 20260808140000.
        status: w.status || 'published',
        exercises: w.exercises
          ?.sort((a: any, b: any) => a.order_index - b.order_index)
          ?.map((ex: any) => ({
            name: ex.name,
            muscle: ex.muscle,
            rest_seconds: ex.rest_seconds || 60,
            metadata: ex.metadata || {},
            sets: ex.exercise_sets
              ?.sort((a: any, b: any) => a.order_index - b.order_index)
              ?.map((s: any) => ({
                reps: s.reps,
                weight: s.weight
              })) || []
          })) || []
      })) || [];
      setWorkouts(mappedWorkouts);

      // Load Diets
      const mappedDiets = pkgData.diets?.map((d: any) => ({
        title: d.title,
        metadata: d.metadata || {},
        meals: d.meals
          ?.sort((a: any, b: any) => a.order_index - b.order_index)
          ?.map((m: any) => ({
            name: m.name,
            time: m.time,
            calories: Number(m.calories) || 0,
            protein: Number(m.protein) || 0,
            carbs: Number(m.carbs) || 0,
            fat: Number(m.fat) || 0,
            metadata: m.metadata || {},
            items: m.meal_items
              ?.sort((a: any, b: any) => a.order_index - b.order_index)
              ?.map((item: any) => ({
                name: item.name,
                quantity: item.quantity
              })) || []
          })) || []
      })) || [];
      setDiets(mappedDiets);
    }
  }, [pkgData]);

  // ⚠️ `returns table` vira ARRAY no PostgREST — a normalização trata os dois
  // formatos e, sem linha, devolve o padrão (nada liberado). Isso é de
  // propósito: `tenho_acesso` já falha fechada para desafio sem regra, então
  // a tela não pode sugerir liberação que o banco não tem.
  useEffect(() => {
    if (acessoBruto === undefined) return;
    setRegrasDeAcesso(normalizarRegrasDeAcesso(acessoBruto));
  }, [acessoBruto]);

  useEffect(() => {
    if (!acessoErro) return;
    if (funcaoAusenteNoBanco(acessoErro)) {
      setPortaDeAcessoAusente(true);
      return;
    }
    toast({
      title: 'Não deu para ler as regras de acesso',
      description:
        `${acessoErro.message ?? 'falha na RPC de regras de acesso'}. ` +
        `A seção "O que este produto libera" está mostrando os valores padrão — ` +
        `confira antes de gravar.`,
      variant: 'destructive',
    });
  }, [acessoErro]);

  // Helper generators
  const generateShareCode = () => {
    setShareCode('FLM-' + Math.random().toString(36).substring(2, 8).toUpperCase());
  };

  // Habits Operations
  const addHabit = () => {
    setHabits(prev => [...prev, { label: '', icon_name: 'flame', color: '#6B1D2F', kind: 'single', target: 1 }]);
  };
  const removeHabit = (idx: number) => {
    setHabits(prev => prev.filter((_, i) => i !== idx));
  };
  const updateHabit = (idx: number, key: keyof LocalHabit, val: any) => {
    setHabits(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: val };
      return copy;
    });
  };

  // Workouts Operations
  const addWorkout = () => {
    setWorkouts(prev => [...prev, { title: 'Treino A', duration_minutes: 45, focus: 'Hipertrofia', days: [], exercises: [] }]);
  };
  const removeWorkout = (idx: number) => {
    setWorkouts(prev => prev.filter((_, i) => i !== idx));
  };
  const updateWorkout = (idx: number, key: keyof LocalWorkout, val: any) => {
    setWorkouts(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: val };
      return copy;
    });
  };

  // ── Periodização (mesociclos por semana via metadata.week_number) ──────────
  const weekOf = (w: LocalWorkout) => w.metadata?.week_number ?? 1;

  /** Treinos ordenados por semana preservando o índice original (handlers). */
  const indexedByWeek = React.useMemo(() => {
    const arr = workouts.map((w, wIdx) => ({ w, wIdx }));
    arr.sort((a, b) => (a.w.metadata?.week_number ?? 1) - (b.w.metadata?.week_number ?? 1) || a.wIdx - b.wIdx);
    return arr;
  }, [workouts]);

  const programmedWeeks = React.useMemo(
    () => new Set(workouts.map(weekOf)).size,
    [workouts]
  );
  const expectedWeeks = Math.max(1, Math.ceil((durationDays || 7) / 7));

  const addWorkoutToWeek = (week: number) => {
    setWorkouts(prev => [
      ...prev,
      { title: 'Treino A', duration_minutes: 45, focus: 'Hipertrofia', days: [], exercises: [], metadata: { week_number: week } },
    ]);
  };

  /** Clona todos os treinos da semana para a semana seguinte (progressão). */
  const duplicateWeek = (week: number) => {
    setWorkouts(prev => {
      const clones = prev
        .filter(w => weekOf(w) === week)
        .map(w => {
          const clone = JSON.parse(JSON.stringify(w)) as LocalWorkout;
          clone.metadata = { ...(clone.metadata ?? {}), week_number: week + 1 };
          return clone;
        });
      return [...prev, ...clones];
    });
    toast({
      title: `Semana ${week} duplicada`,
      description: `Treinos copiados para a semana ${week + 1} — ajuste cargas/reps para a progressão.`,
    });
  };

  const addExercise = (wIdx: number) => {
    setWorkouts(prev => {
      const copy = [...prev];
      copy[wIdx].exercises.push({ name: '', muscle: 'Peitoral', rest_seconds: 60, sets: [{ reps: '10', weight: '20' }] });
      return copy;
    });
  };
  const removeExercise = (wIdx: number, exIdx: number) => {
    setWorkouts(prev => {
      const copy = [...prev];
      copy[wIdx].exercises = copy[wIdx].exercises.filter((_, i) => i !== exIdx);
      return copy;
    });
  };
  const updateExercise = (wIdx: number, exIdx: number, key: keyof LocalExercise, val: any) => {
    setWorkouts(prev => {
      const copy = [...prev];
      copy[wIdx].exercises[exIdx] = { ...copy[wIdx].exercises[exIdx], [key]: val };
      return copy;
    });
  };

  const addSet = (wIdx: number, exIdx: number) => {
    setWorkouts(prev => {
      const copy = [...prev];
      copy[wIdx].exercises[exIdx].sets.push({ reps: '10', weight: '20' });
      return copy;
    });
  };
  const removeSet = (wIdx: number, exIdx: number, setIdx: number) => {
    setWorkouts(prev => {
      const copy = [...prev];
      copy[wIdx].exercises[exIdx].sets = copy[wIdx].exercises[exIdx].sets.filter((_, i) => i !== setIdx);
      return copy;
    });
  };
  const updateSet = (wIdx: number, exIdx: number, setIdx: number, key: keyof LocalSet, val: string) => {
    setWorkouts(prev => {
      const copy = [...prev];
      copy[wIdx].exercises[exIdx].sets[setIdx] = { ...copy[wIdx].exercises[exIdx].sets[setIdx], [key]: val };
      return copy;
    });
  };

  const handleDayToggle = (wIdx: number, dayVal: number) => {
    setWorkouts(prev => {
      const copy = [...prev];
      const prevDays = copy[wIdx].days;
      copy[wIdx].days = prevDays.includes(dayVal) 
        ? prevDays.filter(d => d !== dayVal) 
        : [...prevDays, dayVal];
      return copy;
    });
  };

  // Diets Operations
  const ensureDietExists = () => {
    if (diets.length === 0) {
      setDiets([{ title: 'Plano Alimentar Geral', meals: [] }]);
    }
  };
  const addMeal = () => {
    ensureDietExists();
    setDiets(prev => {
      const copy = [...prev];
      copy[0].meals.push({ name: 'Refeição', time: '08:00:00', calories: 300, protein: 20, carbs: 30, fat: 10, items: [] });
      return copy;
    });
  };
  const removeMeal = (mIdx: number) => {
    setDiets(prev => {
      const copy = [...prev];
      copy[0].meals = copy[0].meals.filter((_, i) => i !== mIdx);
      return copy;
    });
  };
  const updateMeal = (mIdx: number, key: keyof LocalMeal, val: any) => {
    setDiets(prev => {
      const copy = [...prev];
      copy[0].meals[mIdx] = { ...copy[0].meals[mIdx], [key]: val };
      return copy;
    });
  };

  const addMealItem = (mIdx: number) => {
    setDiets(prev => {
      const copy = [...prev];
      copy[0].meals[mIdx].items.push({ name: '', quantity: '100g' });
      return copy;
    });
  };
  const removeMealItem = (mIdx: number, itemIdx: number) => {
    setDiets(prev => {
      const copy = [...prev];
      copy[0].meals[mIdx].items = copy[0].meals[mIdx].items.filter((_, i) => i !== itemIdx);
      return copy;
    });
  };
  const updateMealItem = (mIdx: number, itemIdx: number, key: keyof LocalMealItem, val: string) => {
    setDiets(prev => {
      const copy = [...prev];
      copy[0].meals[mIdx].items[itemIdx] = { ...copy[0].meals[mIdx].items[itemIdx], [key]: val };
      return copy;
    });
  };

  // Metadata Operations
  const updateWorkoutMetadata = (idx: number, subkey: string, val: any) => {
    setWorkouts(prev => {
      const copy = [...prev];
      const currentMeta = copy[idx].metadata || {};
      copy[idx] = { 
        ...copy[idx], 
        metadata: { ...currentMeta, [subkey]: val } 
      };
      return copy;
    });
  };

  const updateExerciseMetadata = (wIdx: number, exIdx: number, subkey: string, val: any) => {
    setWorkouts(prev => {
      const copy = [...prev];
      const currentMeta = copy[wIdx].exercises[exIdx].metadata || {};
      copy[wIdx].exercises[exIdx] = { 
        ...copy[wIdx].exercises[exIdx], 
        metadata: { ...currentMeta, [subkey]: val } 
      };
      return copy;
    });
  };

  const updateMealMetadata = (mIdx: number, subkey: string, val: any) => {
    setDiets(prev => {
      const copy = [...prev];
      const currentMeta = copy[0].meals[mIdx].metadata || {};
      copy[0].meals[mIdx] = { 
        ...copy[0].meals[mIdx], 
        metadata: { ...currentMeta, [subkey]: val } 
      };
      return copy;
    });
  };

  const updateDietMetadata = (subkey: string, val: any) => {
    setDiets(prev => {
      const copy = [...prev];
      const currentMeta = copy[0].metadata || {};
      copy[0] = { 
        ...copy[0], 
        metadata: { ...currentMeta, [subkey]: val } 
      };
      return copy;
    });
  };

  // Helper parser for JSON importation
  const cleanCitation = (str: string) => {
    if (!str) return '';
    return str.replace(/\[cite:\s*\d+(?:,\s*\d+)*\]/g, '').trim();
  };

  const parseDecimal = (str: string) => {
    if (!str) return 0;
    const cleaned = cleanCitation(str).replace(/[^\d.,]/g, '').replace(',', '.');
    return Number(cleaned) || 0;
  };

  // Parser helpers for Excel, CSV and PDF Text
  const parseGrid = (text: string): string[][] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    return lines.map(line => {
      if (line.includes('\t')) {
        return line.split('\t').map(c => c.trim());
      }
      if (line.includes(';')) {
        return line.split(';').map(c => c.trim());
      }
      return line.split(',').map(c => c.trim());
    });
  };

  const parseDietSpreadsheet = (text: string): LocalMeal[] => {
    const grid = parseGrid(text);
    const parsedMeals: LocalMeal[] = [];
    
    for (const row of grid) {
      if (row.length < 2) continue;
      const col0Lower = row[0].toLowerCase();
      if (col0Lower.includes('horár') || col0Lower.includes('hora') || col0Lower.includes('time')) continue;
      
      const timeVal = row[0];
      const nameVal = row[1];
      const foodsStr = row[2] || '';
      const kcal = parseDecimal(row[3] || '0');
      const prot = parseDecimal(row[4] || '0');
      const carb = parseDecimal(row[5] || '0');
      const fatVal = parseDecimal(row[6] || '0');
      
      const items = foodsStr.split(/[,;\n]/).filter(f => f.trim().length > 0).map(f => {
        const parts = f.split(':');
        if (parts.length > 1) {
          return { name: parts[0].trim(), quantity: parts[1].trim() };
        }
        return { name: f.trim(), quantity: '1 porção' };
      });
      
      parsedMeals.push({
        name: nameVal || 'Refeição',
        time: timeVal.length === 5 ? `${timeVal}:00` : timeVal,
        calories: kcal,
        protein: prot,
        carbs: carb,
        fat: fatVal,
        items
      });
    }
    return parsedMeals;
  };

  const parseDietFreeText = (text: string): LocalMeal[] => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsedMeals: LocalMeal[] = [];
    let currentMeal: LocalMeal | null = null;
    const timeRegex = /\b\d{2}:\d{2}\b/;
    
    for (const line of lines) {
      const timeMatch = line.match(timeRegex);
      if (timeMatch) {
        if (currentMeal) {
          parsedMeals.push(currentMeal);
        }
        const timeVal = timeMatch[0];
        let nameVal = line.replace(timeRegex, '').replace(/[-–—]/g, '').trim();
        if (!nameVal) nameVal = 'Refeição';
        
        currentMeal = {
          name: nameVal,
          time: `${timeVal}:00`,
          calories: 300,
          protein: 20,
          carbs: 30,
          fat: 10,
          items: []
        };
      } else if (currentMeal) {
        const parts = line.split(':');
        if (parts.length > 1) {
          currentMeal.items.push({ name: parts[0].trim(), quantity: parts[1].trim() });
        } else {
          currentMeal.items.push({ name: line, quantity: '1 porção' });
        }
      }
    }
    
    if (currentMeal) {
      parsedMeals.push(currentMeal);
    }
    return parsedMeals;
  };

  const parseWorkoutSpreadsheet = (text: string): LocalExercise[] => {
    const grid = parseGrid(text);
    const exercises: LocalExercise[] = [];
    
    for (const row of grid) {
      if (row.length < 1) continue;
      const col0Lower = row[0].toLowerCase();
      if (col0Lower.includes('exercí') || col0Lower.includes('exercise') || col0Lower.includes('nome')) continue;
      
      const exName = row[0];
      const muscleVal = row[1] || 'Geral';
      const setsCount = Number(row[2]) || 3;
      const repsText = row[3] || '10';
      const restSec = parseDecimal(row[4] || '60');
      const notesVal = row[5] || '';
      
      const sets = Array.from({ length: setsCount }, () => ({
        reps: repsText,
        weight: '0'
      }));
      
      exercises.push({
        name: exName,
        muscle: muscleVal,
        rest_seconds: restSec,
        sets,
        metadata: {
          informacoes_adicionais: notesVal || undefined
        }
      });
    }
    return exercises;
  };

  const parseWorkoutFreeText = (text: string): LocalExercise[] => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const exercises: LocalExercise[] = [];
    
    for (const line of lines) {
      let setsCount = 3;
      let repsText = '10';
      let restSec = 60;
      
      const setsRepsRegex = /(\d+)\s*(?:x|séries\s+de|sets\s+of)\s*(\d+(?:-\d+)?)/i;
      const matchSetsReps = line.match(setsRepsRegex);
      if (matchSetsReps) {
        setsCount = Number(matchSetsReps[1]) || 3;
        repsText = matchSetsReps[2];
      }
      
      const restRegex = /(?:descanso|rest|intervalo)\s*[:\-–]?\s*(\d+)\s*(s|seg|min|m)?/i;
      const matchRest = line.match(restRegex);
      if (matchRest) {
        const val = Number(matchRest[1]) || 60;
        const unit = (matchRest[2] || '').toLowerCase();
        if (unit.startsWith('m')) {
          restSec = val * 60;
        } else {
          restSec = val;
        }
      }
      
      let exName = line
        .replace(setsRepsRegex, '')
        .replace(restRegex, '')
        .replace(/[-–—[\]()]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
        
      if (!exName) exName = 'Exercício';
      
      const sets = Array.from({ length: setsCount }, () => ({
        reps: repsText,
        weight: '0'
      }));
      
      exercises.push({
        name: exName,
        muscle: 'Geral',
        rest_seconds: restSec,
        sets,
        metadata: {
          informacoes_adicionais: line
        }
      });
    }
    return exercises;
  };

  const handleImportSubmit = () => {
    if (!importText.trim()) {
      toast({ title: "Campo Vazio", description: "Por favor, cole o texto ou carregue um arquivo.", variant: "destructive" });
      return;
    }

    if (importType === 'diet') {
      let parsedMeals: LocalMeal[] = [];
      let metadata: any = {};
      
      try {
        if (importFormat === 'json') {
          const rawData = JSON.parse(importText);
          const plan = rawData.plano_alimentar;
          const nutrients = rawData.relatorio_nutrientes;
          const shopping = rawData.lista_de_compras;
          
          if (!plan) {
            toast({ title: "JSON Inválido", description: "O JSON deve conter a chave plano_alimentar.", variant: "destructive" });
            return;
          }
          
          parsedMeals = plan.refeicoes.map((ref: any) => {
            const mealName = cleanCitation(ref.nome);
            const cleanTime = cleanCitation(ref.horario).replace(/\s*\[.*\]/, '');
            
            let calories = 0, protein = 0, carbs = 0, fat = 0;
            if (nutrients && nutrients.macronutrientes_por_refeicao) {
              const macro = nutrients.macronutrientes_por_refeicao.find((m: any) => 
                cleanCitation(m.refeicao).toLowerCase() === mealName.toLowerCase()
              );
              if (macro) {
                calories = parseDecimal(macro.calorias);
                protein = parseDecimal(macro.proteinas);
                carbs = parseDecimal(macro.carboidratos);
                fat = parseDecimal(macro.lipideos);
              }
            }
            
            const items = (ref.alimentos || []).map((food: string) => {
              const cleanedFood = cleanCitation(food);
              const parts = cleanedFood.split(':');
              if (parts.length > 1) {
                return { name: parts[0].trim(), quantity: parts[1].trim() };
              }
              return { name: cleanedFood, quantity: "1 porção" };
            });
            
            const substitutions = (ref.substituicoes || []).map((sub: string) => cleanCitation(sub));
            const observacoes = ref.observacoes ? cleanCitation(ref.observacoes) : undefined;
            
            return {
              name: mealName,
              time: cleanTime.length === 5 ? `${cleanTime}:00` : cleanTime,
              calories,
              protein,
              carbs,
              fat,
              items,
              metadata: { observacoes, substitutions }
            };
          });
          
          metadata = {
            patient_name: cleanCitation(plan.paciente),
            prescription_date: cleanCitation(plan.data_prescricao),
            professional_name: cleanCitation(plan.profissional?.nome),
            professional_role: cleanCitation(plan.profissional?.atuacao),
            professional_crn: cleanCitation(plan.profissional?.registro),
            shopping_list: shopping?.itens?.map((i: string) => cleanCitation(i)) || [],
            nutrient_report: nutrients?.micronutrientes_e_gorduras || null
          };
        } else if (importFormat === 'spreadsheet') {
          parsedMeals = parseDietSpreadsheet(importText);
        } else {
          parsedMeals = parseDietFreeText(importText);
        }

        if (parsedMeals.length === 0) {
          toast({ title: "Nenhum Registro", description: "Não foi possível extrair refeições desse formato.", variant: "destructive" });
          return;
        }

        setDiets(prev => {
          if (importMode === 'replace' || prev.length === 0) {
            return [{ title: 'Plano Alimentar Geral', meals: parsedMeals, metadata }];
          } else {
            const updatedMeals = [...prev[0].meals, ...parsedMeals];
            const updatedMeta = { ...prev[0].metadata, ...metadata };
            return [{ ...prev[0], meals: updatedMeals, metadata: updatedMeta }];
          }
        });
        
        toast({ title: "Importado com sucesso", description: `${parsedMeals.length} refeições inseridas.` });
        setIsImportModalOpen(false);
        setImportText('');
      } catch (err: any) {
        toast({ title: "Erro na Importação", description: err.message || "Erro ao processar arquivo.", variant: "destructive" });
      }
    } else {
      try {
        let newWorkouts: LocalWorkout[] = [];
        
        if (importFormat === 'json') {
          const rawData = JSON.parse(importText);
          let title = "";
          let focus = "";
          let videoUrl = "";
          let cronograma = "";
          let exercises: LocalExercise[] = [];
          let hiitProtocol: any = null;
          
          if (rawData.treino_abdomen) {
            const tr = rawData.treino_abdomen;
            title = cleanCitation(tr.titulo);
            focus = cleanCitation(tr.foco);
            videoUrl = cleanCitation(tr.video_instrucional_url || tr.video_instrucional);
            cronograma = cleanCitation(tr.cronograma_semanal);
            
            exercises = (tr.exercicios || []).map((ex: any) => {
              const name = cleanCitation(ex.name);
              const muscle = cleanCitation(ex.foco || tr.foco || "Abdômen");
              const restSec = parseDecimal(ex.descanso_entre_series || "60");
              const setsCount = Number(ex.series) || 3;
              const repsText = cleanCitation(ex.repeticoes || "10-12");
              
              const sets = Array.from({ length: setsCount }, () => ({
                reps: repsText,
                weight: "0"
              }));
              
              return {
                name,
                muscle,
                rest_seconds: restSec,
                sets,
                metadata: {
                  informacoes_adicionais: cleanCitation(ex.informacoes_adicionais)
                }
              };
            });
          } else if (rawData.treino_cardio) {
            const tc = rawData.treino_cardio;
            title = cleanCitation(tc.titulo);
            focus = cleanCitation(tc.foco);
            videoUrl = cleanCitation(tc.video_instrucional_url || tc.video_instrucional);
            cronograma = cleanCitation(tc.cronograma_semanal);
            
            hiitProtocol = {
              aquecimento: tc.protocolo?.aquecimento ? cleanCitation(tc.protocolo.aquecimento) : "",
              treino_hiit: tc.protocolo?.treino_hiit ? cleanCitation(tc.protocolo.treino_hiit) : "",
              resfriamento: tc.protocolo?.resfriamento ? cleanCitation(tc.protocolo.resfriamento) : ""
            };
            
            exercises = [{
              name: cleanCitation(tc.titulo),
              muscle: "Cardiorrespiratório",
              rest_seconds: 0,
              sets: [{ reps: "1", weight: "0" }],
              metadata: {
                informacoes_adicionais: `Aquecimento: ${hiitProtocol.aquecimento}. HIIT: ${hiitProtocol.treino_hiit}. Resfriamento: ${hiitProtocol.resfriamento}.`
              }
            }];
          } else {
            toast({ title: "JSON Inválido", description: "O JSON deve conter treino_abdomen ou treino_cardio.", variant: "destructive" });
            return;
          }
          
          let weekNumber = 1;
          const match = title.match(/\d+/);
          if (match) {
            weekNumber = Number(match[0]) || 1;
          }
          
          let days: number[] = [];
          const cronLower = cronograma.toLowerCase();
          if (cronLower.includes("1") || cronLower.includes("segunda") || cronLower.includes("terça") || cronLower.includes("quarta") || cronLower.includes("quinta") || cronLower.includes("sexta") || cronLower.includes("sábado")) {
            if (cronLower.includes("1, 3 e 5") || (cronLower.includes("segunda") && cronLower.includes("quarta"))) {
              days = [0, 2, 4];
            } else if (cronLower.includes("2, 4 e 6") || (cronLower.includes("terça") && cronLower.includes("quinta"))) {
              days = [1, 3, 5];
            }
          }
          
          newWorkouts.push({
            title,
            duration_minutes: rawData.treino_abdomen ? 30 : 20,
            focus,
            days,
            exercises,
            metadata: {
              week_number: weekNumber,
              video_url: videoUrl,
              hiit_protocol: hiitProtocol
            }
          });
        } else {
          const exercises = importFormat === 'spreadsheet' 
            ? parseWorkoutSpreadsheet(importText) 
            : parseWorkoutFreeText(importText);
            
          if (exercises.length === 0) {
            toast({ title: "Nenhum Registro", description: "Não foi possível extrair exercícios.", variant: "destructive" });
            return;
          }
          
          newWorkouts.push({
            title: `Treino Importado (${new Date().toLocaleDateString()})`,
            duration_minutes: 45,
            focus: 'Geral',
            days: [0, 2, 4],
            exercises,
            metadata: {
              week_number: 1
            }
          });
        }

        setWorkouts(prev => {
          if (importMode === 'replace') {
            return newWorkouts;
          } else {
            return [...prev, ...newWorkouts];
          }
        });
        
        toast({ title: "Treino Importado", description: "Seus treinos foram atualizados com sucesso." });
        setIsImportModalOpen(false);
        setImportText('');
      } catch (err: any) {
        toast({ title: "Erro na Importação", description: err.message || "Erro ao processar planilha.", variant: "destructive" });
      }
    }
  };

  // Zod / Logic Validation
  const validateForm = (): boolean => {
    // 1. Details Validation
    if (!title.trim()) {
      toast({ title: "Campo Obrigatório", description: "O título do desafio é obrigatório.", variant: "destructive" });
      setActiveTab('details');
      return false;
    }
    if (!shareCode.trim()) {
      toast({ title: "Campo Obrigatório", description: "O código de compartilhamento é obrigatório.", variant: "destructive" });
      setActiveTab('details');
      return false;
    }

    // 2. Habits Validation
    //
    // HÁBITO É OPCIONAL — o banco concorda desde 08/08 (save_challenge_package
    // trata seção vazia como no-op seguro e vitrine_de_desafios devolve
    // tem_habitos como estado esperado). A trava que exigia ≥1 hábito era só
    // do navegador e impedia QUALQUER save de desafio sem hábitos — inclusive
    // trocar duas cores do Abdômen Insano (teste do dono, 17/08). Aviso
    // informativo, sem bloquear:
    if (habits.length === 0) {
      toast({ title: "Sem hábitos", description: "Este desafio será salvo sem hábitos modelo — os alunos definem os próprios. Você pode adicionar depois." });
    }
    for (let i = 0; i < habits.length; i++) {
      if (!habits[i].label.trim()) {
        toast({ title: "Erro na aba de Hábitos", description: `Preencha o nome do Hábito ${i+1}.`, variant: "destructive" });
        setActiveTab('habits');
        return false;
      }
    }

    // 3. Workouts Validation
    for (let wIdx = 0; wIdx < workouts.length; wIdx++) {
      const w = workouts[wIdx];
      if (!w.title.trim()) {
        toast({ title: "Erro na aba de Treinos", description: `Dê um título para o Treino ${wIdx+1}.`, variant: "destructive" });
        setActiveTab('workouts');
        return false;
      }
      if (w.days.length === 0) {
        toast({ title: "Erro na aba de Treinos", description: `Selecione pelo menos um dia de agendamento para o treino "${w.title}".`, variant: "destructive" });
        setActiveTab('workouts');
        return false;
      }
      if (w.exercises.length === 0) {
        toast({ title: "Erro na aba de Treinos", description: `Adicione pelo menos um exercício ao treino "${w.title}".`, variant: "destructive" });
        setActiveTab('workouts');
        return false;
      }
      for (let exIdx = 0; exIdx < w.exercises.length; exIdx++) {
        const ex = w.exercises[exIdx];
        if (!ex.name.trim()) {
          toast({ title: "Erro na aba de Treinos", description: `Preencha o nome do exercício ${exIdx+1} no treino "${w.title}".`, variant: "destructive" });
          setActiveTab('workouts');
          return false;
        }
        if (ex.sets.length === 0) {
          toast({ title: "Erro na aba de Treinos", description: `Adicione pelo menos uma série no exercício "${ex.name}" do treino "${w.title}".`, variant: "destructive" });
          setActiveTab('workouts');
          return false;
        }
      }
    }

    // 4. Diets Validation
    if (diets.length > 0 && diets[0].meals.length > 0) {
      const meals = diets[0].meals;
      // "Recomenda-se" era texto de aviso com comportamento de TRAVA — o
      // save inteiro morria por causa de uma dieta com 1 refeição (a outra
      // metade do erro do teste do dono, 17/08). Agora o texto e o
      // comportamento dizem a mesma coisa: recomendação não bloqueia.
      if (meals.length < 2) {
        toast({ title: "Aviso de Nutrição", description: "O plano tem só 1 refeição — recomenda-se pelo menos 2 refeições diárias. Salvando mesmo assim." });
      }
      for (let mIdx = 0; mIdx < meals.length; mIdx++) {
        const m = meals[mIdx];
        if (!m.name.trim()) {
          toast({ title: "Erro na aba de Dieta", description: `Preencha o nome da Refeição ${mIdx+1}.`, variant: "destructive" });
          setActiveTab('diets');
          return false;
        }
      }
    }

    return true;
  };

  // Atomic save package mutation
  const saveChallengePackage = useSupabaseMutation<any, any>(
    async (payload) => {
      const { data, error } = await (supabase as any).rpc('save_challenge_package', {
        p_payload: payload
      });
      if (error) return { data, error };
      // A aparência vai numa RPC própria: save_challenge_package não escreve
      // metadata, e reescrever as 317 linhas dela para um campo novo seria
      // risco à toa. `data` é o uuid do desafio que ela devolve.
      //
      // AS DUAS CHAMADAS NÃO SÃO ATÔMICAS. Se a segunda falhar, o pacote JÁ
      // FOI salvo — e o toast genérico ("falha transacional") mentia: o admin
      // achava que perdeu tudo e não sabia que só a aparência ficou para
      // trás. O erro agora diz exatamente o estado em que o desafio ficou.
      const { error: apErr } = await (supabase as any).rpc('salvar_aparencia_do_desafio', {
        p_challenge_id: data,
        p_appearance: payload.__appearance,
      });

      // AS REGRAS (J2, 17/08) — mesma razão da aparência: save_challenge_package
      // não escreve objetivo, pesos, segmento nem as bandeiras. RPC própria,
      // que só grava as chaves que o payload trouxe.
      if (!apErr) {
        const { error: regErr } = await (supabase as any).rpc('salvar_regras_do_desafio', {
          p_challenge_id: data,
          p_regras: {
            goal_type: payload.goal_type,
            status: payload.status,
            peso_treino: payload.peso_treino,
            peso_dieta: payload.peso_dieta,
            peso_habito: payload.peso_habito,
            habitos_impostos: payload.habitos_impostos,
            periodizacao_adaptativa: payload.periodizacao_adaptativa,
            segmento: payload.segmento,
            max_participants: payload.max_participants,
          },
        });
        if (regErr) {
          return {
            data,
            error: {
              ...regErr,
              message:
                `O desafio e a aparência foram salvos, mas as regras (objetivo, ` +
                `pesos, segmentação) não: ${regErr.message ?? 'falha na RPC de regras'}. ` +
                `Reabra o desafio e salve de novo para aplicá-las.`,
            },
          };
        }

        // AS REGRAS DE ACESSO (27/08) — terceira RPC pela MESMA razão das duas
        // acima: elas moram em `challenge_access_rules`, e nenhuma das outras
        // toca nessa tabela.
        //
        // O contrato é "chave ausente = campo intocado", e é por isso que
        // `grants_free_challenges` não viaja: ela nasce `true` no banco e não
        // é decisão desta tela.
        //
        // Vai por último de propósito: se a migration ainda não foi aplicada,
        // o desafio inteiro já está salvo e a falha vira AVISO, não erro —
        // uma porta que ainda não existe não pode derrubar um save que
        // funcionou.
        const { error: acErr } = await (supabase as any).rpc('admin_salvar_regras_de_acesso', {
          p_challenge_id: data,
          p_regras: payload.__acesso,
        });
        if (acErr && funcaoAusenteNoBanco(acErr)) {
          setPortaDeAcessoAusente(true);
          toast({
            title: 'Regras de acesso não aplicadas',
            description:
              'O desafio foi salvo, mas a migration de `admin_salvar_regras_de_acesso` ainda ' +
              'não está no banco. Aplique a migration e salve de novo para gravar o que este ' +
              'produto libera.',
          });
        } else if (acErr) {
          return {
            data,
            error: {
              ...acErr,
              message:
                `O desafio foi salvo, mas o que o produto libera (acesso, prazo, ` +
                `desbloqueio) não: ${acErr.message ?? 'falha na RPC de regras de acesso'}. ` +
                `Reabra o desafio e salve de novo para aplicar essa seção.`,
            },
          };
        }
      }
      if (apErr) {
        return {
          data,
          error: {
            ...apErr,
            message:
              `O desafio FOI salvo, mas a aparência (carrossel/toggles) não: ` +
              `${apErr.message ?? 'falha na RPC de aparência'}. ` +
              `Reabra o desafio e salve de novo só para aplicar a aparência.`,
          },
        };
      }
      return { data, error: null };
    },
    {
      onSuccess: () => {
        toast({
          title: id ? "Desafio atualizado" : "Desafio criado",
          description: "O pacote completo do desafio foi salvo de forma transacional.",
        });
        navigate('/challenges');
      },
      onError: (err) => {
        toast({
          title: "Erro ao salvar pacote",
          description: err.message || "Houve uma falha transacional no banco de dados.",
          variant: "destructive",
        });
      }
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // SEÇÃO VAZIA NÃO É "APAGAR TUDO" — E TAMBÉM NÃO PODE SER UM SUCESSO MUDO.
    //
    // `save_challenge_package` deixou de apagar seção que o payload não repõe:
    // antes, um formulário que abrisse vazio (era o que acontecia sem a FK)
    // destruía o produto inteiro. A regra nova é a certa, mas cria um efeito
    // colateral honesto: mandar uma lista vazia virou NO-OP, e o painel dizia
    // "salvo com sucesso" sem ter mudado nada.
    //
    // Aqui o admin fica sabendo antes de clicar.
    if (id) {
      const vazias = [
        workouts.length === 0 ? 'treinos' : null,
        diets.length === 0 ? 'dietas' : null,
      ].filter(Boolean) as string[];
      if (vazias.length > 0 && !confirm(
        `A aba de ${vazias.join(' e ')} está vazia.\n\n` +
        `Salvar assim NÃO apaga o que já existe no desafio — essa seção fica ` +
        `intocada. Se a intenção era só editar as outras abas, pode seguir.`
      )) return;
    }

    const payload = {
      id: id || undefined,
      title,
      subtitle: subtitle || null,
      tier,
      visibility,
      challenge_type: challengeType,
      // Individual é sempre 1. Nos demais, o teto vale para privado E público
      // (J2) — e "sem limite" manda null, que é o que a lotação entende como
      // vaga livre.
      max_participants: challengeType === 'individual'
        ? 1
        : (semLimite ? null : Number(maxParticipants)),
      invite_code: inviteCode || shareCode,
      category,
      scoring_mode: scoringMode,
      // ── J2 (17/08) ──
      goal_type: goalType,
      status: statusDesafio,
      peso_treino: Number(pesoTreino),
      peso_dieta: Number(pesoDieta),
      peso_habito: Number(pesoHabito),
      habitos_impostos: habitosImpostos,
      periodizacao_adaptativa: periodizacaoAdaptativa,
      // Segmento só viaja com o que foi de fato escolhido; nada escolhido =
      // null = desafio para todo mundo.
      segmento: (segObjetivo.length || segNivel.length || segLocal.length)
        ? {
            ...(segObjetivo.length ? { objetivo: segObjetivo } : {}),
            ...(segNivel.length ? { nivel: segNivel } : {}),
            ...(segLocal.length ? { local: segLocal } : {}),
          }
        : null,
      duration_days: Number(durationDays),
      prize: prize || null,
      icon_name: iconName,
      theme_colors: themeColors,
      cover_image_url: coverImageUrl || null,
      share_code: shareCode,
      is_featured: isFeatured,
      habits,
      workouts,
      diets,
      // Chave com prefixo __ de propósito: save_challenge_package ignora o que
      // não conhece, e a mutation a repassa para a RPC de aparência.
      __appearance: {
        cover_images: coverImages,
        carousel_seconds: Number(carouselSeconds) || 4,
        mostrar_dias: mostrarDias,
        mostrar_atletas: mostrarAtletas,
        mostrar_criador: mostrarCriador,
      },
      // Mesmo prefixo __ da aparência: save_challenge_package ignora o que não
      // conhece, e a mutation repassa isto para admin_salvar_regras_de_acesso.
      //
      // Só as chaves que ESTA tela governa. `grants_free_challenges` fica de
      // fora para o banco não perder o default `true` — chave ausente é campo
      // intocado.
      __acesso: {
        is_paid: regrasDeAcesso.is_paid,
        access_days: regrasDeAcesso.access_days,
        grants_own_plan: regrasDeAcesso.grants_own_plan,
        grants_ai_workout: regrasDeAcesso.grants_ai_workout,
        grants_create_challenges: regrasDeAcesso.grants_create_challenges,
        grants_catalog: regrasDeAcesso.grants_catalog,
        unlock_mode: regrasDeAcesso.unlock_mode,
        price_cents: regrasDeAcesso.price_cents,
        external_product_ref: regrasDeAcesso.external_product_ref,
      },
    };

    saveChallengePackage.mutate(payload);
  };

  if (id && isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground font-medium">Carregando pacote completo do desafio...</span>
      </div>
    );
  }

  const weekdays = [
    { label: 'Seg', value: 0 },
    { label: 'Ter', value: 1 },
    { label: 'Qua', value: 2 },
    { label: 'Qui', value: 3 },
    { label: 'Sex', value: 4 },
    { label: 'Sáb', value: 5 },
    { label: 'Dom', value: 6 },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="h-9 w-9 text-muted-foreground hover:text-foreground">
            <Link to="/challenges">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
              {id ? 'Editar Desafio' : 'Novo Desafio'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {id ? 'Atualize as abas do pacote' : 'Crie o pacote completo do desafio (detalhes, hábitos, treino e alimentação)'}
            </p>
          </div>
        </div>
        
        {/* Action submit button */}
        <Button onClick={handleSubmit} disabled={saveChallengePackage.isPending} className="gap-1.5 shadow-md shadow-primary/10">
          {saveChallengePackage.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Gravando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Gravar Desafio
            </>
          )}
        </Button>
      </div>

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-11 bg-card border border-border p-1 rounded-xl">
          <TabsTrigger value="details" className="rounded-lg gap-1.5 font-bold text-xs">
            <FolderOpen className="w-4 h-4" />
            1. Detalhes
          </TabsTrigger>
          <TabsTrigger value="habits" className="rounded-lg gap-1.5 font-bold text-xs">
            <CheckSquare className="w-4 h-4" />
            2. Hábitos
          </TabsTrigger>
          <TabsTrigger value="workouts" className="rounded-lg gap-1.5 font-bold text-xs">
            <Dumbbell className="w-4 h-4" />
            3. Treinos (Splits)
          </TabsTrigger>
          <TabsTrigger value="diets" className="rounded-lg gap-1.5 font-bold text-xs">
            <Apple className="w-4 h-4" />
            4. Dieta
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: DETALHES — repaginada em 11/08 a pedido do dono: as seções
            seguem a ordem em que o ALUNO encontra as coisas (vitrine → preview
            → regras → porta de entrada) e cada campo diz ONDE aparece. Antes
            era uma grade única sem hierarquia, com dois campos chamados
            "Categoria" (um era o selo, o outro o tier). */}
        <TabsContent value="details" className="mt-6 space-y-6">

          {/* O mapa: onde cada pedaço deste formulário aparece no app */}
          <div className="bg-secondary/30 border border-border rounded-xl px-5 py-4 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-bold text-foreground mr-1">A jornada do aluno:</span>
            <span className="bg-card border border-border rounded-full px-2.5 py-1 font-medium">① vê o cartão na vitrine</span>
            <span>→</span>
            <span className="bg-card border border-border rounded-full px-2.5 py-1 font-medium">② abre o preview (carrossel, aulas)</span>
            <span>→</span>
            <span className="bg-card border border-border rounded-full px-2.5 py-1 font-medium">③ entra e recebe hábitos, treinos e dieta (abas 2–4)</span>
          </div>

          {/* ═══ §1 · APRESENTAÇÃO — O CARTÃO DA VITRINE ═══ */}
          <div className="bg-card border border-border rounded-md p-6 space-y-5">
            <div className="border-b border-border pb-3">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                1 · Apresentação — o cartão da vitrine
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                O primeiro contato do aluno: o cartão escuro na "Área de Desafios". O que está aqui é o que vende o toque.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="title">Título do Desafio *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Desafio Seca Barriga"
                  required
                />
                <p className="text-[11px] text-muted-foreground">Nome grande do cartão e do preview.</p>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="subtitle">Subtítulo / Descrição Curta</Label>
                <Input
                  id="subtitle"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Ex: Trinque o abdômen em 6 semanas com periodização científica"
                />
                <p className="text-[11px] text-muted-foreground">A frase abaixo do título no cartão — a promessa em uma linha.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="category">Selo de categoria</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ex: Treino"
                />
                <p className="text-[11px] text-muted-foreground">O texto laranja em MAIÚSCULAS acima do título no preview (ex.: TREINO).</p>
              </div>

              {/* A RÉGUA DA DISPUTA.
                  Cada opção aponta para UMA coluna que `challenge_leaderboard`
                  já devolve — nenhuma promete um critério que o placar não tem.
                  A diferença entre "Dias ativos" e os dois últimos é o que mais
                  confunde: dia ativo conta QUALQUER coisa (treino, dieta ou
                  hábito); os outros dois contam uma só. */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="scoring_mode">Como se ganha</Label>
                <select
                  id="scoring_mode"
                  value={scoringMode}
                  onChange={(e) => setScoringMode(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="days_active">Dias ativos — constância</option>
                  <option value="pontos_total">Pontos — volume</option>
                  <option value="photo_checkin">Check-in por foto</option>
                  <option value="workout_days">Dias treinados</option>
                  <option value="diet_days">Dias de dieta</option>
                  <option value="ponderado">Ponderado — você define os pesos</option>
                </select>
                <p className="text-[11px] text-muted-foreground">
                  {scoringMode === 'days_active'   && 'Quem fechar mais DIAS no período. Vale treino, dieta ou hábito — é a régua do "dia fechado" e o padrão.'}
                  {scoringMode === 'pontos_total'  && 'Quem SOMAR mais pontos. Premia volume: quem faz mais no mesmo dia sobe mais.'}
                  {scoringMode === 'photo_checkin' && 'Quem enviar mais fotos de check-in válidas. Neste modo o ranking só aparece DEPOIS do post.'}
                  {scoringMode === 'workout_days'  && 'Quem treinar em mais dias. Só treino conta — dieta e hábito não entram.'}
                  {scoringMode === 'diet_days'     && 'Quem cumprir a dieta em mais dias. Só a alimentação conta.'}
                  {scoringMode === 'ponderado'     && 'Você decide quanto vale cada atividade neste desafio. A fórmula aparece abaixo.'}
                </p>

                {scoringMode === 'ponderado' && (
                  <div className="mt-3 rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
                    <p className="text-xs font-semibold text-foreground">Peso de cada atividade</p>
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        ['Treino', pesoTreino, setPesoTreino],
                        ['Dieta', pesoDieta, setPesoDieta],
                        ['Hábito', pesoHabito, setPesoHabito],
                      ] as [string, number, (n: number) => void][]).map(([rotulo, valor, set]) => (
                        <div key={rotulo} className="space-y-1">
                          <span className="text-[11px] text-muted-foreground block">{rotulo}</span>
                          <Input type="number" min={0} max={10} value={valor}
                                 onChange={(e) => set(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
                                 className="h-9 text-sm" />
                        </div>
                      ))}
                    </div>
                    {/* A fórmula por extenso: o admin precisa ver o que acabou
                        de montar, não adivinhar. */}
                    <p className="text-[11px] text-muted-foreground">
                      Pontuação = <strong>{pesoTreino}×</strong> dias treinados
                      {' + '}<strong>{pesoDieta}×</strong> dias de dieta
                      {' + '}<strong>{pesoHabito}×</strong> hábitos cumpridos
                    </p>
                    {(pesoTreino + pesoDieta + pesoHabito) === 0 && (
                      <p className="text-[11px] font-semibold text-destructive">
                        Pelo menos um peso precisa ser maior que zero — senão ninguém pontua.
                      </p>
                    )}
                  </div>
                )}
                {id && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-500">
                    Trocar a régua de um desafio em andamento reordena o ranking de quem já está participando.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prize">Prêmio</Label>
                <Input
                  id="prize"
                  value={prize}
                  onChange={(e) => setPrize(e.target.value)}
                  placeholder="Ex: Kit Suplementos"
                />
                <p className="text-[11px] text-muted-foreground">Preenchido, acende a cápsula "PRÊMIO" no cartão. Vazio, ela não existe.</p>
              </div>

              <div className="flex items-center space-x-2.5 sm:col-span-2 pt-1">
                <Checkbox
                  id="is_featured"
                  checked={isFeatured}
                  onCheckedChange={(checked) => setIsFeatured(!!checked)}
                />
                <Label htmlFor="is_featured" className="text-sm font-semibold cursor-pointer">
                  Destacar este desafio na página inicial do app
                </Label>
              </div>
            </div>
          </div>

          {/* ═══ §2 · VISUAL DO PREVIEW — A TELA QUE VENDE ═══ */}
          <div className="bg-card border border-border rounded-md p-6 space-y-5">
            <div className="border-b border-border pb-3">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" />
                2 · Visual do preview — a tela que abre no toque
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                O preview é o carrossel no topo, o ícone com as cores do tema e as cápsulas de informação. Tudo desta seção é essa tela.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Capa do desafio</Label>
              <CoverImageUpload value={coverImageUrl} onChange={setCoverImageUrl} />
              <p className="text-[11px] text-muted-foreground">
                Usada nos cards da vitrine — e como imagem única do topo quando o carrossel abaixo estiver vazio.
              </p>
              {coverImageUrl && (
                <img
                  src={coverImageUrl}
                  alt=""
                  className="hidden"
                  key={coverImageUrl}
                  onLoad={() => setCapaQuebrada(false)}
                  onError={() => setCapaQuebrada(true)}
                />
              )}
              {coverImageUrl && capaQuebrada && (
                <p className="text-[11px] font-semibold text-destructive">
                  ⚠️ Esta imagem não carrega — o arquivo não existe no storage.
                  No app, o preview cai no fundo com as cores do tema. Suba a
                  imagem de novo ou limpe o campo.
                </p>
              )}
            </div>

            <div className="space-y-2 border border-border rounded-lg p-4 bg-secondary/20">
              <Label className="text-sm font-semibold">Carrossel do topo</Label>
              <p className="text-[11px] text-muted-foreground -mt-1">
                As imagens passam sozinhas no topo do preview, na ordem daqui. Vazio = o app usa a capa única acima.
              </p>
              <CarouselImagesUpload value={coverImages} onChange={setCoverImages} />
              {coverImages.length > 1 && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-muted-foreground">Segundos por imagem</span>
                  <Input
                    type="number"
                    min={2}
                    max={15}
                    value={carouselSeconds}
                    onChange={(e) => setCarouselSeconds(Number(e.target.value))}
                    className="h-8 w-20 text-xs"
                  />
                </div>
              )}
            </div>

            <div className="space-y-3 border border-border rounded-lg p-4 bg-secondary/20">
              <Label className="text-sm font-semibold">Cores e ícone</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[11px] text-muted-foreground block">Cor principal</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={themeColors[0]}
                      onChange={(e) => setThemeColors([e.target.value, themeColors[1]])}
                      className="h-9 w-12 rounded border border-border cursor-pointer bg-transparent"
                    />
                    <Input
                      value={themeColors[0]}
                      onChange={(e) => setThemeColors([e.target.value, themeColors[1]])}
                      className="text-xs font-mono h-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] text-muted-foreground block">Cor de fundo</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={themeColors[1]}
                      onChange={(e) => setThemeColors([themeColors[0], e.target.value])}
                      className="h-9 w-12 rounded border border-border cursor-pointer bg-transparent"
                    />
                    <Input
                      value={themeColors[1]}
                      onChange={(e) => setThemeColors([themeColors[0], e.target.value])}
                      className="text-xs font-mono h-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] text-muted-foreground block">Ícone (SF Symbol)</span>
                  <select
                    value={CHALLENGE_ICONS.includes(iconName) ? iconName : '__custom'}
                    onChange={(e) => {
                      if (e.target.value !== '__custom') setIconName(e.target.value);
                    }}
                    className="h-9 w-full px-2.5 rounded-lg border border-input bg-card text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {CHALLENGE_ICONS.map((ic) => (
                      <option key={ic} value={ic}>{ic}</option>
                    ))}
                    <option value="__custom">personalizado…</option>
                  </select>
                  {!CHALLENGE_ICONS.includes(iconName) && (
                    <Input
                      value={iconName}
                      onChange={(e) => setIconName(e.target.value)}
                      placeholder="nome do SF Symbol"
                      className="text-xs h-9 mt-1.5"
                    />
                  )}
                </div>
              </div>
              {/* Prévia ao vivo */}
              <div
                className="rounded-lg px-4 py-3 flex items-center gap-3"
                style={{ background: themeColors[0] }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: themeColors[1], color: themeColors[0] }}
                >
                  ★
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: themeColors[1] }}>
                    {title || 'Título do desafio'}
                  </p>
                  <p className="text-[10px] opacity-80 truncate" style={{ color: themeColors[1] }}>
                    prévia das cores no app · ícone: {iconName}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 border border-border rounded-lg p-4 bg-secondary/20">
              <Label className="text-sm font-semibold">O aluno vê no preview:</Label>
              <p className="text-[11px] text-muted-foreground">
                Cada item desmarcado simplesmente some da tela do aluno — útil quando o número ainda não ajuda a vender (ex.: 3 atletas).
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Checkbox checked={mostrarDias} onCheckedChange={(c) => setMostrarDias(!!c)} />
                  Duração (dias)
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Checkbox checked={mostrarAtletas} onCheckedChange={(c) => setMostrarAtletas(!!c)} />
                  Nº de atletas
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Checkbox checked={mostrarCriador} onCheckedChange={(c) => setMostrarCriador(!!c)} />
                  "Criado por…"
                </label>
              </div>
            </div>
          </div>

          {/* ═══ §3 · REGRAS — COMO O DESAFIO FUNCIONA ═══ */}
          <div className="bg-card border border-border rounded-md p-6 space-y-5">
            <div className="border-b border-border pb-3">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-primary" />
                3 · Regras — como o desafio funciona
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Prazo, formato do grupo e lotação. É daqui que a aba Treino do aluno deriva as semanas do programa.
              </p>
            </div>

            {/* ── J2 (17/08): objetivo, estado e público-alvo ── */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="goal_type">Objetivo do desafio</Label>
                <select
                  id="goal_type"
                  value={goalType}
                  onChange={(e) => setGoalType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="activity">Genérico — atividade</option>
                  <option value="emagrecimento">Emagrecimento</option>
                  <option value="ganho_massa">Ganho de massa</option>
                  <option value="condicionamento">Condicionamento</option>
                  <option value="flexibilidade">Flexibilidade</option>
                  <option value="longevidade">Longevidade</option>
                  <option value="weight_goal">Meta de peso (ranking por %)</option>
                  <option value="custom">Outro</option>
                </select>
                <p className="text-[11px] text-muted-foreground">
                  {goalType === 'weight_goal'
                    ? 'Cada participante define a própria meta de peso e o ranking compara o PERCENTUAL do caminho — ninguém vê o peso do outro.'
                    : 'Descreve a promessa do desafio. Combina com a segmentação abaixo para escolher quem vê.'}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="status_desafio">Estado</Label>
                <select
                  id="status_desafio"
                  value={statusDesafio}
                  onChange={(e) => setStatusDesafio(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="draft">Rascunho — só você vê</option>
                  <option value="published">Publicado — aparece na vitrine</option>
                  <option value="paused">Pausado — some da vitrine, quem está dentro segue</option>
                  <option value="archived">Arquivado</option>
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Só <strong>Publicado</strong> aparece na vitrine do app.
                </p>
              </div>
            </div>

            {/* Segmentação: quem vê este desafio */}
            <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
              <div>
                <Label className="text-sm font-semibold">Para quem este desafio aparece</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Nada marcado = <strong>todo mundo</strong>. Marcando, ele só aparece na vitrine de
                  quem respondeu assim no cadastro — e quem não respondeu aquela pergunta continua
                  vendo (não punimos quem tem cadastro incompleto).
                </p>
              </div>
              {([
                ['Objetivo', segObjetivo, setSegObjetivo, [['lose','Emagrecer'],['gain','Ganhar massa'],['maintain','Manter']]],
                ['Nível', segNivel, setSegNivel, [['beginner','Iniciante'],['intermediate','Intermediário'],['advanced','Avançado']]],
                ['Onde treina', segLocal, setSegLocal, [['home','Casa'],['basic_gym','Academia de prédio'],['full_gym','Academia completa']]],
              ] as [string, string[], (v: string[]) => void, [string,string][]][]).map(([rotulo, valores, set, opcoes]) => (
                <div key={rotulo} className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{rotulo}</span>
                  <div className="flex flex-wrap gap-2">
                    {opcoes.map(([valor, texto]) => {
                      const ativo = valores.includes(valor);
                      return (
                        <button
                          key={valor}
                          type="button"
                          onClick={() => set(ativo ? valores.filter((v) => v !== valor) : [...valores, valor])}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                            ativo
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {texto}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {(segObjetivo.length + segNivel.length + segLocal.length) > 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-500">
                  Com segmentação, este desafio deixa de aparecer para quem não se encaixa.
                </p>
              )}
            </div>

            {/* Bandeiras do programa */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={habitosImpostos}
                  onChange={(e) => setHabitosImpostos(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-input"
                />
                <span className="text-sm">
                  <strong className="block text-foreground">Impor os hábitos do desafio</strong>
                  <span className="text-[11px] text-muted-foreground">
                    Ligado: todo participante recebe os hábitos da aba Hábitos. Desligado: cada aluno
                    segue os próprios — o desafio não mexe na rotina de hábitos de ninguém.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={periodizacaoAdaptativa}
                  onChange={(e) => setPeriodizacaoAdaptativa(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-input"
                />
                <span className="text-sm">
                  <strong className="block text-foreground">Periodização adaptativa</strong>
                  <span className="text-[11px] text-muted-foreground">
                    Desligado: todos recebem exatamente o mesmo treino. Ligado: o app troca
                    exercícios que conflitam com a lesão declarada por equivalentes do mesmo padrão
                    de movimento, e explica a troca para o aluno.
                  </span>
                </span>
              </label>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="duration">Duração (dias)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  min={0}
                />
                <p className="text-[11px] text-muted-foreground">
                  {Number(durationDays) > 0
                    ? `${durationDays} dias = programa de ${Math.max(1, Math.ceil(Number(durationDays) / 7))} semana(s) na aba Treino do aluno.`
                    : '0 = clube sem prazo (o desafio que não acaba).'}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="challenge_type">Tipo de Desafio</Label>
                <select
                  id="challenge_type"
                  value={challengeType}
                  onChange={(e: any) => {
                    const val = e.target.value;
                    setChallengeType(val);
                    if (val === 'individual') {
                      setVisibility('private');
                    }
                  }}
                  className="w-full h-10 px-3.5 py-1.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none"
                >
                  <option value="group_public">Grupo Público</option>
                  <option value="group_private">Grupo Privado</option>
                  <option value="individual">Individual</option>
                </select>
                <p className="text-[11px] text-muted-foreground">
                  {challengeType === 'group_public' && 'Todo mundo pode achar e entrar — é a vitrine.'}
                  {challengeType === 'group_private' && 'Só entra quem tem o código de convite (seção 4).'}
                  {challengeType === 'individual' && 'Uma pessoa só, sem ranking de grupo.'}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="visibility">Visibilidade</Label>
                <select
                  id="visibility"
                  value={visibility}
                  onChange={(e: any) => setVisibility(e.target.value)}
                  className="w-full h-10 px-3.5 py-1.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none"
                >
                  <option value="public">Público</option>
                  <option value="private">Privado</option>
                </select>
                <p className="text-[11px] text-muted-foreground">Privado não aparece na vitrine — só por busca de nome ou código.</p>
              </div>

              {/* J2: a lotação vale para privado E público. Antes só aparecia
                  para grupo privado — um desafio público não tinha como
                  declarar teto nem "ilimitado". */}
              {challengeType !== 'individual' && (
                <div className="space-y-1.5">
                  <Label htmlFor="max_participants">Limite de atletas</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="max_participants"
                      type="number"
                      min={1}
                      max={100000}
                      value={maxParticipants}
                      disabled={semLimite}
                      onChange={(e) => setMaxParticipants(Number(e.target.value))}
                      className={semLimite ? 'opacity-40' : ''}
                    />
                    <label className="flex items-center gap-2 whitespace-nowrap cursor-pointer">
                      <input
                        type="checkbox"
                        checked={semLimite}
                        onChange={(e) => setSemLimite(e.target.checked)}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="text-xs font-semibold">Sem limite</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {semLimite
                      ? 'Entra quem quiser, sem teto.'
                      : `Ao chegar em ${maxParticipants}, o app mostra "LOTADO" e barra entradas novas.`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ═══ §4 · ACESSO — QUEM ENTRA E COMO ═══ */}
          <div className="bg-card border border-border rounded-md p-6 space-y-5">
            <div className="border-b border-border pb-3">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-primary" />
                4 · Acesso — quem entra e como
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                A porta de entrada de quem vem de fora (código) e o selo de quem assina o desafio.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite_code">Código de Convite *</Label>
                <div className="flex gap-2">
                  <Input
                    id="invite_code"
                    value={inviteCode || shareCode}
                    onChange={(e) => {
                      const c = e.target.value.toUpperCase();
                      setInviteCode(c);
                      setShareCode(c);
                    }}
                    placeholder="Ex: ABDOMEN42"
                    required
                  />
                  <Button type="button" variant="outline" onClick={() => {
                    const randomCode = Math.random().toString(36).substring(2, 10).toUpperCase();
                    setInviteCode(randomCode);
                    setShareCode(randomCode);
                  }}>Gerar</Button>
                </div>
                <p className="text-[11px] text-muted-foreground">O aluno digita este código na busca da Área de Desafios para entrar direto.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tier">Selo de origem (tier)</Label>
                <select
                  id="tier"
                  value={tier}
                  onChange={(e: any) => setTier(e.target.value)}
                  className="w-full h-10 px-3.5 py-1.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none"
                >
                  <option value="admin">Oficial (Admin)</option>
                  <option value="influencer">Influenciador</option>
                  <option value="premium_user">Premium</option>
                  <option value="free_user">Grátis</option>
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Quem assina o desafio. "Oficial" acende a cápsula OFICIAL no cartão e o criador aparece como Flameer.
                </p>
              </div>
            </div>
          </div>

          {/* ═══ §5 · O QUE ESTE PRODUTO LIBERA ═══
              A matriz `challenge_access_rules`, que até 27/08 só existia via
              SQL na mão. A §4 responde "quem entra"; esta responde "o que a
              pessoa leva quando compra, e por quanto tempo". */}
          <RegrasDeAcessoDoProduto
            valor={regrasDeAcesso}
            aoMudar={setRegrasDeAcesso}
            portaAusente={portaDeAcessoAusente}
            desafioNovo={!id}
          />
        </TabsContent>

        {/* TAB 2: HABITS */}
        <TabsContent value="habits" className="mt-6">
          <div className="bg-card border border-border rounded-md p-8 space-y-6">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-primary" />
                Hábitos Injetados no Desafio
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={addHabit} className="gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" />
                Novo Hábito
              </Button>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Onde o aluno vê: na lista "Hábitos" da tela inicial, injetados no dia em que ele entra no desafio.
              Concluir hábitos é um dos três jeitos de fechar o dia (hábitos ∥ treinou ∥ comeu).
            </p>

            {habits.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2">
                {habits.map((h, hIdx) => (
                  <div key={hIdx} className="border border-border rounded-xl p-5 bg-secondary/20 relative space-y-4">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeHabit(hIdx)}
                      className="absolute right-3 top-3 h-8 w-8 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Meta / Hábito *</Label>
                      <Input
                        value={h.label}
                        onChange={(e) => updateHabit(hIdx, 'label', e.target.value)}
                        placeholder="Ex: Beber 3L de água"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tipo</Label>
                        <select
                          value={h.kind}
                          onChange={(e: any) => updateHabit(hIdx, 'kind', e.target.value)}
                          className="w-full h-9 px-2.5 rounded-lg border border-input bg-background text-xs focus:outline-none"
                        >
                          <option value="single">Marcador Simples</option>
                          <option value="units">Por Unidade</option>
                          <option value="quantity">Livre / Quantidade</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Cor (Hex)</Label>
                        <Input
                          value={h.color}
                          onChange={(e) => updateHabit(hIdx, 'color', e.target.value)}
                          placeholder="#6B1D2F"
                        />
                      </div>
                    </div>

                    {h.kind !== 'single' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Meta Mínima</Label>
                          <Input
                            type="number"
                            value={h.target}
                            onChange={(e) => updateHabit(hIdx, 'target', Number(e.target.value))}
                            min={0.1}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Unidade</Label>
                          <Input
                            value={h.unit}
                            onChange={(e) => updateHabit(hIdx, 'unit', e.target.value)}
                            placeholder="copos, passos, etc."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
                Nenhum hábito acoplado. Hábitos são opcionais — sem eles, cada aluno define os próprios.
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 3: WORKOUTS */}
        <TabsContent value="workouts" className="mt-6">
          <div className="bg-card border border-border rounded-md p-8 space-y-6">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-primary" />
                Rotina de Treinos (Splits Semanais)
              </h3>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImportType('workout');
                    setImportFormat('spreadsheet');
                    setIsImportModalOpen(true);
                  }}
                  className="gap-1 text-xs border-primary text-primary hover:bg-primary/5"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Importar Planilha / PDF / JSON
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={addWorkout} className="gap-1 text-xs">
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Treino
                </Button>
              </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Onde o aluno vê: seção "DO DESAFIO" na aba Treino, recortada por semana (campo Semana de cada treino).
              Os dias marcados viram o cronograma — e são os dias que a chama espera treino.
            </p>
            </div>

            {/* Resumo da periodização */}
            {workouts.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 bg-secondary/30 border border-border rounded-lg px-4 py-2.5">
                <CalendarRange className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground">
                  Periodização: {programmedWeeks} semana(s) programada(s)
                </span>
                <span className="text-[11px] text-muted-foreground">
                  desafio de {durationDays} dias ≈ {expectedWeeks} semana(s)
                </span>
                {programmedWeeks < expectedWeeks && (
                  <span className="text-[11px] font-semibold text-amber-600 inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    faltam {expectedWeeks - programmedWeeks} semana(s) de treino — use "Duplicar" para progredir
                  </span>
                )}
              </div>
            )}

            {workouts.length > 0 ? (
              <div className="space-y-8">
                {indexedByWeek.map(({ w, wIdx }, pos) => (
                  <React.Fragment key={wIdx}>
                    {(pos === 0 || weekOf(indexedByWeek[pos - 1].w) !== weekOf(w)) && (
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 first:pt-0 -mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/15 px-2.5 py-1 rounded-full">
                            Semana {weekOf(w)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {workouts.filter((x) => weekOf(x) === weekOf(w)).length} treino(s)
                          </span>
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[11px] gap-1"
                            onClick={() => addWorkoutToWeek(weekOf(w))}
                          >
                            <Plus className="w-3 h-3" />
                            Treino nesta semana
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[11px] gap-1 text-primary hover:text-primary"
                            onClick={() => duplicateWeek(weekOf(w))}
                          >
                            <Copy className="w-3 h-3" />
                            Duplicar p/ semana {weekOf(w) + 1}
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="border border-border rounded-xl p-6 bg-secondary/15 relative space-y-4">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeWorkout(wIdx)}
                      className="absolute right-3 top-3 h-8 w-8 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>

                    <div className="grid gap-4 sm:grid-cols-5">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">Título do Treino *</Label>
                        <Input
                          value={w.title}
                          onChange={(e) => updateWorkout(wIdx, 'title', e.target.value)}
                          placeholder="Ex: Treino A - Superior"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Foco</Label>
                        <Input
                          value={w.focus}
                          onChange={(e) => updateWorkout(wIdx, 'focus', e.target.value)}
                          placeholder="Hipertrofia, Cardio, etc."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Semana</Label>
                        <Input
                          type="number"
                          value={w.metadata?.week_number || 1}
                          onChange={(e) => updateWorkoutMetadata(wIdx, 'week_number', Number(e.target.value))}
                          min={1}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Minutos</Label>
                        <Input
                          type="number"
                          value={w.duration_minutes}
                          onChange={(e) => updateWorkout(wIdx, 'duration_minutes', Number(e.target.value))}
                          min={1}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Vídeo Instrucional (URL)</Label>
                      <Input
                        value={w.metadata?.video_url || ''}
                        onChange={(e) => updateWorkoutMetadata(wIdx, 'video_url', e.target.value)}
                        placeholder="Ex: https://www.youtube.com/watch?v=..."
                      />
                    </div>

                    {w.metadata?.hiit_protocol && (
                      <div className="grid gap-3 sm:grid-cols-3 bg-primary/5 p-4 rounded-lg border border-primary/10 text-xs">
                        <div>
                          <span className="font-bold block text-primary mb-1">Aquecimento:</span>
                          <span className="text-muted-foreground">{w.metadata.hiit_protocol.aquecimento}</span>
                        </div>
                        <div>
                          <span className="font-bold block text-primary mb-1">HIIT:</span>
                          <span className="text-muted-foreground">{w.metadata.hiit_protocol.treino_hiit}</span>
                        </div>
                        <div>
                          <span className="font-bold block text-primary mb-1">Resfriamento:</span>
                          <span className="text-muted-foreground">{w.metadata.hiit_protocol.resfriamento}</span>
                        </div>
                      </div>
                    )}

                    {/* Weekday scheduler */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Dias de Treino</Label>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {weekdays.map((day) => {
                          const active = w.days.includes(day.value);
                          return (
                            <Button
                              key={day.value}
                              type="button"
                              variant={active ? 'default' : 'outline'}
                              onClick={() => handleDayToggle(wIdx, day.value)}
                              className="h-8 px-3 font-semibold text-[10px]"
                            >
                              {day.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Exercises in split */}
                    <div className="space-y-4 pt-4 border-t border-border/55">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase">Exercícios cadastrados</h4>
                        <Button type="button" variant="ghost" size="sm" onClick={() => addExercise(wIdx)} className="h-7 text-xs text-primary font-bold hover:bg-primary/5">
                          + Adicionar Exercício
                        </Button>
                      </div>

                      {w.exercises.length > 0 ? (
                        <div className="space-y-4">
                          {w.exercises.map((ex, exIdx) => (
                            <div key={exIdx} className="bg-card border border-border p-4 rounded-lg relative space-y-3">
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => removeExercise(wIdx, exIdx)}
                                className="absolute right-2 top-2 h-7 w-7 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>

                              <div className="grid gap-3 sm:grid-cols-4 pr-8">
                                <div className="space-y-1">
                                  <Label className="text-[10px]">Exercício *</Label>
                                  {/* Sugere da base de exercícios (J7) e traz o
                                      grupo muscular junto; digitar livre continua
                                      valendo — conteúdo antigo não quebra. */}
                                  <EscolhaDaBase
                                    fonte="exercicios"
                                    valor={ex.name}
                                    onChange={(v) => updateExercise(wIdx, exIdx, 'name', v)}
                                    onEscolher={(item) => {
                                      updateExercise(wIdx, exIdx, 'name', item.nome);
                                      if (item.grupo) updateExercise(wIdx, exIdx, 'muscle', item.grupo);
                                    }}
                                    placeholder="Busque na base ou digite"
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px]">Músculo</Label>
                                  <Input
                                    value={ex.muscle}
                                    onChange={(e) => updateExercise(wIdx, exIdx, 'muscle', e.target.value)}
                                    placeholder="Ex: Quadríceps"
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px]">Descanso (Segundos)</Label>
                                  <Input
                                    type="number"
                                    value={ex.rest_seconds}
                                    onChange={(e) => updateExercise(wIdx, exIdx, 'rest_seconds', Number(e.target.value))}
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px]">Informações Adicionais / RIR</Label>
                                  <Input
                                    value={ex.metadata?.informacoes_adicionais || ''}
                                    onChange={(e) => updateExerciseMetadata(wIdx, exIdx, 'informacoes_adicionais', e.target.value)}
                                    placeholder="Ex: RIR 1-3"
                                    className="h-8 text-xs"
                                  />
                                </div>
                              </div>

                              {/* Series Sets */}
                              <div className="space-y-2 pt-2 border-t border-border/50">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-muted-foreground">Séries</span>
                                  <Button type="button" variant="ghost" size="sm" onClick={() => addSet(wIdx, exIdx)} className="h-6 text-[10px] text-primary font-bold hover:bg-primary/5">
                                    + Adicionar Série
                                  </Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {ex.sets.map((set, setIdx) => (
                                    <div key={setIdx} className="flex items-center gap-1 bg-secondary/30 border border-border p-1 rounded relative pr-6 h-7 text-xs">
                                      <span className="text-[9px] font-bold text-muted-foreground w-3 text-center">{setIdx+1}</span>
                                      <input
                                        value={set.reps}
                                        onChange={(e) => updateSet(wIdx, exIdx, setIdx, 'reps', e.target.value)}
                                        placeholder="R"
                                        className="w-8 h-5 border border-border text-center text-[10px] bg-background focus:outline-none rounded"
                                        title="Repetições"
                                      />
                                      <input
                                        value={set.weight}
                                        onChange={(e) => updateSet(wIdx, exIdx, setIdx, 'weight', e.target.value)}
                                        placeholder="Kg"
                                        className="w-10 h-5 border border-border text-center text-[10px] bg-background focus:outline-none rounded"
                                        title="Carga"
                                      />
                                      {ex.sets.length > 1 && (
                                        <button 
                                          type="button" 
                                          onClick={() => removeSet(wIdx, exIdx, setIdx)}
                                          className="absolute right-0.5 top-1 text-destructive hover:bg-destructive/10 rounded"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Sem exercícios cadastrados neste split.</p>
                      )}
                    </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
                Nenhum split de treino agendado. Clique acima para estruturar a rotina.
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 4: DIETS */}
        <TabsContent value="diets" className="mt-6">
          <div className="bg-card border border-border rounded-md p-8 space-y-6">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Apple className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-lg text-foreground">Planejamento Nutricional</h3>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImportType('diet');
                    setImportFormat('spreadsheet');
                    setIsImportModalOpen(true);
                  }}
                  className="gap-1 text-xs border-primary text-primary hover:bg-primary/5"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Importar Planilha / PDF / JSON
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={addMeal} className="gap-1 text-xs">
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Refeição
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Onde o aluno vê: aba Dieta, como a dieta PADRÃO de quem comprou o desafio.
              Assinante Premium não vê esta — recebe a dieta sob medida no lugar (regra do produto).
            </p>

            {/* Overall Diet Metadata Display */}
            {diets.length > 0 && diets[0].metadata && (
              <div className="bg-secondary/5 border border-border p-5 rounded-xl grid gap-4 sm:grid-cols-2 text-xs">
                <div className="space-y-2">
                  <h4 className="font-bold text-muted-foreground uppercase text-[10px] tracking-wide">Informações da Prescrição</h4>
                  <div className="space-y-1 text-foreground">
                    <div><span className="text-muted-foreground font-semibold">Paciente:</span> {diets[0].metadata.patient_name}</div>
                    <div><span className="text-muted-foreground font-semibold">Data:</span> {diets[0].metadata.prescription_date}</div>
                    <div>
                      <span className="text-muted-foreground font-semibold">Profissional:</span> {diets[0].metadata.professional_name} ({diets[0].metadata.professional_role} - {diets[0].metadata.professional_crn})
                    </div>
                  </div>
                </div>
                
                {diets[0].metadata.shopping_list && diets[0].metadata.shopping_list.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-bold text-muted-foreground uppercase text-[10px] tracking-wide">Lista de Compras</h4>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-2">
                      {diets[0].metadata.shopping_list.map((item: string, idx: number) => (
                        <span key={idx} className="bg-secondary/50 border border-border px-2 py-0.5 rounded text-[10px] text-foreground font-semibold">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {diets.length > 0 && diets[0].meals.length > 0 ? (
              <div className="space-y-6">
                {diets[0].meals.map((meal, mIdx) => {
                  // Thermodynamic Check
                  const computedKcal = (meal.protein * 4) + (meal.carbs * 4) + (meal.fat * 9);
                  const isDivergent = meal.calories > 0 && Math.abs(meal.calories - computedKcal) > meal.calories * 0.1;

                  return (
                    <div key={mIdx} className="border border-border rounded-xl p-6 bg-secondary/15 relative space-y-4">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeMeal(mIdx)}
                        className="absolute right-3 top-3 h-8 w-8 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 pr-8">
                        <div className="space-y-1.5 lg:col-span-2">
                          <Label className="text-xs">Refeição *</Label>
                          <Input
                            value={meal.name}
                            onChange={(e) => updateMeal(mIdx, 'name', e.target.value)}
                            placeholder="Café da Manhã, Almoço, etc."
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Horário</Label>
                          <Input
                            value={meal.time}
                            onChange={(e) => updateMeal(mIdx, 'time', e.target.value)}
                            placeholder="08:00:00"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Proteína (g)</Label>
                          <Input
                            type="number"
                            value={meal.protein}
                            onChange={(e) => updateMeal(mIdx, 'protein', Number(e.target.value))}
                            min={0}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Carbo (g)</Label>
                          <Input
                            type="number"
                            value={meal.carbs}
                            onChange={(e) => updateMeal(mIdx, 'carbs', Number(e.target.value))}
                            min={0}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Gordura (g)</Label>
                          <Input
                            type="number"
                            value={meal.fat}
                            onChange={(e) => updateMeal(mIdx, 'fat', Number(e.target.value))}
                            min={0}
                          />
                        </div>
                      </div>

                      {/* Calorie input & consistency check */}
                      <div className="grid gap-4 sm:grid-cols-2 items-center">
                        <div className="space-y-1.5 max-w-xs">
                          <Label className="text-xs">Calorias Declaradas (Kcal)</Label>
                          <Input
                            type="number"
                            value={meal.calories}
                            onChange={(e) => updateMeal(mIdx, 'calories', Number(e.target.value))}
                            min={0}
                          />
                        </div>
                        
                        {/* Validation Alert */}
                        {isDivergent && (
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold border border-destructive/20 mt-3 sm:mt-0">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>
                              Divergência: {meal.calories} Kcal informadas vs {computedKcal} Kcal reais baseadas nos macros.
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Meal Observations */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Observações de Preparo</Label>
                        <Input
                          value={meal.metadata?.observacoes || ''}
                          onChange={(e) => updateMealMetadata(mIdx, 'observacoes', e.target.value)}
                          placeholder="Ex: Misturar a chia com a goma de tapioca..."
                        />
                      </div>

                      {/* Substitutions */}
                      {meal.metadata?.substituicoes && meal.metadata.substituicoes.length > 0 && (
                        <div className="space-y-1.5 p-3.5 bg-primary/5 border border-primary/10 rounded-lg text-xs">
                          <span className="font-bold block text-primary mb-1">Opções de Substituição:</span>
                          <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                            {meal.metadata.substituicoes.map((sub: string, sIdx: number) => (
                              <li key={sIdx}>{sub}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Food Items List */}
                      <div className="space-y-3 pt-3 border-t border-border/55">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Alimentos Incluídos</span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => addMealItem(mIdx)} className="h-6 text-[10px] text-primary font-bold hover:bg-primary/5">
                            + Adicionar Alimento
                          </Button>
                        </div>

                        {meal.items.length > 0 ? (
                          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                            {meal.items.map((item, itemIdx) => (
                              <div key={itemIdx} className="bg-card border border-border p-3 rounded-lg relative pr-8 space-y-2">
                                <Button 
                                  type="button" 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => removeMealItem(mIdx, itemIdx)}
                                  className="absolute right-1 top-1 h-6 w-6 text-destructive hover:bg-destructive/5"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                                <div className="space-y-1">
                                  <Label className="text-[9px]">Nome</Label>
                                  {/* Sugere da base de alimentos (183 itens, J8);
                                      digitar livre continua valendo. */}
                                  <EscolhaDaBase
                                    fonte="alimentos"
                                    valor={item.name}
                                    onChange={(v) => updateMealItem(mIdx, itemIdx, 'name', v)}
                                    onEscolher={(a) => {
                                      updateMealItem(mIdx, itemIdx, 'name', a.nome);
                                      if (a.porcao_g) updateMealItem(mIdx, itemIdx, 'quantity', `${a.porcao_g}g`);
                                    }}
                                    placeholder="Busque na base ou digite"
                                    className="h-7 text-xs px-2 font-medium"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px]">Porção</Label>
                                  <Input
                                    value={item.quantity}
                                    onChange={(e) => updateMealItem(mIdx, itemIdx, 'quantity', e.target.value)}
                                    placeholder="Ex: 150g"
                                    className="h-7 text-xs px-2 font-medium"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Sem alimentos descritos.</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
                Nenhum plano de alimentação cadastrado. Clique no botão acima para incluir refeições.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-[600px] bg-card border border-border rounded-md p-6 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              Importador Inteligente de {importType === 'diet' ? 'Plano Alimentar (Dieta)' : 'Planilha de Treino'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Carregue um arquivo (.json, .csv, .tsv, .txt), cole células do Excel/Sheets, ou cole texto extraído de arquivos PDF.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="flex gap-2 border-b border-border pb-2">
              <Button
                type="button"
                variant={importFormat === 'json' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setImportFormat('json')}
                className="text-xs h-8 px-3"
              >
                Colar JSON
              </Button>
              <Button
                type="button"
                variant={importFormat === 'spreadsheet' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setImportFormat('spreadsheet')}
                className="text-xs h-8 px-3"
              >
                Planilha (Excel/CSV/TSV)
              </Button>
              <Button
                type="button"
                variant={importFormat === 'pdf' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setImportFormat('pdf')}
                className="text-xs h-8 px-3"
              >
                Texto Livre (PDF / Texto)
              </Button>
            </div>

            {/* Drag & Drop File Input */}
            <div className="border border-dashed border-border p-4 rounded-lg bg-secondary/5 text-center space-y-2">
              <Label className="text-xs text-muted-foreground block">
                Opcional: Arraste ou selecione um arquivo de entrada para carregar o conteúdo
              </Label>
              <input
                type="file"
                accept=".json,.csv,.tsv,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const text = event.target?.result as string;
                    setImportText(text);
                    if (file.name.endsWith('.json')) {
                      setImportFormat('json');
                    } else if (file.name.endsWith('.csv') || file.name.endsWith('.tsv')) {
                      setImportFormat('spreadsheet');
                    } else {
                      setImportFormat('pdf');
                    }
                  };
                  reader.readAsText(file);
                }}
                className="text-xs text-muted-foreground w-full max-w-xs mx-auto block file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Conteúdo do Documento / Planilha</Label>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={
                  importFormat === 'json'
                    ? 'Cole o JSON estruturado aqui...'
                    : importFormat === 'spreadsheet'
                    ? 'Cole as células copiadas do Excel (colunas separadas por Tab)...'
                    : 'Cole o texto livre ou corrido copiado do PDF...'
                }
                className="w-full h-48 px-3 py-2 text-xs font-mono rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Import Mode: Replace vs Append */}
            <div className="flex items-center gap-4 pt-2">
              <span className="text-xs font-semibold text-muted-foreground">Ação de Importação:</span>
              <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="accent-primary"
                />
                Substituir atual
              </label>
              <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'append'}
                  onChange={() => setImportMode('append')}
                  className="accent-primary"
                />
                Adicionar ao final
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsImportModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleImportSubmit}
              className="text-xs"
            >
              Confirmar Importação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
