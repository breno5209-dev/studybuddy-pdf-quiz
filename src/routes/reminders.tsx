import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Check, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reminders")({
  head: () => ({ meta: [{ title: "Lembretes — MedQuiz" }] }),
  component: RemindersPage,
});

function RemindersPage() {
  const reminders = useStore((s) => s.reminders);
  const groups = useStore((s) => s.groups);
  const addReminder = useStore((s) => s.addReminder);
  const toggleReminder = useStore((s) => s.toggleReminder);
  const removeReminder = useStore((s) => s.removeReminder);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [groupId, setGroupId] = useState<string>("none");

  const handleAdd = () => {
    if (!title.trim() || !date) return;
    addReminder({ title, date, groupId: groupId === "none" ? null : groupId });
    setTitle("");
    setDate("");
    setGroupId("none");
  };

  const sorted = [...reminders].sort((a, b) => a.date.localeCompare(b.date));
  const now = new Date().toISOString().slice(0, 10);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-8 space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Lembretes de revisão</h1>
          <p className="text-muted-foreground mt-1">
            Programe revisões para reforçar o que aprendeu.
          </p>
        </header>

        <Card className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Revisar arritmias"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1.5">
              <Label>Área</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geral</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAdd} className="self-end">
              <Plus className="w-4 h-4 mr-2" /> Adicionar
            </Button>
          </div>
        </Card>

        <div className="space-y-2">
          {sorted.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-3 opacity-40" />
              Nenhum lembrete ainda.
            </Card>
          ) : (
            sorted.map((r) => {
              const group = groups.find((g) => g.id === r.groupId);
              const overdue = !r.done && r.date < now;
              return (
                <Card
                  key={r.id}
                  className={cn(
                    "p-4 flex items-center gap-3",
                    r.done && "opacity-60",
                  )}
                >
                  <button
                    onClick={() => toggleReminder(r.id)}
                    className={cn(
                      "w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0",
                      r.done ? "bg-success border-success" : "border-border hover:border-primary",
                    )}
                  >
                    {r.done && <Check className="w-4 h-4 text-success-foreground" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={cn("font-medium", r.done && "line-through")}>
                      {r.title}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span className={overdue ? "text-destructive font-medium" : ""}>
                        {new Date(r.date).toLocaleDateString("pt-BR")}
                        {overdue && " · atrasado"}
                      </span>
                      {group && (
                        <>
                          <span>·</span>
                          <span style={{ color: group.color }}>{group.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeReminder(r.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
