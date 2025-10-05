'use client';

import Link from 'next/link';
import * as React from 'react';

import { ThemeSwitcher } from './theme-switcher';
import { LogoSymbolic } from './logo-symbolic';

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
      className={ [
        'sticky top-0 z-50 w-full',
        'bg-background/93 text-foreground border-none',
        'backdrop-blur',
        className
      ].join(' ') }
      { ...props }
    >
      <div className="mx-auto px-4 max-w-[1440px] h-18 flex items-center self-center justify-between">
        <div className='flex flex-row gap-2'>
          <LogoSymbolic className='text-primary dark:text-secondary' />
          <Link href='/'><h1 className='font-serif text-xl font-bold'>UpSpace</h1></Link>
        </div>
        <div className="flex items-center">
          <NavigationMenu className="ml-auto">
            <NavigationMenuList className="gap-1">
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <Link href="/" className={ navigationMenuTriggerStyle() }>
                    Home
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <Link
                    href="/#features"
                    className={ navigationMenuTriggerStyle() }
                  >
                    Features
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <Link
                    href="/#about"
                    className={ navigationMenuTriggerStyle() }
                  >
                    About
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <Link href="/#faqs" className={ navigationMenuTriggerStyle() }>
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
