import Marketplace from '@/components/pages/Marketplace/Marketplace';
import NavBar from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';

export default function MarketplacePage() {
  return (
    <>
      <NavBar/>
      <Marketplace />
      <Footer />
    </>
  );
}

