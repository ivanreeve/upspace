import { SpacesActionCenter } from './SpacesPage.ActionCenter';
import { SpacesInventoryForm } from './SpacesPage.InventoryForm';
import { SpacesPortfolioTable } from './SpacesPage.Portfolio';

import BackToTopButton from '@/components/ui/back-to-top';

export default function SpacesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <SpacesActionCenter />
      <SpacesInventoryForm />
      <SpacesPortfolioTable />
      <BackToTopButton />
    </div>
  );
}
