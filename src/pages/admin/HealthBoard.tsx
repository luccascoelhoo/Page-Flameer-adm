import React from 'react';
import { HeartPulse, Users2, LineChart } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PeriodSelector from '@/components/admin/analytics/PeriodSelector';
import RosterSection from '@/pages/admin/health/RosterSection';
import CohortSection from '@/pages/admin/health/CohortSection';
import MemberSection from '@/pages/admin/health/MemberSection';

export default function HealthBoard() {
  const [period, setPeriod] = React.useState(30);
  const [tab, setTab] = React.useState('roster');
  const [memberId, setMemberId] = React.useState<string | null>(null);

  const selectMember = (id: string) => {
    setMemberId(id);
    setTab('member');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">Saúde e Prontidão</h1>
            <p className="text-sm text-muted-foreground">
              Wearables (Apple Health) · prontidão, recuperação e carga — só com consentimento.
            </p>
          </div>
        </div>
        {tab === 'cohort' && <PeriodSelector value={period} onChange={setPeriod} />}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="roster" className="gap-1.5 text-xs">
            <HeartPulse className="w-3.5 h-3.5" />
            Prontidão hoje
          </TabsTrigger>
          <TabsTrigger value="cohort" className="gap-1.5 text-xs">
            <LineChart className="w-3.5 h-3.5" />
            Coorte
          </TabsTrigger>
          <TabsTrigger value="member" className="gap-1.5 text-xs" disabled={!memberId}>
            <Users2 className="w-3.5 h-3.5" />
            Membro
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="mt-0">
          <RosterSection onSelectMember={selectMember} />
        </TabsContent>
        <TabsContent value="cohort" className="mt-0">
          <CohortSection periodDays={period} />
        </TabsContent>
        <TabsContent value="member" className="mt-0">
          {memberId && <MemberSection userId={memberId} onBack={() => setTab('roster')} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
