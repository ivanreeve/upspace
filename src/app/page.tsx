import LandingPage from '@/components/pages/LandingPage/LandingPage';
import NavBar from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';

export default function Home() {
  return (
    <>
      <NavBar />
      <LandingPage />
      <Footer />
    </>
  );
}
