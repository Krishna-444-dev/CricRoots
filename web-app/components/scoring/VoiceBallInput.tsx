'use client';

import { useEffect, useRef, useState } from 'react';
import { parseBallTranscript, ParsedBall } from '@/lib/voiceBallParser';

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
        onParsed(parseBallTranscript(transcript), transcript);
      }
    };

    recognitionRef.current = recognition;
    setInterimText('');
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
      {interimText && (
        <p className="text-xs text-ink-muted italic px-2 text-center">&ldquo;{interimText}&rdquo;</p>
      )}
    </div>
  );
}
