import type { Metadata } from 'next';

import SpaceCreateRoute from '../create/page';

export const metadata: Metadata = {
  title: 'Edit Space | UpSpace',
  description: 'Update an existing listing and submit your latest changes for review.',
};

export const dynamic = 'force-dynamic';

export default SpaceCreateRoute;
