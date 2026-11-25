import { useEffect, useMemo, useRef, useState } from "react";
import {
  useGetAssistantStatusQuery,
  type AssistantTurn,
  type AssistantUsage,
} from "@/redux/features/assistant/assistant.api";
import { getAccessToken } from "@/lib/authToken";
import config from "@/config";
import { useAuth } from "@/hooks/useAuth";
import "@/styles/assistant.css";

type ChatMessage = { role: "user" | "model"; text: string; sources?: { label: string }[] };

const ADMIN_SUGGESTIONS = [
  "Who is invigilating on the next exam day?",
  "Which teachers have two duties on the same day?",
  "Who has approved leave during the exams?",
  "Are any HODs assigned invigilation?",
];

const TEACHER_SUGGESTIONS = [
  "What are my upcoming invigilation duties?",
  "When is my next duty and which room?",
  "Do I have any approved leave coming up?",
];

/** Compact circular meter of the daily message allowance — a "fuel gauge" that empties as it's used. */
function UsageRing({ limit, remaining }: AssistantUsage) {
  const [showTip, setShowTip] = useState(false);
  const size = 46;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const frac = limit > 0 ? Math.max(0, Math.min(1, remaining / limit)) : 0;
  const offset = circumference * (1 - frac);
  const low = remaining <= Math.max(1, Math.ceil(limit * 0.2));
  const color = remaining <= 0 ? "#b91c1c" : low ? "#b45309" : "#5c0931";
  const center = size / 2;

  return (
    <div
      aria-label={`${remaining} of ${limit} daily messages left`}
      tabIndex={0}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      onFocus={() => setShowTip(true)}
      onBlur={() => setShowTip(false)}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0, outline: "none" }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-hidden="true">
        <circle cx={center} cy={center} r={r} fill="none" stroke="#ece2e8" strokeWidth={stroke} />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: "stroke-dashoffset .45s ease, stroke .3s ease" }}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: 14, fontWeight: 700, fill: color }}
        >
          {remaining}
        </text>
      </svg>
      <span style={{ fontSize: 11, lineHeight: 1.2, color: "#6b7280", fontWeight: 600 }}>
        {remaining <= 0 ? (
          <>
            daily limit
            <br />
            reached
          </>
        ) : (
          <>
            left
            <br />
            today
          </>
        )}
      </span>
      {showTip && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 30,
            whiteSpace: "nowrap",
            background: "#241a20",
            color: "#fff",
            fontSize: 12,
            fontWeight: 500,
            padding: "7px 11px",
            borderRadius: 8,
            boxShadow: "0 8px 22px rgba(36, 26, 32, 0.28)",
            pointerEvents: "none",
          }}
        >
          {remaining} of {limit} messages left today · resets at midnight
        </div>
      )}
    </div>
  );
}

export function AssistantChat() {
  const { user, role } = useAuth();
  const isTeacher = role === "TEACHER";
  const { data: status, isLoading: statusLoading } = useGetAssistantStatusQuery();
  const suggestions = status?.suggestions?.length
    ? status.suggestions
    : isTeacher
      ? TEACHER_SUGGESTIONS
      : ADMIN_SUGGESTIONS;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<AssistantUsage | null>(null);
  const [sending, setSending] = useState(false);

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

    setMessages((prev) => [...prev, { role: "user", text: message }, { role: "model", text: "" }]);
    setInput("");
    setSending(true);

    const patchLast = (patch: Partial<ChatMessage>) => {
      setMessages((prev) => {
        const next = prev.slice();
        const last = next[next.length - 1];
        if (!last || last.role !== "model") return prev;
        next[next.length - 1] = { ...last, ...patch, text: patch.text !== undefined ? patch.text : last.text };
        if (patch.sources) next[next.length - 1].sources = patch.sources;
        return next;
      });
    };

    try {
      const res = await fetch(`${config.baseUrl}/assistant/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken() || ""}`,
        },
        credentials: "include",
        body: JSON.stringify({ message, history }),
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        if (res.status === 429) setUsage((u) => (u ? { ...u, used: u.limit, remaining: 0 } : u));
        throw new Error(data.message || "The assistant could not answer that. Please try again.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let event = "";
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) {
            const data = JSON.parse(line.slice(5).trim()) as {
              text?: string;
              sources?: { label: string }[];
              usage?: AssistantUsage;
              message?: string;
            };
            if (event === "sources" && data.sources) patchLast({ sources: data.sources });
            else if (event === "token" && data.text) {
              acc += data.text;
              patchLast({ text: acc });
            } else if (event === "done" && data.usage) setUsage(data.usage);
            else if (event === "error") throw new Error(data.message || "The assistant could not answer that.");
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "The assistant could not answer that. Please try again.";
      setError(msg);
      patchLast({ text: `⚠️ ${msg}` });
    } finally {
      setSending(false);
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
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
            {usage && <UsageRing {...usage} />}
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
            messages.map((m, i) => {
              if (m.role === "model" && !m.text) return null;
              return (
              <div
                key={i}
                className={`assistant__msg assistant__msg--${m.role === "user" ? "user" : "bot"}`}
              >
                <div className="assistant__bubble">{m.text}</div>
                {m.role === "model" && m.sources && m.sources.length > 0 ? (
                  <ul className="assistant__sources">
                    {m.sources.map((s, si) => (
                      <li key={`${s.label}-${si}`}>{s.label}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              );
            })
          )}

          {sending && messages[messages.length - 1]?.text === "" && (
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
