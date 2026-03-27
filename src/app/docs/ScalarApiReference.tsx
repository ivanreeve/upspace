'use client';

import { useEffect } from 'react';
import { ApiReferenceReact, type AnyApiReferenceConfiguration } from '@scalar/api-reference-react';

export default function ScalarApiReference() {
  useEffect(() => {
    document.body.classList.add('scrollbar-hidden');
    document.documentElement.classList.add('scrollbar-hidden');
    return () => {
      document.body.classList.remove('scrollbar-hidden');
      document.documentElement.classList.remove('scrollbar-hidden');
    };
  }, []);

  const configuration = { url: '/openapi.json', } satisfies AnyApiReferenceConfiguration;

  return <ApiReferenceReact configuration={ configuration } />;
}
