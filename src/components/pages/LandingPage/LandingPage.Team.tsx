'use client';

import Image from 'next/image';

import { Badge } from '@/components/ui/badge';

type TeamMember = {
  name: string;
  role: string;
  photo: string;
};

const TEAM_MEMBERS: TeamMember[] = [
  {
    name: 'Mark Armas',
    role: 'System Designer',
    photo: '/img/team/system-designer.png',
  },
  {
    name: 'Trisha Dumagsa',
    role: 'UI/UX Designer',
    photo: '/img/team/designer.png',
  },
  {
    name: 'Ivan Lopez',
    role: 'Lead Developer',
    photo: '/img/team/devops.png',
  },
  {
    name: 'Ferdinand Cadorna',
    role: 'Quality Assurance',
    photo: '/img/team/quality-assurance.png',
  },
  {
    name: 'Jerome Tegrado',
    role: 'Business Analyst',
    photo: '/img/team/analyst.png',
  }
];

export function Team() {
  const carouselMembers = [...TEAM_MEMBERS, ...TEAM_MEMBERS];

  return (
    <section id="team" className="py-32 sm:py-36">
      <div className="mx-auto max-w-6xl space-y-12 px-6 lg:px-8">
        <div className="space-y-6 text-center lg:text-left">
          <Badge variant="secondary" className="mx-auto w-fit uppercase tracking-wide lg:mx-0">
            Team
          </Badge>
          <div className="space-y-4">
            <h2 className="text-4xl sm:text-5xl font-instrument-serif leading-tight tracking-tight">
              The people building UpSpace.
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto lg:mx-0">
              A cross-functional crew of strategists, designers, and technologists dedicated to shaping flexible work.
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden py-8">
          <div className="pointer-events-none absolute inset-y-0 left-0 md:w-64 w-16 bg-gradient-to-r from-background/95 via-background/60 to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 md:w-64 w-16 bg-gradient-to-l from-background/95 via-background/60 to-transparent z-10" />

          <div className="flex gap-12">
            <div
              className="flex min-w-max gap-12 px-6"
              style={ { animation: 'team-marquee 28s linear infinite', } }
            >
              { carouselMembers.map((member, index) => (
                <article
                  key={ `${member.name}-${index}` }
                  className="relative flex shrink-0 flex-col items-left gap-4 bg-background/80 text-left backdrop-blur"
                >
                  <div className="relative h-64 w-48 overflow-hidden border border-border/60 bg-muted/40 rounded-md">
                    <Image
                      src={ member.photo }
                      alt={ member.name }
                      fill
                      sizes="192px"
                      className="object-cover"
                      priority={ index === 0 }
                      unoptimized
                    />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">{ member.name }</h3>
                    <p className="text-sm text-muted-foreground">{ member.role }</p>
                  </div>
                </article>
              )) }
            </div>
          </div>
        </div>
      </div>

      <style jsx>{ `
        @keyframes team-marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      ` }</style>
    </section>
  );
}
