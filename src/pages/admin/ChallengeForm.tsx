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
  FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Local types for unified state
interface LocalHabit {
  label: string;
  icon_name: string;
  color: string;
  kind: 'units' | 'quantity' | 'single';
  unit?: string;
  target: number;
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
}

interface LocalWorkout {
  title: string;
  duration_minutes: number;
  focus: string;
  days: number[];
  exercises: LocalExercise[];
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
}

interface LocalDiet {
  title: string;
  meals: LocalMeal[];
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
  const [isFeatured, setIsFeatured] = useState(false);

  // Tab 2: Habits
  const [habits, setHabits] = useState<LocalHabit[]>([]);

  // Tab 3: Workouts (Splits)
  const [workouts, setWorkouts] = useState<LocalWorkout[]>([]);

  // Tab 4: Diet
  const [diets, setDiets] = useState<LocalDiet[]>([]);

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
            id, title, duration_minutes, focus, is_template,
            workout_days(day_of_week),
            exercises(
              id, name, muscle, rest_seconds, order_index,
              exercise_sets(id, reps, weight, order_index)
            )
          ),
          diets(
            id, title, is_template,
            meals(
              id, name, time, calories, protein, carbs, fat, order_index,
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
      setIsFeatured(pkgData.is_featured || false);

      // Load Habits
      const mappedHabits = pkgData.habits?.map((h: any) => ({
        label: h.label,
        icon_name: h.icon_name,
        color: h.color,
        kind: h.kind,
        unit: h.unit || '',
        target: Number(h.target) || 1
      })) || [];
      setHabits(mappedHabits);

      // Load Workouts
      const mappedWorkouts = pkgData.workouts?.map((w: any) => ({
        title: w.title,
        duration_minutes: w.duration_minutes || 45,
        focus: w.focus || 'Hipertrofia',
        days: w.workout_days?.map((d: any) => d.day_of_week) || [],
        exercises: w.exercises
          ?.sort((a: any, b: any) => a.order_index - b.order_index)
          ?.map((ex: any) => ({
            name: ex.name,
            muscle: ex.muscle,
            rest_seconds: ex.rest_seconds || 60,
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
        meals: d.meals
          ?.sort((a: any, b: any) => a.order_index - b.order_index)
          ?.map((m: any) => ({
            name: m.name,
            time: m.time,
            calories: Number(m.calories) || 0,
            protein: Number(m.protein) || 0,
            carbs: Number(m.carbs) || 0,
            fat: Number(m.fat) || 0,
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
      const { data, error } = await supabase.rpc('save_challenge_package', {
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
      category,
      duration_days: Number(durationDays),
      prize: prize || null,
      icon_name: iconName,
      theme_colors: ['#6B1D2F', '#F7F4EF'], // Burgundy e Bege padrão
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
                <Label htmlFor="share_code">Código de Compartilhamento *</Label>
                <div className="flex gap-2">
                  <Input
                    id="share_code"
                    value={shareCode}
                    onChange={(e) => setShareCode(e.target.value.toUpperCase())}
                    placeholder="Ex: SECA30"
                    required
                  />
                  <Button type="button" variant="outline" onClick={generateShareCode}>Gerar</Button>
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
                <Label htmlFor="cover">Capa (Imagem URL)</Label>
                <Input
                  id="cover"
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  placeholder="https://exemplo.com/imagem.png"
                />
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
              <Button type="button" variant="outline" size="sm" onClick={addWorkout} className="gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" />
                Adicionar Treino
              </Button>
            </div>

            {workouts.length > 0 ? (
              <div className="space-y-8">
                {workouts.map((w, wIdx) => (
                  <div key={wIdx} className="border border-border rounded-xl p-6 bg-secondary/15 relative space-y-4">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeWorkout(wIdx)}
                      className="absolute right-3 top-3 h-8 w-8 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5">
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
                        <Label className="text-xs">Minutos</Label>
                        <Input
                          type="number"
                          value={w.duration_minutes}
                          onChange={(e) => updateWorkout(wIdx, 'duration_minutes', Number(e.target.value))}
                          min={1}
                        />
                      </div>
                    </div>

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

                              <div className="grid gap-3 sm:grid-cols-3 pr-8">
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
              <Button type="button" variant="outline" size="sm" onClick={addMeal} className="gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" />
                Adicionar Refeição
              </Button>
            </div>

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
    </div>
  );
}

// Inline SVGs helpers
function X(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
