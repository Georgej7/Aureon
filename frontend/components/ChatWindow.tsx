"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiError, postChatReply, postTransits } from "@/lib/api";
import type { NatalChart, NumerologyProfile, Transits } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";

type Message = { id: string; role: "user" | "assistant"; content: string; created_at: string };

const FREE_DAILY_MESSAGE_LIMIT = 3;

const KNOWLEDGE_COLUMNS =
  "system, category, topic, definition, traditional_interpretation, modern_interpretation, psychological_interpretation, positive_aspects, challenges, career_meaning, relationship_meaning, growth_meaning, sources, confidence_level, context_notes";

type KnowledgeRow = { system: string; category: string; topic: string };

function dedupeKnowledge<T extends KnowledgeRow>(rows: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const row of rows) {
    const key = `${row.system}|${row.category}|${row.topic}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(row);
    }
  }
  return result;
}

function isToday(isoTimestamp: string): boolean {
  const d = new Date(isoTimestamp);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

const VOICE_REPLIES = [
  "I hear that. Let's slow down for a second — what does your gut say when you picture actually saying yes?",
  "That makes sense given your chart right now. Your Personal Year rewards patience — this doesn't need to be decided today.",
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

/** Every knowledge_base topic relevant to this user's actual chart + numerology,
 * plus today's active transits — exact structured lookups, not semantic search,
 * since a chart (and today's sky) is a fully known set of placements. */
function topicsForProfile(
  chart: NatalChart,
  numerology: NumerologyProfile,
  transits?: Transits | null
): string[] {
  const topics = new Set<string>();
  for (const planet of chart.planets) {
    topics.add(planet.name);
    topics.add(planet.sign);
    if (planet.house !== null) topics.add(`House ${planet.house}`);
    if (planet.retrograde) topics.add(`${planet.name} Retrograde`);
  }
  const sun = chart.planets.find((p) => p.name === "Sun");
  if (sun) topics.add(`${sun.sign} Birthstone`);
  if (chart.houses && chart.houses[0]) topics.add(chart.houses[0].sign); // ascendant sign
  for (const aspect of chart.aspects) topics.add(aspect.aspect_type);
  for (const pattern of chart.patterns) topics.add(pattern.pattern_type);
  for (const value of [
    numerology.life_path,
    numerology.expression,
    numerology.soul_urge,
    numerology.personality,
    numerology.personal_year,
  ]) {
    topics.add(`Number ${value}`);
  }
  if (transits) {
    for (const aspect of transits.aspects) {
      topics.add(`Transiting ${aspect.transiting_planet}`);
      topics.add(aspect.aspect_type);
    }
    topics.add(transits.moon_phase.name);
  }
  return Array.from(topics);
}

export default function ChatWindow() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ chart: NatalChart; numerology: NumerologyProfile } | null>(
    null
  );
  const [transits, setTransits] = useState<Transits | null>(null);
  const [tier, setTier] = useState<"free" | "premium" | "vip">("free");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const chatBodyRef = useRef<HTMLDivElement | null>(null);

  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Connecting…");
  const [voiceTranscript, setVoiceTranscript] = useState<{ speaker: string; text: string } | null>(null);
  const [voiceInput, setVoiceInput] = useState("");
  const [orbSpeaking, setOrbSpeaking] = useState(false);
  const voiceTurn = useRef(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      if (!authSession) {
        if (!cancelled) {
          setLoadError("You need to be signed in to chat.");
          setLoading(false);
        }
        return;
      }
      const user = authSession.user;

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("chart, numerology, subscription_tier")
        .eq("id", user.id)
        .maybeSingle();

      if (!profileRow?.chart || !profileRow?.numerology) {
        if (!cancelled) {
          setLoadError("Complete your profile before chatting — visit Onboarding first.");
          setLoading(false);
        }
        return;
      }
      if (!cancelled) {
        setProfile({ chart: profileRow.chart, numerology: profileRow.numerology });
        setTier((profileRow.subscription_tier as "free" | "premium" | "vip") ?? "free");
      }
      try {
        const result = await postTransits(
          {
            natal_planets: profileRow.chart.planets.map((p: { name: string; longitude: number }) => ({
              name: p.name,
              longitude: p.longitude,
            })),
          },
          authSession.access_token
        );
        if (!cancelled) setTransits(result);
      } catch {
        // Non-fatal — chat still works with natal-only knowledge if transits fail to load.
      }

      let { data: session } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!session) {
        const { data: newSession, error: createError } = await supabase
          .from("chat_sessions")
          .insert({ user_id: user.id })
          .select("id")
          .single();
        if (createError || !newSession) {
          if (!cancelled) {
            setLoadError("Couldn't start a chat session.");
            setLoading(false);
          }
          return;
        }
        session = newSession;
      }
      if (cancelled) return;
      setSessionId(session.id);

      const { data: history } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true });

      if (!cancelled) {
        setMessages((history as Message[]) ?? []);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      const body = chatBodyRef.current;
      if (body) body.scrollTop = body.scrollHeight;
    });
  }

  const todaysUserMessageCount = messages.filter(
    (m) => m.role === "user" && isToday(m.created_at)
  ).length;
  const freeLimitReached = tier === "free" && todaysUserMessageCount >= FREE_DAILY_MESSAGE_LIMIT;

  async function sendChatMsg() {
    const text = chatInput.trim();
    if (!text || sending || !sessionId || !profile) return;
    if (freeLimitReached) {
      setSendError(
        `You've used your ${FREE_DAILY_MESSAGE_LIMIT} free messages for today — upgrade to Premium for unlimited conversations.`
      );
      return;
    }
    setSendError(null);
    setChatInput("");
    const supabase = createClient();

    const { data: inserted, error: insertError } = await supabase
      .from("chat_messages")
      .insert({ session_id: sessionId, role: "user", content: text })
      .select("id, role, content, created_at")
      .single();
    if (insertError || !inserted) {
      setSendError("Couldn't send your message. Try again.");
      return;
    }

    trackEvent("chat_message_sent");
    const nextMessages = [...messages, inserted as Message];
    setMessages(nextMessages);
    scrollToBottom();
    setSending(true);

    try {
      const topics = topicsForProfile(profile.chart, profile.numerology, transits);
      const [{ data: topicMatches }, { data: searchMatches }] = await Promise.all([
        supabase.from("knowledge_base").select(KNOWLEDGE_COLUMNS).in("topic", topics),
        // Full-text search on the user's actual message, so a freeform question can surface
        // relevant content even when it doesn't name one of the known topics above exactly.
        supabase
          .from("knowledge_base")
          .select(KNOWLEDGE_COLUMNS)
          .textSearch("search_vector", text, { type: "websearch", config: "english" })
          .limit(5),
      ]);
      const knowledge = dedupeKnowledge([...(topicMatches ?? []), ...(searchMatches ?? [])]);

      // Fetched fresh right before the call (not read from earlier state) so a stale or
      // just-expired session can't silently slip through — the backend verifies this
      // token itself and enforces the free-tier daily limit server-side.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setSendError("Your session expired — please sign in again.");
        return;
      }

      const { reply } = await postChatReply(
        {
          chart: profile.chart,
          numerology: profile.numerology,
          knowledge,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          transits,
        },
        session.access_token
      );

      const { data: assistantRow, error: assistantInsertError } = await supabase
        .from("chat_messages")
        .insert({ session_id: sessionId, role: "assistant", content: reply })
        .select("id, role, content, created_at")
        .single();

      const { error: sessionUpdateError } = await supabase
        .from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", sessionId);
      if (sessionUpdateError) {
        console.error("Failed to bump chat_sessions.updated_at", sessionUpdateError);
      }

      if (assistantInsertError) {
        throw assistantInsertError;
      }
      if (assistantRow) {
        setMessages((m) => [...m, assistantRow as Message]);
        scrollToBottom();
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setSendError(
          `You've used your ${FREE_DAILY_MESSAGE_LIMIT} free messages for today — upgrade to Premium for unlimited conversations.`
        );
      } else if (err instanceof ApiError && err.status === 401) {
        setSendError("Your session expired — please sign in again.");
      } else {
        setSendError("Aureon couldn't reply just now — is the backend running?");
      }
    } finally {
      setSending(false);
    }
  }

  function speakMsg(id: string, text: string) {
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
        text: "Good to hear your voice — what's on your mind today?",
      });
      speakText(
        "Good to hear your voice — what's on your mind today?",
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
          <span style={{ fontSize: 13, color: "var(--text-dim)" }}>Aureon — remembers your conversations</span>
          <button className="voice-cta" onClick={openVoiceCall}>
            <span className="vip-tag">VIP</span> Start voice call
          </button>
        </div>

        {!voiceActive && (
          <>
            <div className="chat-body" id="chatBody" ref={chatBodyRef}>
              {loading && <p style={{ color: "var(--text-dim)", fontSize: 13 }}>Loading your conversation…</p>}
              {loadError && <p style={{ color: "#c96a4a", fontSize: 13 }}>{loadError}</p>}
              {!loading &&
                !loadError &&
                messages.map((m) => (
                  <div key={m.id} className={`msg ${m.role === "assistant" ? "ai" : "user"}`}>
                    {m.content}
                    {m.role === "assistant" && (
                      <button
                        className={`speak-btn${playingId === m.id ? " playing" : ""}`}
                        onClick={() => speakMsg(m.id, m.content)}
                      >
                        <SpeakIcon />
                      </button>
                    )}
                  </div>
                ))}
              {sending && <p style={{ color: "var(--text-dim)", fontSize: 13 }}>Aureon is thinking…</p>}
              {sendError && (
                <p style={{ color: "#c96a4a", fontSize: 13 }}>
                  {sendError}
                  {freeLimitReached && (
                    <>
                      {" "}
                      <Link href="/pricing" style={{ color: "var(--gold, #c9a24a)" }}>
                        Upgrade to Premium
                      </Link>
                    </>
                  )}
                </p>
              )}
              {!loading && !loadError && tier === "free" && !freeLimitReached && (
                <p style={{ color: "var(--text-dim)", fontSize: 12 }}>
                  {FREE_DAILY_MESSAGE_LIMIT - todaysUserMessageCount} free message
                  {FREE_DAILY_MESSAGE_LIMIT - todaysUserMessageCount === 1 ? "" : "s"} left today
                </p>
              )}
            </div>
            <div className="chat-input">
              <input
                id="chatInputBox"
                placeholder={
                  freeLimitReached
                    ? "Daily free messages used — upgrade for unlimited chat"
                    : "Ask about your chart, your year, or what's on your mind…"
                }
                value={chatInput}
                disabled={loading || !!loadError || freeLimitReached}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChatMsg()}
              />
              <button onClick={sendChatMsg} disabled={loading || !!loadError || sending || freeLimitReached}>
                Send
              </button>
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
