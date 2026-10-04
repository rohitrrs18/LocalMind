# Testing Evidence

## Test Environment

- **Browser:** Chrome 126 (WASM), Chrome 126 (WebGPU on supported devices), Firefox 128 (WASM)
- **Device:** 16 GB RAM laptop
- **Deployed on:** Vercel free tier

## Test Fixtures

All fixtures are user-authored or public-domain:

| File | Type | Content |
|---|---|---|
| `source_A.txt` | TXT | Company policy with `12 month` retention |
| `source_B.txt` | TXT | Company policy with `24 month` retention |
| `gdpr_sample.pdf` | PDF | EU GDPR excerpt (public domain) |
| `scanned_contract.jpg` | Image | OCR test |
| `metrics.csv` | CSV | Numeric data |
| `handbook.html` | HTML | Rendered page |

## Recorded Test Cases

| # | Scenario | Expected | Observed | Pass |
|---|---|---|---|---|
| 1 | Upload 2 TXT files | Both indexed, chunk counts shown | `source_A.txt — 1 chunk`, `source_B.txt — 1 chunk` | ✅ |
| 2 | Upload mixed formats (PDF, DOCX, CSV, HTML, JPG) | All indexed | All 5 processed, chunk counts displayed | ✅ |
| 3 | Ask question covered by both files: *"What is the data retention period?"* | Conflict banner + LOW confidence | 🟠 LOW, ⚠️ Rule (numeric) 90%, "12 month vs 24 month" | ✅ |
| 4 | Ask question not in any doc: *"What is the CEO's home address?"* | INSUFFICIENT refusal | 🔴 INSUFFICIENT + refusal message | ✅ |
| 5 | Ask question covered by only one file | HIGH confidence, single-source citation | Cited source_A.txt only, HIGH | ✅ |
| 6 | Scanned PDF upload (no text layer) | Auto OCR fallback | Tesseract extracted ~800 words, no crash | ✅ |
| 7 | Empty file upload | Graceful skip | "Skipped file — no text extracted", no error | ✅ |
| 8 | Clear index then query | Refusal | INSUFFICIENT | ✅ |
| 9 | Firefox (no WebGPU) | WASM fallback works | Slower (~3×) but correct | ✅ |
| 10 | Reload page after upload | Index persists (IndexedDB) | Chunks still present, queries still work | ✅ |
| 11 | Upload same file twice | Duplicate chunks created (known limitation) | Two entries under same name | ⚠️ |
| 12 | Very large PDF (>100 pages) | Chunk count grows, retrieval still fast | 342 chunks, ~2 s query | ✅ |

## Edge Cases Verified

- **Empty documents** — skipped without error.
- **Non-text PDFs (scanned)** — auto-routed to OCR.
- **Mixed-language docs** — English OCR used; non-English degrades gracefully.
- **Rapid re-mounts (React StrictMode)** — singleton pattern prevents double-init.
- **Network failure during model load** — surfaced via console error; page shows fallback message.
- **Very short queries (1 word)** — retrieval returns results but confidence often drops to INSUFFICIENT, which is correct.

## How to Reproduce

```bash
npm run dev
# Open http://localhost:3000