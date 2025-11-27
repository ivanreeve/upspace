'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FiBell,
  FiCommand,
  FiHome,
  FiLogOut,
  FiMessageSquare,
  FiSearch,
  FiSettings,
  FiBarChart2,
  FiUser
} from 'react-icons/fi';
import { HiOutlineDocumentText } from 'react-icons/hi';
import { TbLayoutSidebarFilled } from 'react-icons/tb';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Kbd } from '@/components/ui/kbd';
import { LogoSymbolic } from '@/components/ui/logo-symbolic';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  useSidebar
} from '@/components/ui/sidebar';
import { ThemeSwitcher } from '@/components/ui/theme-switcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useSession } from '@/components/auth/SessionProvider';
import { useCachedAvatar } from '@/hooks/use-cached-avatar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUserProfile } from '@/hooks/use-user-profile';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type MarketplaceChromeProps = {
  children: React.ReactNode
  dialogSlot?: React.ReactNode
  onSearchOpen?: () => void
  insetClassName?: string
  insetStyle?: React.CSSProperties
  initialSidebarOpen?: boolean
  sidebarExtras?: React.ReactNode
};

type SidebarFooterContentProps = {
  avatarUrl: string | null
  avatarFallback: string
  avatarDisplayName: string
  resolvedHandleLabel: string | undefined
  userEmail: string | null
  onNavigate: (href: string) => void
  onLogout: () => Promise<void> | void
  isGuest: boolean
};

function SidebarToggleMenuItem() {
  const {
    state,
    toggleSidebar,
  } = useSidebar();
  const isExpanded = state === 'expanded';
  const Icon = isExpanded
    ? TbLayoutSidebarFilled
    : TbLayoutSidebarFilled;

  return (
    <SidebarMenuItem
      className={ cn(
        'flex items-center gap-2',
        isExpanded ? 'justify-between pr-2 pl-1' : 'justify-center pr-1'
      ) }
    >
      { isExpanded && (
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <LogoSymbolic className="size-5 text-primary dark:text-secondary" />
          <span className="leading-tight">UpSpace</span>
        </Link>
      ) }
      <SidebarMenuButton
        tooltip={ isExpanded ? 'Collapse sidebar' : 'Expand sidebar' }
        type="button"
        onClick={ toggleSidebar }
        className="w-10 justify-center p-2"
        aria-label={ isExpanded ? 'Collapse sidebar' : 'Expand sidebar' }
      >
        <Icon className="size-4" aria-hidden="true" />
        <span className="sr-only">{ isExpanded ? 'Collapse sidebar' : 'Expand sidebar' }</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SidebarFooterContent({
  avatarUrl,
  avatarFallback,
  avatarDisplayName,
  resolvedHandleLabel,
  userEmail,
  onNavigate,
  onLogout,
  isGuest,
}: SidebarFooterContentProps) {
  const { state, } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const secondaryLabel = isGuest
    ? 'Public browsing'
    : userEmail ?? resolvedHandleLabel ?? 'Account';
  const emailLabel = isGuest
    ? 'Public browsing'
    : userEmail ?? 'Email unavailable';

  return (
    <div
      className={ cn(
        'p-2 flex flex-col',
        isCollapsed ? 'items-center gap-3' : 'space-y-2'
      ) }
    >
      <ThemeSwitcher
        variant={ isCollapsed ? 'compact' : 'default' }
        className={ isCollapsed ? undefined : 'w-full justify-between' }
      />
      { isGuest ? (
        <SidebarMenuButton
          type="button"
          tooltip={ isCollapsed ? 'Sign in' : undefined }
          className={ cn('w-full ml-[-5px] py-8 gap-2', isCollapsed ? 'justify-center' : 'justify-start') }
          aria-label="Sign in"
          onClick={ () => onNavigate('/') }
        >
          <Avatar className={ cn('size-9', isCollapsed && 'size-8') }>
            { avatarUrl ? (
              <AvatarImage src={ avatarUrl } alt="Guest avatar" />
            ) : (
              <AvatarFallback>{ avatarFallback }</AvatarFallback>
            ) }
          </Avatar>
          { !isCollapsed && (
            <div className="flex min-w-0 flex-col text-left">
              <span className="text-sm font-semibold leading-tight">Guest</span>
              <span className="text-xs text-muted-foreground truncate">{ secondaryLabel }</span>
            </div>
          ) }
        </SidebarMenuButton>
      ) : (
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  type="button"
                  tooltip={ isCollapsed ? 'Open account menu' : undefined }
                  className={ cn('w-full ml-[-5px] py-8', isCollapsed ? 'justify-center' : 'justify-start') }
                  aria-label="Open account menu"
                >
                  <Avatar className={ cn('size-9', isCollapsed && 'size-8') }>
                    { avatarUrl ? (
                      <AvatarImage src={ avatarUrl } alt="User avatar" />
                    ) : (
                      <AvatarFallback>{ avatarFallback }</AvatarFallback>
                    ) }
                  </Avatar>
                  { !isCollapsed && (
                    <div className="flex min-w-0 flex-col text-left">
                      <span className="text-sm font-semibold leading-tight">{ avatarDisplayName }</span>
                      { secondaryLabel && (
                        <span className="text-xs text-muted-foreground truncate">
                          { secondaryLabel }
                        </span>
                      ) }
                    </div>
                  ) }
                  <span className="sr-only">
                    { `Open account menu for ${avatarDisplayName}${resolvedHandleLabel ? ` (${resolvedHandleLabel})` : ''}` }
                  </span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                align="end"
                sideOffset={ 24 }
                className="w-64 border border-border bg-card p-2 shadow-lg"
              >
                <div className="flex items-center gap-3 rounded-md px-2 py-3">
                  <Avatar className="size-11 border border-border">
                    { avatarUrl ? (
                      <AvatarImage src={ avatarUrl } alt="User avatar" />
                    ) : (
                      <AvatarFallback>{ avatarFallback }</AvatarFallback>
                    ) }
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold leading-tight">{ avatarDisplayName }</span>
                    <span className="text-xs text-muted-foreground truncate">{ emailLabel }</span>
                  </div>
                </div>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem
                  onSelect={ () => onNavigate('/onboarding') }
                >
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
                  className="text-destructive focus-visible:text-destructive"
                  onSelect={ () => { void onLogout(); } }
                >
                  <FiLogOut className="size-4" aria-hidden="true" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      ) }
    </div>
  );
}

function MobileTopNav({
  avatarUrl,
  avatarFallback,
  onSearchOpen,
  displayName,
  emailLabel,
  onNavigate,
  onLogout,
  isGuest,
}: {
  avatarUrl: string | null
  avatarFallback: string
  onSearchOpen: () => void
  displayName: string
  emailLabel: string
  onNavigate: (href: string) => void
  onLogout: () => Promise<void> | void
  isGuest: boolean
}) {
  return (
    <header
      className="fixed inset-x-0 top-0 z-40 border-b bg-background/90 px-4 py-3 backdrop-blur-md md:hidden"
      style={
        {
          paddingTop: 'calc(var(--safe-area-top) + 12px)',
          paddingBottom: '12px',
          paddingLeft: 'max(1rem, var(--safe-area-left))',
          paddingRight: 'max(1rem, var(--safe-area-right))',
        } as React.CSSProperties
      }
    >
      <div className="mx-auto flex max-w-[1440px] items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <LogoSymbolic className="text-primary dark:text-secondary" />
          <span className="text-base font-semibold text-foreground">UpSpace</span>
        </Link>
        <div className="flex items-center gap-2">
          { !isGuest && (
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="rounded-full p-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <FiBell className="size-5" aria-hidden="true" />
            </Link>
          ) }
          <button
            type="button"
            aria-label="Search"
            onClick={ onSearchOpen }
            className="rounded-full p-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <FiSearch className="size-5" aria-hidden="true" />
          </button>
          { isGuest ? (
            <button
              type="button"
              aria-label="Sign in"
              onClick={ () => onNavigate('/') }
              className="rounded-full border border-border p-1 transition-colors focus-visible:outline-none focus-visible:bg-none"
            >
              <Avatar className="size-8">
                { avatarUrl ? (
                  <AvatarImage src={ avatarUrl } alt="Guest avatar" />
                ) : (
                  <AvatarFallback>{ avatarFallback }</AvatarFallback>
                ) }
              </Avatar>
            </button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Open account menu"
                  className="rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:bg-none"
                >
                  <Avatar className="size-8 border border-border">
                    { avatarUrl ? (
                      <AvatarImage src={ avatarUrl } alt="User avatar" />
                    ) : (
                      <AvatarFallback>{ avatarFallback }</AvatarFallback>
                    ) }
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="bottom"
                sideOffset={ 28 }
                className="z-[60] min-w-[240px] border border-border bg-card px-2 py-2 shadow-lg"
              >
                <div className="flex items-center gap-3 rounded-md px-2 py-3">
                  <Avatar className="size-10 border border-border">
                    { avatarUrl ? (
                      <AvatarImage src={ avatarUrl } alt="User avatar" />
                    ) : (
                      <AvatarFallback>{ avatarFallback }</AvatarFallback>
                    ) }
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold leading-tight">{ displayName }</span>
                    <span className="text-xs text-muted-foreground truncate">{ emailLabel }</span>
                  </div>
                </div>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem onSelect={ () => onNavigate('/onboarding') }>
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
                  className="text-destructive focus-visible:text-destructive"
                  onSelect={ () => { void onLogout(); } }
                >
                  <FiLogOut className="size-4" aria-hidden="true" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) }
        </div>
      </div>
    </header>
  );
}

function useMarketplaceNavData() {
  const { session, } = useSession();
  const { data: userProfile, } = useUserProfile();
  const router = useRouter();

  const avatarUrl = session?.user?.user_metadata?.avatar_url
    ?? session?.user?.user_metadata?.picture
    ?? null;
  const profileHandleLabel = userProfile?.handle ?? undefined;
  const preferredUsername = session?.user?.user_metadata?.preferred_username;
  const preferredUsernameLabel =
    preferredUsername && preferredUsername.includes('@') ? undefined : preferredUsername;
  const resolvedHandleLabel = profileHandleLabel ?? preferredUsernameLabel;
  const isGuest = !session;
  const resolvedHandleValue = isGuest
    ? null
    : userProfile?.handle ?? preferredUsernameLabel ?? null;
  const avatarFallback = isGuest
    ? 'GU'
    : (resolvedHandleValue?.slice(0, 2)?.toUpperCase() ?? 'US');
  const avatarDisplayName = isGuest
    ? 'Guest'
    : (resolvedHandleLabel ?? 'UpSpace User');
  const userEmail = session?.user?.email ?? null;
  const handleNavigation = React.useCallback((href: string) => {
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

  const resolvedRole = isGuest ? undefined : userProfile?.role;

  return React.useMemo(
    () => ({
      avatarUrl,
      avatarFallback,
      avatarDisplayName,
      resolvedHandleLabel,
      userEmail,
      onNavigate: handleNavigation,
      onLogout: handleLogout,
      role: resolvedRole,
      isGuest,
    }),
    [
      avatarDisplayName,
      avatarFallback,
      avatarUrl,
      handleLogout,
      handleNavigation,
      isGuest,
      resolvedHandleLabel,
      userEmail,
      resolvedRole
    ]
  );
}

export function MarketplaceChrome({
  children,
  dialogSlot,
  onSearchOpen,
  insetClassName,
  insetStyle,
  initialSidebarOpen,
  sidebarExtras,
}: MarketplaceChromeProps) {
  const navData = useMarketplaceNavData();
  const cachedAvatarUrl = useCachedAvatar(navData.avatarUrl);
  const {
    onNavigate,
    role,
    isGuest,
  } = navData;
  const isAdmin = role === 'admin';
  const isCustomer = role === 'customer';
  const verificationSidebarItem = isAdmin ? (
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip="Verification queue">
          <Link href="/admin">
            <HiOutlineDocumentText className="size-4" aria-hidden="true" strokeWidth={ 1 } />
            <span data-sidebar-label>Verification Queue</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
  ) : null;
  const dashboardSidebarItem = isAdmin ? (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip="Dashboard">
        <Link href="/marketplace/dashboard">
          <FiBarChart2 className="size-4" aria-hidden="true" strokeWidth={ 1.4 } />
          <span data-sidebar-label>Dashboard</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  ) : null;
  const isMobile = useIsMobile();
  const mobileInsetPadding = React.useMemo<React.CSSProperties | undefined>(
    () => (isMobile
      ? {
          paddingTop: 'calc(4rem + var(--safe-area-top))',
          paddingBottom: 'calc(2.75rem + var(--safe-area-bottom))',
        }
      : undefined),
    [isMobile]
  );
  const handleSearch = React.useCallback(() => {
    if (onSearchOpen) {
      onSearchOpen();
      return;
    }

    onNavigate('/marketplace?search=1');
  }, [onNavigate, onSearchOpen]);

  React.useEffect(() => {
    if (!onSearchOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key.toLowerCase() !== 'k') return;
      if (!event.metaKey && !event.ctrlKey) return;

      event.preventDefault();
      onSearchOpen();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSearchOpen]);

  return (
    <SidebarProvider className="bg-background min-h-screen" initialOpen={ initialSidebarOpen }>
      { dialogSlot }
      { isMobile && (
        <MobileTopNav
          avatarUrl={ cachedAvatarUrl }
          avatarFallback={ navData.avatarFallback }
          onSearchOpen={ handleSearch }
          displayName={ navData.avatarDisplayName }
          emailLabel={ navData.userEmail ?? 'Email unavailable' }
          onNavigate={ navData.onNavigate }
          onLogout={ navData.onLogout }
          isGuest={ navData.isGuest }
        />
      ) }
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="icon" className="hidden md:flex border-1 border-r-muted">
          <SidebarHeader className="pt-4">
              <SidebarMenu>
                <SidebarToggleMenuItem />
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Home">
                    <Link href="/marketplace">
                      <FiHome className="size-4" strokeWidth={ 1.4 } />
                      <span data-sidebar-label>Home</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Search"
                    className="justify-start gap-2 group-data-[collapsible=icon]:justify-center"
                    type="button"
                    onClick={ handleSearch }
                  >
                    <FiSearch className="size-4" strokeWidth={ 1.4 }/>
                    <span data-sidebar-label>Search</span>
                    { onSearchOpen ? (
                      <Kbd className="ml-auto hidden items-center gap-1 bg-sidebar-accent/10 text-[10px] text-sidebar-foreground/70 md:flex group-data-[collapsible=icon]:hidden">
                        <FiCommand className="size-3" aria-hidden="true" />
                        <span> + K</span>
                      </Kbd>
                    ) : null }
                  </SidebarMenuButton>
                </SidebarMenuItem>
                { !isGuest && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Notifications">
                      <Link href="/notifications">
                        <FiBell className="size-4" strokeWidth={ 1.4 } />
                        <span data-sidebar-label>Notifications</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) }
                { isCustomer && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Messages">
                      <Link href="/messages">
                        <FiMessageSquare className="size-4" strokeWidth={ 1.4 } />
                        <span data-sidebar-label>Messages</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) }
                { sidebarExtras }
                { dashboardSidebarItem }
                { verificationSidebarItem }
              </SidebarMenu>
          </SidebarHeader>
          <SidebarContent className="flex-1" />
          <SidebarFooter className="mt-auto border-t border-sidebar-border/60">
          <SidebarFooterContent
            avatarUrl={ cachedAvatarUrl }
            avatarFallback={ navData.avatarFallback }
            avatarDisplayName={ navData.avatarDisplayName }
            resolvedHandleLabel={ navData.resolvedHandleLabel }
            userEmail={ navData.userEmail }
            onNavigate={ navData.onNavigate }
            onLogout={ navData.onLogout }
            isGuest={ navData.isGuest }
          />
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset
          className={ cn('flex-1 bg-background w-full pb-10 pt-16 md:pt-0', insetClassName) }
          style={ mobileInsetPadding || insetStyle ? {
            ...mobileInsetPadding,
            ...insetStyle,
          } : undefined }
        >
          { children }
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
