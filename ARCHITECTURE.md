┌────────────────────────────── LOCALMIND ──────────────────────────────┐
│                  100% BROWSER-SIDE EXECUTION                          │
│                                                                       │
│  ┌──────────────────┐                                                 │
│  │ 1. USER INPUT    │                                                 │
│  │                  │                                                 │
│  │ File Upload      │───┐                                             │
│  │ Query Input      │   │                                             │
│  └──────────────────┘   │                                             │
│                         ▼                                             │
│              ┌─────────────────────┐                                  │
│              │ 2. EXTRACTION       │                                  │
│              │                     │                                  │
│              │    Format Router    │                                  │
│              └──────────┬──────────┘                                  │
│                         │                                             │
│       ┌─────────────────┼────────────────────────┐                    │
│       ▼                 ▼          ▼              ▼                    │
│   PDF/pdfjs        OCR/tesseract  DOCX/mammoth  CSV/papaparse         │
│       │                 │          │              │                    │
│       └─────────────────┼──────────┼──────────────┘                    │
│                         ▼                                             │
│                 HTML/DOMParser                                        │
│                 TXT/MD/File.text()                                    │
│                         │                                             │
│                         ▼                                             │
│              ┌──────────────────────────┐                             │
│              │ 3. PROCESSING            │                             │
│              │                          │                             │
│              │ Heading-aware Chunker    │                             │
│              │ ~700 chars               │                             │
│              │ Sentence-safe splitting  │                             │
│              │ + source metadata        │                             │
│              └────────────┬─────────────┘                             │
│                           │                                            │
│                           ▼                                            │
│              ┌──────────────────────────┐                             │
│              │ MiniLM EMBEDDER          │◄──── WebGPU / WASM          │
│              │ all-MiniLM-L6-v2         │                             │
│              │ 384-d • mean • L2        │                             │
│              └────────────┬─────────────┘                             │
│                           │                                            │
│                           │  INGESTION FLOW                            │
│                           ▼                                            │
│              ┌──────────────────────────┐                             │
│              │ 4. STORAGE               │                             │
│              │                          │                             │
│              │ ┌──────────────────────┐ │                             │
│              │ │ IndexedDB            │ │                             │
│              │ │ Persistent chunks +  │ │                             │
│              │ │ embeddings + metadata│ │                             │
│              │ └──────────────────────┘ │                             │
│              │                          │                             │
│              │ ┌──────────────────────┐ │                             │
│              │ │ Cache Storage        │ │                             │
│              │ │ Persistent ONNX      │ │                             │
│              │ │ model files          │ │                             │
│              │ └──────────────────────┘ │                             │
│              └──────────────────────────┘                             │
│                                                                       │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ PER-QUERY FLOW ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─             │
│                                                                       │
│  ┌──────────────────┐                                                 │
│  │ Question         │                                                     │
│  └────────┬─────────┘                                                 │
│           │                                                           │
│           ▼                                                           │
│  ┌──────────────────────────┐                                         │
│  │ MiniLM Query Embedder    │                                         │
│  │ 384-d vector             │                                         │
│  └────────────┬─────────────┘                                         │
│               │                                                       │
│               ▼                                                       │
│  ┌──────────────────────────┐       ┌─────────────────────────┐       │
│  │ In-Memory Query Vector   │       │ IndexedDB               │       │
│  │ + Retrieved Chunks       │       │ Stored Chunk Vectors    │       │
│  └────────────┬─────────────┘       └────────────┬────────────┘       │
│               │                                  │                    │
│               └────────────────┬─────────────────┘                    │
│                                ▼                                      │
│                   ┌────────────────────────┐                          │
│                   │ 5. RETRIEVAL           │                          │
│                   │ Cosine Similarity Scan │                          │
│                   │ Top-K = 6              │                          │
│                   └────────────┬───────────┘                          │
│                                │                                      │
│                                ▼                                      │
│                   ┌────────────────────────┐                          │
│                   │ 6. ANALYSIS            │                          │
│                   │                        │                          │
│                   │ ┌────────────────────┐ │                          │
│                   │ │ NLI — DeBERTa      │ │                          │
│                   │ │ Contradiction > .5 │ │                          │
│                   │ └─────────┬──────────┘ │                          │
│                   │           │             │                          │
│                   │ ┌─────────▼──────────┐ │                          │
│                   │ │ Numeric Rule Check │ │                          │
│                   │ │ Same subject/unit  │ │                          │
│                   │ │ + different value  │ │                          │
│                   │ └─────────┬──────────┘ │                          │
│                   │           ▼             │                          │
│                   │     Conflict Merge      │                          │
│                   └────────────┬────────────┘                          │
│                                │                                      │
│                                ▼                                      │
│                   ┌──────────────────────────────┐                    │
│                   │ 7. SYNTHESIS                 │                    │
│                   │                              │                    │
│                   │ UNCERTAINTY GATE              │                    │
│                   │ < .20  → INSUFFICIENT         │                    │
│                   │ Conflict → LOW                │                    │
│                   │ > .60  → HIGH                 │                    │
│                   │ Else    → MEDIUM              │                    │
│                   │                              │                    │
│                   │ Answer Assembly               │                    │
│                   │ Top-3 chunks + citations      │                    │
│                   └──────────────┬───────────────┘                    │
│                                  │                                    │
│                                  ▼                                    │
│                   ┌──────────────────────────┐                       │
│                   │ 8. OUTPUT                │                       │
│                   │ Answer                   │                       │
│                   │ Source Citations         │                       │
│                   │ Conflict List            │                       │
│                   │ Confidence Badge         │                       │
│                   └──────────────────────────┘                       │
│                                                                       │
│  OPTIONAL / DISABLED                                                  │
│  ┌──────────────────────────────────────────┐                         │
│  │ LaMini-Flan-T5-77M                      │                         │
│  │ Generative answer synthesis             │                         │
│  │ DISABLED BY DEFAULT                     │                         │
│  └──────────────────────────────────────────┘                         │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘

          EXTERNAL BOUNDARY
                 │
                 │ - - - one-time download - - -
                 ▼
       ┌──────────────────────┐
       │ Hugging Face Hub     │
       │ ONNX model files     │
       └──────────┬───────────┘
                  │
                  ▼
          Browser Cache Storage

       ┌──────────────────────┐
       │ Vercel               │
       │ Static frontend      │
       │ hosting only         │
       └ - - - - - - - - - - ┘


LocalMind is a fully browser-native RAG architecture where document ingestion, embedding, retrieval, conflict detection, and answer synthesis execute locally on the user's device. Persistent document vectors live in IndexedDB while ONNX models are cached in Browser Cache Storage; the only external interactions are static asset delivery from Vercel and one-time model downloads from Hugging Face.