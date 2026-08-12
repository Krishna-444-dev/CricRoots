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

interface VoiceBallInputProps {
  onParsed: (parsed: ParsedBall, transcript: string) => void;
}

export default function VoiceBallInput({ onParsed }: VoiceBallInputProps) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [heard, setHeard] = useState<{ transcript: string; summary: string } | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognitionConstructor() !== null);
  }, []);

  if (!supported) return null;

  const startListening = () => {
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

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
