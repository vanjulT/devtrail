import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";

const PLAN_DAYS = 30; // the dashboard shows the next 30 days
const EXAMPLES = [
  "My exam is in 7 days. Plan 30 minutes a day from my PDFs.",
  "Move tomorrow's task to the day after.",
  "Add a quiz on the last day of my plan.",
];

// Each tool gets an icon and a readable name in the chat
const TOOL_LABELS = {
  list_documents: { icon: "📄", name: "Looked at your PDFs" },
  get_document_topics: { icon: "🔎", name: "Read the PDF topics" },
  get_schedule: { icon: "📅", name: "Checked your plan" },
  create_study_tasks: { icon: "➕", name: "Added tasks" },
  update_study_task: { icon: "✏️", name: "Changed a task" },
  delete_study_task: { icon: "🗑️", name: "Removed a task" },
  create_quiz: { icon: "📝", name: "Made a quiz" },
};

// Full class names (Tailwind only keeps classes it can see written out)
const TYPE_STYLES = {
  read: "bg-brand/10 text-brand",
  flashcards: "bg-mint/10 text-mint",
  quiz: "bg-cite/15 text-cite",
  review: "bg-warn/10 text-warn",
  practice: "bg-accent/10 text-accent",
};
const TASK_TYPES = Object.keys(TYPE_STYLES);

// Today's date on the user's computer, as "YYYY-MM-DD" ("en-CA" writes dates that way)
function localDate(offsetDays = 0) {
  const day = new Date();
  day.setDate(day.getDate() + offsetDays);
  return day.toLocaleDateString("en-CA");
}

function dayLabel(date) {
  if (date === localDate(0)) return "Today";
  if (date === localDate(1)) return "Tomorrow";
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

// { "2026-11-15": [task, task], "2026-11-16": [task] } in date order
function groupByDay(tasks) {
  const groups = {};
  for (const task of tasks) {
    (groups[task.date] ||= []).push(task);
  }
  return Object.entries(groups);
}

// One card in the chat for each tool the coach used
function ToolStep({ step }) {
  const label = TOOL_LABELS[step.tool] || { icon: "🔧", name: step.tool };
  return (
    <details
      className={`msg-in group rounded-xl border px-3 py-2 text-xs ${
        step.ok ? "border-line bg-page/50" : "border-red-500/40 bg-red-500/10"
      }`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2">
        <span aria-hidden="true">{label.icon}</span>
        <span className="font-semibold text-ink">{label.name}</span>
        <code className="rounded bg-raised px-1.5 py-0.5 text-[10px] text-muted">{step.tool}</code>
        <span className={`ml-auto font-semibold ${step.ok ? "text-success" : "text-danger"}`}>{step.ok ? "✓" : "✕ failed"}</span>
      </summary>
      <p className="mt-1.5 text-soft">{step.summary}</p>
      <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-raised p-2 text-[10px] leading-relaxed text-muted">
        {JSON.stringify(step.input, null, 2)}
      </pre>
    </details>
  );
}

export default function PlanPage() {
  // ---------- Coach chat ----------
  const [messages, setMessages] = useState([]); // { role, content, toolSteps? }
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef(null);

  // ---------- Dashboard ----------
  const [tasks, setTasks] = useState([]);
  const [dueCards, setDueCards] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncCount, setSyncCount] = useState(0); // goes up after each reload, to replay the "in sync" animation
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newTask, setNewTask] = useState({ date: localDate(), title: "", minutes: 30, type: "read" });

  const planPath = `/api/tasks?from=${localDate()}&days=${PLAN_DAYS}`;

  function showPlan(data) {
    setTasks(data.tasks);
    setDueCards(data.dueCards);
    setSyncCount((count) => count + 1);
  }

  async function reloadPlan() {
    try {
      showPlan(await apiFetch(planPath));
    } catch (err) {
      setError(err.message);
    }
  }

  // Load the plan when the page opens
  useEffect(() => {
    apiFetch(`/api/tasks?from=${localDate()}&days=${PLAN_DAYS}`)
      .then(showPlan)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Keep the newest message in view
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  async function askCoach(text) {
    const question = text.trim();
    if (!question || thinking) return;
    const conversation = [...messages, { role: "user", content: question }];
    setMessages(conversation);
    setInput("");
    setError("");
    setThinking(true);
    try {
      const data = await apiFetch("/api/agent", {
        method: "POST",
        body: JSON.stringify({
          messages: conversation.map(({ role, content }) => ({ role, content })),
          today: localDate(),
        }),
      });
      setMessages([...conversation, { role: "assistant", content: data.text, toolSteps: data.toolSteps }]);
      // The coach may have changed the plan: reload the dashboard so both stay in sync
      if (data.toolSteps.length > 0) await reloadPlan();
    } catch (err) {
      setError(err.message);
      setMessages(messages); // remove the question, and give it back to retry
      setInput(question);
    } finally {
      setThinking(false);
    }
  }

  async function toggleDone(task) {
    // Tick it on screen straight away, undo if the server says no
    setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ done: !task.done }) });
    } catch (err) {
      setError(err.message);
      setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)));
    }
  }

  async function deleteTask(task) {
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      setTasks((list) => list.filter((t) => t.id !== task.id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function addTask(event) {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ ...newTask, minutes: Number(newTask.minutes) }),
      });
      setNewTask({ ...newTask, title: "" });
      setShowForm(false);
      await reloadPlan();
    } catch (err) {
      setError(err.message);
    }
  }

  // Numbers for the stat cards
  const todayTasks = tasks.filter((t) => t.date === localDate());
  const weekTasks = tasks.filter((t) => t.date <= localDate(6));
  const doneCount = tasks.filter((t) => t.done).length;
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const weekMinutes = weekTasks.reduce((sum, t) => sum + t.minutes, 0);

  const field =
    "rounded-lg border border-line-strong bg-page/70 px-3 py-2 text-sm focus:border-brand focus:outline-none";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      {/* ---------- Left: the study coach (agent chat) ---------- */}
      <div className="relative min-w-0">
        <div className="pointer-events-none absolute -inset-3 rounded-2xl bg-linear-to-r from-brand/10 to-mint/5 opacity-70 blur-2xl" aria-hidden="true" />
        <section className="relative flex h-[75vh] flex-col overflow-hidden rounded-xl border border-line bg-card/60 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-line px-5 py-4">
            <h1 className="text-lg font-bold tracking-tight">Study coach</h1>
            <p className="text-xs text-muted">Ask for a plan. You can see every tool the coach uses.</p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && (
              <div className="msg-in py-8 text-center">
                <p className="text-sm text-muted">Try one of these:</p>
                <div className="mt-4 flex flex-col items-center gap-2">
                  {EXAMPLES.map((example) => (
                    <button
                      key={example}
                      onClick={() => askCoach(example)}
                      className="rounded-full border border-line-strong bg-page/50 px-4 py-2 text-sm text-soft transition-all hover:border-brand/50 hover:text-ink hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) =>
              msg.role === "user" ? (
                <div key={i} className="msg-in bubble bubble-user ml-auto max-w-[85%] bg-brand px-4 py-2.5 text-sm text-on-brand">
                  {msg.content}
                </div>
              ) : (
                <div key={i} className="space-y-2">
                  {msg.toolSteps?.map((step, j) => <ToolStep key={j} step={step} />)}
                  <div className="msg-in bubble bubble-ai mr-auto max-w-[90%] bg-raised px-4 py-3 text-sm leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              )
            )}

            {thinking && (
              <p className="msg-in flex items-center gap-3 text-sm text-muted">
                <span className="flex gap-1" aria-hidden="true">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </span>
                The coach is working… (making a quiz can take 10 to 20 seconds)
              </p>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              askCoach(input);
            }}
            className="border-t border-line p-4"
          >
            <div className="flex items-center gap-2 rounded-full border border-line-strong bg-page/60 p-1.5 pl-5 transition-all focus-within:border-brand/60 focus-within:shadow-[0_0_24px_-4px_rgba(34,211,238,0.35)]">
              <label htmlFor="coach" className="sr-only">Message the coach</label>
              <input
                id="coach"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={thinking}
                placeholder="e.g. Move Friday's task to Saturday"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm placeholder-faint focus:outline-none disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={thinking || !input.trim()}
                className="rounded-full bg-linear-to-r from-brand to-brand-hover px-5 py-2 text-sm font-semibold text-on-brand transition-all hover:brightness-110 disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* ---------- Right: the plan dashboard ---------- */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight">My plan</h2>
          <span key={syncCount} className="msg-in rounded-full bg-mint/10 px-3 py-1 text-xs font-semibold text-mint">
            ● In sync with the coach
          </span>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-line bg-card/40 p-3 backdrop-blur-sm">
            <p className="text-2xl font-bold">
              {todayTasks.filter((t) => t.done).length}/{todayTasks.length}
            </p>
            <p className="text-xs text-muted">done today</p>
          </div>
          <div className="rounded-xl border border-line bg-card/40 p-3 backdrop-blur-sm">
            <p className="text-2xl font-bold">{weekMinutes}</p>
            <p className="text-xs text-muted">min this week</p>
          </div>
          <Link to="/study" className="rounded-xl border border-line bg-card/40 p-3 backdrop-blur-sm transition-colors hover:border-mint/50">
            <p className="text-2xl font-bold text-mint">{dueCards}</p>
            <p className="text-xs text-muted">cards to review</p>
          </Link>
        </div>

        {/* Progress bar */}
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>Plan progress</span>
            <span>{doneCount} of {tasks.length} tasks · {progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-raised">
            <div className="h-full rounded-full bg-linear-to-r from-brand to-mint transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {error && <p className="msg-in rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-danger">{error}</p>}

        {/* Tasks, grouped by day */}
        <div className="max-h-[48vh] space-y-4 overflow-y-auto pr-1">
          {loading && <div className="h-24 animate-pulse rounded-xl bg-raised" />}
          {!loading && tasks.length === 0 && (
            <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">
              No tasks yet. Ask the coach for a plan, or add one yourself.
            </p>
          )}
          {groupByDay(tasks).map(([date, dayTasks]) => (
            <div key={date}>
              <h3 className={`mb-2 text-[11px] font-medium tracking-[0.2em] ${date === localDate() ? "text-brand" : "text-muted"}`}>
                {dayLabel(date).toUpperCase()}
              </h3>
              <ul className="space-y-2">
                {dayTasks.map((task) => (
                  <li
                    key={task.id}
                    className={`msg-in group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                      date === localDate() && !task.done ? "border-brand/40 bg-brand/5" : "border-line bg-card/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => toggleDone(task)}
                      aria-label={`Mark "${task.title}" as done`}
                      className="h-5 w-5 shrink-0 accent-brand"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate ${task.done ? "text-faint line-through" : ""}`}>{task.title}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${TYPE_STYLES[task.type]}`}>{task.type}</span>
                        <span>{task.minutes} min</span>
                        {task.quizId && (
                          <Link to={`/study/quiz/${task.quizId}`} className="font-semibold text-cite hover:underline">
                            Take quiz →
                          </Link>
                        )}
                        {task.type === "flashcards" && (
                          <Link to="/study" className="font-semibold text-mint hover:underline">
                            Review cards →
                          </Link>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteTask(task)}
                      className="px-1 text-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus:opacity-100"
                      aria-label={`Delete task ${task.title}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Add a task by hand */}
        {showForm ? (
          <form onSubmit={addTask} className="msg-in space-y-2 rounded-xl border border-line bg-card/40 p-3 backdrop-blur-sm">
            <label htmlFor="task-title" className="sr-only">Task</label>
            <input
              id="task-title"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="What do you want to do?"
              className={`${field} w-full`}
              required
              minLength={3}
            />
            <div className="flex flex-wrap gap-2">
              <label htmlFor="task-date" className="sr-only">Day</label>
              <input
                id="task-date"
                type="date"
                value={newTask.date}
                min={localDate()}
                onChange={(e) => setNewTask({ ...newTask, date: e.target.value })}
                className={field}
                required
              />
              <label htmlFor="task-minutes" className="sr-only">Minutes</label>
              <input
                id="task-minutes"
                type="number"
                min="5"
                max="240"
                step="5"
                value={newTask.minutes}
                onChange={(e) => setNewTask({ ...newTask, minutes: e.target.value })}
                className={`${field} w-24`}
              />
              <label htmlFor="task-type" className="sr-only">Type</label>
              <select
                id="task-type"
                value={newTask.type}
                onChange={(e) => setNewTask({ ...newTask, type: e.target.value })}
                className={field}
              >
                {TASK_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-on-brand hover:brightness-110">
                Add task
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-full px-4 py-1.5 text-sm text-muted hover:text-ink">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full rounded-xl border border-dashed border-brand/40 py-2.5 text-sm font-semibold text-brand transition-all hover:bg-brand/5"
          >
            + Add a task yourself
          </button>
        )}
      </section>
    </div>
  );
}