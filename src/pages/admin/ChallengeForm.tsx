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
  CalendarRange
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

// Curated SF Symbols the iOS app renders well as challenge icons
const CHALLENGE_ICONS = [
  'trophy', 'trophy.fill', 'flame.fill', 'bolt.fill', 'heart.fill',
  'dumbbell.fill', 'figure.run', 'figure.strengthtraining.traditional',
  'fork.knife', 'leaf.fill', 'moon.stars.fill', 'drop.fill',
  'star.fill', 'crown.fill', 'medal.fill', 'target',
];

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
  const [durationDays, setDurationDays] = useState(30);
  const [prize, setPrize] = useState('');
  const [iconName, setIconName] = useState('trophy');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [shareCode, setShareCode] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [challengeType, setChallengeType] = useState<'individual' | 'group_private' | 'group_public'>('group_public');
  const [maxParticipants, setMaxParticipants] = useState(50);
  const [isFeatured, setIsFeatured] = useState(false);
  // Appearance: [primary, background] hex pair consumed by the iOS app
  const [themeColors, setThemeColors] = useState<[string, string]>(['#6B1D2F', '#F7F4EF']);

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
            id, title, duration_minutes, focus, is_template, metadata,
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
      setDurationDays(pkgData.duration_days || 30);
      setPrize(pkgData.prize || '');
      setIconName(pkgData.icon_name || 'trophy');
      setCoverImageUrl(pkgData.cover_image_url || '');
      setShareCode(pkgData.share_code || '');
      setInviteCode(pkgData.invite_code || pkgData.share_code || '');
      setChallengeType(pkgData.challenge_type || 'group_public');
      setMaxParticipants(pkgData.max_participants || 50);
      setIsFeatured(pkgData.is_featured || false);
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
    if (habits.length === 0) {
      toast({ title: "Hábitos Requeridos", description: "Cadastre pelo menos 1 hábito modelo para este desafio.", variant: "destructive" });
      setActiveTab('habits');
      return false;
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
      if (meals.length < 2) {
        toast({ title: "Aviso de Nutrição", description: "Recomenda-se registrar pelo menos 2 refeições diárias no plano nutricional.", variant: "destructive" });
        setActiveTab('diets');
        return false;
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
      return { data, error };
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

    const payload = {
      id: id || undefined,
      title,
      subtitle: subtitle || null,
      tier,
      visibility,
      challenge_type: challengeType,
      max_participants: challengeType === 'group_private' ? Number(maxParticipants) : (challengeType === 'individual' ? 1 : null),
      invite_code: inviteCode || shareCode,
      category,
      duration_days: Number(durationDays),
      prize: prize || null,
      icon_name: iconName,
      theme_colors: themeColors,
      cover_image_url: coverImageUrl || null,
      share_code: shareCode,
      is_featured: isFeatured,
      habits,
      workouts,
      diets
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
            <h1 className="text-3xl font-bold tracking-tight text-foreground font-sans">
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

        {/* TAB 1: DETAILS */}
        <TabsContent value="details" className="mt-6">
          <div className="bg-card border border-border rounded-xl p-8 shadow-sm space-y-6">
            <h3 className="font-bold text-lg text-foreground border-b border-border pb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Detalhes do Desafio
            </h3>
            
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">Título do Desafio *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Desafio Seca Barriga"
                  required
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="subtitle">Subtítulo / Descrição Curta</Label>
                <Input
                  id="subtitle"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Ex: Treinos rápidos de alta intensidade e plano de macros"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ex: Treino, Nutrição"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duração (Dias)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  min={1}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tier">Categoria (Tier)</Label>
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
              </div>

              <div className="space-y-2">
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
              </div>

              <div className="space-y-2">
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
              </div>

              {challengeType === 'group_private' && (
                <div className="space-y-2">
                  <Label htmlFor="max_participants">Limite de Atletas (Máx)</Label>
                  <Input
                    id="max_participants"
                    type="number"
                    min={1}
                    max={1000}
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(Number(e.target.value))}
                  />
                </div>
              )}

              <div className="space-y-2">
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
                    placeholder="Ex: GYMRATS50"
                    required
                  />
                  <Button type="button" variant="outline" onClick={() => {
                    const randomCode = Math.random().toString(36).substring(2, 10).toUpperCase();
                    setInviteCode(randomCode);
                    setShareCode(randomCode);
                  }}>Gerar</Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prize">Prêmio</Label>
                <Input
                  id="prize"
                  value={prize}
                  onChange={(e) => setPrize(e.target.value)}
                  placeholder="Ex: Kit Suplementos"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Capa do desafio</Label>
                <CoverImageUpload value={coverImageUrl} onChange={setCoverImageUrl} />
              </div>

              {/* Aparência: cores do tema + ícone (renderizados pelo app iOS) */}
              <div className="space-y-3 sm:col-span-2 border border-border rounded-lg p-4 bg-secondary/20">
                <Label className="text-sm font-semibold">Aparência no app</Label>
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

              <div className="flex items-center space-x-2.5 sm:col-span-2 pt-2">
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
        </TabsContent>

        {/* TAB 2: HABITS */}
        <TabsContent value="habits" className="mt-6">
          <div className="bg-card border border-border rounded-xl p-8 shadow-sm space-y-6">
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
                Nenhum hábito acoplado. Todo desafio exige pelo menos um hábito cadastrado.
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 3: WORKOUTS */}
        <TabsContent value="workouts" className="mt-6">
          <div className="bg-card border border-border rounded-xl p-8 shadow-sm space-y-6">
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
                                  <Input
                                    value={ex.name}
                                    onChange={(e) => updateExercise(wIdx, exIdx, 'name', e.target.value)}
                                    placeholder="Ex: Agachamento"
                                    className="h-8 text-xs"
                                    required
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
          <div className="bg-card border border-border rounded-xl p-8 shadow-sm space-y-6">
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
                                  <Input
                                    value={item.name}
                                    onChange={(e) => updateMealItem(mIdx, itemIdx, 'name', e.target.value)}
                                    placeholder="Ex: Arroz Branco"
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
        <DialogContent className="sm:max-w-[600px] bg-card border border-border rounded-xl p-6 text-foreground">
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
