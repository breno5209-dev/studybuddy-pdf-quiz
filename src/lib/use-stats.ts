import { useStore } from "@/lib/store";

export function useStats() {
  const responses = useStore((s) => s.responses);
  const groups = useStore((s) => s.groups);
  const quizzes = useStore((s) => s.quizzes);

  const total = responses.length;
  const correct = responses.filter((r) => r.correct).length;
  const accuracy = total ? correct / total : 0;

  const byGroup = groups.map((g) => {
    const gResp = responses.filter((r) => r.groupId === g.id);
    const c = gResp.filter((r) => r.correct).length;
    return {
      group: g,
      total: gResp.length,
      correct: c,
      accuracy: gResp.length ? c / gResp.length : 0,
    };
  });

  const ungroupedResp = responses.filter((r) => !r.groupId);
  if (ungroupedResp.length) {
    byGroup.push({
      group: { id: "none", name: "Sem grupo", color: "oklch(0.6 0.02 230)" },
      total: ungroupedResp.length,
      correct: ungroupedResp.filter((r) => r.correct).length,
      accuracy:
        ungroupedResp.filter((r) => r.correct).length / ungroupedResp.length,
    });
  }

  const weakAreas = [...byGroup]
    .filter((g) => g.total >= 3)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  return { total, correct, accuracy, byGroup, weakAreas, quizCount: quizzes.length };
}
