'use client';

import dynamic from 'next/dynamic';

type SwaggerUIProps = React.ComponentProps<
  typeof import('swagger-ui-react')['default']
>;

const SwaggerUI = dynamic<SwaggerUIProps>(
  () => import('swagger-ui-react'),
  { ssr: false, }
);

export default function SwaggerUIComponent({ spec, }: { spec: SwaggerUIProps['spec'] }) {
  return <SwaggerUI spec={ spec } />;
}