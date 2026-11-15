import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../api.js";

// Cards whose review date has come (spaced repetition)
function dueCards(deck) {
  const now = Date.now();
  return deck.cards.filter((card) => new Date(card.dueAt).getTime() <= now);
}

export default function DeckPage() {
  const { deckId } = useParams();
  const [deck, setDeck] = useState(null);
  const [queue, setQueue] = useState([]); // the cards to go through in this session
  const [position, setPosition] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/api/decks/${deckId}`)
      .then((data) => {
        setDeck(data.deck);
        setQueue(dueCards(data.deck));
      })
      .catch((err) => setError(err.message));
  }, [deckId]);

  function studyAll() {
    setQueue(deck.cards);
    setPosition(0);
    setKnown(0);
    setFlipped(false);
  }

  async function answer(knew) {
    const card = queue[position];
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/decks/${deckId}/review`, {
        method: "POST",
        body: JSON.stringify({ cardId: card._id, knew }),
      });
      if (knew) setKnown((n) => n + 1);
      setFlipped(false);
      setPosition((p) => p + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (error && !deck) {
    return <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-danger">{error}</p>;
  }
  if (!deck) {
    return <div className="mx-auto h-72 max-w-xl animate-pulse rounded-2xl bg-raised/60" />;
  }

  const card = queue[position];
  const finished = position >= queue.length;
  const progress = queue.length ? Math.round((position / queue.length) * 100) : 100;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link to="/study" className="text-sm text-muted transition-colors hover:text-brand">← Study</Link>
        <p className="text-xs text-faint">{deck.documentTitle}</p>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{deck.title}</h1>

      {/* progress bar */}
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-linear-to-r from-brand to-mint transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {finished ? (
        <div className="msg-in rounded-2xl border border-line bg-card/60 p-10 text-center backdrop-blur-xl">
          {queue.length === 0 ? (
            <>
              <p className="text-lg font-semibold">Nothing due right now</p>
              <p className="mt-2 text-sm text-muted">Cards you know come back after 1, 3, 7 and 14 days.</p>
            </>
          ) : (
            <>
              <p className="text-4xl font-bold text-brand">
                {known}/{queue.length}
              </p>
              <p className="mt-2 text-muted">cards you knew. The ones you missed come back first next time.</p>
            </>
          )}
          <button
            onClick={studyAll}
            className="mt-6 rounded-full border border-brand/40 px-5 py-2.5 text-sm font-medium text-brand transition-all hover:bg-brand/10"
          >
            Review all {deck.cards.length} cards
          </button>
        </div>
      ) : (
        <>
          <p className="text-center text-xs text-faint">
            Card {position + 1} of {queue.length}
          </p>

          {/* 3D flip card. key={card._id}: each new card starts fresh on its front side, with no spin-back */}
          <div
            key={card._id}
            role="button"
            tabIndex={0}
            onClick={() => setFlipped((f) => !f)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setFlipped((f) => !f);
              }
            }}
            className={`flip-card msg-in h-72 w-full cursor-pointer select-none rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${flipped ? "is-flipped" : ""}`}
            aria-label={flipped ? "Answer shown. Press to show the question" : "Question shown. Press to show the answer"}
          >
            <div className="flip-inner">
              {/* No backdrop blur on the faces: it breaks 3D flipping in some browsers */}
              <div className="flip-face flex flex-col items-center justify-center rounded-2xl border border-line bg-card p-8 text-center shadow-2xl transition-colors hover:border-brand/30">
                <p className="text-[11px] font-medium tracking-[0.2em] text-brand">QUESTION</p>
                <p className="mt-4 text-xl font-semibold">{card.front}</p>
                <p className="mt-6 text-xs text-faint">Click or press Space to flip</p>
              </div>
              <div className="flip-face flip-back flex flex-col items-center justify-center rounded-2xl border border-brand/30 bg-card p-8 text-center shadow-[0_0_40px_-12px_rgba(34,211,238,0.5)]">
                <p className="text-[11px] font-medium tracking-[0.2em] text-mint">ANSWER</p>
                <p className="mt-4 text-lg">{card.back}</p>
                {card.evidence && (
                  <p className="mt-4 text-xs italic text-faint">
                    “{card.evidence}” {card.page && <span className="not-italic">· p. {card.page}</span>}
                  </p>
                )}
              </div>
            </div>
          </div>

          {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-danger">{error}</p>}

          <div className={`grid grid-cols-2 gap-3 transition-opacity duration-300 ${flipped ? "opacity-100" : "pointer-events-none opacity-30"}`}>
            <button
              onClick={() => answer(false)}
              disabled={!flipped || saving}
              className="rounded-full border border-red-500/40 py-3 text-sm font-medium text-danger transition-all hover:bg-red-500/10"
            >
              ✕ Didn’t know
            </button>
            <button
              onClick={() => answer(true)}
              disabled={!flipped || saving}
              className="rounded-full border border-mint/40 py-3 text-sm font-medium text-mint transition-all hover:bg-mint/10 hover:shadow-[0_0_20px_rgba(52,211,153,0.2)]"
            >
              ✓ Knew it
            </button>
          </div>
        </>
      )}
    </div>
  );
}
