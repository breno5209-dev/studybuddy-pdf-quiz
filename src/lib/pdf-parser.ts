import * as pdfjsLib from "pdfjs-dist";
// Use the bundled worker
// @ts-expect-error - vite worker import
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { Question } from "./store";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const uid = () => Math.random().toString(36).slice(2, 10);

export async function extractTextFromPdf(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it: any) => ("str" in it ? it.str : ""))
      .join(" ");
    text += "\n" + pageText;
  }
  return text;
}

/**
 * Heuristic parser: finds questions of pattern
 *   "1." or "1)" or "Questão 1" with options a) b) c) d) e)
 * and an answer key section at the end (Gabarito / Respostas) like
 *   "1-A 2-B 3-C" or "1) A 2) B"
 */
export function parseQuestionsAndKey(rawText: string): Question[] {
  const text = rawText.replace(/\s+/g, " ").trim();

  // Find answer key section
  const keyMatch = text.match(
    /(?:Gabarito|Respostas|Answer Key|GABARITO|RESPOSTAS)[\s:.\-]*([\s\S]+)$/i,
  );
  const keyRaw = keyMatch ? keyMatch[1] : "";
  const body = keyMatch ? text.slice(0, keyMatch.index) : text;

  // Parse answer key: capture pairs like 1-A, 1) A, 1: A, 1.A
  const answerMap: Record<number, string> = {};
  const keyRegex = /(\d{1,3})\s*[\)\-\.\:]\s*([A-Ea-e])\b/g;
  let m: RegExpExecArray | null;
  while ((m = keyRegex.exec(keyRaw)) !== null) {
    answerMap[parseInt(m[1], 10)] = m[2].toUpperCase();
  }

  // Split body into questions. Match a number followed by ) or . as start of question.
  const qRegex = /(?:^|\s)(?:Quest[ãa]o\s+)?(\d{1,3})\s*[\)\.\-]\s+/g;
  const indexes: { num: number; idx: number }[] = [];
  while ((m = qRegex.exec(body)) !== null) {
    indexes.push({ num: parseInt(m[1], 10), idx: m.index + m[0].length });
  }

  const questions: Question[] = [];
  for (let i = 0; i < indexes.length; i++) {
    const start = indexes[i].idx;
    const end = i + 1 < indexes.length ? indexes[i + 1].idx - String(indexes[i + 1].num).length - 4 : body.length;
    const chunk = body.slice(start, end).trim();

    // Split chunk by option markers a) b) c) d) e)
    const optRegex = /([a-eA-E])\s*[\)\.\-]\s+/g;
    const optMatches: { letter: string; idx: number }[] = [];
    let om: RegExpExecArray | null;
    while ((om = optRegex.exec(chunk)) !== null) {
      optMatches.push({ letter: om[1].toUpperCase(), idx: om.index });
    }

    if (optMatches.length < 2) continue;

    const statement = chunk.slice(0, optMatches[0].idx).trim();
    const options = optMatches.map((opt, j) => {
      const optEnd =
        j + 1 < optMatches.length
          ? optMatches[j + 1].idx
          : chunk.length;
      const text = chunk
        .slice(opt.idx, optEnd)
        .replace(/^[a-eA-E]\s*[\)\.\-]\s+/, "")
        .trim();
      return { letter: opt.letter, text };
    });

    // Dedup letters (keep first)
    const seen = new Set<string>();
    const cleanOptions = options.filter((o) => {
      if (seen.has(o.letter)) return false;
      seen.add(o.letter);
      return true;
    });

    const num = indexes[i].num;
    const correct = answerMap[num];
    if (!correct || !statement || statement.length < 5) continue;

    questions.push({
      id: uid(),
      number: num,
      statement,
      options: cleanOptions,
      correctAnswer: correct,
    });
  }

  return questions;
}
