'use client';

import * as React from 'react';
import { FaMicrophone, FaPlay, FaStop } from 'react-icons/fa';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { useSpeechRecognition, type SpeechRecognitionStatus } from '@/hooks/use-speech-recognition';
import { useIsMobile } from '@/hooks/use-mobile';

type VoiceSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: string) => void;
  title?: string;
  description?: string;
  autoSubmitDelayMs?: number;
  onStatusChange?: (status: SpeechRecognitionStatus) => void;
  onError?: (message?: string) => void;
};

export function VoiceSearchDialog({
  open,
  onOpenChange,
  onSubmit,
  title,
  description,
  autoSubmitDelayMs = 5000,
  onStatusChange,
  onError,
}: VoiceSearchDialogProps) {
  const isMobile = useIsMobile();
  const {
    isSupported,
    status,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    errorMessage,
  } = useSpeechRecognition();
  const silenceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const isListening = status === 'listening';
  const hasTranscript = Boolean(transcript.trim());
  const borderWidth = hasTranscript
    ? Math.min(6, Math.max(2, transcript.length / 3))
    : isListening
      ? 4
      : 2;
  const ringColor = status === 'unsupported' ? 'var(--muted)' : 'var(--secondary)';
  const circleStyle: React.CSSProperties = {
    borderWidth,
    borderStyle: 'solid',
    borderColor: ringColor,
    boxShadow: isListening
      ? '0 0 0 12px color-mix(in oklab, var(--secondary) 22%, transparent)'
      : undefined,
  };
  const resolvedTitle = title ?? 'Voice search';
  const resolvedDescription = description ?? 'Hold the mic, speak, and we’ll type it out.';
  const placeholderMessage = status === 'unsupported'
    ? 'Voice input is not available in this browser.'
    : 'Speak now and your words will appear here…';

  React.useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  React.useEffect(() => {
    if (!errorMessage) return;

    onError?.(errorMessage);
  }, [errorMessage, onError]);

  const handleSubmit = React.useCallback(() => {
    const value = transcript.trim();
    if (!value) return;

    stopListening();
    onSubmit(value);
    onOpenChange(false);
  }, [transcript, stopListening, onSubmit, onOpenChange]);

  const handleAutoSubmit = React.useCallback(() => {
    const value = transcript.trim();
    if (!value) return;

    stopListening();
    onSubmit(value);
    onOpenChange(false);
  }, [transcript, stopListening, onSubmit, onOpenChange]);

  const handleClose = React.useCallback(() => {
    stopListening();
    onOpenChange(false);
  }, [stopListening, onOpenChange]);

  const handleToggleListening = React.useCallback(() => {
    if (!isSupported) return;

    if (isListening) {
      stopListening();
      return;
    }

    startListening();
  }, [isListening, isSupported, startListening, stopListening]);

  React.useEffect(() => {
    if (!open) {
      stopListening();
      resetTranscript();
      return;
    }

    resetTranscript();
    if (isSupported) {
      startListening();
    }

    return () => {
      stopListening();
    };
  }, [open, isSupported, startListening, stopListening, resetTranscript]);

  React.useEffect(() => {
    if (!transcript.trim()) {
      silenceTimerRef.current && clearTimeout(silenceTimerRef.current);
      return;
    }

    silenceTimerRef.current && clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => handleAutoSubmit(), autoSubmitDelayMs);

    return () => {
      silenceTimerRef.current && clearTimeout(silenceTimerRef.current);
    };
  }, [autoSubmitDelayMs, handleAutoSubmit, transcript]);

  return (
    <Dialog open={ open } onOpenChange={ onOpenChange }>
      <DialogContent
        className="px-6 py-8 sm:px-10 sm:py-10"
        position="top"
        mobileFullScreen={ isMobile }
        fullWidth
      >
        <div className="flex h-full flex-col gap-6">
          <DialogHeader className="px-0 text-center">
            <DialogTitle>{ resolvedTitle }</DialogTitle>
            <DialogDescription>{ resolvedDescription }</DialogDescription>
          </DialogHeader>

          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
            <div
              className="flex h-[108px] w-[108px] items-center justify-center rounded-full bg-secondary/20 transition-all duration-300 mt-6 mb-6"
              style={ circleStyle }
            >
              <div className="flex h-[90px] w-[90px] items-center justify-center rounded-full bg-secondary">
                <FaMicrophone className="size-5 text-background" aria-hidden="true" />
              </div>
            </div>
            <div className="min-h-[3rem] text-center text-sm text-muted-foreground">
              { transcript ? (
                <p className="whitespace-pre-wrap text-foreground">{ transcript }</p>
              ) : (
                <p>{ placeholderMessage }</p>
              ) }
            </div>
            { errorMessage && (
              <p className="text-center text-xs text-destructive" role="status">
                { errorMessage }
              </p>
            ) }
          </div>

          <div className="flex w-full items-center justify-center gap-2">
            <Button
              variant={ isListening ? 'destructive' : 'secondary' }
              onClick={ handleToggleListening }
              disabled={ status === 'unsupported' }
              className="w-full sm:w-auto"
            >
              { isListening ? (
                <>
                  <FaStop className="mr-2 size-4" aria-hidden="true" />
                  Stop listening
                </>
              ) : (
                <>
                  <FaPlay className="mr-2 size-4" aria-hidden="true" />
                  Listen
                </>
              ) }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
