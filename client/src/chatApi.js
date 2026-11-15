const API_URL = import.meta.env.VITE_API_URL;

// Sends a question and reads the answer piece by piece as it arrives.
// onStart gets the chat id and the sources; onText gets the answer so far.
// voice = true when the question was asked with the mic (the server then gives a short spoken answer)
export async function sendChatMessage({ message, chatId, documentId, voice = false }, { onStart, onText }) {
  const token = localStorage.getItem("devtrail-token");

  const response = await fetch(`${API_URL}/api/chats/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, chatId, documentId, voice }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Something went wrong. Please try again.");
  }

  const newChatId = response.headers.get("X-Chat-Id");
  const sources = JSON.parse(decodeURIComponent(response.headers.get("X-Sources") || "%5B%5D"));
  onStart({ chatId: newChatId, sources });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText(text);
  }

  return { chatId: newChatId, sources, text };
}