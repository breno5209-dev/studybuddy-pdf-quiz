import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { Question } from "./store";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const uid = () => Math.random().toString(36).slice(2, 10);

type TextSpan = {
  str: string;
  // viewport coords (CSS pixels at scale 1.5)
  x: number;
  y: number; // top of glyph
  height: number;
};

type PageInfo = {
  pageNum: number;
  width: number;
  height: number;
  imageDataUrl: string; // full page rendered (jpeg)
  spans: TextSpan[];
  imageRegions: { top: number; bottom: number }[]; // viewport coords
};

export type ExtractedPdf = {
  text: string;
  pages: PageInfo[];
};

const RENDER_SCALE = 1.4;

/** Extract text + render pages + locate embedded images. */
export async function extractPdf(file: File): Promise<ExtractedPdf> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages: PageInfo[] = [];
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: RENDER_SCALE });

    // 1. Text content with positions
    const content = await page.getTextContent();
    const spans: TextSpan[] = [];
    let pageText = "";
    for (const it of content.items as any[]) {
      if (!("str" in it)) continue;
      // item.transform = [a,b,c,d,e,f]; baseline at (e,f) in PDF space
      const tr = it.transform as number[];
      const [x, y] = pdfjsLib.Util.transform(viewport.transform, [
        tr[4],
        tr[5],
      ]) as [number, number];
      const height = Math.abs(tr[3]) * RENDER_SCALE;
      spans.push({
        str: it.str,
        x,
        y: y - height, // top
        height,
      });
      pageText += it.str;
      if (it.hasEOL) pageText += "\n";
      else pageText += " ";
    }
    fullText += "\n" + pageText + "\n";

    // 2. Find embedded image regions via operator list
    const opList = await page.getOperatorList();
    const OPS = pdfjsLib.OPS;
    const imageRegions: { top: number; bottom: number }[] = [];
    // Track current transform stack
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
        fn === OPS.paintImageMaskXObject ||
        fn === OPS.paintJpegXObject
      ) {
        // Image drawn from (0,0) to (1,1) in its own space, transformed by ctm
        const corners = [
          pdfjsLib.Util.applyTransform([0, 0], ctm),
          pdfjsLib.Util.applyTransform([1, 0], ctm),
          pdfjsLib.Util.applyTransform([0, 1], ctm),
          pdfjsLib.Util.applyTransform([1, 1], ctm),
        ];
        const ys = corners.map((c) => c[1]);
        const top = Math.min(...ys);
        const bottom = Math.max(...ys);
        if (bottom - top > 8) imageRegions.push({ top, bottom });
      }
    }

    // 3. Render page to canvas → JPEG dataURL
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    // White background to avoid transparent areas as black on jpeg
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.78);

    pages.push({
      pageNum: i,
      width: viewport.width,
      height: viewport.height,
      imageDataUrl,
      spans,
      imageRegions,
    });
  }

  return { text: fullText, pages };
}

const NOISE_RE =
  /^(?:\s*\d[\d\s]*|.*medicina livre.*|.*livremedicina.*|.*t\.me\/.*|@\S+)\s*$/i;

const isNoise = (l: string) => !l.trim() || NOISE_RE.test(l);

/**
 * Parse questions from extracted PDF (text + pages with positions/images).
 * Each question may include cropped image data when it contains an embedded
 * image inside its vertical range on the page.
 */
export function parseQuestions(extracted: ExtractedPdf): Question[] {
  const rawText = extracted.text;

  // 1. Separate answer key from body
  const keyHeader = /(?:Gabarito|Respostas|Answer\s*Key)\s*:?/i;
  const keyMatch = rawText.match(keyHeader);
  const body = keyMatch ? rawText.slice(0, keyMatch.index) : rawText;
  const keyRaw = keyMatch ? rawText.slice(keyMatch.index! + keyMatch[0].length) : "";

  // 2. Parse answer key
  const answerMap: Record<number, string> = {};
  const keyRegex = /(\d{1,3})\s*[\)\-\.\:]?\s+([A-Ea-e])(?![A-Za-z])/g;
  let m: RegExpExecArray | null;
  while ((m = keyRegex.exec(keyRaw)) !== null) {
    const n = parseInt(m[1], 10);
    if (!answerMap[n]) answerMap[n] = m[2].toUpperCase();
  }

  // 3. Find question starts in body text
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

    // 4. Try to associate images by locating the question header on a page
    const images = findImagesForQuestion(extracted, num, i + 1 < qStarts.length ? qStarts[i + 1].num : null);

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

/**
 * For a given question number, locate it on the rendered pages by searching
 * spans for a header like "Questão N" or "N.", then return cropped images
 * for any image regions falling between this question and the next.
 */
function findImagesForQuestion(
  extracted: ExtractedPdf,
  num: number,
  nextNum: number | null,
): { dataUrl: string; ratio: number }[] {
  // Find page + y for header of question `num` and `nextNum`
  const headerPos = locateHeader(extracted, num);
  if (!headerPos) return [];
  const nextPos = nextNum != null ? locateHeader(extracted, nextNum) : null;

  const results: { dataUrl: string; ratio: number }[] = [];

  for (const page of extracted.pages) {
    if (page.pageNum < headerPos.pageNum) continue;
    if (nextPos && page.pageNum > nextPos.pageNum) continue;

    const top =
      page.pageNum === headerPos.pageNum ? headerPos.y : 0;
    const bottom =
      nextPos && page.pageNum === nextPos.pageNum ? nextPos.y : page.height;

    for (const region of page.imageRegions) {
      const overlap =
        Math.min(region.bottom, bottom) - Math.max(region.top, top);
      if (overlap > 10) {
        const cropped = cropImage(
          page,
          Math.max(0, region.top - 4),
          Math.min(page.height, region.bottom + 4),
        );
        if (cropped) results.push(cropped);
      }
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
    // Build a flat lower-cased running string of spans with their y positions
    for (let i = 0; i < page.spans.length; i++) {
      const s = page.spans[i].str.toLowerCase().trim();
      if (!s) continue;
      // Try multi-span concat for "Questão" + " " + number
      const combo = (s + " " + (page.spans[i + 1]?.str ?? "")).toLowerCase().trim();
      if (
        targets.some(
          (t) => s === t || s.startsWith(t) || combo.startsWith(t),
        )
      ) {
        return { pageNum: page.pageNum, y: page.spans[i].y };
      }
    }
  }
  return null;
}

function cropImage(
  page: PageInfo,
  top: number,
  bottom: number,
): { dataUrl: string; ratio: number } | null {
  const h = bottom - top;
  if (h < 12) return null;
  const img = new Image();
  img.src = page.imageDataUrl;
  // The image is already loaded as data URL — but synchronously drawing requires
  // it to be decoded. Use createImageBitmap fallback via a hidden canvas approach:
  // We'll use drawImage on a fresh image element by waiting in caller? Not async here.
  // Simpler: re-render via a temporary canvas using the original canvas data URL.
  const canvas = document.createElement("canvas");
  canvas.width = page.width;
  canvas.height = Math.ceil(h);
  const ctx = canvas.getContext("2d")!;
  // Draw from cached HTMLImageElement loaded synchronously won't work.
  // We use a workaround: the extracted data URL is already a JPEG; we decode
  // it via an Image and then crop. Since this function is sync, we instead
  // store enough info to crop later. Refactor: do cropping during extraction
  // (see cropImageSync below) — we cannot here.
  // Fallback: return the full-page data URL with a CSS hint via ratio so the
  // UI can show the relevant slice using object-position. We encode the crop
  // window in the dataUrl wrapper using a pseudo-protocol.
  return {
    dataUrl: `crop:${page.imageDataUrl}#t=${Math.round(top)},h=${Math.round(
      h,
    )},W=${page.width},H=${page.height}`,
    ratio: page.width / h,
  };
}
