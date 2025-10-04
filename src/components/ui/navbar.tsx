'use client';

import Link from 'next/link';
import * as React from 'react';

import { ThemeSwitcher } from './theme-switcher';

import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  navigationMenuTriggerStyle
} from '@/components/ui/navigation-menu';

export type NavBarProps = React.HTMLAttributes<HTMLElement>;

export default function NavBar({
  className = '', ...props
}: NavBarProps) {
  return (
    <nav
      aria-label="Main"
      className={[
        'sticky top-0 z-50 w-full',
        'bg-background/93 text-foreground border-none',
        'backdrop-blur',
        className
      ].join(' ')}
      {...props}
    >
      <div className="mx-auto px-4 max-w-[1440px] flex items-center self-center justify-between">
        <Link href='/'><h1 className='font-serif'>UpSpace</h1></Link>
        <div className="flex h-14 items-center">
          <NavigationMenu className="ml-auto">
            <NavigationMenuList className="gap-1">
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <Link href="/" className={navigationMenuTriggerStyle()}>
                    Home
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <Link
                    href="/#features"
                    className={navigationMenuTriggerStyle()}
                  >
                    Features
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <Link href="/#faqs" className={navigationMenuTriggerStyle()}>
                    FAQs
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <ThemeSwitcher />
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
      </div>
    </nav>
  );
}
