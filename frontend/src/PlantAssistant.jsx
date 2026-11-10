
import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Leaf,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import "./PlantAssistant.css";

const API_BASE = "http://127.0.0.1:8000";

const suggestions = [
  "How can I prevent tomato leaf mold?",
  "Why are my potato leaves turning yellow?",
  "How often should I water pepper plants?",
  "How can I keep my plants healthy?",
];

export default function PlantAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text = input) {
    const question = text.trim();

    if (!question || loading) return;

    if (question.length > 1500) {
      setError("Please keep your question under 1500 characters.");
      return;
    }

    const updatedMessages = [
      ...messages,
      { role: "user", content: question },
    ].slice(-12);

    setMessages(updatedMessages);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: updatedMessages,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || `Request failed (${response.status}).`
        );
      }

      if (!data.reply) {
        throw new Error("The assistant returned an empty response.");
      }

      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: data.reply },
      ]);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot connect to the backend. Make sure FastAPI is running at port 8000."
          : err.message || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage();
  }

  function clearChat() {
    if (loading) return;
    setMessages([]);
    setInput("");
    setError("");
  }

  return (
    <section className="plant-assistant-section" id="assistant">
      <div className="assistant-heading">
        <span className="assistant-eyebrow">
          <Sparkles size={15} />
          YOUR PLANT CARE COMPANION
        </span>

        <h2>
          Meet your <span>AI Plant Assistant</span>
        </h2>

        <p>
          Ask questions about plant diseases, symptoms, prevention,
          watering, and everyday plant care.
        </p>
      </div>

      <div className="assistant-chat">
        <div className="assistant-chat-header">
          <div className="assistant-avatar">
            <Bot size={23} />
          </div>

          <div className="assistant-header-info">
            <h3>Plant Assistant</h3>
            <span>
              <span className="assistant-online-dot" />
              Powered by Gemini AI
            </span>
          </div>

          <button
            type="button"
            className="assistant-clear"
            onClick={clearChat}
            disabled={loading || messages.length === 0}
            title="Clear conversation"
            aria-label="Clear conversation"
          >
            <Trash2 size={17} />
          </button>
        </div>

        <div className="assistant-messages" aria-live="polite">
          {messages.length === 0 && (
            <div className="assistant-welcome">
              <div className="assistant-welcome-icon">
                <Leaf size={30} />
              </div>

              <h3>How can I help your plants today?</h3>

              <p>
                I'm here to help you understand plant health and
                explore practical care options.
              </p>

              <div className="assistant-suggestions">
                {suggestions.map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    disabled={loading}
                  >
                    <Sparkles size={14} />
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={`${index}-${message.role}`}
              className={`assistant-message ${
                message.role === "user" ? "user-message" : "bot-message"
              }`}
            >
              <div className="assistant-message-avatar">
                {message.role === "user" ? (
                  <UserRound size={17} />
                ) : (
                  <Leaf size={17} />
                )}
              </div>

              <div className="assistant-bubble">
                <span className="assistant-sender">
                  {message.role === "user" ? "You" : "Plant Assistant"}
                </span>
                <p>{message.content}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="assistant-message bot-message">
              <div className="assistant-message-avatar">
                <Leaf size={17} />
              </div>
              <div className="assistant-bubble assistant-typing">
                <LoaderCircle size={17} className="assistant-spinner" />
                Growing an answer...
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {error && (
          <div className="assistant-error" role="alert">
            <AlertCircle size={17} />
            <span>{error}</span>
          </div>
        )}

        <form className="assistant-input-area" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask anything about plant care..."
            rows={2}
            maxLength={1500}
            disabled={loading}
            aria-label="Your plant care question"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSubmit(event);
              }
            }}
          />

          <div className="assistant-input-bottom">
            <span>AI answers can be imperfect. Verify important treatment advice.</span>

            <button
              type="submit"
              className="assistant-send"
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              {loading ? (
                <LoaderCircle size={18} className="assistant-spinner" />
              ) : (
                <Send size={18} />
              )}
              Send
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
