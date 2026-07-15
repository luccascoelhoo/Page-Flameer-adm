import React from 'react';
import { BrainCircuit, LineChart, Users2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PeriodSelector from '@/components/admin/analytics/PeriodSelector';
import OverviewSection from '@/pages/admin/analytics/OverviewSection';
import RetentionSection from '@/pages/admin/analytics/RetentionSection';
import CommunitiesSection from '@/pages/admin/analytics/CommunitiesSection';

export default function Intelligence() {
  const [period, setPeriod] = React.useState(30);
  const [tab, setTab] = React.useState('overview');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Central de Inteligência</h1>
            <p className="text-sm text-muted-foreground">
              Cruzamento de dados, coortes e descoberta de comunidades.
            </p>
          </div>
        </div>
        {tab !== 'retention' && <PeriodSelector value={period} onChange={setPeriod} />}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <LineChart className="w-3.5 h-3.5" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="retention" className="gap-1.5 text-xs">
            <BrainCircuit className="w-3.5 h-3.5" />
            Retenção & Funil
          </TabsTrigger>
          <TabsTrigger value="communities" className="gap-1.5 text-xs">
            <Users2 className="w-3.5 h-3.5" />
            Comunidades
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <OverviewSection periodDays={period} />
        </TabsContent>
        <TabsContent value="retention" className="mt-0">
          <RetentionSection />
        </TabsContent>
        <TabsContent value="communities" className="mt-0">
          <CommunitiesSection periodDays={period} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
