"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiError, postChatReply, postTransits } from "@/lib/api";
import type { NatalChart, NumerologyProfile, SubscriptionTier, Transits } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";

type Message = { id: string; role: "user" | "assistant"; content: string; created_at: string };

// Web Speech API isn't in TS's default lib types, and there's no official
// @types package for it -- just enough shape for what's actually used
// here. Supported un-prefixed in Chrome/Edge, webkit-prefixed in Safari;
// not supported in Firefox, hence the runtime feature-detect in
// createRecognition() rather than assuming it exists.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<SpeechRecognitionResultLike>;
  resultIndex: number;
}
interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

function createRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";
  return recognition;
}

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

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  // Voices load asynchronously in most browsers -- getVoices() often
  // returns empty on the very first call, which meant pickVoice() below
  // had nothing to choose from yet and utter.voice was never set, falling
  // back to whatever the engine's absolute default is (usually the most
  // robotic option it has). Calling getVoices() once here at module load
  // has the side effect of kicking off the browser's voice-list load, and
  // the listener re-primes it once actually ready -- by the time a real
  // speakText() call happens (well after this module loaded), the list is
  // populated. Deliberately NOT awaited inside speakText() itself -- that
  // would add an async hop into a call path that specifically needs to
  // stay synchronous with the user gesture that triggered it (see
  // openVoiceCall's unlock-utterance comment for why that matters).
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener("voiceschanged", () => speechSynthesis.getVoices());
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices();
  // Plain "first English voice" was often whatever low-quality default
  // engine ships (e.g. Chrome's flat "Google US English"), not the best
  // voice actually installed. Try known warmer/more natural ones first --
  // ordered roughly best-to-worst across platforms.
  const preferred = [/Ava/i, /Samantha/i, /Siri/i, /Natural/i, /Google UK English Female/i, /Google US English/i];
  for (const pattern of preferred) {
    const match = voices.find((v) => pattern.test(v.name) && /en/i.test(v.lang));
    if (match) return match;
  }
  return (
    voices.find((v) => /en/i.test(v.lang) && /female|victoria|karen/i.test(v.name)) ||
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
  // Slower and unshifted, not faster/higher -- rushed pace and pitch
  // shifting are what usually make TTS read as obviously synthetic; a
  // touch slower and the voice's own natural pitch reads calmer and less
  // "AI voice," within what a free browser voice can actually do.
  utter.rate = 0.93;
  utter.pitch = 1.0;
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
  // lilith/chiron/ceres/pallas/juno/vesta are newer fields -- guard for
  // profiles saved before they existed, same reasoning as the numerology
  // pinnacles/challenges guard below. Topic must be the body's own name
  // ("Lilith"), not its sign -- the knowledge base entry is keyed by name,
  // and the sign is already covered by every other planet in the loop
  // above. (Fixing a real bug here: this previously added chart.lilith.sign
  // instead of "Lilith", which meant the dedicated Lilith/Chiron knowledge
  // base entries were never reachable by exact topic match, only by luck
  // via full-text search.)
  if (chart.lilith) topics.add("Lilith");
  if (chart.chiron) topics.add("Chiron");
  if (chart.ceres) topics.add("Ceres");
  if (chart.pallas) topics.add("Pallas");
  if (chart.juno) topics.add("Juno");
  if (chart.vesta) topics.add("Vesta");
  for (const value of [
    numerology.life_path,
    numerology.expression,
    numerology.soul_urge,
    numerology.personality,
    numerology.personal_year,
    // pinnacles/challenges/karmic_debts are newer fields -- guard with ?? []
    // so profiles saved before they existed (no re-onboarding backfill) don't
    // crash the spread on undefined.
    ...(numerology.pinnacles ?? []),
    ...(numerology.challenges ?? []),
  ]) {
    topics.add(`Number ${value}`);
  }
  for (const debt of numerology.karmic_debts ?? []) topics.add(`Karmic Debt ${debt}`);
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
  // Distinct from loadError: "hasn't onboarded yet" is a normal, expected state
  // (same condition Dashboard and Vedic show a message + CTA for), not a real
  // failure -- rendering it as red error text was the one page treating it
  // like something broken instead of a clear next step.
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [profile, setProfile] = useState<{ chart: NatalChart; numerology: NumerologyProfile } | null>(
    null
  );
  const [transits, setTransits] = useState<Transits | null>(null);
  const [tier, setTier] = useState<SubscriptionTier>("free");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  // Distinct from a generic "thinking" label -- set once sendMessage's
  // internal retry has actually kicked in, so a slow cold-start reads as
  // "still working on it" instead of looking hung.
  const [retryingAfterColdStart, setRetryingAfterColdStart] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const chatBodyRef = useRef<HTMLDivElement | null>(null);
  // sendMessage() is called from speech-recognition callbacks that are set
  // up once per call and can otherwise close over a stale messages array --
  // this ref is the source of truth for "what's the history right now"
  // inside that helper, kept in sync via the effect below.
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Connecting…");
  const [voiceTranscript, setVoiceTranscript] = useState<{ speaker: string; text: string } | null>(null);
  const [voiceInput, setVoiceInput] = useState("");
  const [orbSpeaking, setOrbSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Mirrors voiceActive for the same stale-closure reason as messagesRef --
  // recognition/TTS callbacks fire well after the render that set them up.
  const voiceActiveRef = useRef(false);
  // Whether the recognition session that just ended captured a real
  // utterance (via onresult) -- distinguishes "ended because the user
  // spoke" (don't auto-restart, handleVoiceUtterance will once the reply's
  // done) from "ended from silence/no-speech" (do auto-restart, keep
  // waiting) inside onend, the one place that decides whether to restart.
  const gotResultRef = useRef(false);
  // Set on a non-recoverable error (mic permission denied) -- onend checks
  // this too, so it doesn't loop restarting a recognition that will just
  // fail the same way again.
  const fatalErrorRef = useRef(false);

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
          setNeedsOnboarding(true);
          setLoadError("Complete your profile before chatting — visit Onboarding first.");
          setLoading(false);
        }
        return;
      }
      if (!cancelled) {
        setProfile({ chart: profileRow.chart, numerology: profileRow.numerology });
        setTier((profileRow.subscription_tier as SubscriptionTier) ?? "free");
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

  // Shared by both the text box and voice call -- both are the same
  // conversation (same sessionId/messages), just a different input/output
  // modality. Throws on failure; callers translate that into their own
  // UI (an inline error for text, a spoken/status message for voice).
  // onRetry fires each time a cold-start-looking failure is about to be
  // retried, so the caller can show something better than a silent wait.
  async function sendMessage(text: string, onRetry?: () => void): Promise<string> {
    if (!sessionId || !profile) throw new Error("not-ready");
    const supabase = createClient();

    const { data: inserted, error: insertError } = await supabase
      .from("chat_messages")
      .insert({ session_id: sessionId, role: "user", content: text })
      .select("id, role, content, created_at")
      .single();
    if (insertError || !inserted) throw new Error("insert-failed");

    const nextMessages = [...messagesRef.current, inserted as Message];
    setMessages(nextMessages);
    scrollToBottom();

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
    if (!session) throw new ApiError(401, "Session expired");

    // The backend is a free-tier Render service that spins down after
    // idle and can take 30-50s to cold-start on the next request. The
    // first retry attempt (2.5s/5s gaps, ~10s total) was too short-sighted
    // -- it gave up long before a real cold start would've finished
    // booting, so it barely helped. These gaps (5s/15s/20s, ~40s total
    // across 4 attempts) actually span a realistic cold-start window.
    // 401/429 still aren't retried -- those need the user to actually do
    // something (sign in again / upgrade), not another attempt.
    const retryDelaysMs = [5000, 15000, 20000];
    let reply: string | undefined;
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
      try {
        reply = (
          await postChatReply(
            {
              chart: profile.chart,
              numerology: profile.numerology,
              knowledge,
              messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
              transits,
            },
            session.access_token
          )
        ).reply;
        break;
      } catch (err) {
        const retryable = !(err instanceof ApiError) || err.status >= 500;
        if (attempt === retryDelaysMs.length || !retryable) throw err;
        onRetry?.();
        await new Promise((r) => setTimeout(r, retryDelaysMs[attempt]));
      }
    }
    // Unreachable in practice -- the loop above only exits via `break`
    // (reply is set) or `throw` (attempt===2 or non-retryable), never by
    // falling off the end. Narrows reply back to `string` for TS.
    if (reply === undefined) throw new Error("no-reply");

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

    if (assistantInsertError) throw assistantInsertError;
    if (assistantRow) {
      setMessages((m) => [...m, assistantRow as Message]);
      scrollToBottom();
    }
    return reply;
  }

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
    trackEvent("chat_message_sent");
    setSending(true);
    setRetryingAfterColdStart(false);
    try {
      await sendMessage(text, () => setRetryingAfterColdStart(true));
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
      setRetryingAfterColdStart(false);
    }
  }

  function speakMsg(id: string, text: string) {
    // Clicking the speak button on the message already playing should stop
    // it, not restart it -- speakText() always calls speechSynthesis.cancel()
    // then starts a fresh utterance, so without this check a second click
    // just re-cancelled-and-restarted from the beginning every time.
    if (playingId === id) {
      speechSynthesis.cancel();
      setPlayingId(null);
      return;
    }
    setPlayingId(id);
    speakText(text, undefined, () => setPlayingId(null));
  }

  // Starts (or restarts) listening -- the one place recognition.start() is
  // called, so every caller (open, onend's auto-restart, after speaking a
  // reply) goes through the same reset of gotResultRef.
  function startListening() {
    const recognition = recognitionRef.current;
    if (!recognition || !voiceActiveRef.current) return;
    gotResultRef.current = false;
    setVoiceStatus("Listening…");
    setListening(true);
    try {
      recognition.start();
    } catch {
      // start() throws if recognition is already running -- harmless,
      // it's already in the state we wanted.
    }
  }

  // Wraps speakText() for the call flow specifically (greeting + replies),
  // not the per-message speak button -- those are one-off, this one gates
  // whether listening ever resumes. Confirmed live on mobile: some
  // browsers (iOS Safari especially) silently drop speechSynthesis.speak()
  // entirely -- no error, no onstart, no onend -- if it's not close enough
  // to a direct user gesture. Without a safety net, that leaves the call
  // hung forever waiting for a reply that never plays.
  //
  // Two different timeouts, not one: if speech never even *started* within
  // ~2s, the browser almost certainly dropped the call silently -- move on
  // quickly. But if it did start, a reply can legitimately take well over
  // 2s to finish speaking -- cutting it off there would start listening
  // again while Aureon's still mid-sentence (the exact mic-hearing-its-
  // own-voice problem turn-taking is built to avoid). Once started, trust
  // onend; the 30s ceiling only guards the rare case where onend itself
  // never fires despite speech actually having played.
  function speakInCall(text: string, onDone: () => void) {
    let started = false;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      setOrbSpeaking(false);
      onDone();
    };
    speakText(
      text,
      () => {
        started = true;
        setOrbSpeaking(true);
      },
      finish
    );
    setTimeout(() => {
      if (!started) finish();
    }, 2000);
    setTimeout(finish, 30000);
  }

  // A spoken (or, via the text fallback below, typed-as-if-spoken) turn.
  async function handleVoiceUtterance(said: string) {
    const text = said.trim();
    if (!text) {
      if (voiceActiveRef.current) startListening();
      return;
    }
    setVoiceTranscript({ speaker: "You said", text });
    setVoiceStatus("Thinking…");
    try {
      const reply = await sendMessage(text, () => {
        if (voiceActiveRef.current) setVoiceStatus("Waking up the server — this can take up to a minute…");
      });
      if (!voiceActiveRef.current) return;
      setVoiceTranscript({ speaker: "Aureon", text: reply });
      setVoiceStatus("Aureon is speaking…");
      speakInCall(reply, () => {
        if (voiceActiveRef.current) startListening();
      });
    } catch (err) {
      if (!voiceActiveRef.current) return;
      // A failure here was previously only visible as a small status-line
      // change up top -- easy to miss, and reported live as "the AI just
      // wasn't responding" (the "You said" line was still on screen, so
      // it read as silence rather than an error). Put it in the
      // transcript itself too, impossible to miss the same way a real
      // reply wouldn't be.
      console.error("Voice call: sendMessage failed", err);
      const message =
        err instanceof ApiError && err.status === 429
          ? "You've used today's free messages — upgrade for unlimited."
          : err instanceof ApiError && err.status === 401
            ? "Your session expired — please sign in again."
            : "Couldn't reach Aureon just now — try again.";
      setVoiceStatus(message);
      setVoiceTranscript({ speaker: "⚠ Error", text: message });
      if (voiceActiveRef.current) startListening();
    }
  }

  async function openVoiceCall() {
    voiceActiveRef.current = true;
    fatalErrorRef.current = false;
    setVoiceActive(true);
    setVoiceTranscript(null);
    setVoiceStatus("Connecting…");

    // Same category of bug as the mic-permission timing fix above, for
    // speech synthesis instead of recognition: iOS Safari in particular
    // silently drops speechSynthesis.speak() calls that aren't close
    // enough to a direct user gesture -- confirmed live, the greeting and
    // every reply after it just never played, no error. Speaking a near-
    // silent utterance synchronously right here, in this click handler,
    // "unlocks" speech synthesis for the rest of the session so the later
    // async speak() calls (the greeting after this setTimeout, and every
    // AI reply after that) actually play.
    if ("speechSynthesis" in window) {
      const unlock = new SpeechSynthesisUtterance(" ");
      unlock.volume = 0;
      speechSynthesis.speak(unlock);
    }

    const recognition = createRecognition();
    if (!recognition) {
      // Firefox and a few others don't implement this at all -- the text
      // fallback below still works, this just means no mic loop.
      setVoiceStatus("Voice recognition isn't supported in this browser — type below instead.");
    } else if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceStatus("Microphone access isn't available here — type below instead.");
    } else {
      // Ask for mic permission *here*, synchronously in this click
      // handler -- recognition.start() itself doesn't happen until after
      // the greeting finishes speaking (see below), which by then is
      // several seconds and a couple of async hops removed from the
      // actual click. Some browsers won't reliably show the permission
      // prompt that late, and just silently refuse instead -- confirmed
      // live, no prompt ever appeared. getUserMedia here is still a
      // direct response to the click, so the browser shows its real
      // prompt; the stream itself is discarded immediately since
      // SpeechRecognition manages its own capture once permission's
      // already granted.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        recognitionRef.current = recognition;

        recognition.onresult = (event) => {
          gotResultRef.current = true;
          const result = event.results[event.results.length - 1];
          const said = result?.[0]?.transcript ?? "";
          setListening(false);
          handleVoiceUtterance(said);
        };
        recognition.onerror = (event) => {
          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            fatalErrorRef.current = true;
            setVoiceStatus("Microphone access denied — allow mic access, or type below.");
          } else if (event.error !== "no-speech" && event.error !== "aborted") {
            setVoiceStatus("Didn't catch that — listening again…");
          }
        };
        recognition.onend = () => {
          setListening(false);
          // onresult already kicked off handleVoiceUtterance (which restarts
          // listening itself once the reply's done speaking); a fatal error
          // shouldn't loop-retry. Anything else ending here is silence/no-
          // speech timing out -- just keep waiting.
          if (!voiceActiveRef.current || gotResultRef.current || fatalErrorRef.current) return;
          startListening();
        };
      } catch (err) {
        if (!voiceActiveRef.current) return;
        fatalErrorRef.current = true;
        // Was blindly reporting "access denied" for *any* getUserMedia
        // failure -- reported live with the site's own permission already
        // showing as Allowed in browser settings, so it genuinely wasn't
        // a permission denial. getUserMedia throws a real, specific
        // DOMException name; surface what it actually is instead of
        // guessing wrong every time it's not a plain permission issue.
        const name = err instanceof DOMException ? err.name : "Unknown";
        console.error("Voice call: getUserMedia failed", name, err);
        const message =
          name === "NotAllowedError" || name === "SecurityError"
            ? "Microphone access denied — allow mic access, or type below."
            : name === "NotFoundError"
              ? "No microphone found — check it's connected, or type below."
              : name === "NotReadableError"
                ? "Microphone is in use by another app (or blocked by your OS) — close other apps using it, or type below."
                : `Couldn't access the microphone (${name}) — or type below.`;
        setVoiceStatus(message);
      }
    }

    if (!voiceActiveRef.current) return;
    const greeting = "Good to hear your voice — what's on your mind today?";
    setTimeout(() => {
      if (!voiceActiveRef.current) return;
      setVoiceStatus((s) => (s.startsWith("Microphone") ? s : "Aureon is speaking…"));
      setVoiceTranscript({ speaker: "Aureon", text: greeting });
      speakInCall(greeting, () => {
        if (voiceActiveRef.current && !fatalErrorRef.current) startListening();
      });
    }, 500);
  }

  // Text fallback inside the voice overlay -- same handler real speech
  // results go through, so a browser without speech recognition (or a
  // mis-heard phrase, or just a quiet room) still gets a real, spoken-back
  // reply rather than the call being unusable.
  function sendVoiceMsg() {
    const said = voiceInput.trim();
    if (!said) return;
    setVoiceInput("");
    handleVoiceUtterance(said);
  }

  function closeVoiceCall() {
    voiceActiveRef.current = false;
    speechSynthesis.cancel();
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setVoiceActive(false);
    setListening(false);
    setOrbSpeaking(false);
  }

  return (
    <div className="chat-wrap">
      <div className="chat-window hud">
        <span className="hud-tag">Session active</span>
        <div className="chat-head">
          <span className="dot-live" />
          <span style={{ fontSize: 13, color: "var(--text-dim)" }}>Aureon — remembers your conversations</span>
          {tier === "vip" ? (
            <button className="voice-cta" onClick={openVoiceCall}>
              <span className="vip-tag">VIP</span> Start voice call
            </button>
          ) : (
            tier === "premium" && (
              <Link href="/pricing" className="voice-upsell">
                VIP unlocks voice calls — sometimes saying it out loud gets you further than typing it
              </Link>
            )
          )}
        </div>

        {!voiceActive && (
          <>
            <div className="chat-body" id="chatBody" ref={chatBodyRef}>
              {loading && <p style={{ color: "var(--text-dim)", fontSize: 13 }}>Loading your conversation…</p>}
              {needsOnboarding ? (
                <div style={{ textAlign: "center", padding: "24px 12px" }}>
                  <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 14 }}>
                    Complete your profile to start chatting — Aureon reads from your chart and numerology.
                  </p>
                  <Link className="btn btn-gold" href="/onboarding">
                    Create your profile
                  </Link>
                </div>
              ) : (
                loadError && <p style={{ color: "#c96a4a", fontSize: 13 }}>{loadError}</p>
              )}
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
              {sending && (
                <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
                  {retryingAfterColdStart
                    ? "Still working on it — the server may be waking up, this can take up to a minute…"
                    : "Aureon is thinking…"}
                </p>
              )}
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
              {!loading && !loadError && freeLimitReached && (
                <div
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    background: "var(--bg-raised)", border: "1px solid var(--line)", borderRadius: 10,
                    padding: "10px 14px",
                  }}
                >
                  <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
                    You&apos;ve used today&apos;s free messages — Premium is unlimited.
                  </span>
                  <Link href="/pricing" className="btn btn-gold" style={{ padding: "7px 14px", fontSize: 12, whiteSpace: "nowrap" }}>
                    Upgrade to Premium
                  </Link>
                </div>
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
            <div className={`orb${orbSpeaking ? " speaking" : listening ? " listening" : ""}`} />
            <div className="voice-transcript">
              {voiceTranscript ? (
                <>
                  <span className="said">{voiceTranscript.speaker}:</span> {voiceTranscript.text}
                </>
              ) : (
                "Say something, or type below."
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
