import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { useStats } from "@/lib/use-stats";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  CheckCircle2,
  TrendingDown,
  Upload,
  Play,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MedQuiz — Dashboard" },
      { name: "description", content: "Estude questões médicas e acompanhe seu desempenho." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const quizzes = useStore((s) => s.quizzes);
  const groups = useStore((s) => s.groups);
  const progress = useStore((s) => s.progress);
  const responses = useStore((s) => s.responses);
  const { total, correct, accuracy, weakAreas, quizCount, byGroup } = useStats();

  const recentQuizzes = [...quizzes].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
  const wrongQuestions = responses.filter((r) => !r.correct).length;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto p-8 space-y-8">
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Bem-vindo de volta</h1>
            <p className="text-muted-foreground mt-1">
              Continue de onde parou ou importe um novo PDF.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/quiz/custom">
              <Button variant="outline" disabled={wrongQuestions === 0}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Quiz dos meus erros
              </Button>
            </Link>
            <Link to="/upload">
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                Importar PDF
              </Button>
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard icon={BookOpen} label="Questões respondidas" value={total} />
          <StatCard icon={CheckCircle2} label="Taxa de acerto" value={`${Math.round(accuracy * 100)}%`} accent />
          <StatCard icon={Play} label="Quizzes criados" value={quizCount} />
          <StatCard icon={TrendingDown} label="Áreas" value={groups.length} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Quizzes recentes</h2>
              <Link to="/groups" className="text-sm text-primary hover:underline">
                Ver todos
              </Link>
            </div>
            {recentQuizzes.length === 0 ? (
              <EmptyHint />
            ) : (
              <div className="space-y-2">
                {recentQuizzes.map((q) => {
                  const lastIdx = progress[q.id];
                  const pct = q.questions.length
                    ? ((lastIdx ?? -1) + 1) / q.questions.length
                    : 0;
                  const group = groups.find((g) => g.id === q.groupId);
                  const wrongInQuiz = responses.filter(
                    (r) => r.quizId === q.id && !r.correct,
                  ).length;
                  return (
                    <div
                      key={q.id}
                      className="block p-4 rounded-lg border border-border hover:border-primary/50 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {group && (
                              <span
                                className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ background: `color-mix(in oklab, ${group.color} 20%, transparent)`, color: group.color }}
                              >
                                {group.name}
                              </span>
                            )}
                            <span className="font-medium truncate">{q.name}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            <Progress value={pct * 100} className="h-1.5 flex-1" />
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {(lastIdx ?? -1) + 1}/{q.questions.length}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {wrongInQuiz > 0 && (
                            <Link
                              to="/quiz/$quizId"
                              params={{ quizId: "errors" }}
                              search={{ source: q.id }}
                            >
                              <Button size="sm" variant="outline">
                                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                                Erros ({wrongInQuiz})
                              </Button>
                            </Link>
                          )}
                          <Link to="/quiz/$quizId" params={{ quizId: q.id }}>
                            <Button size="sm" variant={lastIdx != null ? "default" : "outline"}>
                              {lastIdx != null ? "Continuar" : "Iniciar"}
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <h2 className="font-semibold">Áreas para revisar</h2>
            </div>
            {weakAreas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Responda algumas questões para descobrir suas áreas mais fracas.
              </p>
            ) : (
              <div className="space-y-3">
                {weakAreas.map((w) => (
                  <div key={w.group.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{w.group.name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {Math.round(w.accuracy * 100)}%
                      </span>
                    </div>
                    <Progress value={w.accuracy * 100} className="h-1.5" />
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-4">
              Total acertos: <span className="font-medium text-foreground">{correct}</span> / {total}
            </p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ icon: Icon, label, value, accent }: any) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            accent ? "text-primary-foreground" : "text-primary"
          }`}
          style={{
            background: accent ? "var(--gradient-primary)" : "color-mix(in oklab, var(--primary) 12%, transparent)",
          }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
        </div>
      </div>
    </Card>
  );
}

function EmptyHint() {
  return (
    <div className="text-center py-10 px-4 border border-dashed border-border rounded-lg">
      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm text-muted-foreground mb-4">
        Você ainda não importou nenhum PDF.
      </p>
      <Link to="/upload">
        <Button>Importar primeiro PDF</Button>
      </Link>
    </div>
  );
}
