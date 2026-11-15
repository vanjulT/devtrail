# DevTrail

**An AI study companion for developers.** Upload your own PDFs (docs, course notes, books) and DevTrail answers with page citations, makes flashcards and quizzes that must quote your PDF, talks out loud, and plans your study week with an agent that uses real tools.

Milestone 5 · Flavour B (Developer learning companion) · WSCube Full Stack Mentorship · by **Vanjul Thakur**

**Live:** https://devtrail-two.vercel.app · **API:** https://devtrail-api.onrender.com/api/health

> The API runs on Render's free plan and sleeps after 15 minutes. The first request after that can take about 50 seconds.

![DevTrail home page](docs/screenshots/01-home.jpg)

---

## Features

| Feature | What it does |
| --- | --- |
| **Library** | Upload PDFs (max 10 MB). Each one is read page by page, cut into chunks and stored as vectors in your private space. |
| **RAG chat** | Answers only from your PDFs, streamed word by word, with clickable citations `[1]` that open the source text and page. Says *"I couldn't find this in your material."* instead of guessing. |
| **Flashcards & quizzes** | 10 cards or 5 questions from a PDF and topic. Every item must quote its source word for word, checked with Zod. Cards use spaced repetition (Leitner boxes: 0, 1, 3, 7, 14 days). |
| **Voice** | Ask with your mic (Whisper), hear a natural answer (Gemini voice) that starts on the first sentence. Falls back to the browser's voice if needed. |
| **Study coach (agent)** | Plans your week with 6 tools. Every tool it uses is shown in the chat, and the plan dashboard stays in sync. |

| Chat with citations | Quiz with evidence |
| --- | --- |
| ![Chat](docs/screenshots/03-chat.jpg) | ![Quiz](docs/screenshots/04-quiz.jpg) |

| Study coach + plan dashboard | Library |
| --- | --- |
| ![Plan](docs/screenshots/06-plan.jpg) | ![Library](docs/screenshots/02-library.jpg) |

---

## Architecture

```mermaid
flowchart LR
    U[Browser<br/>React 19 + Vite<br/>Vercel] -->|HTTPS + JWT| API[Express 5 API<br/>Render, Frankfurt]
    API --> DB[(MongoDB Atlas<br/>users, PDFs, chats,<br/>decks, quizzes, tasks)]
    API --> PC[(Pinecone<br/>768-dim vectors<br/>1 namespace per user)]
    API --> GROQ[Groq<br/>gpt-oss-120b<br/>whisper-large-v3-turbo]
    API --> GEM[Google Gemini<br/>gemini-embedding-001<br/>text-to-speech]
```

The browser only talks to my own API. Every API key stays on the server.

### How a chat answer is made (RAG)

```mermaid
sequenceDiagram
    participant B as Browser
    participant S as Express API
    participant G as Gemini
    participant P as Pinecone
    participant Q as Groq
    B->>S: POST /api/chats/message (question)
    S->>G: embed the question (768 numbers)
    S->>P: find the 5 closest chunks in the user's namespace
    S->>Q: streamText(numbered sources + rules)
    S-->>B: X-Sources header, then the answer word by word
    S->>S: save the answer + sources in MongoDB
```

### The study coach (agent)

The coach runs `generateText` with 6 tools and stops after at most 8 steps (`stopWhen: isStepCount(8)`):

| Tool | What it does |
| --- | --- |
| `list_documents` | The user's ready PDFs |
| `get_schedule` | Tasks between two dates (with ids) + flashcards due |
| `create_study_tasks` | Adds 1 to 30 tasks |
| `update_study_task` | Moves, renames, changes minutes or marks done |
| `delete_study_task` | Removes a task |
| `create_quiz` | Makes a real quiz from a PDF |

Every tool checks its input with Zod and checks that the data belongs to the logged-in user. Errors go back to the model so it can fix its next call.

---

## Tech stack

| Part | Tools |
| --- | --- |
| Frontend | React 19, Vite 8, React Router 7, Tailwind CSS v4 |
| Backend | Node.js, Express 5, Mongoose 9, JWT + bcryptjs, multer, unpdf, Zod 4 |
| AI | Vercel AI SDK 7: `@ai-sdk/groq`, `@ai-sdk/google` |
| Data | MongoDB Atlas, Pinecone |
| Hosting | Vercel (frontend), Render (backend) |

---

## Run it locally

You need Node.js 22+ and free accounts on MongoDB Atlas, Pinecone, Groq and Google AI Studio.

```bash
git clone https://github.com/vanjulT/devtrail.git
cd devtrail
```

**1. Server**

```bash
cd server
npm install
cp .env.example .env          # then fill in your own keys
node scripts/createIndex.js   # once: creates the Pinecone index (768 dims, cosine)
npm run dev                   # http://localhost:5001
```

**2. Client** (in a second terminal)

```bash
cd client
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:5001
npm run dev                   # http://localhost:5173
```

---

## API

All routes except register, login and health need `Authorization: Bearer <token>`.

| Method | Route | What it does |
| --- | --- | --- |
| GET | `/api/health` | Server check |
| POST | `/api/auth/register` · `/api/auth/login` | Create an account / log in (returns a JWT) |
| GET | `/api/auth/me` | The logged-in user |
| GET · POST · DELETE | `/api/documents` · `/api/documents/:id` | List, upload (form-data `file`), delete PDFs |
| GET · DELETE | `/api/chats` · `/api/chats/:id` | List, open, delete chats |
| POST | `/api/chats/message` | Ask a question (streamed answer) |
| GET · POST · DELETE | `/api/decks` · `/api/decks/:id` | Flashcard decks |
| POST | `/api/decks/:id/review` | Knew it / didn't know a card |
| GET · POST · DELETE | `/api/quizzes` · `/api/quizzes/:id` | Quizzes (sent without answers) |
| POST | `/api/quizzes/:id/attempts` | Submit answers, get the score + evidence |
| POST | `/api/voice/transcribe` · `/api/voice/speak` | Speech to text / text to speech |
| POST | `/api/agent` | Talk to the study coach |
| GET · POST · PATCH · DELETE | `/api/tasks` · `/api/tasks/:id` | The study plan |

---

## Security

- Passwords hashed with bcrypt; JWT valid 7 days.
- Every MongoDB query is filtered by `userId`; every user has a private Pinecone namespace.
- API keys only on the server; `.env` is never committed.
- Quiz answers are never sent before you submit; scoring happens on the server.
- Rate limits: login/register 10 per 15 min, uploads 20 per hour, AI routes 20 per minute.

---

## Cost

DevTrail runs for **€0 per month**: every service is on a free plan.

| Service | Used for | Plan | Limit that matters |
| --- | --- | --- | --- |
| Vercel | Website | Hobby (free) | Rebuilds on every merge to `main` |
| Render | API | Free | Sleeps after 15 min, ~50 s to wake up |
| MongoDB Atlas | App data | M0 (free) | 512 MB |
| Pinecone | Vectors | Starter (free) | One index (768 dims) |
| Groq | Chat, quizzes, coach, Whisper | Free | 8,000 tokens per minute on gpt-oss-120b |
| Google Gemini | Embeddings, voice | Free tier | Daily request limits (the browser voice takes over) |

To stay inside Groq's per-minute limit, the coach uses low reasoning, a cap on reply length and short tool results. Moving a task takes about 1.6 seconds.

---

## Hardest problems I solved

- **Quizzes used outside knowledge.** Every question must now carry an evidence quote, and Zod `superRefine` checks the quote really appears in the source. On failure the error goes back to the AI, which retries (max 3).
- **Voice cut off the first words.** Recording now waits for the recorder to really start, saves 250 ms pieces and gives the mic 300 ms to warm up.
- **The natural voice was slow to start.** Voice answers are shorter, and the first sentence is turned into audio alone and plays while the rest is prepared.
- **The agent hit Groq's free limit.** An agent resends everything after each tool. Lower reasoning, a reply cap and short tool results fixed it.

---

Designed & built by **Vanjul Thakur** · [github.com/vanjulT](https://github.com/vanjulT)
