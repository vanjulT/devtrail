import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [serverStatus, setServerStatus] = useState("checking");

  // Ask the server once when the page opens
  useEffect(() => {
    async function checkServer() {
      try {
        const response = await fetch(`${API_URL}/api/health`);
        const data = await response.json();
        setServerStatus(data.status === "ok" ? "online" : "offline");
      } catch (error) {
        setServerStatus("offline");
      }
    }
    checkServer();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold">DevTrail</h1>
        <p className="text-slate-400">Your AI coding study companion</p>

        {serverStatus === "checking" && <p className="text-slate-400">Checking the server…</p>}
        {serverStatus === "online" && <p className="text-emerald-400">● Server is online</p>}
        {serverStatus === "offline" && <p className="text-red-400">● Server is offline. Is it running?</p>}
      </div>
    </main>
  );
}

export default App;