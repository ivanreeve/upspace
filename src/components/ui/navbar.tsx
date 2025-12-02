'use client';

import Link from 'next/link';
import * as React from 'react';
import type { IconType } from 'react-icons';
import { GrHomeRounded } from 'react-icons/gr';
import { TbSparkles } from 'react-icons/tb';
import { LuBookOpenText, LuUsers } from 'react-icons/lu';
import { FaQuestion } from 'react-icons/fa6';
import {
  FiSidebar,
  FiLogOut,
  FiUser,
  FiSettings,
  FiBell
} from 'react-icons/fi';
import { useRouter } from 'next/navigation';

import { ThemeSwitcher } from './theme-switcher';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { LogoSymbolic } from './logo-symbolic';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './dropdown-menu';

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
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSession } from '@/components/auth/SessionProvider';
import { useUserProfile } from '@/hooks/use-user-profile';

export type NavItem = {
  href: string;
  label: string;
  icon?: IconType;
};

export type NavBarVariant = 'default' | 'logo-only';

export type NavBarProps = React.HTMLAttributes<HTMLElement> & {
  menuItems?: NavItem[];
  variant?: NavBarVariant;
};

type AccountMenuProps = {
  avatarUrl: string | null;
  fallbackLabel: string;
  onLogout: () => void;
  onNavigate: (href: string) => void;
  displayName: string;
  secondaryLabel: string | null;
  emailLabel: string;
};

function AccountMenu({
 avatarUrl,
 fallbackLabel,
 onLogout,
 onNavigate,
 displayName,
 secondaryLabel,
 emailLabel,
}: AccountMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open account menu"
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Avatar>
            { avatarUrl && <AvatarImage src={ avatarUrl } alt="User avatar" /> }
            <AvatarFallback>{ fallbackLabel }</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="bottom"
          sideOffset={ 12 }
          className="z-[60] min-w-[240px] border border-border bg-card px-2 py-2 shadow-lg"
        >
          <div className="flex items-center gap-3 rounded-md px-2 py-3">
            <Avatar className="size-10 border border-border">
              { avatarUrl ? (
                <AvatarImage src={ avatarUrl } alt="User avatar" />
              ) : (
                <AvatarFallback>{ fallbackLabel }</AvatarFallback>
              ) }
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold leading-tight">{ displayName }</span>
              <span className="text-xs text-muted-foreground truncate">{ secondaryLabel ?? emailLabel }</span>
            </div>
          </div>
          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuItem onSelect={ () => onNavigate('/account') }>
            <FiUser className="size-4" aria-hidden="true" />
            <span>Account</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={ () => onNavigate('/settings') }>
            <FiSettings className="size-4" aria-hidden="true" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={ () => onNavigate('/notifications') }>
            <FiBell className="size-4" aria-hidden="true" />
            <span>Notifications</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuItem
            onSelect={ () => {
              onLogout();
            } }
            className="rounded-sm text-sm font-medium text-destructive focus-visible:text-destructive"
          >
            <FiLogOut className="size-4" aria-hidden="true" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function NavBar({
  className = '',
  menuItems,
  variant = 'default',
  ...props
}: NavBarProps) {
  const navRef = React.useRef<HTMLElement>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const {
 session, isLoading: isSessionLoading, 
} = useSession();
  const { data: userProfile, } = useUserProfile();
  const isSessionResolved = !isSessionLoading;
  const router = useRouter();
  const isLogoOnly = variant === 'logo-only';

  const closeMenu = React.useCallback(() => setIsOpen(false), []);

  const handleNavLinkClick = React.useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, href: string, shouldCloseMenu?: boolean) => {
      if (shouldCloseMenu) {
        closeMenu();
      }

      if (typeof window === 'undefined') {
        return;
      }

      const url = new URL(href, window.location.href);
      const isSamePath = url.pathname === window.location.pathname;
      const targetId = url.hash.replace('#', '');

      if (!isSamePath || !targetId) {
        return;
      }

      const targetElement = document.getElementById(targetId);

      if (!targetElement) {
        return;
      }

      event.preventDefault();

      const navHeight = navRef.current?.offsetHeight ?? 0;
      const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY;

      window.scrollTo({
        top: targetPosition - navHeight,
        behavior: 'smooth',
      });

      history.replaceState(null, '', `${url.pathname}${url.hash}`);
    },
    [closeMenu]
  );

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
      href: '/#team',
      label: 'Team',
      icon: LuUsers,
    },
    {
      href: '/#faqs',
      label: 'FAQs',
      icon: FaQuestion,
    }
  ];
  const shouldShowNavLinks = isSessionResolved && !session;
  const resolvedMenuItems = shouldShowNavLinks ? (menuItems ?? defaultMenuItems) : [];

  const avatarUrl = session?.user?.user_metadata?.avatar_url
    ?? session?.user?.user_metadata?.picture
    ?? null;
  const preferredUsername = session?.user?.user_metadata?.preferred_username;
  const preferredUsernameLabel =
    preferredUsername && preferredUsername.includes('@') ? undefined : preferredUsername;
  const resolvedHandleValue = userProfile?.handle ?? preferredUsernameLabel ?? null;
  const avatarFallback =
    resolvedHandleValue?.slice(0, 2)?.toUpperCase()
    ?? 'US';
  const displayName = resolvedHandleValue ?? 'UpSpace User';
  const secondaryLabel = session?.user?.email ?? null;
  const handleNavigate = React.useCallback((href: string) => {
    router.push(href);
  }, [router]);

  const handleLogout = React.useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { error, } = await supabase.auth.signOut();

    if (error) {
      console.error('Supabase sign-out failed', error);
      return;
    }

    router.refresh();
  }, [router]);

  return (
    <nav
      ref={ navRef }
      aria-label="Main"
      className={ [
        'sticky top-0 z-50 w-full',
        'bg-background/93 text-foreground border-none',
        'backdrop-blur',
        className
      ].join(' ') }
      { ...props }
    >
      { isLogoOnly ? (
        <div className="mx-auto flex h-18 max-w-[1440px] items-center justify-center px-4">
          <Link href="/" className="flex items-center gap-2">
            <LogoSymbolic className="text-primary dark:text-secondary" />
            <span className="text-xl font-bold tracking-wide text-foreground dark:text-foreground">UpSpace</span>
          </Link>
        </div>
      ) : (
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
                        onClick={ (event) => handleNavLinkClick(event, item.href) }
                        className={ navigationMenuTriggerStyle() }
                      >
                        { item.label }
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                )) }

                <NavigationMenuItem>
                    <div className="flex items-center gap-3 px-2">
                      <ThemeSwitcher />
                      { session && (
                        <AccountMenu
                          avatarUrl={ avatarUrl }
                          fallbackLabel={ avatarFallback }
                          onLogout={ handleLogout }
                          onNavigate={ handleNavigate }
                          displayName={ displayName }
                          secondaryLabel={ resolvedHandleValue }
                          emailLabel={ secondaryLabel ?? 'Email unavailable' }
                        />
                      ) }
                    </div>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          { /* Mobile Menu Button */ }
          <div className="flex min-[570px]:hidden items-center gap-2">
            <ThemeSwitcher />
            { session && (
              <AccountMenu
                avatarUrl={ avatarUrl }
                fallbackLabel={ avatarFallback }
                onLogout={ handleLogout }
                onNavigate={ handleNavigate }
                displayName={ displayName }
                secondaryLabel={ resolvedHandleValue }
                emailLabel={ secondaryLabel ?? 'Email unavailable' }
              />
            ) }
            { resolvedMenuItems.length > 0 && (
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
                          onClick={ (event) => handleNavLinkClick(event, item.href, true) }
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
            ) }
          </div>
        </div>
      ) }
    </nav>
  );
}
