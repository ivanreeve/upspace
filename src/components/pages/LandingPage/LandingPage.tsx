import { About } from './LandingPage.About';
import { FAQs } from './LandingPage.FAQ';
import { Features } from './LandingPage.Features';
import { Hero } from './LandingPage.Hero';

import BackToTopButton from '@/components/ui/back-to-top';

export default function LandingPage() {
  return (
    <div className="px-4 max-w-[1200px] mx-auto">
      <Hero />
      <Features />
      <About />
      <FAQs />
      <BackToTopButton />
    </div>
  );
}
