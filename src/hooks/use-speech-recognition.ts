'use client';

import * as React from 'react';

export type SpeechRecognitionStatus = 'idle' | 'listening' | 'error' | 'unsupported';

type UseSpeechRecognitionOptions = {
  lang?: string;
};

type UseSpeechRecognitionReturn = {
  isSupported: boolean;
  status: SpeechRecognitionStatus;
  errorMessage?: string;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
};

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const { lang = 'en-US', } = options;
  const [status, setStatus] = React.useState<SpeechRecognitionStatus>('idle');
  const [isSupported, setIsSupported] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string>();
  const [transcript, setTranscript] = React.useState('');
  const recognitionRef = React.useRef<SpeechRecognition | null>(null);
  const shouldResumeRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      setIsSupported(false);
      setStatus('unsupported');
      return;
    }

    const RecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!RecognitionCtor) {
      setIsSupported(false);
      setStatus('unsupported');
      return;
    }

    const recognition = new RecognitionCtor();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    setIsSupported(true);
    setStatus('idle');

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcriptValue = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();

      setTranscript(transcriptValue);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const message = event.error || 'Speech recognition error';
      setErrorMessage(message);
      setStatus('error');
    };

    recognition.onend = () => {
      if (!shouldResumeRef.current) {
        setStatus((prev) => (prev === 'listening' ? 'idle' : prev));
        return;
      }

      try {
        recognition.start();
        setStatus('listening');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to restart voice search';
        setErrorMessage(message);
        setStatus('error');
        shouldResumeRef.current = false;
      }
    };

    return () => {
      shouldResumeRef.current = false;
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [lang]);

  const startListening = React.useCallback(() => {
    const recognition = recognitionRef.current;
    if (!isSupported || !recognition) return;

    setErrorMessage(undefined);
    setTranscript('');
    shouldResumeRef.current = true;

    try {
      recognition.start();
      setStatus('listening');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start voice search';
      setErrorMessage(message);
      setStatus('error');
    }
  }, [isSupported]);

  const stopListening = React.useCallback(() => {
    shouldResumeRef.current = false;
    recognitionRef.current?.stop();
    setStatus((prev) => (prev === 'listening' ? 'idle' : prev));
  }, []);

  const resetTranscript = React.useCallback(() => {
    setTranscript('');
  }, []);

  return {
    isSupported,
    status,
    errorMessage,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
  };
}

declare global {
  interface Window {
    webkitSpeechRecognition?: typeof SpeechRecognition;
    SpeechRecognition?: typeof SpeechRecognition;
  }
}
