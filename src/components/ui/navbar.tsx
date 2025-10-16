'use client';

import Link from 'next/link';
import * as React from 'react';
import type { IconType } from 'react-icons';
import { GrHomeRounded } from 'react-icons/gr';
import { TbSparkles } from 'react-icons/tb';
import { LuBookOpenText } from 'react-icons/lu';
import { FaQuestion } from 'react-icons/fa6';
import { FiSidebar } from 'react-icons/fi';


import { ThemeSwitcher } from './theme-switcher';
import { LogoSymbolic } from './logo-symbolic';

import { Button } from '@/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  navigationMenuTriggerStyle
} from '@/components/ui/navigation-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';

export type NavItem = {
  href: string;
  label: string;
  icon?: IconType;
};

export type NavBarProps = React.HTMLAttributes<HTMLElement> & {
  menuItems?: NavItem[];
};

export default function NavBar({
  className = '',
  menuItems,
  ...props
}: NavBarProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const closeMenu = () => setIsOpen(false);

  const defaultMenuItems: NavItem[] = [
    {
      href: '/#home',
      label: 'Home',
      icon: GrHomeRounded,
    },
    {
      href: '/#features',
      label: 'Features',
      icon: TbSparkles,
    },
    {
      href: '/#about',
      label: 'About',
      icon: LuBookOpenText,
    },
    {
      href: '/#faqs',
      label: 'FAQs',
      icon: FaQuestion,
    }
  ];
  const resolvedMenuItems = menuItems ?? defaultMenuItems;

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
          <Link href='/'><h1 className='text-xl font-bold'>UpSpace</h1></Link>
        </div>

        { /* Desktop Navigation */ }
        <div className="hidden min-[570px]:flex items-center">
          <NavigationMenu className="ml-auto">
            <NavigationMenuList className="gap-1">
              { resolvedMenuItems.map((item) => (
                <NavigationMenuItem key={ item.href }>
                  <NavigationMenuLink asChild>
                    <Link
                      href={ item.href }
                      className={ navigationMenuTriggerStyle() }
                    >
                      { item.label }
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              )) }

              <NavigationMenuItem>
                <ThemeSwitcher />
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        { /* Mobile Menu Button */ }
        <div className="flex min-[570px]:hidden items-center gap-2">
          <ThemeSwitcher />
          <Sheet open={ isOpen } onOpenChange={ setIsOpen }>
            <SheetTrigger asChild>
              <Button
                className="p-2 rounded-sm bg-muted text-primary dark:bg-muted dark:text-muted-foreground hover:bg-secondary/20 transition-colors"
                aria-label="Toggle menu"
              >
                <FiSidebar className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[300px] sm:w-[400px]"
            >
              <SheetHeader className='border-t-transparent border-r-transparent border-l-transparent border-2 border-b-muted'>
                <SheetTitle className="flex items-center gap-2">
                  <LogoSymbolic className='text-primary dark:text-secondary' />
                  <span className='text-xl font-bold'>UpSpace</span>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                { resolvedMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={ item.href }
                      href={ item.href }
                      onClick={ closeMenu }
                      className="flex rounded-md items-center gap-3 px-4 py-3 bg-transparent text-sm font-medium transition-colors active:bg-secondary/20 active:text-primary dark:active:bg-secondary/10 dark:active:text-secondary group outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    >
                      { Icon && (
                        <Icon className="h-5 w-5 group-active:scale-110 transition-transform" />
                      ) }
                      <span>{ item.label }</span>
                    </Link>
                  );
                }) }
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
