import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Upload, 
  X, 
  FolderOpen, 
  FileSpreadsheet, 
  FileText, 
  Sparkles, 
  Info,
  Code
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'diet' | 'workout' | 'challenge';
  onImport: (data: {
    mode: 'replace' | 'append';
    parsedData: any;
  }) => void;
}

export default function ImportModal({ isOpen, onClose, type, onImport }: ImportModalProps) {
  const [importFormat, setImportFormat] = useState<'spreadsheet' | 'text' | 'json'>('spreadsheet');
  const [importMode, setImportMode] = useState<'replace' | 'append'>('append');
  const [importText, setImportText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setImportText(text);
      if (file.name.endsWith('.json')) {
        setImportFormat('json');
      } else if (file.name.endsWith('.csv') || file.name.endsWith('.tsv')) {
        setImportFormat('spreadsheet');
      } else {
        setImportFormat('text');
      }
      toast({
        title: "Arquivo carregado",
        description: `O arquivo ${file.name} foi lido com sucesso.`
      });
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Parser helpers
  const cleanCitation = (str: string) => {
    if (!str) return '';
    return str.replace(/\[cite:\s*\d+(?:,\s*\d+)*\]/g, '').trim();
  };

  const parseDecimal = (str: string) => {
    if (!str) return 0;
    const cleaned = cleanCitation(str).replace(/[^\d.,]/g, '').replace(',', '.');
    return Number(cleaned) || 0;
  };

  const parseGrid = (text: string): string[][] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    return lines.map(line => {
      if (line.includes('\t')) return line.split('\t').map(c => c.trim());
      if (line.includes(';')) return line.split(';').map(c => c.trim());
      return line.split(',').map(c => c.trim());
    });
  };

  // DIET PARSERS
  const parseDietSpreadsheet = (text: string) => {
    const grid = parseGrid(text);
    const meals: any[] = [];
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
      
      meals.push({
        name: nameVal || 'Refeição',
        time: timeVal.length === 5 ? `${timeVal}:00` : timeVal,
        calories: kcal,
        protein: prot,
        carbs: carb,
        fat: fatVal,
        items
      });
    }
    return { meals };
  };

  const parseDietFreeText = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const meals: any[] = [];
    let currentMeal: any = null;
    const timeRegex = /\b\d{2}:\d{2}\b/;
    
    for (const line of lines) {
      const timeMatch = line.match(timeRegex);
      if (timeMatch) {
        if (currentMeal) meals.push(currentMeal);
        const namePart = line.replace(timeMatch[0], '').replace(/[:-]/g, '').trim();
        currentMeal = {
          name: namePart || 'Refeição',
          time: `${timeMatch[0]}:00`,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          items: []
        };
      } else if (currentMeal) {
        // Parse macros from line if present
        const kcalMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(?:kcal|calorias)/i);
        const protMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gramas)?\s*(?:de)?\s*prote[íi]na/i);
        const carbMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gramas)?\s*(?:de)?\s*carboidrato/i);
        const fatMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gramas)?\s*(?:de)?\s*gordura/i);
        
        if (kcalMatch) currentMeal.calories = parseDecimal(kcalMatch[1]);
        if (protMatch) currentMeal.protein = parseDecimal(protMatch[1]);
        if (carbMatch) currentMeal.carbs = parseDecimal(carbMatch[1]);
        if (fatMatch) currentMeal.fat = parseDecimal(fatMatch[1]);
        
        if (!kcalMatch && !protMatch && !carbMatch && !fatMatch) {
          const parts = line.split(':');
          if (parts.length > 1) {
            currentMeal.items.push({ name: parts[0].trim(), quantity: parts[1].trim() });
          } else {
            currentMeal.items.push({ name: line, quantity: '1 porção' });
          }
        }
      }
    }
    if (currentMeal) meals.push(currentMeal);
    return { meals };
  };

  // WORKOUT PARSERS
  const parseWorkoutSpreadsheet = (text: string) => {
    const grid = parseGrid(text);
    const exercises: any[] = [];
    
    for (const row of grid) {
      if (row.length < 2) continue;
      const col0Lower = row[0].toLowerCase();
      if (col0Lower.includes('exerc') || col0Lower.includes('nome') || col0Lower.includes('workout')) continue;
      
      const nameVal = row[0];
      const muscleVal = row[1] || 'Geral';
      const setsCount = parseInt(row[2]) || 3;
      const repsVal = row[3] || '10';
      const restVal = parseInt(row[4]) || 60;
      const notes = row[5] || '';
      
      const sets = Array.from({ length: setsCount }, () => ({
        reps: repsVal,
        weight: '0'
      }));
      
      exercises.push({
        name: nameVal,
        muscle: muscleVal,
        rest_seconds: restVal,
        sets,
        metadata: {
          informacoes_adicionais: notes
        }
      });
    }
    return { exercises };
  };

  const parseWorkoutFreeText = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const exercises: any[] = [];
    
    for (const line of lines) {
      // Look for format like "Supino Reto - 4x10 - 60s"
      const parts = line.split(/[-|]/);
      if (parts.length < 2) continue;
      
      const name = parts[0].trim();
      const repsPart = parts[1].trim();
      
      // Match set counts (ex: 4x10-12, 3 séries de 15)
      let setsCount = 3;
      let reps = '10';
      
      const xMatch = repsPart.match(/(\d+)\s*[xX]\s*([\d-]+)/);
      if (xMatch) {
        setsCount = parseInt(xMatch[1]);
        reps = xMatch[2];
      } else {
        const wordMatch = repsPart.match(/(\d+)\s*(?:série|serie)s?\s*(?:de)?\s*([\d-]+)?/i);
        if (wordMatch) {
          setsCount = parseInt(wordMatch[1]);
          if (wordMatch[2]) reps = wordMatch[2];
        }
      }
      
      let rest = 60;
      const restMatch = line.match(/(\d+)\s*(?:s|segundos|s descansar|s descanso|s de descanso)/i);
      if (restMatch) {
        rest = parseInt(restMatch[1]);
      }
      
      const sets = Array.from({ length: setsCount }, () => ({
        reps,
        weight: '0'
      }));
      
      exercises.push({
        name,
        muscle: 'Geral',
        rest_seconds: rest,
        sets,
        metadata: {
          informacoes_adicionais: parts[2] ? parts[2].trim() : ''
        }
      });
    }
    return { exercises };
  };

  // CHALLENGE PARSER
  const parseChallengeJson = (text: string) => {
    return JSON.parse(text);
  };

  // Main Submit handler
  const handleImportClick = () => {
    if (!importText.trim()) {
      toast({
        title: "Campo vazio",
        description: "Insira os dados na caixa de texto ou selecione um arquivo.",
        variant: "destructive"
      });
      return;
    }

    try {
      let resultData: any = null;

      if (type === 'challenge') {
        resultData = parseChallengeJson(importText);
      } else if (type === 'diet') {
        if (importFormat === 'json') {
          const raw = JSON.parse(importText);
          if (raw.plano_alimentar) {
            const plan = raw.plano_alimentar;
            const nutrients = raw.relatorio_nutrientes;
            const shopping = raw.lista_de_compras;
            
            const meals = plan.refeicoes.map((ref: any) => {
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
              
              return {
                name: mealName,
                time: cleanTime.length === 5 ? `${cleanTime}:00` : cleanTime,
                calories,
                protein,
                carbs,
                fat,
                items,
                metadata: {
                  substitutions,
                  observacoes: ref.observacoes ? cleanCitation(ref.observacoes) : undefined
                }
              };
            });
            
            resultData = {
              title: plan.titulo || "Dieta Importada",
              meals,
              metadata: {
                patient_name: cleanCitation(plan.paciente),
                prescription_date: cleanCitation(plan.data_prescricao),
                professional_name: cleanCitation(plan.profissional?.nome),
                professional_role: cleanCitation(plan.profissional?.atuacao),
                professional_crn: cleanCitation(plan.profissional?.registro),
                shopping_list: shopping?.itens?.map((i: string) => cleanCitation(i)) || [],
                nutrient_report: nutrients?.micronutrientes_e_gorduras || null
              }
            };
          } else {
            resultData = {
              title: raw.title || "Dieta Importada",
              meals: raw.meals || [],
              metadata: raw.metadata || {}
            };
          }
        } else if (importFormat === 'spreadsheet') {
          resultData = parseDietSpreadsheet(importText);
        } else {
          resultData = parseDietFreeText(importText);
        }
      } else if (type === 'workout') {
        if (importFormat === 'json') {
          const raw = JSON.parse(importText);
          if (raw.treino_abdomen || raw.treino_cardio) {
            const workoutKey = raw.treino_abdomen ? 'treino_abdomen' : 'treino_cardio';
            const tc = raw[workoutKey];
            const title = cleanCitation(tc.titulo);
            const focus = raw.treino_abdomen ? 'Abdômen' : 'Cardio';
            const cronograma = cleanCitation(tc.cronograma || tc.dias);
            const videoUrl = tc.video_demonstrativo ? cleanCitation(tc.video_demonstrativo) : undefined;
            
            let exercises = [];
            if (raw.treino_abdomen) {
              exercises = (tc.exercicios || []).map((ex: any) => {
                const setsCount = parseDecimal(ex.series || "3");
                const repsStr = cleanCitation(ex.repeticoes || "10");
                const sets = Array.from({ length: setsCount }, () => ({
                  reps: repsStr,
                  weight: "0"
                }));
                return {
                  name: cleanCitation(ex.nome),
                  muscle: "Abdômen",
                  rest_seconds: parseDecimal(ex.descanso || "45"),
                  sets,
                  metadata: {
                    informacoes_adicionais: ex.rir ? `RIR: ${cleanCitation(ex.rir)}` : undefined
                  }
                };
              });
            } else {
              const hiitProtocol = tc.protocolo_hiit || {};
              exercises = [{
                name: cleanCitation(tc.titulo),
                muscle: "Cardiorrespiratório",
                rest_seconds: 0,
                sets: [{ reps: "1", weight: "0" }],
                metadata: {
                  informacoes_adicionais: `Aquecimento: ${hiitProtocol.aquecimento}. HIIT: ${hiitProtocol.treino_hiit}. Resfriamento: ${hiitProtocol.resfriamento}.`
                }
              }];
            }
            
            let weekNumber = 1;
            const match = title.match(/\d+/);
            if (match) {
              weekNumber = Number(match[0]) || 1;
            }
            
            let days: number[] = [];
            const cronLower = cronograma.toLowerCase();
            if (cronLower.includes("1, 3 e 5") || (cronLower.includes("segunda") && cronLower.includes("quarta"))) {
              days = [0, 2, 4];
            } else if (cronLower.includes("2, 4 e 6") || (cronLower.includes("terça") && cronLower.includes("quinta"))) {
              days = [1, 3, 5];
            }
            
            resultData = {
              title,
              duration_minutes: raw.treino_abdomen ? 30 : 20,
              focus,
              days,
              exercises,
              metadata: {
                week_number: weekNumber,
                video_url: videoUrl,
                hiit_protocol: tc.protocolo_hiit || null
              }
            };
          } else {
            resultData = raw;
          }
        } else if (importFormat === 'spreadsheet') {
          resultData = parseWorkoutSpreadsheet(importText);
        } else {
          resultData = parseWorkoutFreeText(importText);
        }
      }

      if (!resultData) {
        throw new Error("Não foi possível processar a entrada com o formato selecionado.");
      }

      onImport({
        mode: importMode,
        parsedData: resultData
      });

      // Clear fields
      setImportText('');
      onClose();
    } catch (err: any) {
      toast({
        title: "Erro no processamento",
        description: err.message || "Verifique se a formatação está correta.",
        variant: "destructive"
      });
    }
  };

  const getTitle = () => {
    const map = {
      diet: 'Importar Plano Alimentar / Dieta',
      workout: 'Importar Rotina de Treino',
      challenge: 'Importar Pacote de Desafio'
    };
    return map[type];
  };

  const getDescription = () => {
    const map = {
      diet: 'Cole dados nutricionais estruturados em planilha (Excel/Sheets), texto corrido de PDF ou arquivo JSON bruto.',
      workout: 'Cole exercícios de planilhas de treino, listas de texto copiadas de mensagens, ou JSONs estruturados.',
      challenge: 'Cole o arquivo JSON de configuração completa do desafio (incluindo hábitos, treinos e dieta).'
    };
    return map[type];
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-card border border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="font-bold text-xl flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {getTitle()}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        {/* Drag and Drop Box */}
        <div 
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
            dragActive ? 'border-primary bg-primary/5' : 'border-border bg-secondary/5 hover:bg-secondary/10'
          }`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-upload-input')?.click()}
        >
          <input 
            type="file" 
            id="file-upload-input" 
            className="hidden" 
            accept=".json,.csv,.tsv,.txt" 
            onChange={handleFileChange} 
          />
          <Upload className="w-8 h-8 text-primary mx-auto mb-2" />
          <p className="text-xs font-semibold">Arraste um arquivo (.json, .csv, .tsv, .txt) aqui ou clique para procurar</p>
          <p className="text-[10px] text-muted-foreground mt-1">Tamanho máximo: 5MB</p>
        </div>

        {/* Format & Mode selectors */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-2">
          <Tabs value={importFormat} onValueChange={(v: any) => setImportFormat(v)} className="w-full sm:w-auto">
            <TabsList className="bg-secondary/20 border border-border">
              {type !== 'challenge' && (
                <>
                  <TabsTrigger value="spreadsheet" className="text-xs gap-1 data-[state=active]:bg-primary data-[state=active]:text-white">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Copiar da Planilha
                  </TabsTrigger>
                  <TabsTrigger value="text" className="text-xs gap-1 data-[state=active]:bg-primary data-[state=active]:text-white">
                    <FileText className="w-3.5 h-3.5" />
                    Texto de PDF / Msg
                  </TabsTrigger>
                </>
              )}
              <TabsTrigger value="json" className="text-xs gap-1 data-[state=active]:bg-primary data-[state=active]:text-white">
                <Code className="w-3.5 h-3.5" />
                JSON Bruto
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {type !== 'challenge' && (
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="text-muted-foreground">Modo de Ação:</span>
              <div className="flex gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="radio" 
                    name="importMode" 
                    value="append" 
                    checked={importMode === 'append'} 
                    onChange={() => setImportMode('append')}
                    className="accent-primary" 
                  />
                  Adicionar ao final
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="radio" 
                    name="importMode" 
                    value="replace" 
                    checked={importMode === 'replace'} 
                    onChange={() => setImportMode('replace')}
                    className="accent-primary" 
                  />
                  Substituir atual
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Input box */}
        <div className="space-y-1.5 mt-2">
          <Label className="text-xs font-semibold">Dados para Importação</Label>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={
              importFormat === 'json' 
                ? 'Cole o JSON aqui...'
                : importFormat === 'spreadsheet'
                  ? 'Cole aqui as células do Excel (use Tab para separar colunas)...'
                  : 'Cole aqui o texto livre do PDF ou da mensagem...'
            }
            className="w-full h-44 px-3 py-2 text-xs font-mono rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onClose} className="text-xs">
            Cancelar
          </Button>
          <Button onClick={handleImportClick} className="text-xs gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Confirmar Importação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
