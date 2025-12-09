'use client';

import * as React from 'react';

type VoiceRecognitionAlternative = {
  transcript?: string;
};

type VoiceRecognitionResult = {
  readonly isFinal?: boolean;
  readonly [index: number]: VoiceRecognitionAlternative | undefined;
};

type VoiceRecognitionResults = VoiceRecognitionResult[];

type VoiceRecognitionEvent = {
  readonly results: VoiceRecognitionResults;
};

type VoiceRecognitionErrorEvent = {
  readonly error?: DOMException | Error | string;
};

interface VoiceRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: VoiceRecognitionEvent) => void) | null;
  onerror: ((event: VoiceRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type VoiceRecognitionConstructor = new () => VoiceRecognition;

declare global {
  interface Window {
    SpeechRecognition?: VoiceRecognitionConstructor;
    webkitSpeechRecognition?: VoiceRecognitionConstructor;
  }
}

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

const normalizeRecognitionError = (error: unknown): string => {
  if (typeof error === 'string') return error;

  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'not-allowed';
    }
    if (error.name === 'NotFoundError') {
      return 'microphone-not-found';
    }
    return error.name;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Speech recognition error';
};

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const { lang = 'en-US', } = options;
  const [status, setStatus] = React.useState<SpeechRecognitionStatus>('idle');
  const [isSupported, setIsSupported] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string>();
  const [transcript, setTranscript] = React.useState('');
  const recognitionRef = React.useRef<VoiceRecognition | null>(null);
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

    recognition.onstart = () => {
      setErrorMessage(undefined);
      setStatus('listening');
    };

    recognition.onresult = (event: VoiceRecognitionEvent) => {
      const transcriptValue = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();

      setTranscript(transcriptValue);
    };

    recognition.onerror = (event: VoiceRecognitionErrorEvent) => {
      const message = normalizeRecognitionError(event.error || 'Speech recognition error');
      shouldResumeRef.current = false;
      setErrorMessage(message);
      setStatus('error');
      // Stop immediately so we do not bounce between listening/error states.
      try {
        recognition.stop();
      } catch {
        // ignore stop failures
      }
    };

    recognition.onend = () => {
      if (!shouldResumeRef.current) {
        setStatus((prev) => (prev === 'listening' ? 'idle' : prev));
        return;
      }

    try {
      recognition.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to restart voice search';
      if (message.toLowerCase().includes('invalidstate')) {
        setStatus('listening');
        setErrorMessage(undefined);
        return;
      }
      shouldResumeRef.current = false;
      setErrorMessage(message);
      setStatus('error');
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

    const requestMicPermission = async () => {
      // Some browsers (and OS-level settings) require an explicit media permission grant
      // before SpeechRecognition can start. We request and immediately release the stream
      // so we rely on the same permission prompt and errors as getUserMedia.
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        return true;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, });
        stream.getTracks().forEach((track) => track.stop());
        return true;
      } catch (error) {
        const message = normalizeRecognitionError(error);
        shouldResumeRef.current = false;
        setErrorMessage(message);
        setStatus('error');
        return false;
      }
    };

  const start = async () => {
    const hasPermission = await requestMicPermission();
    if (!hasPermission) return;

    try {
      recognition.start();
    } catch (error) {
      const message = normalizeRecognitionError(error);
      if (message.toLowerCase().includes('invalidstate')) {
        // Already listening; treat as success.
        setStatus('listening');
        setErrorMessage(undefined);
        return;
      }
      shouldResumeRef.current = false;
      setErrorMessage(message);
      setStatus('error');
    }
  };

    void start();
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
