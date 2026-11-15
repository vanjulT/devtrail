import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../api.js";

const LETTERS = ["A", "B", "C", "D"];

// Small bar chart of past scores (newest on the right)
function ScoreHistory({ attempts }) {
  if (attempts.length === 0) return null;
  const recent = attempts.slice(-8);
  return (
    <div className="rounded-xl border border-line bg-card/40 p-5 backdrop-blur-sm">
      <p className="mb-4 text-[11px] font-medium tracking-[0.2em] text-brand">YOUR SCORES</p>
      <div className="flex h-28 items-end gap-3">
        {recent.map((attempt, i) => {
          const percent = Math.round((attempt.score / attempt.total) * 100);
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[11px] text-muted">{attempt.score}/{attempt.total}</span>
              <div
                className="w-full max-w-10 rounded-t-md bg-linear-to-t from-brand/40 to-brand transition-all duration-700"
                style={{ height: `${Math.max(percent, 6)}%` }}
                title={`${percent}%`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function QuizPage() {
  const { quizId } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]); // chosen option for each question
  const [position, setPosition] = useState(0);
  const [result, setResult] = useState(null); // score and corrections after submitting
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/api/quizzes/${quizId}`)
      .then((data) => setQuiz(data.quiz))
      .catch((err) => setError(err.message));
  }, [quizId]);

  function choose(optionIndex) {
    setAnswers((previous) => {
      const copy = [...previous];
      copy[position] = optionIndex;
      return copy;
    });
  }

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const data = await apiFetch(`/api/quizzes/${quizId}/attempts`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      });
      setResult(data);
      setQuiz((q) => ({ ...q, attempts: [...q.attempts, { score: data.score, total: data.total }] }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function retake() {
    setAnswers([]);
    setPosition(0);
    setResult(null);
  }

  if (error && !quiz) {
    return <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-danger">{error}</p>;
  }
  if (!quiz) {
    return <div className="mx-auto h-80 max-w-2xl animate-pulse rounded-2xl bg-raised/60" />;
  }

  const total = quiz.questions.length;
  const question = quiz.questions[position];
  const isLast = position === total - 1;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link to="/study" className="text-sm text-muted transition-colors hover:text-brand">← Study</Link>
        <p className="text-xs text-faint">{quiz.documentTitle}</p>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{quiz.title}</h1>

      {result ? (
        /* ---------- Results ---------- */
        <div className="space-y-6">
          <div className="msg-in relative overflow-hidden rounded-2xl border border-brand/20 bg-card/60 p-8 text-center backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-x-0 -top-20 mx-auto h-40 w-2/3 rounded-full bg-brand/15 blur-3xl" aria-hidden="true" />
            <p className="relative text-5xl font-bold text-brand">
              {result.score}/{result.total}
            </p>
            <p className="relative mt-2 text-muted">
              {result.score === result.total ? "Perfect score!" : result.score >= result.total / 2 ? "Good work. Check the ones you missed below." : "Keep going. The explanations below will help."}
            </p>
            <button
              onClick={retake}
              className="relative mt-6 rounded-full border border-brand/40 px-5 py-2.5 text-sm font-medium text-brand transition-all hover:bg-brand/10"
            >
              Retake quiz
            </button>
          </div>

          <ol className="space-y-4">
            {quiz.questions.map((q, i) => {
              const r = result.results[i];
              return (
                <li
                  key={i}
                  className={`msg-in rounded-xl border p-5 backdrop-blur-sm ${r.isCorrect ? "border-mint/30 bg-mint/5" : "border-red-500/30 bg-red-500/5"}`}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <p className="font-medium">
                    <span className={r.isCorrect ? "text-mint" : "text-danger"}>{r.isCorrect ? "✓" : "✕"}</span> {q.question}
                  </p>
                  {!r.isCorrect && (
                    <p className="mt-2 text-sm text-muted">
                      Your answer: {q.options[r.chosen]} · <span className="text-mint">Correct: {q.options[r.correctIndex]}</span>
                    </p>
                  )}
                  <p className="mt-2 text-sm text-soft">{r.explanation}</p>
                  {r.evidence && (
                    <p className="mt-3 border-t border-line pt-3 text-xs italic text-faint">
                      From your PDF: “{r.evidence}” {r.page && <span className="not-italic">· p. {r.page}</span>}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>

          <ScoreHistory attempts={quiz.attempts} />
        </div>
      ) : (
        /* ---------- One question at a time ---------- */
        <div className="space-y-6">
          <div className="flex gap-1.5" aria-hidden="true">
            {quiz.questions.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                  i < position ? "bg-brand" : i === position ? "bg-brand/60" : "bg-line"
                }`}
              />
            ))}
          </div>

          <div key={position} className="msg-in rounded-2xl border border-line bg-card/60 p-6 backdrop-blur-xl">
            <p className="text-xs text-faint">
              Question {position + 1} of {total}
            </p>
            <p className="mt-2 text-lg font-semibold">{question.question}</p>
            {question.code && (
              <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-page/80 p-4 text-sm text-soft">
                <code>{question.code}</code>
              </pre>
            )}

            <div className="mt-5 space-y-2" role="radiogroup" aria-label="Options">
              {question.options.map((option, i) => {
                const selected = answers[position] === i;
                return (
                  <button
                    key={i}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => choose(i)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                      selected
                        ? "border-brand bg-brand/10 shadow-[0_0_20px_-6px_rgba(34,211,238,0.5)]"
                        : "border-line-strong hover:border-brand/40 hover:bg-raised/50"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                        selected ? "border-brand bg-brand text-on-brand" : "border-line-strong text-muted"
                      }`}
                    >
                      {LETTERS[i]}
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-danger">{error}</p>}

          <div className="flex justify-between gap-3">
            <button
              onClick={() => setPosition((p) => p - 1)}
              disabled={position === 0}
              className="rounded-full px-5 py-2.5 text-sm text-muted transition-colors hover:text-ink disabled:opacity-30"
            >
              ← Back
            </button>
            {isLast ? (
              <button
                onClick={submit}
                disabled={answers.filter((a) => a !== undefined).length < total || submitting}
                className="rounded-full bg-linear-to-r from-brand to-brand-hover px-6 py-2.5 text-sm font-semibold text-on-brand shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:brightness-110 disabled:opacity-40"
              >
                {submitting ? "Checking…" : "Submit answers"}
              </button>
            ) : (
              <button
                onClick={() => setPosition((p) => p + 1)}
                disabled={answers[position] === undefined}
                className="rounded-full bg-linear-to-r from-brand to-brand-hover px-6 py-2.5 text-sm font-semibold text-on-brand transition-all hover:brightness-110 disabled:opacity-40"
              >
                Next →
              </button>
            )}
          </div>

          <ScoreHistory attempts={quiz.attempts} />
        </div>
      )}
    </div>
  );
}
