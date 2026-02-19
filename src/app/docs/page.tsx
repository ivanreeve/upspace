import type { Metadata } from 'next';

import ScalarApiReference from './ScalarApiReference';

import { getApiDocs } from '@/lib/openapi';

export const metadata: Metadata = {
  title: 'API Docs | UpSpace',
  description: 'Explore UpSpace API endpoints, request schemas, and response contracts.',
};

export default async function ApiDocsPage() {
  const spec = await getApiDocs();
  return (
    <div>
      <ScalarApiReference spec={ spec } />
    </div>
  );
}
