"use client";

import { useRef, useState } from "react";
import { Candidate } from "@/lib/types";
import ProductCard from "./ProductCard";

type Item =
  | { type: "user"; text: string }
  | { type: "clarify"; text: string }
  | { type: "error"; text: string }
  | { type: "cards"; intro: string; items: Candidate[] };

const EXAMPLES = [
  "通勤用、戴久了别夹耳朵、200 刀以内的耳机",
  "跑步用、不堵耳朵、防汗的耳机",
  "在很吵的地铁里要最强降噪，预算不太在意",
];

export default function Chat() {
  const [history, setHistory] = useState<Item[]>([]);
  const [live, setLive] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const sessionId = useRef<string | null>(null);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setHistory((h) => [...h, { type: "user", text }]);
    setInput("");
    setBusy(true);
    setLive("…");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sessionId: sessionId.current }),
      });
      if (!res.body) throw new Error("no stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const ev = JSON.parse(line.slice(5).trim());
          handle(ev);
        }
      }
    } catch (e) {
      setHistory((h) => [...h, { type: "error", text: "出错了：" + (e as Error).message }]);
    } finally {
      setBusy(false);
      setLive(null);
    }
  }

  function handle(ev: any) {
    switch (ev.kind) {
      case "session":
        sessionId.current = ev.sessionId;
        break;
      case "status":
        setLive(ev.text);
        break;
      case "clarify":
        setHistory((h) => [...h, { type: "clarify", text: ev.question }]);
        break;
      case "candidates":
        setHistory((h) => [...h, { type: "cards", intro: ev.intro, items: ev.items }]);
        setLive(null);
        break;
      case "error":
        setHistory((h) => [...h, { type: "error", text: ev.message }]);
        setLive(null);
        break;
    }
  }

  return (
    <>
      {history.length === 0 && (
        <div style={{ margin: "8px 0 18px" }}>
          {EXAMPLES.map((e) => (
            <button
              key={e}
              onClick={() => send(e)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                margin: "8px 0",
                padding: "12px 14px",
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {history.map((it, i) => {
        if (it.type === "user")
          return (
            <div key={i} className="msg user">
              <div className="bubble">{it.text}</div>
            </div>
          );
        if (it.type === "clarify")
          return (
            <div key={i} className="msg assistant">
              <div className="bubble">🤔 {it.text}</div>
            </div>
          );
        if (it.type === "error")
          return (
            <div key={i} className="msg assistant">
              <div className="bubble" style={{ color: "#ff8080" }}>{it.text}</div>
            </div>
          );
        return (
          <div key={i} className="msg assistant">
            {it.intro && <div className="bubble">{it.intro}</div>}
            <div className="cards">
              {it.items.map((c) => (
                <ProductCard key={c.product.product_id} c={c} />
              ))}
            </div>
          </div>
        );
      })}

      {live && <div className="status">{live}</div>}

      <div className="composer">
        <div className="inner">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="描述你的需求，而不是品牌…"
            disabled={busy}
          />
          <button onClick={() => send(input)} disabled={busy || !input.trim()}>
            发送
          </button>
        </div>
      </div>
    </>
  );
}
