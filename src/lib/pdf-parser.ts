import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { Question, QuestionImage } from "./store";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const uid = () => Math.random().toString(36).slice(2, 10);

type TextSpan = { str: string; x: number; y: number; height: number };
type ImageRegion = { top: number; bottom: number };

type PageInfo = {
  pageNum: number;
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
  spans: TextSpan[];
  imageRegions: ImageRegion[];
};

export type ExtractedPdf = { text: string; pages: PageInfo[] };

const RENDER_SCALE = 1.4;

export async function extractPdf(file: File): Promise<ExtractedPdf> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages: PageInfo[] = [];
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: RENDER_SCALE });

    // Text spans with viewport positions
    const content = await page.getTextContent();
    const spans: TextSpan[] = [];
    let pageText = "";
    for (const it of content.items as any[]) {
      if (!("str" in it)) continue;
      const tr = it.transform as number[];
      const pt = pdfjsLib.Util.applyTransform(
        [tr[4], tr[5]],
        viewport.transform,
      ) as unknown as number[];
      const x = pt[0];
      const y = pt[1];
      const height = Math.abs(tr[3]) * RENDER_SCALE;
      spans.push({ str: it.str, x, y: y - height, height });
      pageText += it.str;
      pageText += it.hasEOL ? "\n" : " ";
    }
    fullText += "\n" + pageText + "\n";

    // Image regions via operator list
    const opList = await page.getOperatorList();
    const OPS = pdfjsLib.OPS;
    const imageRegions: ImageRegion[] = [];
    const stack: number[][] = [];
    let ctm: number[] = viewport.transform.slice();
    for (let k = 0; k < opList.fnArray.length; k++) {
      const fn = opList.fnArray[k];
      const args = opList.argsArray[k];
      if (fn === OPS.save) stack.push(ctm.slice());
      else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
      else if (fn === OPS.transform) {
        ctm = pdfjsLib.Util.transform(ctm, args as number[]);
      } else if (
        fn === OPS.paintImageXObject ||
        fn === OPS.paintInlineImageXObject ||
        fn === OPS.paintImageMaskXObject
      ) {
        const corners = [
          pdfjsLib.Util.applyTransform([0, 0], ctm) as unknown as number[],
          pdfjsLib.Util.applyTransform([1, 0], ctm) as unknown as number[],
          pdfjsLib.Util.applyTransform([0, 1], ctm) as unknown as number[],
          pdfjsLib.Util.applyTransform([1, 1], ctm) as unknown as number[],
        ];
        const ys = corners.map((c) => c[1]);
        const top = Math.min(...ys);
        const bottom = Math.max(...ys);
        if (bottom - top > 8) imageRegions.push({ top, bottom });
      }
    }

    // Render page to canvas (kept in-memory for cropping later)
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    pages.push({
      pageNum: i,
      width: viewport.width,
      height: viewport.height,
      canvas,
      spans,
      imageRegions,
    });
  }

  return { text: fullText, pages };
}

const NOISE_RE =
  /^(?:\s*\d[\d\s]*|.*medicina livre.*|.*livremedicina.*|.*t\.me\/.*|@\S+)\s*$/i;
const isNoise = (l: string) => !l.trim() || NOISE_RE.test(l);

export function parseQuestions(extracted: ExtractedPdf): Question[] {
  const rawText = extracted.text;
  const keyHeader = /(?:Gabarito|Respostas|Answer\s*Key)\s*:?/i;
  const keyMatch = rawText.match(keyHeader);
  const body = keyMatch ? rawText.slice(0, keyMatch.index) : rawText;
  const keyRaw = keyMatch ? rawText.slice(keyMatch.index! + keyMatch[0].length) : "";

  const answerMap: Record<number, string> = {};
  const keyRegex = /(\d{1,3})\s*[\)\-\.\:]?\s+([A-Ea-e])(?![A-Za-z])/g;
  let m: RegExpExecArray | null;
  while ((m = keyRegex.exec(keyRaw)) !== null) {
    const n = parseInt(m[1], 10);
    if (!answerMap[n]) answerMap[n] = m[2].toUpperCase();
  }

  const qStarts: { num: number; idx: number; headerLen: number }[] = [];
  const qRe =
    /(?:^|\n|\s)(?:Quest[ãa]o\s+0*(\d{1,3})|0*(\d{1,3})\s*[\)\.\-]\s+)/gi;
  while ((m = qRe.exec(body)) !== null) {
    const num = parseInt(m[1] ?? m[2], 10);
    if (!num) continue;
    qStarts.push({ num, idx: m.index + m[0].length, headerLen: m[0].length });
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
        if (!isNoise(line) && opts.length > 0) {
          opts[opts.length - 1].text += " " + line.trim();
        }
      } else {
        if (!isNoise(line)) statementLines.push(line);
      }
    }

    const cleanOpts = opts
      .map((o) => ({ letter: o.letter, text: o.text.replace(/\s+/g, " ").trim() }))
      .filter((o) => o.text.length > 0);
    const statement = statementLines.join(" ").replace(/\s+/g, " ").trim();
    const num = qStarts[i].num;
    const correct = answerMap[num];
    if (cleanOpts.length < 2) continue;
    if (statement.length < 5) continue;
    if (!correct) continue;

    const nextNum = i + 1 < qStarts.length ? qStarts[i + 1].num : null;
    const images = findImagesForQuestion(extracted, num, nextNum);

    questions.push({
      id: uid(),
      number: num,
      statement,
      options: cleanOpts,
      correctAnswer: correct,
      images: images.length > 0 ? images : undefined,
    });
  }
  return questions;
}

function findImagesForQuestion(
  extracted: ExtractedPdf,
  num: number,
  nextNum: number | null,
): QuestionImage[] {
  const headerPos = locateHeader(extracted, num);
  if (!headerPos) return [];
  const nextPos = nextNum != null ? locateHeader(extracted, nextNum) : null;
  const results: QuestionImage[] = [];

  for (const page of extracted.pages) {
    if (page.pageNum < headerPos.pageNum) continue;
    if (nextPos && page.pageNum > nextPos.pageNum) continue;
    const top = page.pageNum === headerPos.pageNum ? headerPos.y : 0;
    const bottom =
      nextPos && page.pageNum === nextPos.pageNum ? nextPos.y : page.height;

    // Merge nearby image regions in [top, bottom]
    const inRange = page.imageRegions
      .filter((r) => Math.min(r.bottom, bottom) - Math.max(r.top, top) > 10)
      .map((r) => ({
        top: Math.max(top, r.top - 4),
        bottom: Math.min(bottom, r.bottom + 4),
      }))
      .sort((a, b) => a.top - b.top);

    const merged: ImageRegion[] = [];
    for (const r of inRange) {
      const last = merged[merged.length - 1];
      if (last && r.top - last.bottom < 20) last.bottom = Math.max(last.bottom, r.bottom);
      else merged.push({ ...r });
    }

    for (const r of merged) {
      const cropped = cropFromCanvas(page, r.top, r.bottom);
      if (cropped) results.push(cropped);
    }
  }
  return results;
}

function locateHeader(
  extracted: ExtractedPdf,
  num: number,
): { pageNum: number; y: number } | null {
  const targets = [
    `questão ${num}`,
    `questao ${num}`,
    `questão 0${num}`,
    `questao 0${num}`,
    `${num}.`,
    `${num})`,
  ];
  for (const page of extracted.pages) {
    for (let i = 0; i < page.spans.length; i++) {
      const s = page.spans[i].str.toLowerCase().trim();
      if (!s) continue;
      const combo = (s + " " + (page.spans[i + 1]?.str ?? ""))
        .toLowerCase()
        .trim();
      if (targets.some((t) => s === t || s.startsWith(t) || combo.startsWith(t))) {
        return { pageNum: page.pageNum, y: page.spans[i].y };
      }
    }
  }
  return null;
}

function cropFromCanvas(
  page: PageInfo,
  top: number,
  bottom: number,
): QuestionImage | null {
  const h = Math.ceil(bottom - top);
  if (h < 12) return null;
  // Find left/right via examining non-white pixels could be heavy; just use full width
  const out = document.createElement("canvas");
  out.width = page.width;
  out.height = h;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(
    page.canvas,
    0,
    Math.max(0, Math.floor(top)),
    page.width,
    h,
    0,
    0,
    page.width,
    h,
  );
  const dataUrl = out.toDataURL("image/jpeg", 0.78);
  return { dataUrl, width: page.width, height: h };
}
