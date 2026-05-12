import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Histórico — MedQuiz" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const responses = useStore((s) => s.responses);
  const quizzes = useStore((s) => s.quizzes);
  const groups = useStore((s) => s.groups);

  const sorted = [...responses].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Histórico</h1>
          <p className="text-muted-foreground mt-1">
            Todas as suas respostas, da mais recente para a mais antiga.
          </p>
        </header>

        {sorted.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            Nenhuma resposta ainda. Comece um quiz para ver o histórico.
          </Card>
        ) : (
          <Card className="divide-y divide-border">
            {sorted.slice(0, 200).map((r) => {
              const quiz = quizzes.find((q) => q.id === r.quizId);
              const group = groups.find((g) => g.id === r.groupId);
              const question = quiz?.questions.find((qq) => qq.id === r.questionId);
              return (
                <div key={r.id} className="p-4 flex items-start gap-4">
                  {r.correct ? (
                    <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      {group && (
                        <span
                          className="px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `color-mix(in oklab, ${group.color} 20%, transparent)`, color: group.color }}
                        >
                          {group.name}
                        </span>
                      )}
                      {quiz && (
                        <Link to="/quiz/$quizId" params={{ quizId: quiz.id }} className="hover:text-primary truncate">
                          {quiz.name}
                        </Link>
                      )}
                      <span>·</span>
                      <span>{new Date(r.timestamp).toLocaleString("pt-BR")}</span>
                    </div>
                    <p className="text-sm line-clamp-2">{question?.statement ?? "Questão removida"}</p>
                    <div className="text-xs mt-1 text-muted-foreground">
                      Sua resposta: <span className="font-medium">{r.selected}</span>
                      {!r.correct && question && (
                        <> · Correta: <span className="font-medium text-success">{question.correctAnswer}</span></>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </AppShell>
  );
}
