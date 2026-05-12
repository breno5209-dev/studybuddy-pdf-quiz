import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FolderPlus, Trash2, FileText, Folder, Pencil } from "lucide-react";

export const Route = createFileRoute("/groups")({
  head: () => ({ meta: [{ title: "Áreas — MedQuiz" }] }),
  component: GroupsPage,
});

function GroupsPage() {
  const groups = useStore((s) => s.groups);
  const quizzes = useStore((s) => s.quizzes);
  const addGroup = useStore((s) => s.addGroup);
  const removeGroup = useStore((s) => s.removeGroup);
  const renameGroup = useStore((s) => s.renameGroup);
  const removeQuiz = useStore((s) => s.removeQuiz);
  const assign = useStore((s) => s.assignQuizToGroup);

  const [newName, setNewName] = useState("");

  const handleAdd = () => {
    if (!newName.trim()) return;
    addGroup(newName.trim());
    setNewName("");
  };

  const ungrouped = quizzes.filter((q) => !q.groupId);

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-8 space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Áreas e quizzes</h1>
          <p className="text-muted-foreground mt-1">
            Agrupe quizzes em grandes áreas como Cardiologia, Pediatria, etc.
          </p>
        </header>

        <Card className="p-5">
          <div className="flex gap-2">
            <Input
              placeholder="Nome da nova área (ex: Cardiologia)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button onClick={handleAdd}>
              <FolderPlus className="w-4 h-4 mr-2" /> Criar área
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          {groups.map((g) => {
            const gQuizzes = quizzes.filter((q) => q.groupId === g.id);
            return (
              <Card key={g.id} className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Folder className="w-5 h-5" style={{ color: g.color }} />
                    <EditableName
                      name={g.name}
                      onChange={(n) => renameGroup(g.id, n)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {gQuizzes.length} quiz{gQuizzes.length !== 1 ? "zes" : ""}
                    </span>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir área?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Os quizzes serão mantidos, mas ficarão sem área.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeGroup(g.id)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                {gQuizzes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum quiz nesta área ainda.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {gQuizzes.map((q) => (
                      <QuizRow
                        key={q.id}
                        quiz={q}
                        groups={groups}
                        onAssign={(gid) => assign(q.id, gid)}
                        onRemove={() => removeQuiz(q.id)}
                      />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}

          {ungrouped.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Folder className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Sem grupo</span>
                <span className="text-xs text-muted-foreground">
                  {ungrouped.length} quiz{ungrouped.length !== 1 ? "zes" : ""}
                </span>
              </div>
              <div className="space-y-2">
                {ungrouped.map((q) => (
                  <QuizRow
                    key={q.id}
                    quiz={q}
                    groups={groups}
                    onAssign={(gid) => assign(q.id, gid)}
                    onRemove={() => removeQuiz(q.id)}
                  />
                ))}
              </div>
            </Card>
          )}

          {groups.length === 0 && ungrouped.length === 0 && (
            <Card className="p-10 text-center text-muted-foreground">
              Nenhuma área ou quiz ainda. Importe um PDF para começar.
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function EditableName({ name, onChange }: { name: string; onChange: (n: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);
  if (editing) {
    return (
      <Input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          if (val.trim()) onChange(val.trim());
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (val.trim()) onChange(val.trim());
            setEditing(false);
          }
        }}
        className="w-48 h-7 text-sm"
      />
    );
  }
  return (
    <button
      className="font-semibold inline-flex items-center gap-1.5 hover:text-primary"
      onClick={() => setEditing(true)}
    >
      {name}
      <Pencil className="w-3 h-3 opacity-50" />
    </button>
  );
}

function QuizRow({ quiz, groups, onAssign, onRemove }: any) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors">
      <FileText className="w-4 h-4 text-muted-foreground" />
      <Link
        to="/quiz/$quizId"
        params={{ quizId: quiz.id }}
        className="flex-1 font-medium hover:text-primary truncate"
      >
        {quiz.name}
      </Link>
      <span className="text-xs text-muted-foreground">
        {quiz.questions.length} q.
      </span>
      <Select value={quiz.groupId ?? "none"} onValueChange={(v) => onAssign(v === "none" ? null : v)}>
        <SelectTrigger className="w-40 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Sem grupo</SelectItem>
          {groups.map((g: any) => (
            <SelectItem key={g.id} value={g.id}>
              {g.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="ghost" size="icon" onClick={onRemove}>
        <Trash2 className="w-4 h-4 text-destructive" />
      </Button>
    </div>
  );
}
