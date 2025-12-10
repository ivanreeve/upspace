import { About } from './LandingPage.About';
import CallToAction from './LandingPage.CallToAction';
import { FAQs } from './LandingPage.FAQ';
import { Features } from './LandingPage.Features';
import { Hero } from './LandingPage.Hero';
import { Team } from './LandingPage.Team';

import NavBar from '@/components/ui/navbar';
import BackToTopButton from '@/components/ui/back-to-top';

type LandingPageProps = {
  showHero?: boolean,
};

export default function LandingPage({ showHero = true, }: LandingPageProps) {
  return (
    <>
      <NavBar />
      <div className="px-4 max-w-[1440px] mx-auto">
        { showHero && <Hero /> }
        <Features />
        <About />
        <Team />
        <FAQs />
        <CallToAction />
        <BackToTopButton />
      </div>
    </>
  );
}
