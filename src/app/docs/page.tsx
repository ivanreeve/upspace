import ScalarApiReference from './ScalarApiReference';

import { getApiDocs } from '@/lib/openapi';

export default async function ApiDocsPage() {
  const spec = await getApiDocs();
  return (
    <div>
      <ScalarApiReference spec={ spec } />
    </div>
  );
}
