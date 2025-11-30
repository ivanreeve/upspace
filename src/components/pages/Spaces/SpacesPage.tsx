import { SpacesInventoryForm } from './SpacesPage.InventoryForm';
import { SpacesPortfolioTable } from './SpacesPage.Portfolio';

export default function SpacesPage() {
  return (
    <div className="w-full px-4 pb-8 sm:px-6 lg:px-10">
      <SpacesInventoryForm />
      <SpacesPortfolioTable />
    </div>
  );
}
