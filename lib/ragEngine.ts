'use client';

import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import { pipeline, env } from '@huggingface/transformers';
import { openDB, IDBPDatabase } from 'idb';
import mammoth from 'mammoth';
import Papa from 'papaparse';

// Serve worker locally (copy pdf.worker.min.mjs into /public/)
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

env.allowLocalModels = false;
env.useBrowserCache = true;

export interface Chunk {
  id: string;
  text: string;
  sourceFile: string;
  page: number;
  heading: string;
  embedding?: Float32Array;
}

export interface RetrievedChunk extends Chunk {
  score: number;
}

export interface ConflictPair {
  a: RetrievedChunk;
  b: RetrievedChunk;
  confidence: number;
  reason: 'nli' | 'rule';
  detail?: string;
}

export interface InvestigationResult {
  answer: string;
  sources: RetrievedChunk[];
  conflicts: ConflictPair[];
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  method: 'generative' | 'extractive';
}

function dot(a: Float32Array, b: Float32Array) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

class RAGEngine {
  private embedder: any = null;
  private nli: any = null;
  private llm: any = null;
  private db: IDBPDatabase | null = null;
  private ready = false;
  private initializing: Promise<void> | null = null;

  // ============================================================
  // INIT — guarded so React StrictMode / Fast Refresh can't race
  // ============================================================
  async init(): Promise<void> {
    if (this.ready) return;
    if (this.initializing) return this.initializing;

    this.initializing = (async () => {
      const log = (m: string) => console.log('[RAG]', m);

      // -------- 1. Embedder (REQUIRED) --------
      log('Step 1/4 — Loading embedder (MiniLM, q8/WASM)…');
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        {
          progress_callback: (p: any) => {
            if (p.status === 'progress' && p.file) {
              console.log(
                `[RAG] embedder ${p.file} — ${Math.round(p.progress ?? 0)}%`
              );
            } else if (p.status === 'ready') {
              console.log('[RAG] embedder ✅ ready');
            }
          },
        }
      );

      if (typeof this.embedder !== 'function') {
        throw new Error('Embedder loaded but is not callable');
      }
      log('Step 1/4 done');

      // -------- 2. NLI (OPTIONAL) --------
      log('Step 2/4 — Loading NLI (conflict detection)…');
      try {
        this.nli = await pipeline(
          'text-classification',
          'Xenova/nli-deberta-v3-xsmall',
          {
            progress_callback: (p: any) => {
              if (p.status === 'progress' && p.file) {
                console.log(
                  `[RAG] nli ${p.file} — ${Math.round(p.progress ?? 0)}%`
                );
              }
            },
          }
        );
        log('Step 2/4 done');
      } catch (e) {
        console.warn('[RAG] NLI skipped:', e);
        this.nli = null;
      }

      // -------- 3. LLM (DISABLED — enable later if you want) --------
      log('Step 3/4 — LLM disabled, using extractive answers');
      this.llm = null;

      // -------- 4. IndexedDB --------
      log('Step 4/4 — Opening IndexedDB…');
      this.db = await openDB('doc-investigator', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('chunks')) {
            const s = db.createObjectStore('chunks', { keyPath: 'id' });
            s.createIndex('sourceFile', 'sourceFile');
          }
        },
      });
      log('Step 4/4 done');

      this.ready = true;
      log('🎉 Init complete');
    })();

    return this.initializing;
  }

  isReady() {
    return this.ready;
  }

  // ============================================================
  // EXTRACTION
  // ============================================================
  async extract(file: File): Promise<{
    text: string;
    pageMap: { page: number; start: number }[];
  }> {
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf') || file.type === 'application/pdf')
      return this.fromPDF(file);
    if (name.endsWith('.docx')) return this.fromDOCX(file);
    if (name.endsWith('.csv')) return this.fromCSV(file);
    if (name.endsWith('.html') || name.endsWith('.htm'))
      return this.fromHTML(file);
    if (file.type.startsWith('image/')) return this.fromImage(file);
    return { text: await file.text(), pageMap: [{ page: 1, start: 0 }] };
  }

  private async fromPDF(file: File) {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = '';
    const pageMap: { page: number; start: number }[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      pageMap.push({ page: i, start: text.length });
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it: any) => it.str).join(' ') + '\n\n';
    }
    if (text.trim().length < 40) {
      // scanned PDF → OCR fallback
      return this.fromImage(file);
    }
    return { text, pageMap };
  }

  private async fromDOCX(file: File) {
    const buf = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
    return { text: value, pageMap: [{ page: 1, start: 0 }] };
  }

  private async fromCSV(file: File) {
    const text = await file.text();
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
    const rows = parsed.data.map((r) => r.join(' | ')).join('\n');
    return { text: rows, pageMap: [{ page: 1, start: 0 }] };
  }

  private async fromHTML(file: File) {
    const html = await file.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style').forEach((el) => el.remove());
    return { text: doc.body.innerText, pageMap: [{ page: 1, start: 0 }] };
  }

  private async fromImage(file: File) {
    const worker = await createWorker('eng');
    const {
      data: { text },
    } = await worker.recognize(file);
    await worker.terminate();
    return { text, pageMap: [{ page: 1, start: 0 }] };
  }

  // ============================================================
  // CHUNKING (heading + page aware)
  // ============================================================
  chunk(
    text: string,
    sourceFile: string,
    pageMap: { page: number; start: number }[]
  ): Chunk[] {
    const lines = text.split(/\n/);
    const chunks: Chunk[] = [];
    let current = '';
    let currentHeading = 'Introduction';
    let cursor = 0;
    const maxLen = 700;

    const pageAt = (pos: number) => {
      let p = 1;
      for (const pm of pageMap) if (pos >= pm.start) p = pm.page;
      return p;
    };

    const flush = () => {
      if (!current.trim()) return;
      chunks.push({
        id: `${sourceFile}::${chunks.length}`,
        text: current.trim(),
        sourceFile,
        page: pageAt(Math.max(0, cursor - current.length)),
        heading: currentHeading,
      });
      current = '';
    };

    for (const line of lines) {
      const trimmed = line.trim();
      cursor += line.length + 1;

      const isHeading =
        trimmed.length > 0 &&
        trimmed.length < 80 &&
        (/^(#{1,6}\s|Chapter|Section|\d+(\.\d+)*\s+[A-Z])/.test(trimmed) ||
          (trimmed === trimmed.toUpperCase() && trimmed.split(' ').length < 10));

      if (isHeading) {
        flush();
        currentHeading = trimmed.replace(/^#+\s*/, '');
        continue;
      }

      current += line + '\n';
      if (current.length > maxLen) {
        const sentences = current.match(/[^.!?]+[.!?]+\s*/g) || [current];
        let buf = '';
        for (const s of sentences) {
          if (buf.length + s.length > maxLen) {
            current = buf;
            flush();
            buf = s;
          } else buf += s;
        }
        current = buf;
      }
    }
    flush();
    return chunks;
  }

  // ============================================================
  // EMBED (self-heals if embedder is missing)
  // ============================================================
  async embed(chunks: Chunk[]): Promise<void> {
    if (typeof this.embedder !== 'function') {
      console.warn('[RAG] embedder missing, re-initializing…');
      this.ready = false;
      this.initializing = null;
      await this.init();
    }
    if (!this.db) throw new Error('DB not initialized');

    for (const c of chunks) {
      const out = await this.embedder(c.text, {
        pooling: 'mean',
        normalize: true,
      });
      c.embedding = new Float32Array(out.data);
      await this.db.put('chunks', c);
    }
  }

  async clearAll() {
    if (!this.db) return;
    await this.db.clear('chunks');
  }

  // ============================================================
  // RETRIEVE (self-heals if embedder is missing)
  // ============================================================
  async retrieve(query: string, topK = 6): Promise<RetrievedChunk[]> {
    if (typeof this.embedder !== 'function') {
      console.warn('[RAG] embedder missing, re-initializing…');
      this.ready = false;
      this.initializing = null;
      await this.init();
    }
    if (!this.db) throw new Error('DB not initialized');

    const q = await this.embedder(query, { pooling: 'mean', normalize: true });
    const qv = new Float32Array(q.data);
    const all: Chunk[] = await this.db.getAll('chunks');
    return all
      .filter((c) => c.embedding)
      .map((c) => ({ ...c, score: dot(qv, c.embedding!) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  // ============================================================
  // CONFLICT DETECTION — sentence-level NLI + rule-based fallback
  // ============================================================

  /** NLI-based: split chunks into sentences, run pairwise */
  private async detectNliConflicts(chunks: RetrievedChunk[]): Promise<ConflictPair[]> {
    const pairs: ConflictPair[] = [];
    if (!this.nli) return pairs;

    console.log('[RAG] Running sentence-level NLI conflict detection…');

    const sentenceChunks = chunks.map((c) => ({
      original: c,
      sentences: c.text
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 15 && s.length < 400),
    }));

    for (let i = 0; i < sentenceChunks.length; i++) {
      for (let j = i + 1; j < sentenceChunks.length; j++) {
        const A = sentenceChunks[i];
        const B = sentenceChunks[j];

        for (const sa of A.sentences) {
          for (const sb of B.sentences) {
            try {
              const out: any = await this.nli(sa, { text_pair: sb });
              const arr = Array.isArray(out) ? out : [out];
              const contradiction = arr.find((o: any) =>
                o.label.toLowerCase().includes('contradiction')
              );

              const score = contradiction?.score ?? 0;
              console.log(
                `[RAG] NLI "${sa.slice(0, 45)}…" vs "${sb.slice(0, 45)}…" → ${contradiction?.label ?? 'n/a'} ${score.toFixed(2)}`
              );

              if (contradiction && score > 0.5) {
                const exists = pairs.some(
                  (p) =>
                    (p.a.id === A.original.id && p.b.id === B.original.id) ||
                    (p.a.id === B.original.id && p.b.id === A.original.id)
                );
                if (!exists) {
                  pairs.push({
                    a: A.original,
                    b: B.original,
                    confidence: score,
                    reason: 'nli',
                    detail: `"${sa.slice(0, 60)}…" vs "${sb.slice(0, 60)}…"`,
                  });
                }
              }
            } catch (e) {
              console.warn('[RAG] NLI pair error:', e);
            }
          }
        }
      }
    }
    return pairs;
  }

  /** Rule-based: same subject + same unit + different numeric value */
  private detectRuleConflicts(chunks: RetrievedChunk[]): ConflictPair[] {
    const pairs: ConflictPair[] = [];

    const extractFacts = (
      text: string
    ): { subject: string; value: number; unit: string; raw: string }[] => {
      const out: { subject: string; value: number; unit: string; raw: string }[] = [];
      const regex =
        /([a-z ]{3,40}?)\s+(?:must be|is|are|should be|will be|kept for|retained for)\s+[a-z ]{0,20}?(\d+)\s*(months?|years?|days?|hours?|minutes?|weeks?)/gi;
      for (const m of text.matchAll(regex)) {
        out.push({
          subject: m[1].trim().toLowerCase(),
          value: parseInt(m[2]),
          unit: m[3].toLowerCase().replace(/s$/, ''),
          raw: m[0],
        });
      }
      return out;
    };

    for (let i = 0; i < chunks.length; i++) {
      for (let j = i + 1; j < chunks.length; j++) {
        const factsA = extractFacts(chunks[i].text);
        const factsB = extractFacts(chunks[j].text);

        for (const fa of factsA) {
          for (const fb of factsB) {
            // same subject + same unit + different value = conflict
            const sameSubject =
              fa.subject === fb.subject ||
              fa.subject.includes(fb.subject) ||
              fb.subject.includes(fa.subject);

            if (sameSubject && fa.unit === fb.unit && fa.value !== fb.value) {
              const exists = pairs.some(
                (p) =>
                  (p.a.id === chunks[i].id && p.b.id === chunks[j].id) ||
                  (p.a.id === chunks[j].id && p.b.id === chunks[i].id)
              );
              if (!exists) {
                console.log(
                  `[RAG] Rule conflict: "${fa.raw}" vs "${fb.raw}"`
                );
                pairs.push({
                  a: chunks[i],
                  b: chunks[j],
                  confidence: 0.9,
                  reason: 'rule',
                  detail: `${fa.value} ${fa.unit} vs ${fb.value} ${fb.unit}`,
                });
              }
            }
          }
        }
      }
    }
    return pairs;
  }

  /** Merge NLI + rule-based, de-duplicate */
  async detectConflicts(chunks: RetrievedChunk[]): Promise<ConflictPair[]> {
    const nliConflicts = await this.detectNliConflicts(chunks);
    const ruleConflicts = this.detectRuleConflicts(chunks);

    const seen = new Set<string>();
    const merged = [...nliConflicts, ...ruleConflicts].filter((c) => {
      const key = [c.a.id, c.b.id].sort().join('::');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(
      `[RAG] Conflict detection complete — ${merged.length} pair(s) found (NLI: ${nliConflicts.length}, rule: ${ruleConflicts.length})`
    );
    return merged;
  }

  // ============================================================
  // CONFIDENCE LEVEL
  // ============================================================
  private confidenceLevel(
    top: RetrievedChunk[],
    conflicts: ConflictPair[]
  ): InvestigationResult['confidence'] {
    const best = top[0]?.score ?? 0;
    if (best < 0.2) return 'insufficient';
    if (conflicts.length > 0) return 'low';
    if (best > 0.6) return 'high';
    return 'medium';
  }

  // ============================================================
  // INVESTIGATE — full pipeline
  // ============================================================
  async investigate(question: string): Promise<InvestigationResult> {
    const retrieved = await this.retrieve(question, 6);
    const conflicts = await this.detectConflicts(retrieved);
    const confidence = this.confidenceLevel(retrieved, conflicts);

    if (confidence === 'insufficient') {
      return {
        answer:
          "I don't have enough relevant information in the uploaded documents to answer this confidently. Please upload additional or more specific documents.",
        sources: retrieved,
        conflicts,
        confidence,
        method: 'extractive',
      };
    }

    let answer = '';
    let method: 'generative' | 'extractive' = 'extractive';

    if (this.llm) {
      try {
        const context = retrieved
          .map(
            (c, i) =>
              `[${i + 1}] (${c.sourceFile} · ${c.heading} · p.${c.page}) ${c.text}`
          )
          .join('\n\n');
        const prompt = `Answer the question using ONLY the sources below. Cite sources as [n]. If sources conflict, say so explicitly.\n\nQuestion: ${question}\n\nSources:\n${context}`;
        const out: any = await this.llm(prompt, { max_new_tokens: 220 });
        answer = Array.isArray(out)
          ? out[0].generated_text
          : out.generated_text;
        method = 'generative';
      } catch {
        /* fallthrough to extractive */
      }
    }

    if (!answer) {
      answer =
        `Based on the retrieved sources:\n\n` +
        retrieved
          .slice(0, 3)
          .map(
            (c, i) =>
              `[${i + 1}] (${c.sourceFile} · ${c.heading} · p.${c.page}) ${c.text.slice(0, 320)}…`
          )
          .join('\n\n');
    }

    if (conflicts.length) {
      answer += `\n\n⚠️ Note: ${conflicts.length} conflicting pair(s) detected between sources.`;
    }

    return { answer, sources: retrieved, conflicts, confidence, method };
  }
}

// ============================================================
// Singleton — survives React StrictMode + Fast Refresh
// ============================================================
declare global {
  // eslint-disable-next-line no-var
  var __ragEngine__: RAGEngine | undefined;
}

export const ragEngine: RAGEngine =
  globalThis.__ragEngine__ ?? (globalThis.__ragEngine__ = new RAGEngine());