# LocalMind — Intelligent Document Investigator

**PS ID: ALG-AI-02** | Domain: AI / ML

A browser-native document investigation platform. Upload PDFs, DOCX, CSV, HTML, text, and images. Ask natural-language questions. Get cited answers, conflict detection, and calibrated uncertainty — **without any API keys, servers, or cost**.

## 🎯 What It Does

1. **Ingests** multiple document formats (PDF, DOCX, CSV, HTML, TXT/MD, images via OCR)
2. **Indexes** them locally using real sentence embeddings
3. **Answers** natural-language questions with source citations (file · heading · page)
4. **Detects conflicts** between documents (two independent layers: NLI + rule-based)
5. **Communicates uncertainty** with a 4-level confidence gate instead of guessing

## ✨ Key Features

| Feature | Implementation |
|---|---|
| Multi-format ingestion | pdfjs-dist, mammoth, papaparse, Tesseract.js, DOMParser |
| Local embeddings | `Xenova/all-MiniLM-L6-v2` (22 MB, ONNX, WASM/WebGPU) |
| Persistent index | IndexedDB (survives page reloads) |
| Semantic retrieval | Cosine similarity over 384-d vectors |
| Conflict detection | `Xenova/nli-deberta-v3-xsmall` (NLI) + numeric rule-based fallback |
| Uncertainty handling | 4-level confidence: HIGH / MEDIUM / LOW / INSUFFICIENT |
| Source grounding | file · heading · page · similarity score |
| Privacy | 100% client-side — documents never leave the browser |
| Cost | $0 — no API keys, no per-query charges |

## 🚀 Quick Start

```bash
git clone https://github.com/YOUR-USERNAME/localmind.git
cd localmind
npm install
npm run dev
# Open http://localhost:3000