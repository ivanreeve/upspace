'use client';

import { useEffect, useState } from 'react';

export type GeolocationState = {
  location: { lat: number; long: number } | null;
  status: 'idle' | 'pending' | 'success' | 'error';
  error: string | null;
};

export function useGeolocation(): GeolocationState {
  const [location, setLocation] = useState<{ lat: number; long: number } | null>(
    null
  );
  const [status, setStatus] = useState<GeolocationState['status']>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setError('Location access is not supported in this browser.');
      setStatus('error');
      return;
    }

    let canceled = false;
    setStatus('pending');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (canceled) {
          return;
        }
        setLocation({
          lat: position.coords.latitude,
          long: position.coords.longitude,
        });
        setStatus('success');
      },
      (geoError) => {
        if (canceled) {
          return;
        }
        setError(
          geoError?.message ?? 'Unable to determine location. Please try again.'
        );
        setStatus('error');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000 * 60 * 5,
        timeout: 10000,
      }
    );

    return () => {
      canceled = true;
    };
  }, []);

  return {
 location,
status,
error, 
};
}
