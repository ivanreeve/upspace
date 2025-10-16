import { About } from './LandingPage.About';
import CallToAction from './LandingPage.CallToAction';
import { FAQs } from './LandingPage.FAQ';
import { Features } from './LandingPage.Features';
import { Hero } from './LandingPage.Hero';

import BackToTopButton from '@/components/ui/back-to-top';

export default function LandingPage() {
  return (
    <div className="px-4 max-w-[1440px] mx-auto">
      <Hero />
      <Features />
      <About />
      <FAQs />
      <CallToAction />
      <BackToTopButton />
    </div>
  );
}
