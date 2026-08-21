import { useEffect, useMemo, useRef, useState } from "react";
import {
  useGetAssistantStatusQuery,
  useChatWithAssistantMutation,
  type AssistantTurn,
  type AssistantUsage,
} from "@/redux/features/assistant/assistant.api";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/utils/getErrorMessage";
import "@/styles/assistant.css";

type ChatMessage = { role: "user" | "model"; text: string };

const ADMIN_SUGGESTIONS = [
  "Which teacher has the most invigilation duties?",
  "Is anyone assigned over their duty limit?",
  "List the next 3 exams with date, time and room.",
  "Who is on leave this week?",
];

const TEACHER_SUGGESTIONS = [
  "What are my upcoming invigilation duties?",
  "When is my next duty and in which room?",
  "What is the exam routine for this week?",
  "What are the leaves I have on record?",
];

export function AssistantChat() {
  const { user, role } = useAuth();
  const isTeacher = role === "TEACHER";
  const suggestions = isTeacher ? TEACHER_SUGGESTIONS : ADMIN_SUGGESTIONS;

  const { data: status, isLoading: statusLoading } = useGetAssistantStatusQuery();
  const [chat, { isLoading: sending }] = useChatWithAssistantMutation();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<AssistantUsage | null>(null);

  // Seed the daily-usage counter from the status endpoint (and whenever it refetches).
  useEffect(() => {
    if (status?.usage) setUsage(status.usage);
  }, [status]);

  const limitReached = !!usage && usage.remaining <= 0;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const firstName = useMemo(() => (user?.name ? user.name.split(" ")[0] : "there"), [user]);

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!message || sending) return;
    if (limitReached) {
      setError("You've reached today's message limit. It resets tomorrow.");
      return;
    }
    setError(null);

    // Snapshot history BEFORE appending the new turn (what the server should see as prior context).
    const history: AssistantTurn[] = messages.slice(-10).map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setInput("");

    try {
      const res = await chat({ message, history }).unwrap();
      setMessages((prev) => [...prev, { role: "model", text: res.answer }]);
      if (res.usage) setUsage(res.usage);
    } catch (err) {
      const msg = getErrorMessage(err, "The assistant could not answer that. Please try again.");
      // A 429 means the daily cap was hit — reflect that in the counter so the input locks.
      if ((err as { status?: number })?.status === 429) {
        setUsage((u) => (u ? { ...u, used: u.limit, remaining: 0 } : u));
      }
      setError(msg);
      setMessages((prev) => [...prev, { role: "model", text: `⚠️ ${msg}` }]);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  if (!statusLoading && status && !status.configured) {
    return (
      <div className="assistant">
        <div className="card assistant__card">
          <h1 className="assistant__title">AI Assistant</h1>
          <p className="assistant__notice">
            The AI assistant is not configured on this server yet. An administrator needs to set the{" "}
            <code>GEMINI_API_KEY</code> environment variable on the API.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="assistant">
      <div className="card assistant__card">
        <div className="assistant__head">
          <div>
            <h1 className="assistant__title">AI Assistant</h1>
            <p className="assistant__lead">
              Ask about exams, the routine, invigilation duties, workload, or leaves. Answers come only
              from your live Excon-IUS data.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {usage && (
              <span
                title={`Daily message limit: ${usage.limit}`}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  color: limitReached ? "#b91c1c" : "#5c0931",
                  background: limitReached ? "#fef2f2" : "#f4e4ed",
                  border: `1px solid ${limitReached ? "#fecaca" : "#e7cdd9"}`,
                  borderRadius: 999,
                  padding: "4px 10px",
                }}
              >
                {limitReached ? "Daily limit reached" : `${usage.remaining} of ${usage.limit} left today`}
              </span>
            )}
            {messages.length > 0 && (
              <button
                type="button"
                className="btn btn--ghost assistant__clear"
                onClick={() => {
                  setMessages([]);
                  setError(null);
                }}
              >
                Clear chat
              </button>
            )}
          </div>
        </div>

        <div className="assistant__thread" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="assistant__empty">
              <p className="assistant__greeting">Hi {firstName} 👋 What would you like to know?</p>
              <div className="assistant__suggestions">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="assistant__chip"
                    disabled={sending || limitReached}
                    onClick={() => void send(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`assistant__msg assistant__msg--${m.role === "user" ? "user" : "bot"}`}
              >
                <div className="assistant__bubble">{m.text}</div>
              </div>
            ))
          )}

          {sending && (
            <div className="assistant__msg assistant__msg--bot">
              <div className="assistant__bubble assistant__bubble--typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
        </div>

        {error && <div className="assistant__error">{error}</div>}

        <form className="assistant__composer" onSubmit={onSubmit}>
          <textarea
            className="assistant__input"
            placeholder={
              limitReached
                ? "Daily message limit reached — resets tomorrow."
                : "Ask a question…  (Enter to send, Shift+Enter for a new line)"
            }
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={sending || limitReached}
          />
          <button type="submit" className="btn assistant__send" disabled={sending || limitReached || !input.trim()}>
            {sending ? "…" : "Send"}
          </button>
        </form>
        <p className="assistant__disclaimer">
          The assistant can make mistakes — verify important details against the routine and allocation
          pages.
        </p>
      </div>
    </div>
  );
}
