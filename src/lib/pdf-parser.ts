import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { Question } from "./store";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Extract text from PDF preserving line breaks (uses item.hasEOL when present).
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let pageText = "";
    for (const it of content.items as any[]) {
      if ("str" in it) pageText += it.str;
      if (it.hasEOL) pageText += "\n";
      else pageText += " ";
    }
    text += "\n" + pageText + "\n";
  }
  return text;
}

const NOISE_RE =
  /^(?:\s*\d[\d\s]*|.*medicina livre.*|.*livremedicina.*|.*t\.me\/.*|@\S+)\s*$/i;

const isNoise = (l: string) => !l.trim() || NOISE_RE.test(l);

/**
 * Parser tolerante a múltiplos formatos de PDF de questões.
 *
 * Reconhece questões iniciadas por:
 *   - "Questão 1", "Questão 01", "QUESTÃO 1"
 *   - "1.", "1)", "01 -"
 *
 * Reconhece alternativas em linhas começando por A/B/C/D/E, com ou sem
 * separador (`A`, `A)`, `A.`, `A -`).
 *
 * Reconhece o gabarito após "Gabarito" / "Respostas" / "Answer Key" como pares
 * número-letra separados por espaços, hífens, parênteses, dois-pontos etc.
 */
export function parseQuestionsAndKey(rawText: string): Question[] {
  // 1. Separar gabarito do corpo
  const keyHeader = /(?:Gabarito|Respostas|Answer\s*Key)\s*:?/i;
  const keyMatch = rawText.match(keyHeader);
  const body = keyMatch ? rawText.slice(0, keyMatch.index) : rawText;
  const keyRaw = keyMatch ? rawText.slice(keyMatch.index! + keyMatch[0].length) : "";

  // 2. Mapear gabarito (pares número + letra com qualquer separador/whitespace)
  const answerMap: Record<number, string> = {};
  const keyRegex = /(\d{1,3})\s*[\)\-\.\:]?\s+([A-Ea-e])(?![A-Za-z])/g;
  let m: RegExpExecArray | null;
  while ((m = keyRegex.exec(keyRaw)) !== null) {
    const n = parseInt(m[1], 10);
    if (!answerMap[n]) answerMap[n] = m[2].toUpperCase();
  }

  // 3. Localizar inícios de questões
  const qStarts: { num: number; idx: number; headerLen: number }[] = [];
  const qRe =
    /(?:^|\n|\s)(?:Quest[ãa]o\s+0*(\d{1,3})|0*(\d{1,3})\s*[\)\.\-]\s+)/gi;
  while ((m = qRe.exec(body)) !== null) {
    const num = parseInt(m[1] ?? m[2], 10);
    if (!num) continue;
    qStarts.push({
      num,
      idx: m.index + m[0].length,
      headerLen: m[0].length,
    });
  }

  if (qStarts.length === 0) return [];

  const questions: Question[] = [];

  for (let i = 0; i < qStarts.length; i++) {
    const start = qStarts[i].idx;
    const end =
      i + 1 < qStarts.length
        ? qStarts[i + 1].idx - qStarts[i + 1].headerLen
        : body.length;
    const chunk = body.slice(start, end);

    // Quebra em linhas
    const lines = chunk.split(/\r?\n/);
    const opts: { letter: string; text: string }[] = [];
    const statementLines: string[] = [];
    let inOptions = false;

    const optLineRe = /^\s*([A-Ea-e])\s*[\)\.\-]?\s+(.{2,})$/;

    for (const rawLine of lines) {
      const line = rawLine.replace(/\s+$/, "");
      const om = line.match(optLineRe);
      if (om) {
        const letter = om[1].toUpperCase();
        const expected = String.fromCharCode(65 + opts.length);
        if (letter === expected) {
          opts.push({ letter, text: om[2].trim() });
          inOptions = true;
          continue;
        }
      }
      if (inOptions) {
        // Continuação da última alternativa (ignorando rodapés)
        if (!isNoise(line) && opts.length > 0) {
          opts[opts.length - 1].text += " " + line.trim();
        }
      } else {
        if (!isNoise(line)) statementLines.push(line);
      }
    }

    // Limpar alternativas: trim e descartar texto vazio
    const cleanOpts = opts
      .map((o) => ({ letter: o.letter, text: o.text.replace(/\s+/g, " ").trim() }))
      .filter((o) => o.text.length > 0);

    const statement = statementLines.join(" ").replace(/\s+/g, " ").trim();
    const num = qStarts[i].num;
    const correct = answerMap[num];

    if (cleanOpts.length < 2) continue;
    if (statement.length < 5) continue;
    if (!correct) continue; // sem gabarito não há como pontuar

    questions.push({
      id: uid(),
      number: num,
      statement,
      options: cleanOpts,
      correctAnswer: correct,
    });
  }

  return questions;
}
