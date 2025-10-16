'use client';

import { useEffect } from 'react';

const SERVICE_WORKER_PATH = '/sw.js';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      process.env.NODE_ENV !== 'production'
    ) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          SERVICE_WORKER_PATH,
        );
        return registration;
      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    };

    registerServiceWorker();
  }, []);

  return null;
}
