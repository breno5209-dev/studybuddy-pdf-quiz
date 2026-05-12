import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useStore, type Question } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  StickyNote,
  RotateCcw,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/quiz/$quizId")({
  head: () => ({ meta: [{ title: "Quiz — MedQuiz" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    source: typeof search.source === "string" ? search.source : undefined,
  }),
  component: QuizPage,
});

function QuizPage() {
  const { quizId } = Route.useParams();
  const { source } = Route.useSearch();
  const navigate = useNavigate();
  const quizzes = useStore((s) => s.quizzes);
  const responses = useStore((s) => s.responses);
  const progress = useStore((s) => s.progress);
  const notes = useStore((s) => s.notes);
  const recordResponse = useStore((s) => s.recordResponse);
  const setProgress = useStore((s) => s.setProgress);
  const resetProgress = useStore((s) => s.resetProgress);
  const setNote = useStore((s) => s.setNote);

  // Build "custom error quiz" virtually
  const customQuiz = useMemo(() => {
    if (quizId !== "custom" && quizId !== "errors") return null;
    const filtered =
      quizId === "errors" && source
        ? responses.filter((r) => !r.correct && r.quizId === source)
        : responses.filter((r) => !r.correct);
    const seen = new Set<string>();
    const wrongQuestions: Question[] = [];
    const pool =
      quizId === "errors" && source
        ? quizzes.find((q) => q.id === source)?.questions ?? []
        : quizzes.flatMap((qz) => qz.questions);
    for (const r of filtered) {
      if (seen.has(r.questionId)) continue;
      seen.add(r.questionId);
      const q = pool.find((qq) => qq.id === r.questionId);
      if (q) wrongQuestions.push(q);
    }
    const sourceQuiz =
      quizId === "errors" && source
        ? quizzes.find((q) => q.id === source)
        : null;
    return {
      id: quizId,
      name:
        sourceQuiz != null
          ? `Erros — ${sourceQuiz.name}`
          : "Quiz dos meus erros",
      groupId: sourceQuiz?.groupId ?? null,
      createdAt: 0,
      questions: wrongQuestions,
    };
  }, [quizId, source, quizzes, responses]);

  const quiz = customQuiz ?? quizzes.find((q) => q.id === quizId);
  const isVirtual = quizId === "custom" || quizId === "errors";

  const [currentIdx, setCurrentIdx] = useState(() => {
    const saved = progress[quizId];
    return saved != null ? Math.min(saved, (quiz?.questions.length ?? 1) - 1) : 0;
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showResume, setShowResume] = useState(() => {
    return !isVirtual && progress[quizId] != null && progress[quizId] > 0;
  });

  if (!quiz) {
    return (
      <AppShell>
        <div className="p-8">Quiz não encontrado.</div>
      </AppShell>
    );
  }

  if (quiz.questions.length === 0) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto p-8">
          <Card className="p-10 text-center">
            <Trophy className="w-12 h-12 text-success mx-auto mb-4" />
            <h2 className="text-xl font-semibold">Sem erros para revisar!</h2>
            <p className="text-muted-foreground mt-2">
              Você ainda não errou nenhuma questão. Continue praticando.
            </p>
            <Link to="/">
              <Button className="mt-5">Voltar ao início</Button>
            </Link>
          </Card>
        </div>
      </AppShell>
    );
  }

  const question = quiz.questions[currentIdx];
  const note = notes[question.id] ?? "";

  const handleSelect = (letter: string) => {
    if (revealed) return;
    setSelected(letter);
  };

  const handleReveal = () => {
    if (!selected) return;
    const correct = selected === question.correctAnswer;
    recordResponse({
      quizId: isVirtual ? quiz.id : quiz.id,
      questionId: question.id,
      selected,
      correct,
      groupId: quiz.groupId,
    });
    setRevealed(true);
    if (!isVirtual) setProgress(quiz.id, currentIdx);
  };

  const goNext = () => {
    if (currentIdx < quiz.questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setSelected(null);
      setRevealed(false);
    } else {
      navigate({ to: "/" });
    }
  };

  const goPrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
      setSelected(null);
      setRevealed(false);
    }
  };

  const startOver = () => {
    if (!isVirtual) resetProgress(quiz.id);
    setCurrentIdx(0);
    setSelected(null);
    setRevealed(false);
    setShowResume(false);
  };

  const continueFromSaved = () => {
    setShowResume(false);
  };

  if (showResume) {
    const lastIdx = progress[quiz.id] ?? 0;
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto p-8">
          <Card className="p-8 text-center">
            <RotateCcw className="w-10 h-10 text-primary mx-auto mb-4" />
            <h2 className="text-xl font-semibold">Continuar de onde parou?</h2>
            <p className="text-muted-foreground mt-2">
              Você parou na questão {lastIdx + 1} de {quiz.questions.length}.
            </p>
            <div className="flex gap-2 justify-center mt-6">
              <Button variant="outline" onClick={startOver}>
                Recomeçar
              </Button>
              <Button onClick={() => { setCurrentIdx(lastIdx); continueFromSaved(); }}>
                Continuar
              </Button>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-8 space-y-5">
        <header>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
            <ChevronLeft className="w-4 h-4" /> Voltar
          </Link>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">{quiz.name}</h1>
            <span className="text-sm text-muted-foreground tabular-nums">
              Questão {currentIdx + 1} / {quiz.questions.length}
            </span>
          </div>
          <Progress
            value={((currentIdx + 1) / quiz.questions.length) * 100}
            className="h-1.5 mt-3"
          />
        </header>

        <Card className="p-6 space-y-5">
          <div>
            <div className="text-xs text-muted-foreground mb-2">
              Questão {question.number}
            </div>
            <p className="text-base leading-relaxed whitespace-pre-wrap">{question.statement}</p>
            {question.images && question.images.length > 0 && (
              <div className="mt-4 space-y-3">
                {question.images.map((img, idx) => (
                  <img
                    key={idx}
                    src={img.dataUrl}
                    alt={`Imagem da questão ${question.number}`}
                    className="rounded-md border border-border max-w-full h-auto bg-white"
                    loading="lazy"
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            {question.options.map((opt) => {
              const isSelected = selected === opt.letter;
              const isCorrect = opt.letter === question.correctAnswer;
              const showState = revealed;
              return (
                <button
                  key={opt.letter}
                  onClick={() => handleSelect(opt.letter)}
                  disabled={revealed}
                  className={cn(
                    "w-full text-left p-4 rounded-lg border transition-all flex items-start gap-3",
                    !showState && isSelected && "border-primary bg-primary/5",
                    !showState && !isSelected && "border-border hover:border-primary/40 hover:bg-accent/30",
                    showState && isCorrect && "border-success bg-success/10",
                    showState && isSelected && !isCorrect && "border-destructive bg-destructive/10",
                    showState && !isCorrect && !isSelected && "border-border opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "w-7 h-7 rounded-full border flex items-center justify-center text-sm font-medium shrink-0",
                      !showState && isSelected && "border-primary text-primary",
                      showState && isCorrect && "border-success bg-success text-success-foreground",
                      showState && isSelected && !isCorrect && "border-destructive bg-destructive text-destructive-foreground",
                    )}
                  >
                    {opt.letter}
                  </span>
                  <span className="flex-1 pt-0.5 text-sm leading-relaxed">{opt.text}</span>
                  {showState && isCorrect && <CheckCircle2 className="w-5 h-5 text-success shrink-0" />}
                  {showState && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-destructive shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" onClick={goPrev} disabled={currentIdx === 0}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
            </Button>
            {!revealed ? (
              <Button onClick={handleReveal} disabled={!selected}>
                Confirmar resposta
              </Button>
            ) : (
              <Button onClick={goNext}>
                {currentIdx < quiz.questions.length - 1 ? "Próxima" : "Finalizar"}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </Card>

        <NoteCard
          questionNumber={question.number}
          value={note}
          onSave={(t) => setNote(question.id, t)}
        />
      </div>
    </AppShell>
  );
}

function NoteCard({
  questionNumber,
  value,
  onSave,
}: {
  questionNumber: number;
  value: string;
  onSave: (t: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  // sync when question changes
  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <Card className="p-5 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <StickyNote className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-medium">
            {value ? "Anotação salva" : "Sem anotação"} para a Questão {questionNumber}
          </div>
          {value && (
            <div className="text-xs text-muted-foreground truncate max-w-md">
              {value}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link to="/notes" className="text-xs text-primary hover:underline">
          Ver todas
        </Link>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant={value ? "outline" : "default"}>
              <StickyNote className="w-4 h-4 mr-1" />
              {value ? "Editar anotação" : "Criar anotação"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Anotação — Questão {questionNumber}</DialogTitle>
              <DialogDescription>
                Salve mnemônicos, observações e links de revisão.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={8}
              placeholder="Escreva sua anotação..."
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  onSave(draft);
                  setOpen(false);
                }}
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}
