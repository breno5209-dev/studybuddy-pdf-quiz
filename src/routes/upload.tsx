import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
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
import { extractTextFromPdf, parseQuestionsAndKey } from "@/lib/pdf-parser";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { Upload, FileText, Loader2, Plus } from "lucide-react";

export const Route = createFileRoute("/upload")({
  head: () => ({ meta: [{ title: "Importar PDF — MedQuiz" }] }),
  component: UploadPage,
});

function UploadPage() {
  const navigate = useNavigate();
  const groups = useStore((s) => s.groups);
  const addQuiz = useStore((s) => s.addQuiz);
  const addGroup = useStore((s) => s.addGroup);

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState<string>("none");
  const [newGroup, setNewGroup] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ count: number } | null>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setName(f.name.replace(/\.pdf$/i, ""));
    setPreview(null);
  };

  const handleSubmit = async () => {
    if (!file || !name) return;
    setLoading(true);
    try {
      const text = await extractTextFromPdf(file);
      const questions = parseQuestionsAndKey(text);
      if (questions.length === 0) {
        toast.error("Nenhuma questão detectada", {
          description:
            "Verifique se o PDF possui questões numeradas e gabarito (ex: '1-A 2-B') no final.",
        });
        setLoading(false);
        return;
      }
      let finalGroupId: string | null = groupId === "none" ? null : groupId;
      if (groupId === "__new" && newGroup.trim()) {
        finalGroupId = addGroup(newGroup.trim()).id;
      }
      const quiz = addQuiz({ name, groupId: finalGroupId, questions });
      toast.success(`${questions.length} questões importadas!`);
      navigate({ to: "/quiz/$quizId", params: { quizId: quiz.id } });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao processar PDF");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto p-8 space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Importar PDF</h1>
          <p className="text-muted-foreground mt-1">
            Envie um PDF com questões numeradas e gabarito ao final.
          </p>
        </header>

        <Card className="p-6 space-y-5">
          <label
            className="block border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
          >
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-6 h-6 text-primary" />
                <div className="text-left">
                  <div className="font-medium">{file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(0)} KB
                  </div>
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <div className="font-medium">Clique para selecionar</div>
                <div className="text-sm text-muted-foreground mt-1">
                  ou arraste um arquivo PDF
                </div>
              </>
            )}
          </label>

          <div className="space-y-2">
            <Label>Nome do quiz</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Cardiologia - Arritmias"
            />
          </div>

          <div className="space-y-2">
            <Label>Grande área (grupo)</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem grupo</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
                <SelectItem value="__new">+ Criar novo grupo</SelectItem>
              </SelectContent>
            </Select>
            {groupId === "__new" && (
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Ex: Cardiologia"
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                />
                <Plus className="w-5 h-5 text-muted-foreground self-center" />
              </div>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!file || !name || loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...
              </>
            ) : (
              "Importar e iniciar quiz"
            )}
          </Button>

          {preview && (
            <p className="text-sm text-success">
              {preview.count} questões detectadas.
            </p>
          )}
        </Card>

        <Card className="p-5 bg-muted/30">
          <div className="text-sm space-y-2">
            <div className="font-medium">Dica de formato</div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Funciona melhor com PDFs no formato:
              <br />
              <code className="text-foreground">1. Enunciado... a) opção b) opção c) opção d) opção e) opção</code>
              <br />
              E ao final, um gabarito como:
              <br />
              <code className="text-foreground">Gabarito: 1-A 2-B 3-C ...</code>
            </p>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
