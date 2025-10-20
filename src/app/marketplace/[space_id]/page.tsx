import NavBar from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';

export default function SpaceDetailPage({ params, }: { params: { space_id: string } }) {
  return (
    <>
      <NavBar />
      <main className="max-w-[1200px] mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold">Space #{ params.space_id }</h1>
        <p className="text-muted-foreground mt-2">Details coming soon.</p>
      </main>
      <Footer />
    </>
  );
}

