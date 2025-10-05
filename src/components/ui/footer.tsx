'use client';

import * as React from 'react';
import { FaGithub } from 'react-icons/fa6';
import { GoLinkExternal } from 'react-icons/go';

import { LogoSymbolic } from './logo-symbolic';

type FooterLink = { label: string; href: string; external?: boolean };
type FooterSection = { title: string; links: FooterLink[] };

const BRAND = {
  name: 'UpSpace',
  href: '/',
  tagline: 'Book in seconds.',
  logo: <LogoSymbolic className="h-[18px] w-[18px] text-background dark:text-foreground" />, // color via text-*
};

const SECTIONS: FooterSection[] = [
  {
    title: 'Product',
    links: [
      {
        label: 'Features',
        href: '/features',
      },
      {
        label: 'Pricing',
        href: '/pricing',
      },
      {
        label: 'Changelog',
        href: '/changelog',
      }
    ],
  },
  {
    title: 'Company',
    links: [
      {
        label: 'About',
        href: '/about',
      },
      {
        label: 'Careers',
        href: '/careers',
      },
      {
        label: 'Press',
        href: '/press',
      }
    ],
  },
  {
    title: 'Resources',
    links: [
      {
        label: 'Docs',
        href: '/docs',
      },
      {
        label: 'Blog',
        href: '/blog',
      },
      {
        label: 'Support',
        href: '/support',
      }
    ],
  }
];

const SOCIALS: { github?: string; twitter?: string; linkedin?: string } = {
  github: 'https://github.com/ivanreeve/upspace',
  twitter: 'https://x.com/acme',
  linkedin: 'https://www.linkedin.com/company/acme',
};

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-black text-background dark:bg-background dark:text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="flex items-center justify-start gap-3">
              <div className="flex justify-center p-1">
                {BRAND.logo}
              </div>
              <div>
                <a
                  href={BRAND.href}
                  className="text-lg font-medium hover:underline"
                  aria-label={BRAND.name}
                >
                  {BRAND.name}
                </a>
                <p className="mt-1 max-w-prose text-sm text-background dark:text-foreground">
                  {BRAND.tagline}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              {SOCIALS.github && (
                <a
                  href={SOCIALS.github}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="GitHub"
                  className="inline-flex h-9 items-center justify-center gap-2 p-4 border-2 border-white text-black bg-white hover:bg-black dark:hover:bg-background hover:text-white"
                >
                  <FaGithub size={16} /> <span className="text-sm font-semibold">GitHub</span> <GoLinkExternal />
                </a>
              )}
            </div>
          </div>

          <nav aria-label="Footer navigation" className="md:col-span-8">
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              {SECTIONS.map((section) => (
                <div key={section.title}>
                  <h3 className="text-sm font-medium dark:text-foreground text-background">{section.title}</h3>
                  <ul className="mt-3 space-y-2">
                    {section.links.map((link) => (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          {...(link.external ? {
                            target: '_blank',
                            rel: 'noreferrer',
                          } : {})}
                          className="text-sm text-muted-foreground dark:hover:text-foreground hover:text-background"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </nav>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-6">
          <div className="text-sm text-background dark:text-muted-foreground">
            <span>© {year} {BRAND.name}. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
