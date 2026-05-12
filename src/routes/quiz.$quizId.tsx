import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useStore, type Question } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  component: QuizPage,
});

function QuizPage() {
  const { quizId } = Route.useParams();
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
    if (quizId !== "custom") return null;
    const wrongResponses = responses.filter((r) => !r.correct);
    const seen = new Set<string>();
    const wrongQuestions: Question[] = [];
    for (const r of wrongResponses) {
      if (seen.has(r.questionId)) continue;
      seen.add(r.questionId);
      const q = quizzes
        .flatMap((qz) => qz.questions)
        .find((qq) => qq.id === r.questionId);
      if (q) wrongQuestions.push(q);
    }
    return {
      id: "custom",
      name: "Quiz dos meus erros",
      groupId: null,
      createdAt: 0,
      questions: wrongQuestions,
    };
  }, [quizId, quizzes, responses]);

  const quiz = customQuiz ?? quizzes.find((q) => q.id === quizId);

  const [currentIdx, setCurrentIdx] = useState(() => {
    const saved = progress[quizId];
    return saved != null ? Math.min(saved, (quiz?.questions.length ?? 1) - 1) : 0;
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showResume, setShowResume] = useState(() => {
    return quizId !== "custom" && progress[quizId] != null && progress[quizId] > 0;
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
      quizId: quiz.id === "custom" ? "custom" : quiz.id,
      questionId: question.id,
      selected,
      correct,
      groupId: quiz.groupId,
    });
    setRevealed(true);
    if (quiz.id !== "custom") setProgress(quiz.id, currentIdx);
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
    if (quiz.id !== "custom") resetProgress(quiz.id);
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
            <p className="text-base leading-relaxed">{question.statement}</p>
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

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <StickyNote className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Anotações sobre esta questão</span>
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(question.id, e.target.value)}
            placeholder="Escreva suas observações, mnemônicos, links de revisão..."
            rows={3}
          />
        </Card>
      </div>
    </AppShell>
  );
}
