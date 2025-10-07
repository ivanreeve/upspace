'use client';

import Link from 'next/link';
import * as React from 'react';
import { Menu, X } from 'lucide-react';

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
  const [isOpen, setIsOpen] = React.useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  const closeMenu = () => setIsOpen(false);

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
      <div className="mx-auto px-4 max-w-[1440px] h-18 flex items-center self-center justify-between">
        <div className='flex flex-row gap-2'>
          <LogoSymbolic className='text-primary dark:text-secondary' />
          <Link href='/'><h1 className='font-serif text-xl font-bold'>UpSpace</h1></Link>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden min-[570px]:flex items-center">
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
                  <Link
                    href="/#about"
                    className={navigationMenuTriggerStyle()}
                  >
                    About
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

        {/* Mobile Menu Button */}
        <div className="flex min-[570px]:hidden items-center gap-2">
          <ThemeSwitcher />
          <button
            onClick={toggleMenu}
            className="p-2 rounded-md hover:bg-secondary/20 transition-colors"
            aria-label="Toggle menu"
            aria-expanded={isOpen}
          >
            {isOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isOpen && (
        <div className="min-[570px]:hidden bg-background border-t border-border">
          <div className="px-4 py-4 space-y-1">
            <Link
              href="/"
              onClick={closeMenu}
              className="block px-4 py-3 rounded-md hover:bg-secondary/20 hover:text-primary transition-colors"
            >
              Home
            </Link>
            <Link
              href="/#features"
              onClick={closeMenu}
              className="block px-4 py-3 rounded-md hover:bg-secondary/20 hover:text-primary transition-colors"
            >
              Features
            </Link>
            <Link
              href="/#about"
              onClick={closeMenu}
              className="block px-4 py-3 rounded-md hover:bg-secondary/20 hover:text-primary transition-colors"
            >
              About
            </Link>
            <Link
              href="/#faqs"
              onClick={closeMenu}
              className="block px-4 py-3 rounded-md hover:bg-secondary/20 hover:text-primary transition-colors"
            >
              FAQs
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
