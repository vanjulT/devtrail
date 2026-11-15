import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api.js";
import { sendChatMessage } from "../chatApi.js";
import { speak, startRecording, stopSpeaking, transcribe, unlockAudio } from "../voice.js";

// The 4 voice states shown on screen
const VOICE_LABELS = {
  starting: "Starting the microphone… wait for the red dot",
  recording: "Recording, speak now. Click the mic again when you're done",
  transcribing: "Transcribing your question…",
  thinking: "Thinking… searching your PDFs",
  speaking: "Speaking the answer",
};

const EXAMPLES = ["Summarise this document", "What are the key concepts?", "Explain the hardest topic simply"];

// Shows the answer text and turns [1], [2]… into buttons that open the source
function AnswerText({ text, sources, onCite }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <p className="whitespace-pre-wrap leading-relaxed">
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        const source = match && sources.find((s) => s.number === Number(match[1]));
        if (source) {
          return (
            <button
              key={i}
              onClick={() => onCite(source)}
              className="mx-0.5 rounded-full bg-cite/15 px-2 text-xs font-semibold text-cite transition-all hover:bg-cite/25 hover:shadow-[0_0_12px_rgba(142,166,255,0.4)]"
              title={`${source.title}, page ${source.page}`}
            >
              {match[1]}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

export default function ChatPage() {
  const { chatId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bottomRef = useRef(null);
  const skipNextLoad = useRef(null); // avoids reloading a chat we just created

  const [chats, setChats] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [scope, setScope] = useState(searchParams.get("doc") || ""); // "" = all PDFs
  // The messages on screen, and which chat they belong to (null = a new chat not saved yet)
  const [thread, setThread] = useState({ id: null, messages: [] });
  const [failedChatId, setFailedChatId] = useState(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [openSource, setOpenSource] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [voiceStatus, setVoiceStatus] = useState("idle"); // idle, starting, recording, transcribing, thinking, speaking
  const stopRecording = useRef(null);

  // Worked out from the state above instead of stored separately
  const currentId = chatId || null;
  const messages = thread.id === currentId ? thread.messages : [];
  const loadingChat = Boolean(chatId) && thread.id !== chatId && failedChatId !== chatId;

  async function loadChats() {
    try {
      const data = await apiFetch("/api/chats");
      setChats(data.chats);
    } catch (err) {
      setError(err.message);
    }
  }

  // Load past chats and the PDFs that are ready
  useEffect(() => {
    apiFetch("/api/chats")
      .then((data) => setChats(data.chats))
      .catch((err) => setError(err.message));
    apiFetch("/api/documents")
      .then((data) => setDocuments(data.documents.filter((doc) => doc.status === "ready")))
      .catch((err) => setError(err.message));
  }, []);

  // Open the chat in the address bar (a new chat needs nothing loaded)
  useEffect(() => {
    if (!chatId) return;
    if (skipNextLoad.current === chatId) {
      skipNextLoad.current = null;
      return;
    }
    let cancelled = false;
    apiFetch(`/api/chats/${chatId}`)
      .then((data) => {
        if (cancelled) return;
        setThread({ id: chatId, messages: data.chat.messages });
        setScope(data.chat.documentId || "");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setFailedChatId(chatId);
      });
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  // Keep the newest message in view
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  // Changes only the last message (the answer being written)
  function updateLastMessage(changes) {
    setThread((previous) => {
      const copy = [...previous.messages];
      copy[copy.length - 1] = { ...copy[copy.length - 1], ...changes };
      return { ...previous, messages: copy };
    });
  }

  // Sends a question, shows the answer as it streams in, and returns the full answer (null if it failed)
  // voice = true when the question came from the mic, so the server gives a short spoken answer
  async function askQuestion(question, voice = false) {
    if (!question.trim() || sending) return null;
    setInput("");
    setError("");
    setSending(true);
    setThread((previous) => ({
      id: currentId,
      messages: [
        ...(previous.id === currentId ? previous.messages : []),
        { role: "user", content: question },
        { role: "assistant", content: "", sources: [], pending: true },
      ],
    }));

    try {
      const result = await sendChatMessage(
        { message: question, chatId, documentId: chatId ? undefined : scope || undefined, voice },
        {
          onStart: ({ sources }) => updateLastMessage({ sources }),
          onText: (text) => updateLastMessage({ content: text }),
        }
      );
      updateLastMessage({ pending: false });

      // A new chat now has an id: keep the messages and put the id in the address bar
      if (!chatId && result.chatId) {
        setThread((previous) => ({ ...previous, id: result.chatId }));
        skipNextLoad.current = result.chatId;
        navigate(`/chat/${result.chatId}`, { replace: true });
      }
      loadChats();
      return result.text;
    } catch (err) {
      setError(err.message);
      // remove the question and the empty answer, and give the question back so the user can retry
      setThread((previous) => ({ ...previous, messages: previous.messages.slice(0, -2) }));
      setInput(question);
      return null;
    } finally {
      setSending(false);
    }
  }

  // ---------- Voice mode: record → transcribe → think → speak ----------
  async function handleMic() {
    // Second click while recording: stop and send the recording
    if (voiceStatus === "recording") {
      unlockAudio(); // unlock sound now, during the click, so Safari lets the voice play later
      const audio = await stopRecording.current();
      stopRecording.current = null;
      setVoiceStatus("transcribing");
      try {
        const question = await transcribe(audio);
        setVoiceStatus("thinking");
        const answer = await askQuestion(question, true);
        if (!answer) {
          setVoiceStatus("idle");
          return;
        }
        setVoiceStatus("speaking");
        speak(answer, () => setVoiceStatus("idle"));
      } catch (err) {
        setError(err.message);
        setVoiceStatus("idle");
      }
      return;
    }

    // While speaking: the mic button stops the voice
    if (voiceStatus === "speaking") {
      stopSpeaking();
      setVoiceStatus("idle");
      return;
    }

    // First click: start recording (the red dot only shows once the mic is really listening)
    setError("");
    setVoiceStatus("starting");
    try {
      stopRecording.current = await startRecording();
      setVoiceStatus("recording");
    } catch (err) {
      setError(err.message);
      setVoiceStatus("idle");
    }
  }

  // Stop any voice when leaving the page
  useEffect(() => () => stopSpeaking(), []);

  function handleSubmit(event) {
    event.preventDefault();
    askQuestion(input.trim());
  }

  function startNewChat() {
    setScope("");
    setError("");
    navigate("/chat");
  }

  async function deleteChat(id) {
    try {
      await apiFetch(`/api/chats/${id}`, { method: "DELETE" });
      setChats((previous) => previous.filter((chat) => chat._id !== id));
      if (id === chatId) navigate("/chat");
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      {/* Past chats */}
      <aside className="space-y-4 md:w-64 md:shrink-0">
        <button
          onClick={startNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-brand to-brand-hover py-2.5 text-sm font-semibold text-on-brand shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:brightness-110"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New chat
        </button>

        <div className="rounded-xl border border-line bg-card/40 p-3 backdrop-blur-sm">
          <h2 className="px-2 pb-2 text-[11px] font-medium tracking-[0.2em] text-brand">PAST CHATS</h2>
          {chats.length === 0 && <p className="px-2 py-1 text-sm text-faint">No chats yet.</p>}
          <ul className="space-y-1">
            {chats.map((chat) => (
              <li
                key={chat._id}
                className={`msg-in rounded-lg transition-all ${
                  chat._id === chatId ? "bg-brand/10 shadow-[0_0_16px_rgba(34,211,238,0.10)]" : "hover:bg-raised/70"
                }`}
              >
                {confirmDeleteId === chat._id ? (
                  <div className="flex items-center gap-2 p-2 text-sm">
                    <span className="text-soft">Delete?</span>
                    <button onClick={() => deleteChat(chat._id)} className="rounded-full bg-red-500 px-3 py-0.5 text-white hover:bg-red-400">
                      Yes
                    </button>
                    <button onClick={() => setConfirmDeleteId(null)} className="rounded-full px-3 py-0.5 hover:bg-line-strong">
                      No
                    </button>
                  </div>
                ) : (
                  <div className="group flex items-center">
                    <Link
                      to={`/chat/${chat._id}`}
                      className={`min-w-0 flex-1 truncate px-3 py-2 text-sm ${chat._id === chatId ? "text-brand" : "text-soft"}`}
                    >
                      {chat.title}
                    </Link>
                    <button
                      onClick={() => setConfirmDeleteId(chat._id)}
                      className="px-2 text-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus:opacity-100"
                      aria-label={`Delete chat ${chat.title}`}
                    >
                      ×
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* The conversation: a glass panel with a soft glow behind it */}
      <div className="relative min-w-0 flex-1">
        <div className="pointer-events-none absolute -inset-3 rounded-2xl bg-linear-to-r from-brand/10 to-mint/5 opacity-70 blur-2xl" aria-hidden="true" />

        <section className="relative flex min-h-[72vh] flex-col overflow-hidden rounded-xl border border-line bg-card/60 shadow-2xl backdrop-blur-xl">
          {/* window bar, like the preview on the landing page */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 text-sm">
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="scope" className="text-xs text-muted">Searching in</label>
              <select
                id="scope"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                disabled={Boolean(chatId)}
                className="rounded-full border border-line-strong bg-page/70 px-3 py-1 text-xs transition-colors hover:border-brand/50 focus:border-brand focus:outline-none disabled:opacity-70"
              >
                <option value="">All my PDFs</option>
                {documents.map((doc) => (
                  <option key={doc._id} value={doc._id}>{doc.title}</option>
                ))}
              </select>
            </div>
            <span className="w-12" aria-hidden="true" />
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            {loadingChat && (
              <div className="space-y-4">
                <div className="ml-auto h-11 w-1/2 animate-pulse rounded-3xl bg-brand/10" />
                <div className="h-24 w-4/5 animate-pulse rounded-3xl bg-raised" />
              </div>
            )}

            {!loadingChat && messages.length === 0 && (
              <div className="msg-in flex flex-col items-center py-14 text-center">
                <div className="relative mb-6">
                  <div className="absolute inset-0 rounded-full bg-brand/30 blur-xl" aria-hidden="true" />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-brand/30 bg-page text-brand">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
                      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
                      <path d="M8.5 11h7M8.5 14h4" />
                    </svg>
                  </div>
                </div>
                {documents.length === 0 ? (
                  <p className="text-muted">
                    You have no PDFs yet. <Link to="/library" className="text-accent hover:underline">Upload one in your library</Link> first.
                  </p>
                ) : (
                  <>
                    <h1 className="bg-linear-to-b from-ink to-muted bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                      Ask anything about <span className="bg-linear-to-r from-brand to-mint bg-clip-text text-transparent">your PDFs</span>
                    </h1>
                    <p className="mt-2 text-sm text-muted">Answers come only from your material, with the page they came from.</p>
                    <div className="mt-8 flex flex-wrap justify-center gap-2">
                      {EXAMPLES.map((example, i) => (
                        <button
                          key={example}
                          onClick={() => askQuestion(example)}
                          className="msg-in rounded-full border border-line-strong bg-page/50 px-4 py-2 text-sm text-soft backdrop-blur-sm transition-all hover:border-brand/50 hover:text-ink hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                          style={{ animationDelay: `${150 + i * 100}ms` }}
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {!loadingChat &&
              messages.map((msg, i) =>
                msg.role === "user" ? (
                  <div
                    key={i}
                    className="msg-in bubble bubble-user ml-auto max-w-[85%] bg-brand px-5 py-3 text-on-brand shadow-[0_0_24px_-6px_rgba(34,211,238,0.5)]"
                  >
                    {msg.content}
                  </div>
                ) : (
                  <div key={i} className="msg-in bubble bubble-ai mr-auto max-w-[90%] space-y-3 bg-raised px-5 py-3.5">
                    {msg.pending && !msg.content ? (
                      <p className="flex items-center gap-3 text-sm text-muted">
                        <span className="flex gap-1" aria-hidden="true">
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                        </span>
                        Searching your PDFs…
                      </p>
                    ) : (
                      <div>
                        <AnswerText text={msg.content} sources={msg.sources || []} onCite={setOpenSource} />
                        {msg.pending && <span className="stream-caret" aria-hidden="true" />}
                      </div>
                    )}
                    {!msg.pending && msg.sources?.length > 0 && (
                      <div className="msg-in flex flex-wrap gap-1.5 border-t border-line-strong/60 pt-3">
                        {msg.sources.map((source) => (
                          <button
                            key={source.number}
                            onClick={() => setOpenSource(source)}
                            className="rounded-full border border-line bg-page/60 px-2.5 py-1 text-[11px] text-muted transition-all hover:border-cite/50 hover:text-cite hover:shadow-[0_0_14px_rgba(142,166,255,0.25)]"
                          >
                            <span className="font-semibold text-cite">[{source.number}]</span> {source.title} · p. {source.page}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              )}
            <div ref={bottomRef} />
          </div>

          {error && (
            <p className="msg-in mx-4 mb-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-danger">{error}</p>
          )}

          {/* Question box: a glass pill that glows when you type in it */}
          {voiceStatus !== "idle" && (
            <div className="msg-in mx-4 mb-2 flex items-center gap-3 rounded-full border border-brand/30 bg-brand/5 px-4 py-2 text-sm text-soft" role="status">
              {voiceStatus === "recording" ? (
                <span className="relative flex h-3 w-3" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                </span>
              ) : voiceStatus === "speaking" ? (
                <span className="flex h-4 items-end gap-0.5" aria-hidden="true">
                  {[0, 1, 2, 3].map((bar) => (
                    <span key={bar} className="voice-bar w-1 rounded-full bg-brand" style={{ animationDelay: `${bar * 0.12}s` }} />
                  ))}
                </span>
              ) : (
                <span className="flex gap-1" aria-hidden="true">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </span>
              )}
              {VOICE_LABELS[voiceStatus]}
              {voiceStatus === "speaking" && (
                <button type="button" onClick={handleMic} className="ml-auto rounded-full px-3 py-0.5 text-xs text-muted hover:bg-raised hover:text-ink">
                  Stop
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="border-t border-line p-4">
            <div className="flex items-center gap-2 rounded-full border border-line-strong bg-page/60 p-1.5 pl-5 transition-all focus-within:border-brand/60 focus-within:shadow-[0_0_24px_-4px_rgba(34,211,238,0.35)]">
              <label htmlFor="question" className="sr-only">Your question</label>
              <input
                id="question"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={sending || documents.length === 0}
                placeholder="Ask about your PDFs…"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm placeholder-faint focus:outline-none disabled:opacity-60"
              />
              <button
                type="button"
                onClick={handleMic}
                disabled={documents.length === 0 || (sending && voiceStatus === "idle") || ["starting", "transcribing", "thinking"].includes(voiceStatus)}
                aria-label={voiceStatus === "recording" ? "Stop recording and send" : voiceStatus === "speaking" ? "Stop speaking" : "Ask with your voice"}
                title={voiceStatus === "recording" ? "Stop and send" : "Ask with your voice"}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all disabled:opacity-40 ${
                  voiceStatus === "recording"
                    ? "border-red-500/60 bg-red-500/15 text-danger shadow-[0_0_20px_rgba(239,68,68,0.35)]"
                    : "border-line-strong text-muted hover:border-brand/50 hover:text-brand hover:shadow-[0_0_16px_rgba(34,211,238,0.2)]"
                }`}
              >
                {voiceStatus === "recording" ? (
                  <span className="h-3 w-3 rounded-sm bg-current" aria-hidden="true" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                  </svg>
                )}
              </button>
              <button
                type="submit"
                disabled={sending || !input.trim()}
                aria-label="Send question"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-r from-brand to-brand-hover text-on-brand shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all hover:shadow-[0_0_28px_rgba(6,182,212,0.4)] hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
              >
                {sending ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-brand border-t-transparent" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                )}
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* The source the user clicked on */}
      {openSource && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setOpenSource(null)}>
          <div
            className="msg-in max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-cite/30 bg-card/90 p-6 shadow-[0_0_40px_-10px_rgba(142,166,255,0.4)] backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium tracking-[0.2em] text-cite">SOURCE [{openSource.number}]</p>
                <h3 className="mt-1 font-semibold">{openSource.title} · page {openSource.page}</h3>
              </div>
              <button
                onClick={() => setOpenSource(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-raised hover:text-ink"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-soft">{openSource.text}</p>
          </div>
        </div>
      )}
    </div>
  );
}