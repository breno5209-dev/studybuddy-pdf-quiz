import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StickyNote, Trash2, ExternalLink, Search } from "lucide-react";

export const Route = createFileRoute("/notes")({
  head: () => ({ meta: [{ title: "Anotações — MedQuiz" }] }),
  component: NotesPage,
});

function NotesPage() {
  const notes = useStore((s) => s.notes);
  const quizzes = useStore((s) => s.quizzes);
  const groups = useStore((s) => s.groups);
  const setNote = useStore((s) => s.setNote);
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const list: {
      questionId: string;
      text: string;
      quizId: string;
      quizName: string;
      groupName?: string;
      groupColor?: string;
      number: number;
      statement: string;
    }[] = [];
    for (const quiz of quizzes) {
      const group = groups.find((g) => g.id === quiz.groupId);
      for (const q of quiz.questions) {
        const text = notes[q.id];
        if (text && text.trim()) {
          list.push({
            questionId: q.id,
            text,
            quizId: quiz.id,
            quizName: quiz.name,
            groupName: group?.name,
            groupColor: group?.color,
            number: q.number,
            statement: q.statement,
          });
        }
      }
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (i) =>
        i.text.toLowerCase().includes(q) ||
        i.statement.toLowerCase().includes(q) ||
        i.quizName.toLowerCase().includes(q),
    );
  }, [notes, quizzes, groups, query]);

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Anotações</h1>
          <p className="text-muted-foreground mt-1">
            Todas as suas observações por questão em um só lugar.
          </p>
        </header>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar nas anotações..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {items.length === 0 ? (
          <Card className="p-10 text-center">
            <StickyNote className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              Você ainda não criou nenhuma anotação. Use o botão "Anotar" em
              qualquer questão para começar.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((i) => (
              <Card key={i.questionId} className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {i.groupName && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: `color-mix(in oklab, ${i.groupColor} 20%, transparent)`,
                          color: i.groupColor,
                        }}
                      >
                        {i.groupName}
                      </span>
                    )}
                    <span className="text-sm font-medium">{i.quizName}</span>
                    <span className="text-xs text-muted-foreground">
                      Questão {i.number}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Link
                      to="/quiz/$quizId"
                      params={{ quizId: i.quizId }}
                    >
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir quiz
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setNote(i.questionId, "")}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {i.statement}
                </p>
                <div className="p-3 rounded-md bg-accent/40 border border-border whitespace-pre-wrap text-sm">
                  {i.text}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
