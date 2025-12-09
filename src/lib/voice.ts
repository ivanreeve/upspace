export const VOICE_UNSUPPORTED_MESSAGE =
  'Voice input is not supported in this browser.';

const MICROPHONE_ACCESS_DENIED_MESSAGE =
  'Microphone access was denied. Please allow microphone access in your browser settings to use voice search.';
const MICROPHONE_NOT_FOUND_MESSAGE =
  'No microphone was detected. Check your input device and try again.';

export function getSpeechRecognitionErrorMessage(error?: string) {
  if (!error) return undefined;

  if (error === 'not-allowed') {
    return MICROPHONE_ACCESS_DENIED_MESSAGE;
  }

  if (error === 'microphone-not-found') {
    return MICROPHONE_NOT_FOUND_MESSAGE;
  }

  return error;
}
