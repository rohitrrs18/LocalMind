# Disclosure of External Components

This project uses open-source libraries and pre-trained models. No paid APIs, no proprietary services, no user data leaves the browser. All runtime inference happens client-side.

## AI Models

All models are downloaded from the Hugging Face Hub on first load and cached in the browser.

| Model | Task | Size | License | Source |
|---|---|---|---|---|
| `Xenova/all-MiniLM-L6-v2` | Sentence embeddings (384-d) | 22 MB (q8) | Apache-2.0 | https://huggingface.co/Xenova/all-MiniLM-L6-v2 |
| `Xenova/nli-deberta-v3-xsmall` | Natural language inference (conflict detection) | 90 MB (q8) | MIT | https://huggingface.co/Xenova/nli-deberta-v3-xsmall |
| `Xenova/LaMini-Flan-T5-77M` *(optional, disabled by default)* | Text generation | 60 MB | Apache-2.0 | https://huggingface.co/Xenova/LaMini-Flan-T5-77M |

**No API key is required.** Models are downloaded once and run entirely in the user's browser.

## JavaScript Libraries

| Library | Purpose | License |
|---|---|---|
| Next.js | React framework | MIT |
| React / React DOM | UI | MIT |
| TypeScript | Type safety | Apache-2.0 |
| Tailwind CSS | Styling | MIT |
| `@huggingface/transformers` (Transformers.js) | On-device inference | Apache-2.0 |
| `onnxruntime-web` (via Transformers.js) | ONNX runtime for browser | MIT |
| `pdfjs-dist` | PDF text extraction | Apache-2.0 |
| `tesseract.js` | In-browser OCR | Apache-2.0 |
| `mammoth` | DOCX text extraction | BSD-2-Clause |
| `papaparse` | CSV parsing | MIT |
| `idb` | IndexedDB wrapper | ISC |

## Browser APIs Used

All are web standards, built into modern browsers — no external dependency:

- **IndexedDB** — persistent local storage for chunk vectors
- **Cache Storage** — browser-level caching of ONNX model files
- **WebAssembly** — CPU-accelerated inference runtime
- **WebGPU** (optional) — GPU-accelerated inference on supported devices
- **File API** — local file reading
- **DOMParser** — HTML parsing

## Datasets

**None.** All documents processed by the application are uploaded by the user at runtime. No training data, no fine-tuning data, no bundled corpora.

For testing purposes, the following public-domain or user-authored samples were used:

- European Union GDPR text (public domain)
- User-authored sample policy files (`source_A.txt`, `source_B.txt`)

## External Services

| Service | Used For | When | Cost |
|---|---|---|---|
| **Hugging Face Hub** (`huggingface.co`) | One-time model download | First page load only | $0 |
| **cdnjs** (`cdnjs.cloudflare.com`) | pdf.js worker script | First PDF parse only | $0 |
| **Vercel** | Static hosting (deployed demo) | Deployment | $0 (free tier) |

**No requests are made to OpenAI, Anthropic, Google, Cohere, or any other paid AI provider.** Runtime inference is 100% local.

## AI-Assisted Development

The following AI tools were used as **coding assistants** during development:

- ChatGPT / Claude / GitHub Copilot — used for code scaffolding, debugging, and documentation drafting.

**Every AI-generated suggestion was reviewed, tested, and adapted by the development team.** No AI tool was used to generate test data, training data, or user-facing content at runtime.

## Third-Party Attribution

Model authors:
- `all-MiniLM-L6-v2` — Microsoft Research, distributed via Sentence-Transformers; ONNX conversion by Xenova
- `nli-deberta-v3-xsmall` — Microsoft Research; ONNX conversion by Xenova
- `LaMini-Flan-T5-77M` — MBZUAI; ONNX conversion by Xenova

Library authors are listed in `package.json`.

## Compliance

- **GDPR:** No personal data is transmitted to any server. All processing is local.
- **HIPAA:** Not certified; suitable for non-PHI use. Do not upload protected health information to the deployed demo.
- **Data retention:** All data lives in the user's browser and can be cleared via "Clear all" or by clearing browser data.

## License

This project is released under the MIT License. Third-party components retain their original licenses as listed above.