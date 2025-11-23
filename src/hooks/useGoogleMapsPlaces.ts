'use client';

import { useEffect, useState } from 'react';

type LoaderState = 'idle' | 'loading' | 'ready' | 'error';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
let googleMapsLoaderPromise: Promise<void> | null = null;

const loadGoogleMapsScript = (apiKey: string) => {
  if (googleMapsLoaderPromise) {
    return googleMapsLoaderPromise;
  }

  googleMapsLoaderPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Google Maps can only load in the browser.'));
      return;
    }

    const existingScript =
      document.querySelector<HTMLScriptElement>('script[data-google-maps="true"]') ??
      document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com/maps/api/js"]');

    const script = existingScript ?? document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = 'true';

    const cleanup = () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };

    const handleLoad = () => {
      cleanup();
      script.dataset.loaded = 'true';
      resolve();
    };

    const handleError = () => {
      cleanup();
      googleMapsLoaderPromise = null;
      reject(new Error('Failed to load Google Maps script'));
    };

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);

    if (!existingScript) {
      document.head.appendChild(script);
    } else if (existingScript.dataset.loaded === 'true') {
      cleanup();
      resolve();
    }
  });

  return googleMapsLoaderPromise;
};

export const useGoogleMapsPlaces = () => {
  const [status, setStatus] = useState<LoaderState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (window.google?.maps?.places) {
      setStatus('ready');
      setErrorMessage(null);
      return;
    }

    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set. Address autocomplete is disabled.');
      setStatus('error');
      setErrorMessage('Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable address autocomplete.');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setErrorMessage(null);

    loadGoogleMapsScript(GOOGLE_MAPS_API_KEY)
      .then(() => {
        if (cancelled) {
          return;
        }

        if (window.google?.maps?.places) {
          setStatus('ready');
          setErrorMessage(null);
        } else {
          setStatus('error');
          setErrorMessage('Unable to initialize Google Maps Places.');
        }
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setStatus('error');
        setErrorMessage('Unable to load Google Maps data. Please refresh the page.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    isReady: status === 'ready',
    isLoading: status === 'loading',
    isError: status === 'error',
    errorMessage,
  };
};
