'use client';

import { useEffect, useRef, useState } from 'react';
import { parseBallTranscript, ParsedBall } from '@/lib/voiceBallParser';
import { labelize } from '@/lib/ballTaxonomy';

// Renders what the parser actually understood from the transcript, as short "Field: Value"
// chips, so the scorer can visually confirm before tapping Record Ball - a raw transcript
// alone doesn't show whether e.g. "off stump" landed as the line or was missed entirely.
function summarizeParsed(parsed: ParsedBall): string {
  const parts: string[] = [];
  if (parsed.isWicket) parts.push(`Wicket: ${parsed.wicketType ? labelize(parsed.wicketType.replace(/ /g, '-')) : 'yes'}`);
  if (parsed.isExtra) parts.push(`Extra: ${parsed.extraType ? labelize(parsed.extraType) : 'yes'}`);
  if (typeof parsed.runs === 'number') parts.push(`Runs: ${parsed.runs}`);
  if (parsed.line) parts.push(`Line: ${labelize(parsed.line)}`);
  if (parsed.length) parts.push(`Length: ${labelize(parsed.length)}`);
  if (parsed.shotType) parts.push(`Shot: ${labelize(parsed.shotType)}`);
  if (parsed.shotZone) parts.push(`Zone: ${labelize(parsed.shotZone)}`);
  if (parsed.fielderPosition) parts.push(`Fielder pos: ${labelize(parsed.fielderPosition)}`);
  return parts.length > 0 ? parts.join(' · ') : 'nothing recognized - use the buttons below';
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// BCP-47 locale codes for Web Speech API. Cricket-term nouns (yorker, cover drive, off
// stump...) are kept matching against the same English vocabulary in voiceBallParser.ts
// regardless of the selected language - real Indian/Pakistani cricket commentary is
// famously Hinglish/Urdish, with technical cricket terms almost always spoken as English
// loanwords even mid-vernacular-sentence. What the locale selection actually buys is
// better recognition accuracy for everything AROUND those terms (numbers, connecting
// words, wicket descriptions) when the scorer is more comfortable narrating in their own
// language. A true vernacular cricket-term vocabulary (e.g. matching "यॉर्कर" the way
// "yorker" is matched today) is a deliberate follow-up, not built here - transliteration
// accuracy can't be verified without live audio testing, and a wrong guess at unfamiliar
// vocabulary would silently mis-parse rather than just miss, which is worse than the
// current honest "didn't recognize that" fallback.
const VOICE_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-IN', label: 'English (India)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'en-AU', label: 'English (Australia)' },
  { code: 'hi-IN', label: 'हिन्दी Hindi' },
  { code: 'ur-PK', label: 'اردو Urdu' },
  { code: 'bn-IN', label: 'বাংলা Bengali' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ Punjabi' },
  { code: 'ta-IN', label: 'தமிழ் Tamil' },
  { code: 'te-IN', label: 'తెలుగు Telugu' },
];

const VOICE_LANG_STORAGE_KEY = 'cricroots_voice_lang';

interface VoiceBallInputProps {
  onParsed: (parsed: ParsedBall, transcript: string) => void;
}

export default function VoiceBallInput({ onParsed }: VoiceBallInputProps) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [heard, setHeard] = useState<{ transcript: string; summary: string } | null>(null);
  const [lang, setLang] = useState('en-US');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognitionConstructor() !== null);
    const saved = typeof window !== 'undefined' ? localStorage.getItem(VOICE_LANG_STORAGE_KEY) : null;
    if (saved && VOICE_LANGUAGES.some(l => l.code === saved)) setLang(saved);
  }, []);

  if (!supported) return null;

  const handleLangChange = (code: string) => {
    setLang(code);
    localStorage.setItem(VOICE_LANG_STORAGE_KEY, code);
  };

  const startListening = () => {
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    let finalTranscript = '';
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += `${result[0].transcript} `;
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimText(finalTranscript + interim);
    };
    recognition.onerror = () => {
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      const transcript = finalTranscript.trim();
      if (transcript) {
        const parsed = parseBallTranscript(transcript);
        setHeard({ transcript, summary: summarizeParsed(parsed) });
        onParsed(parsed, transcript);
      }
    };

    recognitionRef.current = recognition;
    setInterimText('');
    setHeard(null);
    setListening(true);
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
  };

  return (
    <div className="mb-4 flex flex-col items-center gap-2">
      <select
        value={lang}
        onChange={(e) => handleLangChange(e.target.value)}
        disabled={listening}
        className="text-xs bg-surface-alt border border-border rounded-md px-2 py-1 text-ink-secondary self-end"
        aria-label="Voice input language"
      >
        {VOICE_LANGUAGES.map(l => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
      {!lang.startsWith('en') && (
        <p className="text-[11px] text-ink-muted text-center -mt-1 px-2">
          Cricket terms (yorker, cover drive, off stump...) still work best said in English within your sentence.
        </p>
      )}
      <button
        type="button"
        onMouseDown={startListening}
        onMouseUp={stopListening}
        onMouseLeave={() => listening && stopListening()}
        onTouchStart={(e) => { e.preventDefault(); startListening(); }}
        onTouchEnd={(e) => { e.preventDefault(); stopListening(); }}
        className={`w-full py-3 rounded-lg font-semibold text-sm touch-manipulation border transition-colors ${
          listening
            ? 'bg-wicket-500 border-wicket-500 text-white'
            : 'bg-surface-alt border-border text-ink-secondary hover:bg-surface-hover'
        }`}
      >
        {listening ? '🎙️ Listening... release to fill' : '🎙️ Hold to speak the ball'}
      </button>
      {listening && interimText && (
        <p className="text-xs text-ink-muted italic px-2 text-center">&ldquo;{interimText}&rdquo;</p>
      )}
      {!listening && heard && (
        <div className="text-xs px-2 text-center">
          <p className="text-ink-muted italic">Heard: &ldquo;{heard.transcript}&rdquo;</p>
          <p className="text-pitch-400 font-medium mt-0.5">{heard.summary}</p>
        </div>
      )}
    </div>
  );
}
