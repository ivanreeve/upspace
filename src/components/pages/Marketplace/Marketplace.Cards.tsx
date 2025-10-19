"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Star } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { Space } from "@/lib/api/spaces";

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="shadow-sm">
          <Skeleton className="h-40 w-full rounded-t-xl" />
          <CardContent className="py-4 space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-9 w-40 mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function CardsGrid({ items }: { items: Space[] }) {
  if (items.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">No spaces found. Try adjusting filters.</div>
    );
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => (
        <SpaceCard key={s.space_id} space={s} />)
      )}
    </div>
  );
}

export function SpaceCard({ space }: { space: Space }) {
  const location = [space.city, space.region].filter(Boolean).join(', ');
  const priceText = '₱500–₱700'; // placeholder
  const rating = 4.5; // placeholder

  return (
<Card className="shadow-sm hover:shadow-md transition p-3">
  <div className="aspect-[16/9] w-full rounded-xl overflow-hidden relative">
    {space.image_url ? (
      <Image
        src={space.image_url}
        alt={space.name}
        fill
        sizes="(min-width: 1024px) 33vw, 100vw"
        className="object-cover"
      />
    ) : (
      <div className="h-full w-full bg-gradient-to-br from-slate-200 to-slate-300" />
    )}
  </div>

  <CardContent className="p-3">
    <Link href={`/marketplace/${space.space_id}`} className="block group">
      <div className="font-semibold group-hover:underline truncate">{space.name}</div>
    </Link>
    <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
      <MapPin className="size-3.5" /> {location || '—'}
    </div>
    <div className="mt-2 flex items-center justify-between">
      <div className="text-[#0c7b46] font-semibold">{priceText}</div>
      <div className="flex items-center gap-1 text-amber-500 text-sm">
        <Star className="size-4 fill-amber-500 text-amber-500" />
        {rating.toFixed(1)}
      </div>
    </div>
    <div className="mt-3">
      <Link href={`/marketplace/${space.space_id}`}>
        <Button className="bg-[#0f5a62] hover:bg-[#0f5a62]/90 w-full">Check Availability</Button>
      </Link>
    </div>
  </CardContent>
</Card>
  );
}
