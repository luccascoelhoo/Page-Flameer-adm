import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Settings as SettingsIcon,
  Key,
  Eye,
  EyeOff,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Zap,
  BookOpen,
  Cpu,
  Thermometer,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

// Provider model options
const PROVIDER_MODELS: Record<string, { label: string; models: { value: string; label: string }[] }> = {
  gemini: {
    label: 'Google Gemini',
    models: [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    ],
  },
  openai: {
    label: 'OpenAI',
    models: [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    ],
  },
  anthropic: {
    label: 'Anthropic',
    models: [
      { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { value: 'claude-3.5-haiku', label: 'Claude 3.5 Haiku' },
    ],
  },
};

const DEFAULT_INSTRUCTION_MD = `# Flameer AI Workout Generator

Você é um personal trainer especializado da plataforma Flameer.

## Regras Absolutas
- Nunca sugira exercícios que conflitem com as lesões/limitações do usuário
- Sempre respeite o tempo disponível informado
- Use nomenclatura em português brasileiro
- Cada exercício deve ter: nome, grupo muscular, séries (3-5), repetições (8-15), tempo de descanso (30-120s)
- Priorize exercícios compostos antes de isolados
- Adapte a intensidade ao nível de fitness do usuário

## Formato de Resposta
Retorne APENAS um JSON válido no formato:
{
  "name": "Nome do Treino",
  "focus": "Grupamentos",
  "duration": "XX min",
  "exercises": [
    {
      "name": "Nome do Exercício",
      "muscle": "Grupo Muscular",
      "rest": "60s",
      "sets": [
        {"reps": "12", "weight": "Moderado"},
        {"reps": "10", "weight": "Moderado"},
        {"reps": "8", "weight": "Pesado"}
      ]
    }
  ]
}`;

interface AISettings {
  id?: string;
  provider: string;
  api_key: string;
  model: string;
  instruction_md: string;
  max_tokens: number;
  temperature: number;
  is_active: boolean;
}

export default function Settings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [mdPreview, setMdPreview] = useState(false);
  const [tableExists, setTableExists] = useState(true);

  const [settings, setSettings] = useState<AISettings>({
    provider: 'gemini',
    api_key: '',
    model: 'gemini-2.5-flash',
    instruction_md: DEFAULT_INSTRUCTION_MD,
    max_tokens: 4096,
    temperature: 0.7,
    is_active: true,
  });

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_settings' as any)
        .select('*')
        .limit(1)
        .single();

      if (error) {
        if (error.code === '42P01' || error.message?.includes('relation') || error.code === 'PGRST116') {
          // Table doesn't exist or no rows
          if (error.code === '42P01' || error.message?.includes('relation')) {
            setTableExists(false);
          }
          console.info('ai_settings: using defaults');
        } else {
          console.error('Load error:', error);
        }
      } else if (data) {
        const row = data as any;
        setSettings({
          id: row.id,
          provider: row.provider || 'gemini',
          api_key: row.api_key || '',
          model: row.model || 'gemini-2.5-flash',
          instruction_md: row.instruction_md || DEFAULT_INSTRUCTION_MD,
          max_tokens: row.max_tokens || 4096,
          temperature: parseFloat(row.temperature) || 0.7,
          is_active: row.is_active ?? true,
        });
        setTestStatus(row.is_active && row.api_key ? 'success' : 'idle');
      }
    } catch (err) {
      console.error('Unexpected error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings.api_key.trim()) {
      toast({
        title: 'Chave obrigatória',
        description: 'Informe a chave de API antes de salvar.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        provider: settings.provider,
        api_key: settings.api_key,
        model: settings.model,
        instruction_md: settings.instruction_md,
        max_tokens: settings.max_tokens,
        temperature: settings.temperature,
        is_active: settings.is_active,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (settings.id) {
        result = await supabase
          .from('ai_settings' as any)
          .update(payload)
          .eq('id', settings.id);
      } else {
        result = await supabase
          .from('ai_settings' as any)
          .insert(payload)
          .select()
          .single();

        if (result.data) {
          setSettings((prev) => ({ ...prev, id: (result.data as any).id }));
        }
      }

      if (result.error) throw result.error;

      toast({
        title: 'Configurações salvas',
        description: 'As configurações de IA foram atualizadas com sucesso.',
      });
    } catch (err: any) {
      console.error('Save error:', err);
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Verifique a tabela ai_settings no Supabase.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!settings.api_key.trim()) {
      toast({
        title: 'Chave ausente',
        description: 'Configure a chave de API antes de testar.',
        variant: 'destructive',
      });
      return;
    }

    setTesting(true);
    setTestStatus('idle');

    try {
      let response: Response;
      const testPrompt = 'Responda apenas com: "Flameer IA ativa." Nada mais.';

      if (settings.provider === 'gemini') {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${settings.api_key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: testPrompt }] }],
              generationConfig: { maxOutputTokens: 50, temperature: 0.1 },
            }),
          }
        );
      } else if (settings.provider === 'openai') {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.api_key}`,
          },
          body: JSON.stringify({
            model: settings.model,
            messages: [{ role: 'user', content: testPrompt }],
            max_tokens: 50,
            temperature: 0.1,
          }),
        });
      } else {
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': settings.api_key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: settings.model,
            max_tokens: 50,
            messages: [{ role: 'user', content: testPrompt }],
          }),
        });
      }

      if (response.ok) {
        setTestStatus('success');
        toast({
          title: 'Conexão bem-sucedida ✅',
          description: `${PROVIDER_MODELS[settings.provider].label} respondeu corretamente.`,
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as any)?.error?.message || `HTTP ${response.status}: ${response.statusText}`
        );
      }
    } catch (err: any) {
      setTestStatus('error');
      toast({
        title: 'Falha na conexão ❌',
        description: err.message || 'Verifique a chave e o modelo selecionado.',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleProviderChange = (provider: string) => {
    const firstModel = PROVIDER_MODELS[provider]?.models[0]?.value || '';
    setSettings((prev) => ({ ...prev, provider, model: firstModel }));
    setTestStatus('idle');
  };

  const currentModels = PROVIDER_MODELS[settings.provider]?.models || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <SettingsIcon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie a integração de IA, chaves de API e instruções do sistema.
          </p>
        </div>
      </div>

      {!tableExists && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="font-semibold text-destructive text-sm">Tabela ai_settings não encontrada</p>
                <p className="text-xs text-muted-foreground">
                  Execute a migration SQL abaixo no Supabase SQL Editor para criar a tabela:
                </p>
                <pre className="bg-muted/50 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre">
{`CREATE TABLE public.ai_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'gemini',
  api_key TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  instruction_md TEXT NOT NULL DEFAULT '',
  max_tokens INTEGER DEFAULT 4096,
  temperature NUMERIC(3,2) DEFAULT 0.7,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access" ON public.ai_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_profiles
      WHERE user_id = auth.uid()
    )
  );`}
                </pre>
                <Button variant="outline" size="sm" onClick={loadSettings} className="gap-2 mt-2">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Verificar novamente
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Provider & Key Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cpu className="w-5 h-5 text-primary" />
              <div>
                <CardTitle className="text-base">Motor de IA</CardTitle>
                <CardDescription>Provider, modelo e chave de autenticação</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {testStatus === 'success' && (
                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Ativo
                </Badge>
              )}
              {testStatus === 'error' && (
                <Badge variant="destructive" className="gap-1.5">
                  <XCircle className="w-3.5 h-3.5" />
                  Erro
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Provider */}
            <div className="space-y-2">
              <Label htmlFor="provider" className="text-xs font-medium">
                Provider
              </Label>
              <Select value={settings.provider} onValueChange={handleProviderChange}>
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Selecione o provider" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROVIDER_MODELS).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      {val.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label htmlFor="model" className="text-xs font-medium">
                Modelo
              </Label>
              <Select
                value={settings.model}
                onValueChange={(model) => setSettings((prev) => ({ ...prev, model }))}
              >
                <SelectTrigger id="model">
                  <SelectValue placeholder="Selecione o modelo" />
                </SelectTrigger>
                <SelectContent>
                  {currentModels.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="api-key" className="text-xs font-medium">
              Chave de API
            </Label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={settings.api_key}
                onChange={(e) => {
                  setSettings((prev) => ({ ...prev, api_key: e.target.value }));
                  setTestStatus('idle');
                }}
                placeholder="sk-... ou AIza..."
                className="pl-10 pr-20 font-mono text-sm"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Advanced controls */}
          <div className="grid grid-cols-2 gap-6">
            {/* Temperature */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium flex items-center gap-2">
                  <Thermometer className="w-3.5 h-3.5 text-muted-foreground" />
                  Temperature
                </Label>
                <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                  {settings.temperature.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.temperature}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))
                }
                className="w-full accent-primary h-1.5 rounded-lg appearance-none cursor-pointer bg-muted"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Preciso</span>
                <span>Criativo</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div className="space-y-2">
              <Label htmlFor="max-tokens" className="text-xs font-medium flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                Max Tokens
              </Label>
              <Input
                id="max-tokens"
                type="number"
                min={256}
                max={32768}
                value={settings.max_tokens}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, max_tokens: parseInt(e.target.value) || 4096 }))
                }
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">IA Ativa</Label>
              <p className="text-xs text-muted-foreground">
                Quando desativado, o fluxo de IA no app ficará indisponível.
              </p>
            </div>
            <Switch
              checked={settings.is_active}
              onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, is_active: checked }))}
            />
          </div>

          {/* Test & Save buttons */}
          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || !settings.api_key.trim()}
              className="gap-2"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Testar Conexão
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salvar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Instruction MD Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-primary" />
              <div>
                <CardTitle className="text-base">Instrução do Sistema (Markdown)</CardTitle>
                <CardDescription>
                  System prompt que guia a IA a manter o padrão Flameer, independente do provider usado.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="md-preview" className="text-xs text-muted-foreground">
                Preview
              </Label>
              <Switch
                id="md-preview"
                checked={mdPreview}
                onCheckedChange={setMdPreview}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {mdPreview ? (
            <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border bg-muted/30 p-6 min-h-[400px]">
              <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/90">
                {settings.instruction_md}
              </div>
            </div>
          ) : (
            <Textarea
              value={settings.instruction_md}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, instruction_md: e.target.value }))
              }
              placeholder="# Instruções para a IA..."
              className="font-mono text-xs leading-relaxed min-h-[400px] resize-y"
            />
          )}
          <div className="flex justify-between items-center mt-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground gap-1.5"
              onClick={() =>
                setSettings((prev) => ({ ...prev, instruction_md: DEFAULT_INSTRUCTION_MD }))
              }
            >
              <RefreshCw className="w-3 h-3" />
              Restaurar padrão
            </Button>
            <p className="text-[10px] text-muted-foreground">
              {settings.instruction_md.length} caracteres
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
