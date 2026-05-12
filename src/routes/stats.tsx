import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStats } from "@/lib/use-stats";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { useMemo } from "react";

export const Route = createFileRoute("/stats")({
  head: () => ({ meta: [{ title: "Desempenho — MedQuiz" }] }),
  component: StatsPage,
});

function StatsPage() {
  const { byGroup, total, correct, accuracy } = useStats();
  const responses = useStore((s) => s.responses);

  const dailyData = useMemo(() => {
    const byDay: Record<string, { date: string; total: number; correct: number }> = {};
    for (const r of responses) {
      const d = new Date(r.timestamp);
      const key = d.toISOString().slice(0, 10);
      byDay[key] ??= { date: key, total: 0, correct: 0 };
      byDay[key].total++;
      if (r.correct) byDay[key].correct++;
    }
    return Object.values(byDay)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14)
      .map((d) => ({
        date: d.date.slice(5),
        Acertos: d.correct,
        Erros: d.total - d.correct,
        Acurácia: Math.round((d.correct / d.total) * 100),
      }));
  }, [responses]);

  const groupData = byGroup.map((g) => ({
    name: g.group.name,
    Acurácia: Math.round(g.accuracy * 100),
    Total: g.total,
  }));

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto p-8 space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Desempenho</h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe sua evolução e identifique pontos fracos.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat label="Total respondido" value={total} />
          <Stat label="Acertos" value={correct} />
          <Stat label="Acurácia geral" value={`${Math.round(accuracy * 100)}%`} highlight />
        </div>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Acurácia por área</h2>
          {groupData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              Sem dados ainda.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={groupData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Bar dataKey="Acurácia" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Evolução (últimos 14 dias)</h2>
          {dailyData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              Sem dados ainda.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Line type="monotone" dataKey="Acertos" stroke="var(--success)" strokeWidth={2} />
                <Line type="monotone" dataKey="Erros" stroke="var(--destructive)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Detalhe por área</h2>
          <div className="space-y-3">
            {byGroup.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            )}
            {byGroup.map((g) => (
              <div key={g.group.id} className="flex items-center gap-4">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: g.group.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{g.group.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {g.correct}/{g.total} · {Math.round(g.accuracy * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${g.accuracy * 100}%`,
                        background: g.group.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <Card className="p-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`text-3xl font-semibold tabular-nums mt-1 ${highlight ? "text-primary" : ""}`}
      >
        {value}
      </div>
    </Card>
  );
}
