import { useAuth } from "../context/AuthContext.jsx";

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <h1 className="text-2xl font-bold">DevTrail</h1>
        <div className="flex items-center gap-4">
          <span className="text-slate-400">Hi, {user.name}</span>
          <button onClick={logout}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800">
            Log out
          </button>
        </div>
      </header>

      <section className="mx-auto mt-16 max-w-5xl rounded-xl border border-dashed border-slate-700 p-10 text-center">
        <p className="text-lg">Your library is empty</p>
        <p className="mt-2 text-slate-400">Soon you'll upload your first PDF here.</p>
      </section>
    </main>
  );
}