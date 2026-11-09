"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type AssistantSource = { title: string; url: string };
type ChatMessage = { role: "user" | "assistant"; content: string; sources?: AssistantSource[]; webSearchUnavailable?: boolean };
type Position = { left: number; top: number };
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };

const POSITION_KEY = "rfx-assistant-position-v1";

function RobotIcon() {
  return <svg viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="rfx-robot-shell" x1="12" x2="52" y1="7" y2="57" gradientUnits="userSpaceOnUse"><stop stopColor="#1b3455"/><stop offset="1" stopColor="#091221"/></linearGradient></defs>
    <path d="M32 8v6" stroke="#70dbff" strokeWidth="3" strokeLinecap="round"/><circle cx="32" cy="6" r="3" fill="#9cf2ff"/>
    <rect x="11" y="14" width="42" height="37" rx="13" fill="url(#rfx-robot-shell)" stroke="#78dcff" strokeWidth="2"/>
    <rect x="17" y="20" width="30" height="20" rx="8" fill="#d9f8ff"/>
    <circle cx="25" cy="30" r="3" fill="#0e3e62"/><circle cx="39" cy="30" r="3" fill="#0e3e62"/>
    <path d="M27 36c3 2 7 2 10 0" stroke="#168ac1" strokeWidth="2" strokeLinecap="round"/>
    <path d="M23 46h18v7a4 4 0 0 1-4 4h-10a4 4 0 0 1-4-4z" fill="#dffaff" stroke="#78dcff" strokeWidth="1.5"/>
    <path d="M18 25h-3m34 0h-3" stroke="#93eaff" strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}

function MaleVoiceIcon({ muted = false }: { muted?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4z"/>
    {muted ? <path d="m16 9 5 6m0-6-5 6"/> : <><path d="M15 9a5 5 0 0 1 0 6"/><path d="M18 6a9 9 0 0 1 0 12"/></>}
  </svg>;
}

function MicrophoneIcon({ active = false }: { active?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8"/>
    {active && <circle cx="19" cy="5" r="2" fill="currentColor" stroke="none"/>}
  </svg>;
}

export default function RfxAssistant() {
  const [position, setPosition] = useState<Position | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceReplies, setVoiceReplies] = useState(false);
  const [speechAudio, setSpeechAudio] = useState<{ messageIndex: number; url: string } | null>(null);
  const [speechBusy, setSpeechBusy] = useState(false);
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState<number | null>(null);
  const [speechLanguage, setSpeechLanguage] = useState<"km-KH" | "en-US">("km-KH");
  const [panelBelow, setPanelBelow] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const speechAudioRef = useRef<HTMLAudioElement>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const voiceConversationRef = useRef(false);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; left: number; top: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    let initial = { left: window.innerWidth - 88, top: window.innerHeight - 96 };
    try {
      const stored = localStorage.getItem(POSITION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Position>;
        if (typeof parsed.left === "number" && typeof parsed.top === "number") initial = { left: parsed.left, top: parsed.top };
      }
    } catch { /* Use the default launcher position. */ }
    const clamp = (next: Position) => ({
      left: Math.max(8, Math.min(next.left, window.innerWidth - 72)),
      top: Math.max(8, Math.min(next.top, window.innerHeight - 72)),
    });
    setPosition(clamp(initial));
    const resize = () => setPosition(current => current ? clamp(current) : current);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, notice]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  function moveStart(event: ReactPointerEvent<HTMLElement>) {
    if (!position || event.button !== 0) return;
    const buttonTarget = (event.target as HTMLElement).closest("button");
    if (buttonTarget && buttonTarget !== event.currentTarget) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, ...position, moved: false };
  }

  function movePointer(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
    if (!drag.moved) return;
    setPosition({
      left: Math.max(8, Math.min(drag.left + dx, window.innerWidth - 72)),
      top: Math.max(8, Math.min(drag.top + dy, window.innerHeight - 72)),
    });
  }

  function moveEnd(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressClickRef.current = drag.moved;
    if (drag.moved) {
      const next = {
        left: Math.max(8, Math.min(drag.left + event.clientX - drag.startX, window.innerWidth - 72)),
        top: Math.max(8, Math.min(drag.top + event.clientY - drag.startY, window.innerHeight - 72)),
      };
      setPosition(next);
      try { localStorage.setItem(POSITION_KEY, JSON.stringify(next)); } catch { /* Position persistence is optional. */ }
    }
    dragRef.current = null;
  }

  function spokenText(value: string) {
    const clean = value
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/\[(?:\d+(?:\s*,\s*\d+)*)\]/g, "")
      .replace(/^\s*(?:sources?|references?|ប្រភព(?:ព័ត៌មាន)?)\s*:.*$/gim, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return clean || value.trim();
  }

  function toggleVoiceReplies() {
    const next = !voiceReplies;
    setVoiceReplies(next);
    voiceConversationRef.current = next;
    if (!next) {
      recognitionRef.current?.stop();
      setListening(false);
      speechAudioRef.current?.pause();
      setSpeakingMessageIndex(null);
    }
  }

  function onSpeechEnded() {
    setSpeakingMessageIndex(null);
    if (voiceConversationRef.current) window.setTimeout(() => {
      if (voiceConversationRef.current) startListening();
    }, 250);
  }
  async function sendMessage(content = input, speak = voiceReplies) {
    const question = content.trim();
    if (!question || busy) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setInput("");
    setNotice("");
    setBusy(true);
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.slice(-12).map(({ role, content }) => ({ role, content })) }),
      });
      const result = await response.json() as { answer?: string; error?: string; sources?: unknown; webSearchAvailable?: unknown };
      if (!response.ok || !result.answer) throw new Error(result.error || "មិនអាចទទួលចម្លើយបានទេ។");
      const answer = result.answer;
      const sources = Array.isArray(result.sources) ? result.sources.flatMap((source): AssistantSource[] => {
        if (!source || typeof source !== "object") return [];
        const item = source as Record<string, unknown>;
        if (typeof item.title !== "string" || typeof item.url !== "string") return [];
        try { const url = new URL(item.url); return url.protocol === "https:" ? [{ title: item.title.slice(0, 180), url: url.href }] : []; } catch { return []; }
      }).slice(0, 8) : [];
      setMessages(current => [...current, { role: "assistant", content: answer, sources, webSearchUnavailable: result.webSearchAvailable === false }]);
      if (speak) {
        setSpeechBusy(true);
        setSpeechAudio(null);
        setSpeakingMessageIndex(null);
        try {
          const speechResponse = await fetch("/api/assistant/speech", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: spokenText(answer) }),
          });
          if (!speechResponse.ok) {
            const errorResult = await speechResponse.json() as { error?: string };
            throw new Error(errorResult.error || "មិនអាចបង្កើតសំឡេងបានទេ។");
          }
          const audioUrl = URL.createObjectURL(await speechResponse.blob());
          setSpeechAudio({ messageIndex: nextMessages.length, url: audioUrl });
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "មិនអាចបង្កើតសំឡេងខ្មែរបានទេ។");
        } finally {
          setSpeechBusy(false);
        }
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "មិនអាចភ្ជាប់ទៅ RFX assistant បានទេ។");
    } finally {
      setBusy(false);
    }
  }

  function startListening() {
    if (listening) {
      voiceConversationRef.current = false;
      setVoiceReplies(false);
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const Recognition = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
    if (!Recognition) {
      setNotice("Browser នេះមិនគាំទ្រការស្តាប់សម្លេងទេ។ សូមប្រើ Chrome ឬ Edge ថ្មី។");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = speechLanguage;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = event => {
      const transcript = Array.from(event.results).filter(result => result.isFinal).map(result => result[0].transcript).join(" ").trim();
      if (transcript) {
        voiceConversationRef.current = true;
        setVoiceReplies(true);
        setListening(false);
        setNotice("");
        void sendMessage(transcript, true);
      }
    };
    recognition.onerror = event => {
      setListening(false);
      setNotice(event.error === "not-allowed" ? "សូមអនុញ្ញាតឱ្យប្រើ microphone ក្នុង browser។" : "មិនអាចស្តាប់សម្លេងបានទេ។ សូមព្យាយាមម្ដងទៀត។");
    };
    recognition.onend = () => { setListening(false); if (recognitionRef.current === recognition) recognitionRef.current = null; };
    recognitionRef.current = recognition;
    setVoiceReplies(true);
    setListening(true);
    setNotice("កំពុងស្តាប់…");
    try { recognition.start(); } catch {
      setListening(false);
      setNotice("មិនអាចបើក microphone បានទេ។ សូមព្យាយាមម្ដងទៀត។");
    }
  }

  useEffect(() => () => {
    if (speechAudio?.url) URL.revokeObjectURL(speechAudio.url);
  }, [speechAudio]);

  if (!position) return null;

  return <div className="rfx-assistant-root" style={{ left: position.left, top: position.top }}>
    {open && <section className={`rfx-assistant-panel${panelBelow ? " is-below" : ""}`} aria-label="RFX assistant chat">
      <header className="rfx-assistant-header" onPointerDown={moveStart} onPointerMove={movePointer} onPointerUp={moveEnd} onPointerCancel={moveEnd}>
        <div className="rfx-assistant-avatar"><RobotIcon/></div>
        <div className="rfx-assistant-title"><strong>RFX assistant</strong><span><i/> AI · Web search · សម្លេងបុរស</span></div>
        <button type="button" className="rfx-assistant-close" aria-label="បិទជំនួយការ" onClick={() => setOpen(false)}>×</button>
      </header>
      <div className="rfx-assistant-transcript" ref={transcriptRef} aria-live="polite">
        {messages.length === 0 && <div className="rfx-assistant-welcome"><span>សួស្តី! ខ្ញុំជា RFX assistant</span><p>សួរអ្វីក៏បាន ឬចុចមីក្រូហ្វូនដើម្បីនិយាយ។ អូសផ្នែកខាងលើដើម្បីផ្លាស់ទីខ្ញុំ។</p></div>}
        {messages.map((message, index) => <article key={`${index}-${message.role}`} className={`rfx-assistant-message is-${message.role}`}>
          <span>{message.role === "user" ? "អ្នក" : "RFX assistant"}</span><p>{message.content}</p>{message.role === "assistant" && message.webSearchUnavailable && <small className="rfx-assistant-web-warning">ការស្វែងរក Web មិនអាចប្រើបានបណ្ដោះអាសន្ន។ ចម្លើយនេះមិនបានផ្ទៀងផ្ទាត់ព័ត៌មានថ្មីៗទេ។</small>}{message.sources && message.sources.length > 0 && <nav className="rfx-assistant-sources" aria-label="ប្រភពព័ត៌មានពីអ៊ីនធឺណិត"><strong>ប្រភពព័ត៌មាន</strong>{message.sources.map((source, sourceIndex) => <a href={source.url} target="_blank" rel="noreferrer" key={`${source.url}-${sourceIndex}`}>{source.title} ↗</a>)}</nav>}
          {message.role === "assistant" && speechAudio?.messageIndex === index && <>
            <button type="button" className={`rfx-assistant-wave${speakingMessageIndex === index ? " is-speaking" : ""}`} onClick={() => {
              const audio = speechAudioRef.current;
              if (!audio) return;
              if (audio.paused) void audio.play().then(() => setNotice("")).catch(() => setNotice("មិនអាចចាក់សំឡេងបានទេ។ សូមសាកម្ដងទៀត។"));
              else audio.pause();
            }} aria-label={speakingMessageIndex === index ? "ផ្អាកសំឡេង RFX assistant" : "ស្តាប់ចម្លើយជាសំឡេង"} aria-pressed={speakingMessageIndex === index}>
              <span className="rfx-assistant-wave-bars" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/></span>
            </button>
          </>}
        </article>)}
        {busy && <div className="rfx-assistant-thinking" aria-label="កំពុងគិត"><i/><i/><i/></div>}
        {speechBusy && <p className="rfx-assistant-notice" role="status">កំពុងបង្កើតសំឡេងខ្មែរ…</p>}
        {notice && <p className="rfx-assistant-notice" role="status">{notice}</p>}
      </div>
      <form className="rfx-assistant-compose" onSubmit={event => { event.preventDefault(); void sendMessage(); }}>
        <input value={input} onChange={event => setInput(event.target.value)} placeholder="សរសេរសំណួររបស់អ្នក…" aria-label="សរសេរសំណួរ" maxLength={1200}/>
        <button type="button" className={`rfx-assistant-tool${listening ? " is-active" : ""}`} onClick={startListening} disabled={busy} aria-label={listening ? "បិទមីក្រូហ្វូន" : "និយាយទៅកាន់ RFX assistant"} title="និយាយសំណួរ"><MicrophoneIcon active={listening}/></button>
        <button type="button" className={`rfx-assistant-tool${voiceReplies ? " is-active" : ""}`} onClick={toggleVoiceReplies} aria-label={voiceReplies ? "បិទសំឡេងឆ្លើយ" : "បើកសំឡេងឆ្លើយ"} title="សំឡេងឆ្លើយតបជាបុរស"><MaleVoiceIcon muted={!voiceReplies}/></button>
        <button type="button" className="rfx-assistant-language" onClick={() => setSpeechLanguage(value => value === "km-KH" ? "en-US" : "km-KH")} aria-label={`ភាសាស្តាប់៖ ${speechLanguage === "km-KH" ? "ខ្មែរ" : "English"}`} title="ប្តូរភាសាស្តាប់">{speechLanguage === "km-KH" ? "KM" : "EN"}</button>
        <button type="submit" className="rfx-assistant-send" disabled={busy || !input.trim()} aria-label="ផ្ញើសំណួរ">↑</button>
      </form>

    </section>}
    {speechAudio && <audio ref={speechAudioRef} className="rfx-assistant-audio" autoPlay preload="auto" src={speechAudio.url}
      onPlay={() => setSpeakingMessageIndex(speechAudio.messageIndex)}
      onPause={() => setSpeakingMessageIndex(current => current === speechAudio.messageIndex ? null : current)}
      onEnded={onSpeechEnded}
      aria-hidden="true"/>}
    <button type="button" className="rfx-assistant-launcher" onPointerDown={moveStart} onPointerMove={movePointer} onPointerUp={moveEnd} onPointerCancel={moveEnd} onClick={() => {
      if (suppressClickRef.current) { suppressClickRef.current = false; return; }
      setPanelBelow(position.top < 350);
      setOpen(value => !value);
    }} aria-label={open ? "បិទ RFX assistant" : "បើក RFX assistant"} aria-expanded={open} title="RFX assistant — អូសដើម្បីផ្លាស់ទី"><RobotIcon/></button>
  </div>;
}
