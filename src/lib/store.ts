import { create } from "zustand";
import { persist } from "zustand/middleware";

export type QuestionImage = {
  dataUrl: string;
  width: number;
  height: number;
};

export type Question = {
  id: string;
  number: number;
  statement: string;
  options: { letter: string; text: string }[];
  correctAnswer: string; // letter
  images?: QuestionImage[];
};

export type Quiz = {
  id: string;
  name: string;
  groupId: string | null;
  createdAt: number;
  questions: Question[];
};

export type Response = {
  id: string;
  quizId: string;
  questionId: string;
  selected: string;
  correct: boolean;
  timestamp: number;
  groupId: string | null;
};

export type Group = {
  id: string;
  name: string;
  color: string;
};

export type Reminder = {
  id: string;
  title: string;
  date: string; // ISO
  groupId: string | null;
  done: boolean;
};

type State = {
  groups: Group[];
  quizzes: Quiz[];
  responses: Response[];
  notes: Record<string, string>; // questionId -> text
  progress: Record<string, number>; // quizId -> last index reached
  reminders: Reminder[];
  darkMode: boolean;

  toggleDark: () => void;
  addGroup: (name: string, color?: string) => Group;
  removeGroup: (id: string) => void;
  renameGroup: (id: string, name: string) => void;

  addQuiz: (q: Omit<Quiz, "id" | "createdAt">) => Quiz;
  removeQuiz: (id: string) => void;
  assignQuizToGroup: (quizId: string, groupId: string | null) => void;

  recordResponse: (r: Omit<Response, "id" | "timestamp">) => void;
  setProgress: (quizId: string, index: number) => void;
  resetProgress: (quizId: string) => void;

  setNote: (questionId: string, text: string) => void;

  addReminder: (r: Omit<Reminder, "id" | "done">) => void;
  toggleReminder: (id: string) => void;
  removeReminder: (id: string) => void;
};

const palette = [
  "oklch(0.7 0.15 200)",
  "oklch(0.7 0.17 155)",
  "oklch(0.78 0.15 80)",
  "oklch(0.65 0.22 25)",
  "oklch(0.7 0.18 290)",
  "oklch(0.7 0.18 350)",
];

const uid = () => Math.random().toString(36).slice(2, 10);

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      groups: [],
      quizzes: [],
      responses: [],
      notes: {},
      progress: {},
      reminders: [],
      darkMode: false,

      toggleDark: () => {
        const next = !get().darkMode;
        set({ darkMode: next });
        if (typeof document !== "undefined") {
          document.documentElement.classList.toggle("dark", next);
        }
      },

      addGroup: (name, color) => {
        const g: Group = {
          id: uid(),
          name,
          color: color ?? palette[get().groups.length % palette.length],
        };
        set({ groups: [...get().groups, g] });
        return g;
      },
      removeGroup: (id) =>
        set({
          groups: get().groups.filter((g) => g.id !== id),
          quizzes: get().quizzes.map((q) =>
            q.groupId === id ? { ...q, groupId: null } : q,
          ),
        }),
      renameGroup: (id, name) =>
        set({
          groups: get().groups.map((g) => (g.id === id ? { ...g, name } : g)),
        }),

      addQuiz: (q) => {
        const quiz: Quiz = { ...q, id: uid(), createdAt: Date.now() };
        set({ quizzes: [...get().quizzes, quiz] });
        return quiz;
      },
      removeQuiz: (id) =>
        set({
          quizzes: get().quizzes.filter((q) => q.id !== id),
          responses: get().responses.filter((r) => r.quizId !== id),
        }),
      assignQuizToGroup: (quizId, groupId) =>
        set({
          quizzes: get().quizzes.map((q) =>
            q.id === quizId ? { ...q, groupId } : q,
          ),
        }),

      recordResponse: (r) =>
        set({
          responses: [
            ...get().responses,
            { ...r, id: uid(), timestamp: Date.now() },
          ],
        }),
      setProgress: (quizId, index) =>
        set({ progress: { ...get().progress, [quizId]: index } }),
      resetProgress: (quizId) => {
        const p = { ...get().progress };
        delete p[quizId];
        set({ progress: p });
      },

      setNote: (questionId, text) =>
        set({ notes: { ...get().notes, [questionId]: text } }),

      addReminder: (r) =>
        set({
          reminders: [
            ...get().reminders,
            { ...r, id: uid(), done: false },
          ],
        }),
      toggleReminder: (id) =>
        set({
          reminders: get().reminders.map((r) =>
            r.id === id ? { ...r, done: !r.done } : r,
          ),
        }),
      removeReminder: (id) =>
        set({ reminders: get().reminders.filter((r) => r.id !== id) }),
    }),
    {
      name: "medquiz-store",
      onRehydrateStorage: () => (state) => {
        if (state?.darkMode && typeof document !== "undefined") {
          document.documentElement.classList.add("dark");
        }
      },
    },
  ),
);

export function getQuizStats(quizId: string) {
  const responses = useStore.getState().responses.filter((r) => r.quizId === quizId);
  const total = responses.length;
  const correct = responses.filter((r) => r.correct).length;
  return { total, correct, accuracy: total ? correct / total : 0 };
}
