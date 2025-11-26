import { SpacesInventoryForm } from './SpacesPage.InventoryForm';
import { SpacesPortfolioTable } from './SpacesPage.Portfolio';

export default function SpacesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
      <SpacesInventoryForm />
      <SpacesPortfolioTable />
    </div>
  );
}
