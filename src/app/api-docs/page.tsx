import { getApiDocs } from '@/lib/swagger';
import SwaggerUIComponent from './SwaggerUI';

export default async function ApiDocsPage() {
  const spec = await getApiDocs();
  return (
    <div>
      <SwaggerUIComponent spec={spec} />
    </div>
  );
}
