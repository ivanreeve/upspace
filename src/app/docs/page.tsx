import type { Metadata } from 'next';

import ScalarApiReference from './ScalarApiReference';

export const metadata: Metadata = {
  title: 'API Docs | UpSpace',
  description: 'Explore UpSpace API endpoints, request schemas, and response contracts.',
};

export default function ApiDocsPage() {
  return (
    <div>
      <ScalarApiReference />
    </div>
  );
}
