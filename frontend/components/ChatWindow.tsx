"use client";

import { useRef, useState } from "react";

type Message = { id: number; role: "ai" | "user"; text: string };

const INITIAL_MESSAGES: Message[] = [
  {
    id: 1,
    role: "ai",
    text: "Last time we talked, you were deciding whether to take the job offer in Berlin. Any movement on that?",
  },
  { id: 2, role: "user", text: "Still sitting on it. I keep going back and forth." },
  {
    id: 3,
    role: "ai",
    text: "That tracks — your Saturn transit this quarter has been pushing toward “decide slowly, decide once,” not indecision for its own sake. Your Life Path 8 also tends to regret moves made under pressure more than moves made late. What's actually driving the hesitation — the move itself, or the timing?",
  },
];

const VOICE_REPLIES = [
  "I hear that. Let's slow down for a second — what does your gut say when you picture actually saying yes?",
  "That makes sense given your chart right now. Your Personal Year 8 rewards patience — this doesn't need to be decided today.",
  "Worth naming: is this fear about the move itself, or fear of choosing wrong? Those call for different next steps.",
];

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => /en/i.test(v.lang) && /female|samantha|victoria|karen/i.test(v.name)) ||
    voices.find((v) => /en/i.test(v.lang)) ||
    voices[0]
  );
}

function speakText(text: string, onStart?: () => void, onEnd?: () => void) {
  if (!("speechSynthesis" in window)) {
    alert("Voice is not supported in this browser.");
    return;
  }
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) utter.voice = v;
  utter.rate = 0.98;
  utter.pitch = 1.02;
  utter.onstart = () => onStart?.();
  utter.onend = () => onEnd?.();
  speechSynthesis.speak(utter);
}

const SpeakIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M11 5 6 9H2v6h4l5 4V5Z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
  </svg>
);

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [chatInput, setChatInput] = useState("");
  const [playingId, setPlayingId] = useState<number | null>(null);
  const nextId = useRef(INITIAL_MESSAGES.length + 1);

  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Connecting…");
  const [voiceTranscript, setVoiceTranscript] = useState<{ speaker: string; text: string } | null>(null);
  const [voiceInput, setVoiceInput] = useState("");
  const [orbSpeaking, setOrbSpeaking] = useState(false);
  const voiceTurn = useRef(0);
  const chatBodyRef = useRef<HTMLDivElement | null>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      const body = chatBodyRef.current;
      if (body) body.scrollTop = body.scrollHeight;
    });
  }

  function sendChatMsg() {
    const text = chatInput.trim();
    if (!text) return;
    setMessages((m) => [...m, { id: nextId.current++, role: "user", text }]);
    setChatInput("");
    scrollToBottom();
  }

  function speakMsg(id: number, text: string) {
    setPlayingId(id);
    speakText(text, undefined, () => setPlayingId(null));
  }

  function openVoiceCall() {
    setVoiceActive(true);
    setVoiceStatus("Connecting…");
    setVoiceTranscript(null);
    setTimeout(() => {
      setVoiceStatus("Connected");
      setVoiceTranscript({
        speaker: "Aureon",
        text: "Good to hear your voice — same conversation as before. Still deciding on Berlin?",
      });
      speakText(
        "Good to hear your voice, same conversation as before. Still deciding on Berlin?",
        () => setOrbSpeaking(true),
        () => setOrbSpeaking(false)
      );
    }, 900);
  }

  function sendVoiceMsg() {
    const said = voiceInput.trim();
    if (!said) return;
    setVoiceInput("");
    setVoiceTranscript({ speaker: "You said", text: said });
    setVoiceStatus("Thinking…");
    setTimeout(() => {
      setVoiceStatus("Connected");
      const reply = VOICE_REPLIES[voiceTurn.current % VOICE_REPLIES.length];
      voiceTurn.current++;
      setVoiceTranscript({ speaker: "Aureon", text: reply });
      speakText(reply, () => setOrbSpeaking(true), () => setOrbSpeaking(false));
    }, 700);
  }

  function closeVoiceCall() {
    speechSynthesis.cancel();
    setVoiceActive(false);
    voiceTurn.current = 0;
  }

  return (
    <div className="chat-wrap">
      <div className="chat-window hud">
        <span className="hud-tag">Session active</span>
        <div className="chat-head">
          <span className="dot-live" />
          <span style={{ fontSize: 13, color: "var(--text-dim)" }}>Aureon — remembers your last 6 months</span>
          <button className="voice-cta" onClick={openVoiceCall}>
            <span className="vip-tag">VIP</span> Start voice call
          </button>
        </div>

        {!voiceActive && (
          <>
            <div className="chat-body" id="chatBody" ref={chatBodyRef}>
              {messages.map((m) => (
                <div key={m.id} className={`msg ${m.role}`}>
                  {m.text}
                  {m.role === "ai" && (
                    <button
                      className={`speak-btn${playingId === m.id ? " playing" : ""}`}
                      onClick={() => speakMsg(m.id, m.text)}
                    >
                      <SpeakIcon />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="chat-input">
              <input
                id="chatInputBox"
                placeholder="Ask about your chart, your year, or what's on your mind…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChatMsg()}
              />
              <button onClick={sendChatMsg}>Send</button>
            </div>
          </>
        )}

        <div className={`voice-overlay${voiceActive ? " active" : ""}`}>
          <div className="status">{voiceStatus}</div>
          <div className="orb-wrap">
            <div className={`orb${orbSpeaking ? " speaking" : ""}`} />
            <div className="voice-transcript">
              {voiceTranscript ? (
                <>
                  <span className="said">{voiceTranscript.speaker}:</span> {voiceTranscript.text}
                </>
              ) : (
                "Say something, or type below to simulate speaking."
              )}
            </div>
          </div>
          <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div className="voice-input-row">
              <input
                placeholder="Type what you'd say out loud…"
                value={voiceInput}
                onChange={(e) => setVoiceInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendVoiceMsg()}
              />
              <button onClick={sendVoiceMsg}>Speak</button>
            </div>
            <button className="end-call" onClick={closeVoiceCall}>
              End call
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
