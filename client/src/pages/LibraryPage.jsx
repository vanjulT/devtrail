import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";

const MAX_SIZE_MB = 10;

const statusStyles = {
  ready: "bg-success/15 text-success",
  processing: "bg-amber-500/15 text-warn",
  failed: "bg-red-500/15 text-danger",
};

function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function LibraryPage() {
  const fileInput = useRef(null);

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [confirmId, setConfirmId] = useState(null); // which card shows "Are you sure?"
  const [deletingId, setDeletingId] = useState(null);

  // Asks the server for this user's PDFs
  async function fetchDocuments() {
    try {
      const data = await apiFetch("/api/documents");
      setDocuments(data.documents);
      setLoadError("");
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // First load when the page opens
  useEffect(() => {
    apiFetch("/api/documents")
      .then((data) => setDocuments(data.documents))
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function retryLoading() {
    setLoading(true);
    fetchDocuments();
  }

  async function handleFileChosen(event) {
    const file = event.target.files[0];
    event.target.value = ""; // lets you choose the same file again later
    if (!file) return;

    setUploadError("");

    // Check in the browser first, so the user gets a fast, clear message
    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are allowed.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setUploadError(`The file is too big. The limit is ${MAX_SIZE_MB} MB.`);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const data = await apiFetch("/api/documents", { method: "POST", body: formData });
      setDocuments((previous) => [data.document, ...previous]);
    } catch (err) {
      setUploadError(err.message);
      fetchDocuments(); // the failed PDF is saved with status "failed", so show it
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    setDeletingId(id);
    try {
      await apiFetch(`/api/documents/${id}`, { method: "DELETE" });
      setDocuments((previous) => previous.filter((doc) => doc._id !== id));
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Your library</h1>
          <p className="text-sm text-muted">Upload docs, books or course notes as PDF (max {MAX_SIZE_MB} MB).</p>
        </div>
        <button
          onClick={() => fileInput.current.click()}
          disabled={uploading}
          className="rounded-md bg-brand px-5 py-3 font-semibold text-on-brand glow hover:bg-brand-hover disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "Upload PDF"}
        </button>
        <input ref={fileInput} type="file" accept="application/pdf" onChange={handleFileChosen} className="hidden" />
      </div>

      {uploadError && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-danger">{uploadError}</p>
      )}

      {uploading && (
        <div className="flex items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-warn">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-warn border-t-transparent" />
          Reading your PDF and preparing it for chat. This can take up to a minute for big files.
        </div>
      )}

      {/* Loading: grey skeleton cards */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-32 animate-pulse rounded-md bg-raised" />
          ))}
        </div>
      )}

      {/* Error: could not load the list */}
      {!loading && loadError && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-6 text-center">
          <p className="text-danger">{loadError}</p>
          <button onClick={retryLoading} className="mt-3 rounded-md border border-red-400/50 px-4 py-2 text-sm hover:bg-red-500/20">
            Try again
          </button>
        </div>
      )}

      {/* Empty: no PDFs yet */}
      {!loading && !loadError && documents.length === 0 && (
        <div className="rounded-md border border-dashed border-line-strong p-10 text-center">
          <p className="text-lg">Your library is empty</p>
          <p className="mt-2 text-muted">Upload your first PDF to start chatting with it.</p>
        </div>
      )}

      {/* The list */}
      {!loading && !loadError && documents.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <li key={doc._id} className="flex flex-col justify-between gap-4 rounded-md border border-line bg-card p-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold break-words">{doc.title}</h2>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[doc.status]}`}>
                    {doc.status}
                  </span>
                </div>
                <p className="text-sm text-muted">
                  {doc.pageCount} pages · {formatSize(doc.sizeBytes)} · {formatDate(doc.createdAt)}
                </p>
                {doc.status === "failed" && <p className="text-sm text-danger">{doc.errorMessage}</p>}
              </div>

              {confirmId === doc._id ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-soft">Delete this PDF?</span>
                  <button
                    onClick={() => handleDelete(doc._id)}
                    disabled={deletingId === doc._id}
                    className="rounded-md bg-red-500 px-3 py-1.5 font-medium text-white hover:bg-red-400 disabled:opacity-60"
                  >
                    {deletingId === doc._id ? "Deleting…" : "Yes, delete"}
                  </button>
                  <button onClick={() => setConfirmId(null)} className="rounded-md px-3 py-1.5 hover:bg-raised">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  {doc.status === "ready" ? (
                    <Link
                      to={`/chat?doc=${doc._id}`}
                      className="rounded-md bg-brand/10 px-3 py-1.5 text-sm font-medium text-accent hover:bg-brand/20"
                    >
                      Chat with this PDF
                    </Link>
                  ) : (
                    <span />
                  )}
                  <button
                    onClick={() => setConfirmId(doc._id)}
                    className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-raised hover:text-danger"
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}