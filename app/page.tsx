'use client';

import { useEffect, useRef, useState } from 'react';
import { ragEngine, InvestigationResult } from '@/lib/ragEngine';

export default function Home() {
  const [ready, setReady] = useState(false);
  const [docs, setDocs] = useState<{ name: string; chunks: number }[]>([]);
  const [q, setQ] = useState('');
  const [res, setRes] = useState<InvestigationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    ragEngine
      .init()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError('');
    try {
      for (const f of Array.from(files)) {
        setProgress(`Extracting ${f.name}…`);
        const { text, pageMap } = await ragEngine.extract(f);
        if (!text.trim()) {
          setProgress(`Skipped ${f.name} — no text extracted`);
          continue;
        }
        const chunks = ragEngine.chunk(text, f.name, pageMap);
        setProgress(`Embedding ${chunks.length} chunks from ${f.name}…`);
        await ragEngine.embed(chunks);
        setDocs((d) => [...d, { name: f.name, chunks: chunks.length }]);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setProgress('');
      setBusy(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const ask = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setRes(null);
    setError('');
    try {
      const r = await ragEngine.investigate(q);
      setRes(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  // ---------- LOADING STATE ----------
  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4 sm:p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-6 sm:p-8 text-center space-y-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <h2 className="text-lg sm:text-xl font-bold text-slate-800">
            Loading local AI models
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            First run downloads ~100 MB. This only happens once — the models
            are cached in your browser afterwards.
          </p>
          <p className="text-xs text-slate-400">
            Watch the browser console (F12) for live progress.
          </p>
          {error && (
            <p className="text-xs sm:text-sm text-red-600 bg-red-50 rounded p-2 break-words">
              {error}
            </p>
          )}
        </div>
      </main>
    );
  }

  // ---------- MAIN UI ----------
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-6 sm:py-10 px-3 sm:px-4">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
        {/* HEADER */}
        <header className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 tracking-tight leading-tight px-2">
            LocalMind: Intelligent Document Investigator
          </h1>
          <p className="text-sm sm:text-base text-slate-600 px-2 max-w-2xl mx-auto">
            Ask natural-language questions across PDFs, images, and text
            documents. Get cited answers, conflict warnings, and confidence
            scores — entirely in your browser.
          </p>
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 pt-2 px-2">
            <Badge>PDF</Badge>
            <Badge>DOCX</Badge>
            <Badge>CSV</Badge>
            <Badge>HTML</Badge>
            <Badge>TXT</Badge>
            <Badge>Images (OCR)</Badge>
          </div>
        </header>

        {/* STEP 1 — UPLOAD */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <StepBadge>1</StepBadge>
            <h2 className="text-base sm:text-lg font-semibold text-slate-800">
              Upload documents
            </h2>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed transition-colors p-4 sm:p-8 text-center ${
              dragOver
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
            }`}
          >
            <div className="text-3xl sm:text-4xl mb-2">📄</div>
            <p className="font-medium text-slate-700 text-sm sm:text-base">
              {dragOver ? 'Drop files here' : 'Drag & drop or click to browse'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Multiple files supported
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={onFileChange}
              accept=".pdf,.docx,.csv,.html,.htm,.txt,.md,image/*"
              className="hidden"
            />
          </div>

          {docs.length > 0 && (
            <div className="mt-3 sm:mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs sm:text-sm font-medium text-slate-700">
                  Indexed documents ({docs.length})
                </p>
                <button
                  className="text-xs text-red-600 hover:text-red-700 underline"
                  onClick={async () => {
                    await ragEngine.clearAll();
                    setDocs([]);
                    setRes(null);
                  }}
                >
                  Clear all
                </button>
              </div>
              <ul className="space-y-1">
                {docs.map((d, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-2.5 sm:px-3 py-2 text-xs sm:text-sm"
                  >
                    <span className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                      <span className="text-green-600 shrink-0">✓</span>
                      <span className="truncate text-slate-700">{d.name}</span>
                    </span>
                    <span className="text-xs text-slate-500 shrink-0">
                      {d.chunks} chunk{d.chunks !== 1 ? 's' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* STEP 2 — ASK */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <StepBadge>2</StepBadge>
            <h2 className="text-base sm:text-lg font-semibold text-slate-800">
              Ask a question
            </h2>
          </div>

          {/* Stack on mobile, side-by-side on sm+ */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="flex-1 border border-slate-300 rounded-lg px-3 sm:px-4 py-2.5 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ask()}
              placeholder="e.g., What is the data retention period?"
              disabled={busy || docs.length === 0}
            />
            <button
              onClick={ask}
              disabled={busy || !q.trim() || docs.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 sm:px-6 py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm sm:text-base w-full sm:w-auto"
            >
              {busy ? 'Working…' : 'Investigate'}
            </button>
          </div>

          {docs.length === 0 && (
            <p className="text-xs text-slate-500 mt-2">
              Upload at least one document first.
            </p>
          )}

          {progress && (
            <p className="text-xs sm:text-sm text-blue-600 mt-3 flex items-center gap-2 break-words">
              <span className="inline-block w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin shrink-0" />
              <span className="truncate">{progress}</span>
            </p>
          )}
          {error && (
            <p className="text-xs sm:text-sm text-red-600 bg-red-50 rounded p-2 mt-3 break-words">
              {error}
            </p>
          )}
        </section>

        {/* RESULTS */}
        {res && <ResultsPanel res={res} />}
                {/* FOOTER */}
        <footer className="pt-6 sm:pt-8 pb-2 text-center">
          <p className="text-xs sm:text-sm text-slate-500">
            Developed by{' '}
            <span className="font-semibold text-slate-700">Rohit Sawant</span>
          </p>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-1">
            ALGOTHON&apos;26 · ALG-AI-02 · Intelligent Document Investigator
          </p>
        </footer>
          
      </div>
    </main>
  );
}

// ============================================================
// Sub-components
// ============================================================

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] sm:text-xs font-medium bg-slate-100 text-slate-600 rounded-full px-2 sm:px-2.5 py-1">
      {children}
    </span>
  );
}

function StepBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-600 text-white text-xs sm:text-sm font-bold shrink-0">
      {children}
    </span>
  );
}

function ResultsPanel({ res }: { res: InvestigationResult }) {
  const conf = res.confidence;
  const confStyles = {
    high: 'bg-green-100 text-green-800 border-green-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    low: 'bg-orange-100 text-orange-800 border-orange-300',
    insufficient: 'bg-red-100 text-red-800 border-red-300',
  }[conf];

  const confIcon = {
    high: '🟢',
    medium: '🟡',
    low: '🟠',
    insufficient: '🔴',
  }[conf];

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* HEADER ROW — wraps on mobile */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <span
          className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold border ${confStyles}`}
        >
          {confIcon} Confidence: {conf.toUpperCase()}
        </span>
        <span className="text-[10px] sm:text-xs text-slate-500">
          method: <span className="font-mono">{res.method}</span>
        </span>
        <span className="text-[10px] sm:text-xs text-slate-500">
          {res.sources.length} source{res.sources.length !== 1 ? 's' : ''}{' '}
          retrieved
        </span>
      </div>

      {/* CONFLICTS */}
      {res.conflicts.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 sm:p-4">
          <div className="flex items-start gap-2 sm:gap-3">
            <span className="text-xl sm:text-2xl shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-amber-900 mb-2 text-sm sm:text-base">
                Conflicting sources detected ({res.conflicts.length})
              </h3>
              <ul className="space-y-2">
                {res.conflicts.map((c, i) => (
                  <li
                    key={i}
                    className="text-xs sm:text-sm text-amber-900 bg-white/60 rounded-lg p-2 border border-amber-200"
                  >
                    <div className="font-medium break-words">
                      &ldquo;{c.a.sourceFile} · {c.a.heading}&rdquo;
                      <span className="text-amber-700 mx-1">vs</span>
                      &ldquo;{c.b.sourceFile} · {c.b.heading}&rdquo;
                    </div>
                    <div className="text-[10px] sm:text-xs text-amber-700 mt-1 flex flex-wrap gap-1.5 sm:gap-2">
                      <span className="bg-amber-100 rounded px-1.5 py-0.5 whitespace-nowrap">
                        {c.reason === 'nli' ? 'NLI (semantic)' : 'Rule (numeric)'}
                      </span>
                      <span className="bg-amber-100 rounded px-1.5 py-0.5 whitespace-nowrap">
                        {(c.confidence * 100).toFixed(0)}% confidence
                      </span>
                      {c.detail && (
                        <span className="italic text-amber-800 break-words">
                          {c.detail}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ANSWER */}
      <div>
        <h3 className="font-semibold text-slate-800 mb-2 text-sm sm:text-base">
          Answer
        </h3>
        <pre className="whitespace-pre-wrap break-words text-xs sm:text-sm text-slate-700 bg-slate-50 rounded-xl p-3 sm:p-4 font-mono leading-relaxed border border-slate-200 overflow-x-auto">
          {res.answer}
        </pre>
      </div>

      {/* SOURCES */}
      <div>
        <h3 className="font-semibold text-slate-800 mb-2 text-sm sm:text-base">
          Sources ({res.sources.length})
        </h3>
        <ol className="space-y-2">
          {res.sources.map((s, i) => (
            <li
              key={i}
              className="flex items-start gap-2 sm:gap-3 bg-slate-50 rounded-lg p-2.5 sm:p-3 text-xs sm:text-sm border border-slate-200"
            >
              <span className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-600 text-white text-[10px] sm:text-xs font-bold shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800 truncate">
                  {s.sourceFile}
                </div>
                <div className="text-[10px] sm:text-xs text-slate-500 truncate">
                  {s.heading} · page {s.page}
                </div>
              </div>
              <span className="text-[10px] sm:text-xs font-mono text-slate-500 shrink-0">
                {s.score.toFixed(3)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}