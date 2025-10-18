import SwaggerUIComponent from './SwaggerUI';

import { getApiDocs } from '@/lib/swagger';

export default async function ApiDocsPage() {
  const spec = await getApiDocs();
  return (
    <div>
      <SwaggerUIComponent spec={ spec } />
    </div>
  );
}
