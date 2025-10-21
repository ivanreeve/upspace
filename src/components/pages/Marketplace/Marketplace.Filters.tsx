'use client';

import React from 'react';
import { Search, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type FiltersProps = {
  q: string;
  amenities: string[];
  onChange: (next: { q: string; amenities: string[] }) => void;
  onSearch: () => void;
};

export default function MarketplaceFilters({
 q, amenities, onChange, onSearch, 
}: FiltersProps) {
  const [draftAmenity, setDraftAmenity] = React.useState('');

  const addAmenity = (name: string) => {
    const cleaned = name.trim();
    if (!cleaned) return;
    const set = new Set(amenities.map((s) => s.trim()));
    if (!set.has(cleaned)) {
      onChange({
 q,
amenities: [...amenities, cleaned], 
});
    }
  };

  const removeAmenity = (name: string) => {
    onChange({
 q,
amenities: amenities.filter((a) => a !== name), 
});
  };

  const clearFilters = () => onChange({
 q: '',
amenities: [], 
});

  const onAmenityKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addAmenity(draftAmenity);
      setDraftAmenity('');
    } else if (e.key === 'Backspace' && !draftAmenity && amenities.length) {
      // quick remove last
      removeAmenity(amenities[amenities.length - 1]);
    }
  };

  return (
    <>
      <form
        className="flex flex-col gap-3 w-full"
        onSubmit={ (e) => { e.preventDefault(); onSearch(); } }
      >
        <div className="flex gap-3 items-stretch">
          <div className="flex-1 flex items-center gap-2 rounded-md border px-3 py-2 bg-background">
            <Search className="size-4 text-muted-foreground" />
            <Input
              value={ q }
              onChange={ (e) => onChange({
 q: e.target.value,
amenities, 
}) }
              placeholder="Find your perfect coworking space..."
              className="h-8 border-0 focus-visible:ring-0 px-0"
            />
          </div>
          <Button type="submit" className="bg-[#0f5a62] hover:bg-[#0f5a62]/90 px-6">Search</Button>
        </div>

        <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-background">
          <Input
            value={ draftAmenity }
            onChange={ (e) => setDraftAmenity(e.target.value) }
            onKeyDown={ onAmenityKeyDown }
            placeholder="Type an amenity (press Enter)"
            className="h-8 border-0 focus-visible:ring-0 px-0"
          />
        </div>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        { amenities.length === 0 && (
          <Badge variant="secondary" className="text-muted-foreground">No filters</Badge>
        ) }
        { amenities.map((name) => (
          <span key={ name } className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs bg-background">
            { name }
            <button type="button" onClick={ () => removeAmenity(name) } aria-label={ `Remove ${name}` }>
              <X className="size-3" />
            </button>
          </span>
        )) }
        { amenities.length > 0 && (
          <button onClick={ clearFilters } type="button" className="text-xs text-muted-foreground hover:underline">Clear all filters</button>
        ) }
      </div>
    </>
  );
}
