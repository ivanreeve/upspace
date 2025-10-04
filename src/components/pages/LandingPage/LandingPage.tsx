import { FAQs, Features, Hero } from './LandingPage.components';

export default function LandingPage() {
  return (
    <div className="px-4 max-w-[1200px] mx-auto">
      <Hero />
      <Features />
      <FAQs />
    </div>
  );
}
