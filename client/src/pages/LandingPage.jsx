import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/auth.js";
import ThemeToggle from "../components/ThemeToggle.jsx";
import MadeBy from "../components/MadeBy.jsx";

// Thin wireframe icons (1.5px strokes, no fill), drawn inline so no icon library is needed
function Icon({ children }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      {children}
    </svg>
  );
}

// Each card has its own accent: the icon box and the hover border use it
const FEATURES = [
  {
    title: "Ask your documents",
    text: "Upload docs, books or course notes. Every answer comes from your own material, with the page it came from.",
    tone: "cyan",
    icon: (
      <Icon>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6M9 17h4" />
      </Icon>
    ),
  },
  {
    title: "Flashcards & quizzes",
    text: "Turn any chapter into flashcards and “what does this code do?” quizzes, then track your scores over time.",
    tone: "mint",
    icon: (
      <Icon>
        <rect x="3" y="6" width="14" height="14" rx="1" />
        <path d="M7 3h13a1 1 0 0 1 1 1v13" />
        <path d="M7 12l2 2 4-4" />
      </Icon>
    ),
  },
  {
    title: "Voice mode",
    text: "Ask a coding question out loud. DevTrail transcribes it, answers from your notes and reads the answer back.",
    tone: "cyan",
    icon: (
      <Icon>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <path d="M12 18v3" />
      </Icon>
    ),
  },
  {
    title: "Study-plan agent",
    text: "Say “I want to learn React in two weeks”. An agent builds a dated roadmap and keeps it in sync with your dashboard.",
    tone: "slate",
    icon: (
      <Icon>
        <rect x="3" y="4" width="18" height="17" rx="1" />
        <path d="M3 9h18M8 2v4M16 2v4" />
        <path d="M8 14h3M8 17h6" />
      </Icon>
    ),
  },
];

const TONES = {
  cyan: { box: "bg-brand/10 text-brand border-brand/20", hover: "hover:border-brand/30" },
  mint: { box: "bg-mint/10 text-mint border-mint/20", hover: "hover:border-mint/30" },
  slate: { box: "bg-raised/60 text-muted border-line-strong/60", hover: "hover:border-line-strong" },
};


// ---------- 1. Live product preview: a question types itself, the answer streams in ----------
const DEMO_QUESTION = "How does useEffect cleanup work?";
const DEMO_ANSWER =
  "The cleanup function runs before the effect runs again, and when the component unmounts [1]. Use it to cancel timers, subscriptions or requests, so nothing keeps running in the background [2].";
const DEMO_WORDS = DEMO_ANSWER.split(" ");
const DEMO_SOURCES = [
  { number: 1, label: "React docs · p. 22" },
  { number: 2, label: "React docs · p. 24" },
];
const EMPTY_DEMO = { typed: 0, searching: false, words: 0, done: false };

const FINISHED_DEMO = { typed: DEMO_QUESTION.length, searching: false, words: DEMO_WORDS.length, done: true };

function prefersLessMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useDemoTimeline() {
  // People who prefer less motion see the finished conversation straight away
  const [demo, setDemo] = useState(() => (prefersLessMotion() ? FINISHED_DEMO : EMPTY_DEMO));

  useEffect(() => {
    if (prefersLessMotion()) return;

    const timers = [];
    const at = (ms, update) => timers.push(setTimeout(() => setDemo((d) => ({ ...d, ...update })), ms));

    function play() {
      let t = 700;
      for (let i = 1; i <= DEMO_QUESTION.length; i++) {
        at(t, { typed: i });
        t += 45;
      }
      t += 350;
      at(t, { searching: true });
      t += 1200;
      at(t, { searching: false });
      for (let i = 1; i <= DEMO_WORDS.length; i++) {
        at(t, { words: i });
        t += 65;
      }
      at(t + 200, { done: true });
      // Hold the finished answer, then start again
      timers.push(
        setTimeout(() => {
          setDemo(EMPTY_DEMO);
          play();
        }, t + 6000)
      );
    }

    play();
    return () => timers.forEach(clearTimeout);
  }, []);

  return demo;
}

// Turns [1], [2] in the answer into small cyan citation chips
function CitedText({ text }) {
  return text.split(/(\[\d\])/g).map((part, i) =>
    /^\[\d\]$/.test(part) ? (
      <span key={i} className="mx-0.5 rounded bg-cite/15 px-1.5 py-0.5 text-[11px] font-semibold text-cite">
        {part.slice(1, -1)}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function HeroPreview() {
  const demo = useDemoTimeline();
  const question = DEMO_QUESTION.slice(0, demo.typed);
  const answer = DEMO_WORDS.slice(0, demo.words).join(" ");

  return (
    <div className="reveal relative mx-auto mt-20 max-w-3xl text-left" style={{ animationDelay: "500ms" }}>
      {/* soft glow behind the window */}
      <div className="absolute -inset-4 rounded-2xl bg-linear-to-r from-brand/20 to-mint/10 opacity-60 blur-2xl" aria-hidden="true" />

      <div className="relative overflow-hidden rounded-xl border border-line bg-card/70 shadow-2xl backdrop-blur-xl">
        {/* window bar */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          </div>
          <span className="rounded-full border border-line px-3 py-0.5 text-[11px] text-muted">Searching in: React docs.pdf</span>
          <span className="w-12" aria-hidden="true" />
        </div>

        {/* conversation */}
        <div className="min-h-[260px] space-y-5 p-6 text-sm" aria-label="Example conversation in DevTrail">
          <div className="bubble bubble-user ml-auto max-w-[80%] bg-brand px-4 py-2.5 text-on-brand">
            {question || " "}
            {demo.typed < DEMO_QUESTION.length && <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-on-brand align-middle" />}
          </div>

          {(demo.searching || demo.words > 0) && (
            <div className="bubble bubble-ai mr-auto max-w-[90%] bg-raised px-4 py-3 leading-relaxed text-soft">
              {demo.searching ? (
                <span className="flex items-center gap-2 text-muted">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-transparent" />
                  Searching your PDFs…
                </span>
              ) : (
                <CitedText text={answer} />
              )}
            </div>
          )}

          <div className={`flex flex-wrap gap-2 transition-opacity duration-700 ${demo.done ? "opacity-100" : "opacity-0"}`}>
            {DEMO_SOURCES.map((source) => (
              <span key={source.number} className="rounded-md border border-line bg-page/60 px-2.5 py-1 text-[11px] text-muted">
                <span className="font-semibold text-cite">[{source.number}]</span> {source.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- 2. How it works: three steps, the line fills in when it scrolls into view ----------
function useInView() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect(); // only needs to happen once
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, inView];
}

const STEPS = [
  {
    title: "Upload",
    text: "Drop in a PDF: docs, a book chapter or your course notes.",
    icon: (
      <Icon>
        <path d="M12 16V4M7 9l5-5 5 5" />
        <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
      </Icon>
    ),
  },
  {
    title: "Ask",
    text: "Chat with it. Every answer cites the exact page it came from.",
    icon: (
      <Icon>
        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
      </Icon>
    ),
  },
  {
    title: "Learn",
    text: "Practise with quizzes and follow a day-by-day study plan.",
    icon: (
      <Icon>
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M14 7h7v7" />
      </Icon>
    ),
  },
];

function HowItWorks() {
  const [ref, inView] = useInView();

  return (
    <section id="how-it-works" ref={ref} className="mt-32 scroll-mt-24" aria-labelledby="how-title">
      <p className="text-xs font-medium tracking-[0.25em] text-brand">HOW IT WORKS</p>
      <h2 id="how-title" className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
        From PDF to progress in three steps
      </h2>

      <div className="relative mt-14">
        {/* the connecting line (desktop only): grey track + cyan fill */}
        <div className="absolute left-[16.66%] right-[16.66%] top-6 hidden h-px bg-line md:block" aria-hidden="true">
          <div
            className="h-px bg-linear-to-r from-brand to-mint shadow-[0_0_12px_rgba(34,211,238,0.6)] transition-[width] duration-[1600ms] ease-out"
            style={{ width: inView ? "100%" : "0%" }}
          />
        </div>

        <ol className="grid gap-10 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="relative flex flex-col items-center transition-all duration-700"
              style={{
                opacity: inView ? 1 : 0.35,
                transform: inView ? "none" : "translateY(8px)",
                transitionDelay: `${i * 350}ms`,
              }}
            >
              <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-brand/30 bg-page text-brand shadow-[0_0_20px_rgba(34,211,238,0.15)]">
                {step.icon}
              </div>
              <p className="mt-5 text-xs font-medium tracking-widest text-faint">STEP {i + 1}</p>
              <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------- 3. Feature card with a soft cyan spotlight that follows the mouse ----------
function SpotlightCard({ className = "", style, children }) {
  const ref = useRef(null);

  function handleMouseMove(event) {
    const rect = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    ref.current.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  }

  return (
    <article ref={ref} onMouseMove={handleMouseMove} className={`relative overflow-hidden ${className}`} style={style}>
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(260px circle at var(--spot-x, 50%) var(--spot-y, 50%), color-mix(in oklab, var(--color-brand) 14%, transparent), transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div className="relative">{children}</div>
    </article>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const startLink = user ? "/library" : "/register";

  return (
    <div className="min-h-screen bg-page font-sans text-ink selection:bg-brand/30 selection:text-brand">
      {/* Subtle glowing orbs in the background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-[-10%] top-[-10%] h-[600px] w-[600px] rounded-full bg-brand/5 blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[600px] w-[600px] rounded-full bg-mint/5 blur-[150px]" />
      </div>

      {/* 1. Nav bar: sticky, transparent with blur */}
      <nav className="sticky top-0 z-50 border-b border-line bg-page/70 backdrop-blur-md" aria-label="Main">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-wider">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand" aria-hidden="true" />
            DEVTRAIL
          </Link>
          <div className="hidden gap-8 text-sm text-muted md:flex">
            <a href="#features" className="transition-colors hover:text-brand">Features</a>
            <a href="#how-it-works" className="transition-colors hover:text-brand">How it works</a>
            <a href="https://github.com/vanjulT/devtrail" target="_blank" rel="noreferrer" className="transition-colors hover:text-brand">
              GitHub
            </a>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              to={user ? "/library" : "/login"}
              className="rounded-full border border-line-strong px-4 py-1.5 text-xs font-semibold transition-all hover:border-brand/50 hover:bg-brand/5"
            >
              {user ? "Open app" : "Log in"}
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-24 text-center">
        {/* 2. Hero */}
        <span className="reveal mb-6 inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" /> AI STUDY COMPANION
        </span>

        <h1
          className="reveal mb-6 bg-linear-to-b from-ink to-muted bg-clip-text pb-1 text-4xl font-bold tracking-tight text-transparent md:text-6xl"
          style={{ animationDelay: "120ms" }}
        >
          Learn any stack from <br />
          <span className="bg-linear-to-r from-brand to-mint bg-clip-text text-transparent">your own docs</span>, not guesses.
        </h1>

        <p className="reveal mx-auto mb-10 max-w-2xl text-base leading-relaxed text-muted md:text-lg" style={{ animationDelay: "240ms" }}>
          Upload documentation, books and course notes. DevTrail answers with citations, quizzes you on real code and plans your
          learning, day by day.
        </p>

        <div className="reveal flex flex-col justify-center gap-4 sm:flex-row" style={{ animationDelay: "360ms" }}>
          <Link
            to={startLink}
            className="rounded-md bg-linear-to-r from-brand to-brand-hover px-6 py-3 text-sm font-medium text-on-brand shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:brightness-110"
          >
            {user ? "Open your library" : "Get started free"}
          </Link>
          <a
            href="#features"
            className="rounded-md border border-line bg-card/50 px-6 py-3 text-sm font-medium text-soft backdrop-blur-sm transition-all hover:bg-raised/80 hover:text-ink"
          >
            See the features
          </a>
        </div>

        <HeroPreview />

        <HowItWorks />

        {/* 3. Feature grid: glass cards with 1px borders */}
        <section id="features" className="mt-32 scroll-mt-24 text-left" aria-labelledby="features-title">
          <p className="text-center text-xs font-medium tracking-[0.25em] text-brand">FEATURES</p>
          <h2 id="features-title" className="mt-3 text-center text-3xl font-bold tracking-tight md:text-4xl">
            Everything you need to learn a new stack
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature, i) => {
              const tone = TONES[feature.tone];
              return (
                <SpotlightCard
                  key={feature.title}
                  className={`reveal group rounded-lg border border-line bg-card/40 p-6 backdrop-blur-sm transition-all ${tone.hover}`}
                  style={{ animationDelay: `${450 + i * 120}ms` }}
                >
                  <div
                    className={`mb-4 flex h-10 w-10 items-center justify-center rounded-md border transition-transform group-hover:scale-105 ${tone.box}`}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">{feature.text}</p>
                </SpotlightCard>
              );
            })}
          </div>
        </section>

        {/* 5. Final call to action */}
        <section className="relative mt-32 overflow-hidden rounded-xl border border-brand/20 bg-card/50 px-6 py-16 backdrop-blur-sm">
          <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-2/3 rounded-full bg-brand/15 blur-3xl" aria-hidden="true" />
          <h2 className="relative text-3xl font-bold tracking-tight md:text-4xl">Start learning from your own docs</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-muted">
            Upload your first PDF and ask it anything. Free, and it only takes a minute.
          </p>
          <Link
            to={startLink}
            className="relative mt-8 inline-block rounded-md bg-linear-to-r from-brand to-brand-hover px-7 py-3 text-sm font-medium text-on-brand shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:brightness-110"
          >
            {user ? "Open your library" : "Create your free account"}
          </Link>
        </section>
      </main>

      {/* 4. Footer */}
      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-10 text-sm text-faint sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
            <span className="font-semibold tracking-wider text-soft">DEVTRAIL</span>
            <span className="ml-2">© {new Date().getFullYear()} Vanjul Thakur</span>
          </div>
          <nav className="flex flex-wrap gap-6" aria-label="Footer">
            <a href="#features" className="transition-colors hover:text-brand">Features</a>
            <Link to="/login" className="transition-colors hover:text-brand">Log in</Link>
            <a href="https://github.com/vanjulT/devtrail" target="_blank" rel="noreferrer" className="transition-colors hover:text-brand">
              GitHub
            </a>
          </nav>
        </div>
        <div className="border-t border-line/60 py-6">
          <MadeBy />
        </div>
      </footer>
    </div>
  );
}
