import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Small glass panel used for both lists
function Panel({ title, children }) {
  return (
    <section className="rounded-xl border border-line bg-card/40 p-5 backdrop-blur-sm">
      <h2 className="mb-4 text-[11px] font-medium tracking-[0.2em] text-brand">{title}</h2>
      {children}
    </section>
  );
}

export default function StudyPage() {
  const [documents, setDocuments] = useState([]);
  const [decks, setDecks] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [documentId, setDocumentId] = useState("");
  const [topic, setTopic] = useState("");
  const [creating, setCreating] = useState(null); // "deck" or "quiz" while the AI works
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null); // { type, id }

  // Load PDFs, decks and quizzes together when the page opens
  useEffect(() => {
    Promise.all([apiFetch("/api/documents"), apiFetch("/api/decks"), apiFetch("/api/quizzes")])
      .then(([docs, deckData, quizData]) => {
        const ready = docs.documents.filter((doc) => doc.status === "ready");
        setDocuments(ready);
        setDocumentId(ready[0]?._id || "");
        setDecks(deckData.decks);
        setQuizzes(quizData.quizzes);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function create(type) {
    setError("");
    setCreating(type);
    try {
      const path = type === "deck" ? "/api/decks" : "/api/quizzes";
      await apiFetch(path, { method: "POST", body: JSON.stringify({ documentId, topic }) });
      // Reload the list so the new item shows its counts
      if (type === "deck") {
        const data = await apiFetch("/api/decks");
        setDecks(data.decks);
      } else {
        const data = await apiFetch("/api/quizzes");
        setQuizzes(data.quizzes);
      }
      setTopic("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(null);
    }
  }

  async function remove(type, id) {
    try {
      await apiFetch(`/api/${type === "deck" ? "decks" : "quizzes"}/${id}`, { method: "DELETE" });
      if (type === "deck") setDecks((list) => list.filter((d) => d._id !== id));
      else setQuizzes((list) => list.filter((q) => q._id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirmDelete(null);
    }
  }

  function DeleteControl({ type, id }) {
    if (confirmDelete?.id === id) {
      return (
        <span className="flex items-center gap-2 text-xs">
          <button onClick={() => remove(type, id)} className="rounded-full bg-red-500 px-3 py-1 text-white hover:bg-red-400">
            Delete
          </button>
          <button onClick={() => setConfirmDelete(null)} className="rounded-full px-3 py-1 hover:bg-raised">
            Cancel
          </button>
        </span>
      );
    }
    return (
      <button
        onClick={() => setConfirmDelete({ type, id })}
        className="rounded-full px-2 text-faint transition-colors hover:text-danger"
        aria-label="Delete"
      >
        ×
      </button>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="bg-linear-to-b from-ink to-muted bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Study <span className="bg-linear-to-r from-brand to-mint bg-clip-text text-transparent">smarter</span>
        </h1>
        <p className="mt-2 text-sm text-muted">
          Turn a PDF into flashcards or a quiz. Every answer is checked against a real quote from your document.
        </p>
      </div>

      {/* Create panel */}
      <section className="relative">
        <div className="pointer-events-none absolute -inset-3 rounded-2xl bg-linear-to-r from-brand/10 to-mint/5 opacity-70 blur-2xl" aria-hidden="true" />
        <div className="relative rounded-xl border border-line bg-card/60 p-5 backdrop-blur-xl">
          {documents.length === 0 && !loading ? (
            <p className="text-sm text-muted">
              You have no ready PDFs yet. <Link to="/library" className="text-accent hover:underline">Upload one in your library</Link>.
            </p>
          ) : (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="flex-1 space-y-1.5">
                <label htmlFor="study-doc" className="text-xs text-muted">PDF</label>
                <select
                  id="study-doc"
                  value={documentId}
                  onChange={(e) => setDocumentId(e.target.value)}
                  className="w-full rounded-full border border-line-strong bg-page/70 px-4 py-2.5 text-sm focus:border-brand focus:outline-none"
                >
                  {documents.map((doc) => (
                    <option key={doc._id} value={doc._id}>{doc.title}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 space-y-1.5">
                <label htmlFor="study-topic" className="text-xs text-muted">Topic (optional)</label>
                <input
                  id="study-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. hooks, promises, routing"
                  className="w-full rounded-full border border-line-strong bg-page/70 px-4 py-2.5 text-sm placeholder-faint focus:border-brand focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => create("deck")}
                  disabled={Boolean(creating) || !documentId}
                  className="rounded-full border border-brand/40 px-5 py-2.5 text-sm font-medium text-brand transition-all hover:bg-brand/10 hover:shadow-[0_0_20px_rgba(34,211,238,0.15)] disabled:opacity-50"
                >
                  {creating === "deck" ? "Making cards…" : "Make flashcards"}
                </button>
                <button
                  onClick={() => create("quiz")}
                  disabled={Boolean(creating) || !documentId}
                  className="rounded-full bg-linear-to-r from-brand to-brand-hover px-5 py-2.5 text-sm font-semibold text-on-brand shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:brightness-110 disabled:opacity-50"
                >
                  {creating === "quiz" ? "Writing quiz…" : "Make a quiz"}
                </button>
              </div>
            </div>
          )}

          {creating && (
            <p className="msg-in mt-4 flex items-center gap-3 text-sm text-muted">
              <span className="flex gap-1" aria-hidden="true">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </span>
              Reading your PDF and checking every answer against it. This takes about 15 seconds.
            </p>
          )}
          {error && <p className="msg-in mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-danger">{error}</p>}
        </div>
      </section>

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-48 animate-pulse rounded-xl bg-raised/60" />
          <div className="h-48 animate-pulse rounded-xl bg-raised/60" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="FLASHCARDS">
            {decks.length === 0 ? (
              <p className="text-sm text-faint">No flashcards yet. Make your first set above.</p>
            ) : (
              <ul className="space-y-2">
                {decks.map((deck) => (
                  <li key={deck._id} className="msg-in flex items-center justify-between gap-3 rounded-lg border border-line bg-page/40 p-3 transition-all hover:border-brand/30">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{deck.title}</p>
                      <p className="text-xs text-faint">
                        {deck.cardCount} cards · {deck.documentTitle} · {formatDate(deck.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {deck.dueCount > 0 && (
                        <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-medium text-warn">{deck.dueCount} due</span>
                      )}
                      <Link to={`/study/deck/${deck._id}`} className="rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand hover:bg-brand/20">
                        Study
                      </Link>
                      <DeleteControl type="deck" id={deck._id} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="QUIZZES">
            {quizzes.length === 0 ? (
              <p className="text-sm text-faint">No quizzes yet. Make your first one above.</p>
            ) : (
              <ul className="space-y-2">
                {quizzes.map((quiz) => (
                  <li key={quiz._id} className="msg-in flex items-center justify-between gap-3 rounded-lg border border-line bg-page/40 p-3 transition-all hover:border-brand/30">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{quiz.title}</p>
                      <p className="text-xs text-faint">
                        {quiz.questionCount} questions · {quiz.attemptCount} {quiz.attemptCount === 1 ? "try" : "tries"}
                        {quiz.bestScore !== null && ` · best ${quiz.bestScore}/${quiz.questionCount}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link to={`/study/quiz/${quiz._id}`} className="rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand hover:bg-brand/20">
                        {quiz.attemptCount > 0 ? "Retake" : "Start"}
                      </Link>
                      <DeleteControl type="quiz" id={quiz._id} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
