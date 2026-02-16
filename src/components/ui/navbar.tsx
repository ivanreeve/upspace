'use client';

import Link from 'next/link';
import * as React from 'react';
import type { IconType } from 'react-icons';
import { GrHomeRounded } from 'react-icons/gr';
import { TbSparkles } from 'react-icons/tb';
import { LuBookOpenText, LuUsers } from 'react-icons/lu';
import { FaQuestion } from 'react-icons/fa6';
import {
  FiBell,
  FiChevronRight,
  FiCreditCard,
  FiLayers,
  FiLogOut,
  FiSettings,
  FiSidebar,
  FiUser
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
  showTransactionHistory: boolean;
  showNotifications: boolean;
  showAccountLinks: boolean;
};

function AccountMenu({
  avatarUrl,
  fallbackLabel,
  onLogout,
  onNavigate,
  displayName,
  secondaryLabel,
  emailLabel,
  showTransactionHistory,
  showNotifications,
  showAccountLinks,
}: AccountMenuProps) {
  const hasAdditionalLinks =
    showAccountLinks || showNotifications || showTransactionHistory;

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
            <span className="text-sm font-semibold leading-tight">
              { displayName }
            </span>
            <span className="text-xs text-muted-foreground truncate">
              { secondaryLabel ?? emailLabel }
            </span>
          </div>
        </div>
        { hasAdditionalLinks && <DropdownMenuSeparator className="my-1" /> }
        { showAccountLinks && (
          <>
            <DropdownMenuItem
              onSelect={ () => onNavigate('/customer/account') }
              className="dark:data-[highlighted]:bg-[oklch(0.24_0.02_204.6929)] dark:focus-visible:bg-[oklch(0.24_0.02_204.6929)] dark:data-[highlighted]:text-secondary dark:data-[highlighted]:[&_svg]:text-secondary"
            >
              <FiUser className="size-4" aria-hidden="true" />
              <span>Account</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={ () => onNavigate('/customer/settings') }
              className="dark:data-[highlighted]:bg-[oklch(0.24_0.02_204.6929)] dark:focus-visible:bg-[oklch(0.24_0.02_204.6929)] dark:data-[highlighted]:text-secondary dark:data-[highlighted]:[&_svg]:text-secondary"
            >
              <FiSettings className="size-4" aria-hidden="true" />
              <span>Settings</span>
            </DropdownMenuItem>
          </>
        ) }
        { showNotifications && (
          <DropdownMenuItem
            onSelect={ () => onNavigate('/customer/notifications') }
            className="dark:data-[highlighted]:bg-[oklch(0.24_0.02_204.6929)] dark:focus-visible:bg-[oklch(0.24_0.02_204.6929)] dark:data-[highlighted]:text-secondary dark:data-[highlighted]:[&_svg]:text-secondary"
          >
            <FiBell className="size-4" aria-hidden="true" />
            <span>Notifications</span>
          </DropdownMenuItem>
        ) }
        { showTransactionHistory && (
          <DropdownMenuItem
            onSelect={ () => onNavigate('/customer/transactions') }
            className="dark:data-[highlighted]:bg-[oklch(0.24_0.02_204.6929)] dark:focus-visible:bg-[oklch(0.24_0.02_204.6929)] dark:data-[highlighted]:text-secondary dark:data-[highlighted]:[&_svg]:text-secondary"
          >
            <FiCreditCard className="size-4" aria-hidden="true" />
            <span>Transaction history</span>
          </DropdownMenuItem>
        ) }
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem
          onSelect={ () => {
            onLogout();
          } }
          className="mt-2 rounded-sm text-sm font-medium text-destructive focus-visible:text-destructive data-[highlighted]:bg-[oklch(0.9647_0.0345_19.81)] focus-visible:bg-[oklch(0.9647_0.0345_19.81)] dark:data-[highlighted]:bg-[oklch(0.24_0.04_19.81)] dark:focus-visible:bg-[oklch(0.24_0.04_19.81)] data-[highlighted]:text-destructive data-[highlighted]:[&_svg]:text-destructive hover:bg-[oklch(0.9647_0.0345_19.81)] dark:hover:bg-[oklch(0.24_0.04_19.81)] hover:text-destructive hover:[&_svg]:text-destructive"
        >
          <FiLogOut className="size-4 text-destructive" aria-hidden="true" />
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
    (
      event: React.MouseEvent<HTMLAnchorElement>,
      href: string,
      shouldCloseMenu?: boolean
    ) => {
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
      const targetPosition =
        targetElement.getBoundingClientRect().top + window.scrollY;

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
      href: '/marketplace',
      label: 'Marketplace',
      icon: FiLayers,
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
  const resolvedMenuItems = shouldShowNavLinks
    ? (menuItems ?? defaultMenuItems)
    : [];

  const avatarUrl =
    session?.user?.user_metadata?.avatar_url ??
    session?.user?.user_metadata?.picture ??
    null;
  const preferredUsername = session?.user?.user_metadata?.preferred_username;
  const preferredUsernameLabel =
    preferredUsername && preferredUsername.includes('@')
      ? undefined
      : preferredUsername;
  const resolvedHandleValue =
    userProfile?.handle ?? preferredUsernameLabel ?? null;
  const avatarFallback =
    resolvedHandleValue?.slice(0, 2)?.toUpperCase() ?? 'US';
  const displayName = resolvedHandleValue ?? 'UpSpace User';
  const secondaryLabel = session?.user?.email ?? null;
  const metadataRole = session?.user?.user_metadata?.role as
    | 'customer'
    | 'partner'
    | 'admin'
    | undefined;
  const resolvedRole = metadataRole ?? userProfile?.role;
  const isAdmin = resolvedRole === 'admin';
  const hasTransactionHistory =
    resolvedRole === 'customer' || resolvedRole === 'partner';
  const hasNotifications = hasTransactionHistory;
  const showAccountLinks = !isAdmin;
  const handleNavigate = React.useCallback(
    (href: string) => {
      router.push(href);
    },
    [router]
  );

  const handleLogout = React.useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { error, } = await supabase.auth.signOut();

    if (error) {
      console.error('Supabase sign-out failed', error);
      return;
    }

    await router.replace('/');
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
            <span className="text-xl font-bold tracking-wide text-foreground dark:text-foreground">
              UpSpace
            </span>
          </Link>
        </div>
      ) : (
        <div className="mx-auto px-4 max-w-[1440px] h-18 flex items-center self-center justify-between">
          <div className="flex flex-row gap-2">
            <LogoSymbolic className="text-primary dark:text-secondary" />
            <Link href="/">
              <h1 className="text-xl font-bold">UpSpace</h1>
            </Link>
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
                        onClick={ (event) =>
                          handleNavLinkClick(event, item.href)
                        }
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
                          showTransactionHistory={ hasTransactionHistory }
                          showNotifications={ hasNotifications }
                          showAccountLinks={ showAccountLinks }
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
              showTransactionHistory={ hasTransactionHistory }
              showNotifications={ hasNotifications }
              showAccountLinks={ showAccountLinks }
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
                  className="w-full max-w-[480px] overflow-hidden border-l bg-background/95 p-0 backdrop-blur-xl"
                >
                  <div className="relative flex h-full flex-col">
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute -left-10 top-6 size-44 rounded-full bg-primary/12 blur-3xl" />
                      <div className="absolute right-[-56px] top-24 size-48 rounded-full bg-secondary/10 blur-3xl" />
                    </div>

                    <div className="relative border-b border-border/60 bg-gradient-to-br from-background/95 via-background/80 to-secondary/5 px-5 pb-6 pt-8 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <LogoSymbolic className="text-primary dark:text-secondary" />
                          <div className="flex flex-col">
                            <span className="text-base font-semibold">
                              UpSpace
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Find your next workspace
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                        Book inspiring coworking spaces and stay close to your
                        team, wherever you are.
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button asChild size="sm">
                          <Link
                            href="/#features"
                            onClick={ (event) =>
                              handleNavLinkClick(event, '/#features', true)
                            }
                            aria-label="Explore featured workspaces"
                          >
                            Book a space
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href="/#faqs"
                            onClick={ (event) =>
                              handleNavLinkClick(event, '/#faqs', true)
                            }
                            aria-label="Browse frequently asked questions"
                          >
                            FAQs
                          </Link>
                        </Button>
                      </div>
                    </div>

                    <nav
                      aria-label="Mobile primary navigation"
                      className="relative flex-1 overflow-y-auto px-4 py-4"
                    >
                      <div className="flex flex-col gap-2">
                        { resolvedMenuItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <Link
                              key={ item.href }
                              href={ item.href }
                              onClick={ (event) =>
                                handleNavLinkClick(event, item.href, true)
                              }
                              className="group flex items-center gap-3 rounded-lg border border-border/70 bg-card/80 px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition hover:-translate-x-1 hover:border-primary/50 hover:bg-card focus-visible:ring-ring/50 focus-visible:ring-[3px] active:scale-[0.995]"
                            >
                              { Icon && (
                                <span className="rounded-md bg-muted/60 p-2 text-primary transition group-hover:bg-primary/10 group-hover:text-primary">
                                  <Icon
                                    className="h-5 w-5"
                                    aria-hidden="true"
                                  />
                                </span>
                              ) }
                              <div className="flex flex-1 flex-col items-start">
                                <span>{ item.label }</span>
                                <span className="text-xs font-normal text-muted-foreground">
                                  Jump to the { item.label.toLowerCase() } section
                                </span>
                              </div>
                              <FiChevronRight
                                className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
                                aria-hidden="true"
                              />
                            </Link>
                          );
                        }) }
                      </div>
                    </nav>

                    <div className="relative border-t border-border/60 bg-card/80 px-4 py-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-foreground">
                            Need a space today?
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Chat with our team for tailored options.
                          </span>
                        </div>
                        <Button size="sm" variant="secondary" asChild>
                          <Link
                            href="/#team"
                            onClick={ (event) =>
                              handleNavLinkClick(event, '/#team', true)
                            }
                            aria-label="Meet the UpSpace team"
                          >
                            Meet the team
                          </Link>
                        </Button>
                      </div>
                    </div>
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
