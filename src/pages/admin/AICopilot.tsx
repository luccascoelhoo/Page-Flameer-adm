import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  Sparkles, 
  Send, 
  Key, 
  Loader2, 
  ArrowRight, 
  Dumbbell, 
  Apple, 
  CheckSquare, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  payload?: any;
  missingFields?: string[];
  error?: boolean;
}

export default function AICopilot() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Olá! Sou o Copiloto de Gerência Ativo (Gatekeeper) do Flameer.\n\nMinha função é garantir o rigor de regras de negócio do banco. Se você pedir um desafio raso, eu apontarei as falhas e os riscos e solicitarei o que falta.\n\nExperimente digitar: "Criar um desafio de supino".'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isKeyDialogOpen, setIsKeyDialogOpen] = useState(false);
  const [localApiKey, setLocalApiKey] = useState(localStorage.getItem('flameer_gemini_api_key') || '');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const saveLocalKey = () => {
    localStorage.setItem('flameer_gemini_api_key', localApiKey);
    toast({
      title: "Chave Salva",
      description: "Chave local do Gemini API configurada com sucesso.",
    });
    setIsKeyDialogOpen(false);
  };

  const handleImport = (payload: any) => {
    localStorage.setItem('flameer_prefilled_challenge', JSON.stringify(payload));
    toast({
      title: "Importado com sucesso!",
      description: "Redirecionando para o editor de desafios com os dados preenchidos.",
    });
    navigate('/challenges/new');
  };

  // Direct client-side call fallback (Gatekeeper prompt + wrapper schema)
  const callGeminiDirectly = async (promptText: string, apiKey: string) => {
    const systemPrompt = `Você é o Copiloto de IA do Flameer, atuando como um Co-Piloto de Gerência Ativo (Gatekeeper).
Sua missão é atuar com rigor absoluto, garantindo a integridade de dados e a segurança das regras de negócios.

Regras de Gerenciamento Ativo (IA Gatekeeper):
1. Avaliação de Suficiência:
   - Analise se o pedido do administrador possui as informações essenciais mínimas: Título do desafio, duração em dias, pelo menos um hábito modelo e detalhamento mínimo dos treinos/dieta.
   - Se dados essenciais estiverem omitidos ou o pedido for raso, você DEVE retornar "status": "needs_clarification".
   - Se o usuário especificar todos os dados, ou solicitar explicitamente para você sugerir os padrões, ou estiver respondendo a um questionamento anterior completando as lacunas, retorne "status": "complete".

2. Análise de Riscos e Questionamento Passo a Passo:
   - No campo "feedback_message", se status for "needs_clarification", aponte brevemente os riscos de forma resumida, mas faça APENAS UMA OU DUAS perguntas direcionadas de cada vez para obter os dados que faltam (ex: se faltarem hábitos, treinos e prêmio, pergunte primeiro apenas sobre os hábitos de forma conversacional, deixando as outras perguntas para a próxima rodada da conversa). Isso cria um assistente de configuração passo a passo (wizard) mais amigável, em vez de exigir uma lista enorme de uma só vez.
   - Popule o array "missing_fields" com o nome técnico de todos os campos que ainda estão pendentes (ex: "duration_days", "habits", "workouts", "diets").
   - Se o status for "complete", apresente em "feedback_message" uma revisão técnica resumida aprovando o desafio.

3. Mapeamentos de Banco de Dados (Estritos):
   - Tiers (Enums): Apenas "admin", "influencer", "premium_user" ou "free_user".
   - Dias da Semana (0-6): Segunda = 0, Terça = 1, Quarta = 2, Quinta = 3, Sexta = 4, Sábado = 5, Domingo = 6. (NUNCA use 1 para Segunda).
   - Horários das Refeições: Sempre no formato TIME do Postgres "HH:MM:SS" (ex: "08:00:00").
   - Consistência de Calorias: Garanta que as calorias informadas coincidam com (Proteína * 4) + (Carbo * 4) + (Gordura * 9) com margem máxima de 10%.`;

    const geminiSchema = {
      type: "object",
      properties: {
        status: { 
          type: "string", 
          enum: ["complete", "needs_clarification"], 
          description: "Status da completitude das regras do desafio" 
        },
        feedback_message: { 
          type: "string", 
          description: "Mensagem de feedback da IA para o administrador" 
        },
        missing_fields: {
          type: "array",
          items: { type: "string" },
          description: "Nomes dos campos vazios ou omitidos"
        },
        challenge_data: {
          type: "object",
          description: "Payload do desafio. Preencha completamente se status for complete.",
          properties: {
            title: { type: "string" },
            subtitle: { type: "string" },
            tier: { type: "string", enum: ["admin", "influencer", "premium_user", "free_user"] },
            visibility: { type: "string", enum: ["public", "private"] },
            category: { type: "string" },
            duration_days: { type: "integer" },
            prize: { type: "string" },
            icon_name: { type: "string" },
            cover_image_url: { type: "string" },
            share_code: { type: "string" },
            is_featured: { type: "boolean" },
            habits: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  icon_name: { type: "string" },
                  color: { type: "string" },
                  kind: { type: "string", enum: ["units", "quantity", "single"] },
                  unit: { type: "string" },
                  target: { type: "number" }
                },
                required: ["label", "icon_name", "color", "kind", "target"]
              }
            },
            workouts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  duration_minutes: { type: "integer" },
                  focus: { type: "string" },
                  days: {
                    type: "array",
                    items: { type: "integer" }
                  },
                  exercises: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        muscle: { type: "string" },
                        rest_seconds: { type: "integer" },
                        sets: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              reps: { type: "string" },
                              weight: { type: "string" }
                            },
                            required: ["reps", "weight"]
                          }
                        }
                      },
                      required: ["name", "muscle", "sets"]
                    }
                  }
                },
                required: ["title", "focus", "days", "exercises"]
              }
            },
            diets: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  meals: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        time: { type: "string" },
                        calories: { type: "number" },
                        protein: { type: "number" },
                        carbs: { type: "number" },
                        fat: { type: "number" },
                        items: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              quantity: { type: "string" }
                            },
                            required: ["name", "quantity"]
                          }
                        }
                      },
                      required: ["name", "time", "calories", "protein", "carbs", "fat", "items"]
                    }
                  }
                },
                required: ["title", "meals"]
              }
            }
          }
        }
      },
      required: ["status", "feedback_message", "missing_fields"]
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\nPedido do Administrador:\n"${promptText}"` }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: geminiSchema,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errTxt = await response.text();
      throw new Error(`API do Gemini retornou erro: ${errTxt}`);
    }

    const resJson = await response.json();
    const resultText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) {
      throw new Error("API retornou resposta vazia.");
    }

    return JSON.parse(resultText);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    setLoading(true);

    const userMsgId = 'msg-' + Date.now();
    setMessages(prev => [...prev, { id: userMsgId, sender: 'user', text: userText }]);

    try {
      let resultPayload: any = null;

      // 1. Try to invoke the Supabase Edge Function first
      try {
        const { data, error } = await supabase.functions.invoke('generate-challenge-copilot', {
          body: { prompt: userText }
        });

        if (error) {
          throw new Error(error.message || "Erro na Edge Function.");
        }
        if (data && !data.error) {
          resultPayload = data;
        } else if (data?.error) {
          throw new Error(data.error);
        }
      } catch (edgeError) {
        console.warn("Falha ao usar Supabase Edge Function, tentando chave local de fallback...", edgeError);
        
        // 2. Fallback to Local API Key if configured
        const apiKey = localStorage.getItem('flameer_gemini_api_key');
        if (!apiKey) {
          throw new Error("A Edge Function do Supabase não está configurada e nenhuma chave de API local do Gemini foi encontrada. Configure uma chave local clicando no ícone de chave no canto superior.");
        }
        resultPayload = await callGeminiDirectly(userText, apiKey);
      }

      if (resultPayload) {
        const isComplete = resultPayload.status === 'complete';
        setMessages(prev => [...prev, {
          id: 'ai-' + Date.now(),
          sender: 'ai',
          text: resultPayload.feedback_message,
          payload: isComplete ? resultPayload.challenge_data : null,
          missingFields: resultPayload.missing_fields || []
        }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: 'ai-err-' + Date.now(),
        sender: 'ai',
        text: `Erro ao gerar desafio: ${err.message || 'Falha desconhecida.'}`,
        error: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] max-w-4xl mx-auto border border-border bg-card rounded-2xl shadow-md overflow-hidden">
      {/* Copilot Header */}
      <div className="flex items-center justify-between border-b border-border bg-secondary/15 px-6 py-4.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary animate-pulse" />
          <div>
            <h2 className="text-base font-bold text-foreground font-sans">Copiloto IA Flameer (Gerência)</h2>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Analisa riscos, valida integridade de dados e cria desafios estruturados.</p>
          </div>
        </div>

        {/* Local Key Configuration Trigger */}
        <Dialog open={isKeyDialogOpen} onOpenChange={setIsKeyDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <Key className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                Configurar Chave Local
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-3">
              <p className="text-xs text-muted-foreground leading-normal">
                Insira sua chave da API do Gemini para testar o copiloto localmente sem precisar fazer deploy da Edge Function do Supabase. A chave fica salva apenas no seu navegador.
              </p>
              <div className="space-y-1.5">
                <Input
                  type="password"
                  placeholder="AIzaSy..."
                  value={localApiKey}
                  onChange={(e) => setLocalApiKey(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setIsKeyDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" onClick={saveLocalKey}>
                  Salvar Chave
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-secondary/5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl p-4 shadow-sm text-sm leading-relaxed whitespace-pre-line ${
                msg.sender === 'user'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : msg.error
                  ? 'bg-destructive/10 border border-destructive/20 text-destructive'
                  : 'bg-card border border-border text-foreground'
              }`}
            >
              {msg.text}

              {/* Warning Tags for Missing Fields */}
              {msg.missingFields && msg.missingFields.length > 0 && (
                <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-border/50 pt-2.5">
                  {msg.missingFields.map((field) => (
                    <span 
                      key={field} 
                      className="bg-destructive/10 text-destructive border border-destructive/25 px-2 py-0.5 rounded text-[9px] font-bold uppercase flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      Falta: {field}
                    </span>
                  ))}
                </div>
              )}

              {/* Summary Card for Generated Challenge */}
              {msg.payload && (
                <div className="mt-4 border border-border/80 bg-secondary/15 rounded-lg p-4 space-y-4 text-xs">
                  <div className="flex items-start gap-3">
                    {msg.payload.cover_image_url && (
                      <img 
                        src={msg.payload.cover_image_url} 
                        alt="Capa" 
                        className="w-16 h-16 rounded-md object-cover border border-border shrink-0" 
                      />
                    )}
                    <div>
                      <h4 className="font-bold text-foreground text-sm">{msg.payload.title}</h4>
                      <p className="text-muted-foreground text-[10px] mt-0.5">{msg.payload.subtitle}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">
                          {msg.payload.category || 'Treino'}
                        </span>
                        <span className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-[9px] font-bold">
                          {msg.payload.duration_days} Dias
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary items */}
                  <div className="grid grid-cols-3 gap-2 border-t border-b border-border/50 py-2.5">
                    <div className="flex items-center gap-1.5 text-foreground font-medium">
                      <CheckSquare className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{msg.payload.habits?.length || 0} Hábitos</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-foreground font-medium">
                      <Dumbbell className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{msg.payload.workouts?.length || 0} Treinos</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-foreground font-medium">
                      <Apple className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{msg.payload.diets?.[0]?.meals?.length || 0} Refeições</span>
                    </div>
                  </div>

                  {/* Action Import Button */}
                  <Button 
                    onClick={() => handleImport(msg.payload)}
                    className="w-full gap-1.5 font-bold h-9"
                    size="sm"
                  >
                    Importar para Editor
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-2 text-sm text-muted-foreground font-medium shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Copiloto de gerência analisando integridade e riscos...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Feed Area */}
      <form onSubmit={handleSend} className="border-t border-border bg-card p-4 flex gap-2">
        <Input
          placeholder="Peça para criar um desafio..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          className="flex-1 focus-visible:ring-primary h-11"
        />
        <Button 
          type="submit" 
          disabled={loading || !input.trim()} 
          size="icon"
          className="h-11 w-11 shrink-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
