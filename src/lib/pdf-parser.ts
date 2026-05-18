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
      if (!it || !("str" in it)) continue;
      const tr = it.transform as number[] | undefined;
      if (!tr || tr.length < 6) {
        pageText += (it.str ?? "") + (it.hasEOL ? "\n" : " ");
        continue;
      }
      let x = 0;
      let y = 0;
      try {
        const [vx, vy] = (viewport as any).convertToViewportPoint(tr[4], tr[5]);
        x = vx;
        y = vy;
      } catch {
        x = tr[4] * RENDER_SCALE;
        y = (viewport.height ?? 0) - tr[5] * RENDER_SCALE;
      }
      const height = Math.abs(tr[3] ?? 12) * RENDER_SCALE;
      spans.push({ str: it.str, x, y: y - height, height });
      pageText += it.str;
      pageText += it.hasEOL ? "\n" : " ";
    }
    fullText += "\n" + pageText + "\n";

    // Image regions via operator list (best-effort; pdfjs API may vary by version)
    const imageRegions: ImageRegion[] = [];
    try {
      const opList = await page.getOperatorList();
      const OPS = (pdfjsLib as any).OPS;
      const Util = (pdfjsLib as any).Util;
      if (opList && OPS && Util) {
        const stack: number[][] = [];
        let ctm: number[] = (viewport.transform as number[]).slice();
        for (let k = 0; k < opList.fnArray.length; k++) {
          const fn = opList.fnArray[k];
          const args = opList.argsArray[k];
          if (fn === OPS.save) stack.push(ctm.slice());
          else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
          else if (fn === OPS.transform) {
            ctm = Util.transform(ctm, args as number[]);
          } else if (
            fn === OPS.paintImageXObject ||
            fn === OPS.paintInlineImageXObject ||
            fn === OPS.paintImageMaskXObject
          ) {
            const corners = [
              Util.applyTransform([0, 0], ctm) as number[],
              Util.applyTransform([1, 0], ctm) as number[],
              Util.applyTransform([0, 1], ctm) as number[],
              Util.applyTransform([1, 1], ctm) as number[],
            ];
            const ys = corners.map((c) => c[1]);
            const top = Math.min(...ys);
            const bottom = Math.max(...ys);
            if (bottom - top > 8) imageRegions.push({ top, bottom });
          }
        }
      }
    } catch (e) {
      console.warn("operator list parse failed", e);
    }

    // Render page to canvas (kept in-memory for cropping later)
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    try {
      await (page as any).render({ canvasContext: ctx, viewport, canvas }).promise;
    } catch {
      await (page as any).render({ canvasContext: ctx, viewport }).promise;
    }

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
  /^(?:\s*\d[\d\s]*|.*medicina livre.*|.*livremedicina.*|.*venda\s*proibida.*|.*t\.me\/.*|@\S+)\s*$/i;
const isNoise = (l: string) => !l.trim() || NOISE_RE.test(l);

// Strip inline noise fragments that appear mid-line
function stripInlineNoise(s: string): string {
  let out = s;
  out = out.replace(/medicina\s+livre/gi, " ");
  out = out.replace(/livremedicina/gi, " ");
  out = out.replace(/venda\s*proibida/gi, " ");
  // Footnote on last alternative: "Essa questão possui comentário no site ..."
  // Handles spaced/garbled variants like "po ssui", "co me ntário", trailing digits.
  out = out.replace(
    /\.?\s*Essa\s+quest[ãa]o\s+.{0,40}?coment[áa]?\s*[áa]?rio.*$/gi,
    "",
  );
  return out.replace(/\s{2,}/g, " ").trim();
}

// Detect where the actual clinical case starts, skipping the topic/classification header.
const CASE_START_RE =
  /\b(?:Uma?\s+(?:mulher|homem|paciente|crian[çc]a|lactente|gestante|idos[oa]|adolescente|rec[ée]m[-\s]?nascido)|Mulher\s+de\s+\d|Homem\s+de\s+\d|Paciente\s+(?:de\s+\d|do\s+sexo|com\s+|masculin|feminin)|Crian[çc]a\s+de\s+\d|Lactente\s+de\s+\d|Gestante\s+de\s+\d|Rec[ée]m[-\s]?nascid[oa]|RN\s+de\s+\d|Adolescente\s+de\s+\d|Idos[oa]\s+de\s+\d|Considere\s+(?:o|a|as|os)|Analise\s+(?:o|a|as|os)|Assinale|Em\s+rela[çc][ãa]o\s+a|A\s+respeito\s+(?:de|do|da)|Sobre\s+(?:a|o|as|os)\s+|No\s+que\s+(?:se\s+refere|diz\s+respeito)|Qual\s+(?:das|dos|a|o)|Quanto\s+(?:a|ao|à))/;

function trimClassificationHeader(s: string): string {
  const m = s.match(CASE_START_RE);
  if (m && m.index !== undefined && m.index > 0 && m.index < s.length * 0.7) {
    return s.slice(m.index).trim();
  }
  return s;
}

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
      .map((o) => ({
        letter: o.letter,
        text: stripInlineNoise(o.text.replace(/\s+/g, " ").trim()),
      }))
      .filter((o) => o.text.length > 0);
    let statement = statementLines.join(" ").replace(/\s+/g, " ").trim();
    statement = stripInlineNoise(statement);
    statement = trimClassificationHeader(statement);
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

    const bands = detectImageBandsByPixels(page, top, bottom);
    for (const b of bands) {
      const cropped = cropBand(page, b.top, b.bottom, b.left, b.right);
      if (cropped) results.push(cropped);
    }
  }
  return results;
}

type Band = { top: number; bottom: number; left: number; right: number };

function detectImageBandsByPixels(
  page: PageInfo,
  top: number,
  bottom: number,
): Band[] {
  const t = Math.max(0, Math.floor(top));
  const b = Math.min(page.height, Math.ceil(bottom));
  if (b - t < 20) return [];

  // Build a row mask of text coverage from spans
  const textRow = new Uint8Array(page.height);
  for (const s of page.spans) {
    const y0 = Math.max(0, Math.floor(s.y - 1));
    const y1 = Math.min(page.height, Math.ceil(s.y + s.height + 1));
    for (let y = y0; y < y1; y++) textRow[y] = 1;
  }

  // Read canvas pixels for the region
  let img: ImageData;
  try {
    const ctx = page.canvas.getContext("2d")!;
    img = ctx.getImageData(0, t, page.width, b - t);
  } catch {
    return [];
  }
  const W = page.width;
  const H = b - t;
  const data = img.data;

  // Per-row non-white pixel count (excluding text rows)
  const rowDark = new Float32Array(H);
  const WHITE_THRESH = 240; // pixels darker than this count as content
  for (let y = 0; y < H; y++) {
    if (textRow[t + y]) continue; // skip text rows entirely
    let count = 0;
    const rowStart = y * W * 4;
    for (let x = 0; x < W; x++) {
      const i = rowStart + x * 4;
      const r = data[i], g = data[i + 1], bl = data[i + 2];
      const lum = (r + g + bl) / 3;
      if (lum < WHITE_THRESH) count++;
    }
    rowDark[y] = count;
  }

  // Threshold: a row is "image" if at least 4% of width has dark pixels
  const minRowPx = Math.max(8, Math.floor(W * 0.04));
  const isImg = new Uint8Array(H);
  for (let y = 0; y < H; y++) isImg[y] = rowDark[y] >= minRowPx ? 1 : 0;

  // Group consecutive image rows into bands (allow small gaps up to 12px)
  const bands: Band[] = [];
  let y = 0;
  while (y < H) {
    if (!isImg[y]) { y++; continue; }
    let start = y;
    let end = y;
    while (y < H) {
      if (isImg[y]) { end = y; y++; }
      else {
        // peek for gap
        let gap = 0;
        let j = y;
        while (j < H && !isImg[j] && gap < 12) { gap++; j++; }
        if (j < H && isImg[j]) { y = j; }
        else break;
      }
    }
    const bandH = end - start + 1;
    if (bandH >= 30) {
      // compute left/right bounds across the band
      let left = W, right = 0;
      for (let yy = start; yy <= end; yy += 2) {
        const rowStart = yy * W * 4;
        for (let x = 0; x < W; x++) {
          const i = rowStart + x * 4;
          const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (lum < WHITE_THRESH) {
            if (x < left) left = x;
            if (x > right) right = x;
          }
        }
      }
      if (right > left + 30) {
        const pad = 6;
        bands.push({
          top: t + Math.max(0, start - pad),
          bottom: t + Math.min(H - 1, end + pad),
          left: Math.max(0, left - pad),
          right: Math.min(W - 1, right + pad),
        });
      }
    }
  }
  return bands;
}

function cropBand(
  page: PageInfo,
  top: number,
  bottom: number,
  left: number,
  right: number,
): QuestionImage | null {
  const w = Math.ceil(right - left);
  const h = Math.ceil(bottom - top);
  if (w < 30 || h < 20) return null;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(
    page.canvas,
    Math.max(0, Math.floor(left)),
    Math.max(0, Math.floor(top)),
    w,
    h,
    0,
    0,
    w,
    h,
  );
  return { dataUrl: out.toDataURL("image/jpeg", 0.82), width: w, height: h };
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
