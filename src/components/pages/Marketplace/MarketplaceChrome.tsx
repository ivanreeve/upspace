'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BarChart3,
  Bookmark,
  Briefcase,
  ChevronRight,
  Command,
  CreditCard,
  DollarSign,
  EyeOff,
  FileText,
  Home,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeft,
  Search,
  Settings,
  Ticket,
  User,
  Users,
  UserX,
  Wallet
} from 'lucide-react';
import { LuMessageSquareText } from 'react-icons/lu';
import { MdManageSearch, MdOutlineNotificationsNone } from 'react-icons/md';
import { RiHome6Line } from 'react-icons/ri';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/components/auth/SessionProvider';
import { useCachedAvatar } from '@/hooks/use-cached-avatar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUserProfile, type UserProfile } from '@/hooks/use-user-profile';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type MarketplaceChromeProps = {
  children: React.ReactNode;
  dialogSlot?: React.ReactNode;
  onSearchOpen?: () => void;
  insetClassName?: string;
  insetStyle?: React.CSSProperties;
  initialSidebarOpen?: boolean;
  messageHref?: string;
};

type SidebarFooterContentProps = {
  avatarUrl: string | null;
  avatarFallback: string;
  avatarDisplayName: string;
  resolvedHandleLabel: string | undefined;
  userEmail: string | null;
  onNavigate: (href: string) => void;
  onLogout: () => Promise<void> | void;
  isGuest: boolean;
  isSidebarLoading: boolean;
  showNotifications?: boolean;
  showAccount?: boolean;
  showWallet?: boolean;
  showTransactionHistory?: boolean;
  showSettings?: boolean;
};

function GradientSparklesIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  const gradientId = React.useId();
  const stroke = `url(#${gradientId})`;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={ 2 }
      strokeLinecap="round"
      strokeLinejoin="round"
      className={ cn('size-4', className) }
      aria-hidden={ props['aria-label'] ? undefined : 'true' }
      { ...props }
    >
      <defs>
        <linearGradient
          id={ gradientId }
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
          gradientTransform="rotate(120 0.5 0.5)"
        >
          <stop offset="0%" stopColor="var(--secondary)" />
          <stop offset="35%" stopColor="#28a745" />
          <stop offset="60%" stopColor="#ffc107" />
          <stop offset="85%" stopColor="#ff8c00" />
          <stop offset="100%" stopColor="#ff6f00" />
        </linearGradient>
      </defs>
      <path
        d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
        stroke={ stroke }
      />
      <path d="M20 3v4" stroke={ stroke } />
      <path d="M22 5h-4" stroke={ stroke } />
      <path d="M4 17v2" stroke={ stroke } />
      <path d="M5 18H3" stroke={ stroke } />
    </svg>
  );
}

function NotificationIcon(props: React.SVGProps<SVGSVGElement>) {
  return <MdOutlineNotificationsNone { ...props } />;
}

function SidebarMessageIcon(props: React.SVGProps<SVGSVGElement>) {
  return <LuMessageSquareText { ...props } />;
}

function SidebarHomeIcon(props: React.SVGProps<SVGSVGElement>) {
  return <RiHome6Line { ...props } />;
}

function SidebarToggleMenuItem() {
  const {
 state, toggleSidebar, isMobile, 
} = useSidebar();
  const isExpanded = state === 'expanded';

  if (isMobile) {
    const CloseIcon = ChevronRight;

    return (
      <SidebarMenuItem className="flex items-center justify-between gap-2 pr-1">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <LogoSymbolic className="size-5 text-primary dark:text-secondary" />
          <span className="leading-tight">UpSpace</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeSwitcher variant="compact" shadowless />
          <SidebarMenuButton
            tooltip="Close menu"
            type="button"
            onClick={ toggleSidebar }
            className="w-10 justify-center p-2"
            aria-label="Close menu"
          >
            <CloseIcon className="size-4" aria-hidden="true" />
            <span className="sr-only">Close menu</span>
          </SidebarMenuButton>
        </div>
      </SidebarMenuItem>
    );
  }

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
        { isExpanded ? (
          <PanelLeft className="size-4" aria-hidden="true" />
        ) : (
          <LogoSymbolic
            className="size-4 text-primary dark:text-secondary"
            aria-hidden="true"
          />
        ) }
        <span className="sr-only">
          { isExpanded ? 'Collapse sidebar' : 'Expand sidebar' }
        </span>
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
  isSidebarLoading,
  showNotifications = true,
  showAccount = true,
  showWallet = false,
  showTransactionHistory = true,
  showSettings = true,
}: SidebarFooterContentProps) {
  const {
 state, isMobile, 
} = useSidebar();
  const isCollapsed = state === 'collapsed';
  const secondaryLabel = isGuest
    ? 'Public browsing'
    : (userEmail ?? resolvedHandleLabel ?? 'Account');
  const emailLabel = isGuest
    ? 'Public browsing'
    : (userEmail ?? 'Email unavailable');
  const skeletonAvatarClass = cn(
    'rounded-full',
    isCollapsed ? 'h-9 w-9' : 'h-11 w-11'
  );
  const skeletonTextClass = isCollapsed ? 'h-3 w-16' : 'h-3 w-24';
  const sidebarAccountMenuItemClassName =
    'data-[highlighted]:bg-[oklch(0.955_0.02_204.6929)] focus-visible:bg-[oklch(0.955_0.02_204.6929)] dark:data-[highlighted]:bg-[oklch(0.24_0.02_204.6929)] dark:focus-visible:bg-[oklch(0.24_0.02_204.6929)] data-[highlighted]:text-primary data-[highlighted]:[&_svg]:text-primary dark:data-[highlighted]:text-secondary dark:data-[highlighted]:[&_svg]:text-secondary hover:!text-primary hover:[&_svg]:!text-primary dark:hover:!text-secondary dark:hover:[&_svg]:!text-secondary';
  const sidebarLogoutMenuItemClassName =
    'mt-2 text-destructive focus-visible:text-destructive data-[highlighted]:bg-[oklch(0.9647_0.0345_19.81)] focus-visible:bg-[oklch(0.9647_0.0345_19.81)] dark:data-[highlighted]:bg-[oklch(0.24_0.04_19.81)] dark:focus-visible:bg-[oklch(0.24_0.04_19.81)] data-[highlighted]:text-destructive data-[highlighted]:[&_svg]:text-destructive hover:bg-[oklch(0.9647_0.0345_19.81)] dark:hover:bg-[oklch(0.24_0.04_19.81)] hover:text-destructive hover:[&_svg]:text-destructive';

  if (isMobile) {
    return null;
  }

  return (
    <div
      className={ cn(
        'p-2 flex flex-col',
        isCollapsed ? 'items-center gap-3' : 'space-y-2'
      ) }
    >
      <ThemeSwitcher
        variant={ isCollapsed ? 'compact' : 'default' }
        shadowless
        className={ isCollapsed ? undefined : 'w-full justify-between' }
      />
      { isSidebarLoading ? (
        isCollapsed ? (
          <Skeleton className={ skeletonAvatarClass } />
        ) : (
          <Skeleton className="h-16 w-full rounded-md" />
        )
      ) : isGuest ? (
        <SidebarMenuButton
          type="button"
          tooltip={ isCollapsed ? 'Sign in' : undefined }
          className={ cn(
            'w-full ml-[-5px] py-8 gap-2',
            isCollapsed ? 'justify-center' : 'justify-start'
          ) }
          aria-label="Sign in"
          onClick={ () => onNavigate('/') }
        >
          <Avatar className={ cn('size-9', isCollapsed && 'size-8') }>
            { avatarUrl ? (
              <AvatarImage src={ avatarUrl } alt="Guest avatar" />
            ) : (
              <AvatarFallback className="text-white">
                { avatarFallback }
              </AvatarFallback>
            ) }
          </Avatar>
          { !isCollapsed && (
            <div className="flex min-w-0 flex-col text-left">
              <span className="text-sm font-semibold leading-tight">Guest</span>
              <span className="text-xs text-muted-foreground truncate">
                { secondaryLabel }
              </span>
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
                  className={ cn(
                    'w-full ml-[-5px] py-8',
                    isCollapsed ? 'justify-center' : 'justify-start'
                  ) }
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
                      <span className="text-sm font-semibold leading-tight">
                        { avatarDisplayName }
                      </span>
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
                    <span className="text-sm font-semibold leading-tight">
                      { avatarDisplayName }
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      { emailLabel }
                    </span>
                  </div>
                </div>
                { (showAccount ||
                  showWallet ||
                  showSettings ||
                  showNotifications ||
                  showTransactionHistory) && (
                  <DropdownMenuSeparator className="my-1" />
                ) }
                { showAccount && (
                  <DropdownMenuItem
                    onSelect={ () => onNavigate('/customer/account') }
                    className={ sidebarAccountMenuItemClassName }
                  >
                    <User className="size-4" aria-hidden="true" />
                    <span>Account</span>
                  </DropdownMenuItem>
                ) }
                { showWallet && (
                  <DropdownMenuItem
                    onSelect={ () => onNavigate('/customer/account/wallet') }
                    className={ sidebarAccountMenuItemClassName }
                  >
                    <Wallet className="size-4" aria-hidden="true" />
                    <span>Wallet</span>
                  </DropdownMenuItem>
                ) }
                { showSettings && (
                  <DropdownMenuItem
                    onSelect={ () => onNavigate('/customer/settings') }
                    className={ sidebarAccountMenuItemClassName }
                  >
                    <Settings className="size-4" aria-hidden="true" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                ) }
                { showNotifications && (
                  <DropdownMenuItem
                    onSelect={ () => onNavigate('/customer/notifications') }
                    className={ sidebarAccountMenuItemClassName }
                  >
                    <NotificationIcon className="size-4" aria-hidden="true" />
                    <span>Notifications</span>
                  </DropdownMenuItem>
                ) }
                { showTransactionHistory && (
                  <DropdownMenuItem
                    onSelect={ () => onNavigate('/customer/transactions') }
                    className={ sidebarAccountMenuItemClassName }
                  >
                    <CreditCard className="size-4" aria-hidden="true" />
                    <span>Transaction history</span>
                  </DropdownMenuItem>
                ) }
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem
                  className={ sidebarLogoutMenuItemClassName }
                  onSelect={ () => {
                    void onLogout();
                  } }
                >
                  <LogOut className="size-4 text-destructive" aria-hidden="true" />
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

function SidebarLoadingSkeleton() {
  return (
    <>
      { Array.from({ length: 5, }).map((_, index) => (
        <SidebarMenuItem
          key={ `sidebar-skeleton-${index}` }
          className="pointer-events-none"
        >
          <SidebarMenuButton
            type="button"
            className="w-full justify-start gap-2 opacity-50"
            disabled
            aria-hidden="true"
          >
            <Skeleton className="h-7 flex-1 rounded-sm" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      )) }
    </>
  );
}

type SidebarRole = 'guest' | 'customer' | 'partner' | 'admin';

type SidebarLinkItemProps = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  tooltip?: string;
  iconProps?: React.SVGProps<SVGSVGElement>;
  className?: string;
  labelBadge?: React.ReactNode;
};

function SidebarLinkItem({
  href,
  label,
  icon: Icon,
  tooltip,
  iconProps,
  className,
  labelBadge,
}: SidebarLinkItemProps) {
  const {
 className: iconClassName, ...restIconProps 
} = iconProps ?? {};

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={ tooltip } className={ className }>
        <Link href={ href }>
          <span className="sidebar-link-icon" aria-hidden="true">
            <Icon
              className={ cn('size-4', iconClassName) }
              aria-hidden="true"
              { ...restIconProps }
            />
          </span>
          <span data-sidebar-label className="inline-flex items-center gap-1.5">
            <span>{ label }</span>
            { labelBadge }
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
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
  showSidebarToggle = false,
  showSearchButton = true,
  showThemeSwitcher = false,
  showNotifications = true,
  showTransactionHistory = true,
  showAccountLinks = true,
}: {
  avatarUrl: string | null;
  avatarFallback: string;
  onSearchOpen: () => void;
  displayName: string;
  emailLabel: string;
  onNavigate: (href: string) => void;
  onLogout: () => Promise<void> | void;
  isGuest: boolean;
  showSidebarToggle?: boolean;
  showSearchButton?: boolean;
  showThemeSwitcher?: boolean;
  showNotifications?: boolean;
  showTransactionHistory?: boolean;
  showAccountLinks?: boolean;
}) {
  const { toggleSidebar, } = useSidebar();
  const hasAdditionalLinks =
    showAccountLinks || showNotifications || showTransactionHistory;

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
          <span className="text-base font-semibold text-foreground">
            UpSpace
          </span>
        </Link>
        <div className="flex items-center gap-2">
          { showNotifications && !isGuest && (
            <Link
              href="/customer/notifications"
              aria-label="Notifications"
              className="rounded-full p-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <NotificationIcon className="size-5" aria-hidden="true" />
            </Link>
          ) }
          { showSearchButton && (
            <button
              type="button"
              aria-label="Search"
              onClick={ onSearchOpen }
              className="rounded-full p-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Search className="size-5" aria-hidden="true" />
            </button>
          ) }
          { showSidebarToggle && (
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={ toggleSidebar }
              className="rounded-full p-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
          ) }
          { showThemeSwitcher && <ThemeSwitcher variant="compact" /> }
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
                    <span className="text-sm font-semibold leading-tight">
                      { displayName }
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      { emailLabel }
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
                      <User className="size-4" aria-hidden="true" />
                      <span>Account</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={ () => onNavigate('/customer/settings') }
                      className="dark:data-[highlighted]:bg-[oklch(0.24_0.02_204.6929)] dark:focus-visible:bg-[oklch(0.24_0.02_204.6929)] dark:data-[highlighted]:text-secondary dark:data-[highlighted]:[&_svg]:text-secondary"
                    >
                      <Settings className="size-4" aria-hidden="true" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                  </>
                ) }
                { showNotifications && (
                  <DropdownMenuItem
                    onSelect={ () => onNavigate('/customer/notifications') }
                    className="dark:data-[highlighted]:bg-[oklch(0.24_0.02_204.6929)] dark:focus-visible:bg-[oklch(0.24_0.02_204.6929)] dark:data-[highlighted]:text-secondary dark:data-[highlighted]:[&_svg]:text-secondary"
                  >
                    <NotificationIcon className="size-4" aria-hidden="true" />
                    <span>Notifications</span>
                  </DropdownMenuItem>
                ) }
                { showTransactionHistory && (
                  <DropdownMenuItem
                    onSelect={ () => onNavigate('/customer/transactions') }
                    className="dark:data-[highlighted]:bg-[oklch(0.24_0.02_204.6929)] dark:focus-visible:bg-[oklch(0.24_0.02_204.6929)] dark:data-[highlighted]:text-secondary dark:data-[highlighted]:[&_svg]:text-secondary"
                  >
                    <CreditCard className="size-4" aria-hidden="true" />
                    <span>Transaction history</span>
                  </DropdownMenuItem>
                ) }
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem
                  className="mt-2 text-destructive focus-visible:text-destructive data-[highlighted]:bg-[oklch(0.9647_0.0345_19.81)] focus-visible:bg-[oklch(0.9647_0.0345_19.81)] dark:data-[highlighted]:bg-[oklch(0.24_0.04_19.81)] dark:focus-visible:bg-[oklch(0.24_0.04_19.81)] data-[highlighted]:text-destructive data-[highlighted]:[&_svg]:text-destructive hover:bg-[oklch(0.9647_0.0345_19.81)] dark:hover:bg-[oklch(0.24_0.04_19.81)] hover:text-destructive hover:[&_svg]:text-destructive"
                  onSelect={ () => {
                    void onLogout();
                  } }
                >
                  <LogOut className="size-4 text-destructive" aria-hidden="true" />
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

type MobileBottomNavAction = {
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  href?: string;
  onClick?: () => void;
  show?: boolean;
};

type MobileBottomNavProps = {
  actions: MobileBottomNavAction[];
};

function MobileBottomNav({ actions, }: MobileBottomNavProps) {
  const visibleActions = actions.filter((action) => action.show ?? true);
  if (visibleActions.length === 0) {
    return null;
  }

  const actionClassName =
    'flex-1 flex items-center justify-center rounded-md px-2 py-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/90 px-4 py-2 backdrop-blur-md md:hidden"
      style={ { paddingBottom: 'calc(var(--safe-area-bottom) + 0.5rem)', } }
      aria-label="Secondary navigation"
    >
      <div className="mx-auto flex w-full max-w-[1440px] gap-1">
        { visibleActions.map(({
 label, href, icon: ActionIcon, onClick, 
}) => {
          if (href) {
            return (
              <Link
                key={ label }
                href={ href }
                className={ actionClassName }
                aria-label={ label }
              >
                <ActionIcon className="size-5" aria-hidden="true" />
                <span className="sr-only">{ label }</span>
              </Link>
            );
          }

          return (
            <button
              key={ label }
              type="button"
              onClick={ onClick }
              className={ actionClassName }
              aria-label={ label }
            >
              <ActionIcon className="size-5" aria-hidden="true" />
              <span className="sr-only">{ label }</span>
            </button>
          );
        }) }
      </div>
    </nav>
  );
}

function useMarketplaceNavData() {
  const {
 session, isLoading: isSessionLoading, 
} = useSession();
  const {
    data: userProfile,
    isLoading: isProfileLoading,
    isError: isProfileError,
  } = useUserProfile();
  const router = useRouter();

  const avatarUrl =
    session?.user?.user_metadata?.avatar_url ??
    session?.user?.user_metadata?.picture ??
    null;
  const profileHandleLabel = userProfile?.handle ?? undefined;
  const preferredUsername = session?.user?.user_metadata?.preferred_username;
  const preferredUsernameLabel =
    preferredUsername && preferredUsername.includes('@')
      ? undefined
      : preferredUsername;
  const resolvedHandleLabel = profileHandleLabel ?? preferredUsernameLabel;
  const registeredFirstName = userProfile?.firstName?.trim();
  const isGuest = !session;
  const resolvedHandleValue = isGuest
    ? null
    : (userProfile?.handle ?? preferredUsernameLabel ?? null);
  const avatarFallback = isGuest
    ? 'GU'
    : registeredFirstName
      ? registeredFirstName.slice(0, 2).toUpperCase()
      : (resolvedHandleValue?.slice(0, 2)?.toUpperCase() ?? 'US');
  const avatarDisplayName = isGuest
    ? 'Guest'
    : (registeredFirstName ?? resolvedHandleLabel ?? 'UpSpace User');
  const userEmail = session?.user?.email ?? null;
  const handleNavigation = React.useCallback(
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

  const metadataRole = session?.user?.user_metadata?.role as
    | 'customer'
    | 'partner'
    | 'admin'
    | undefined;
  const resolvedRole = isGuest
    ? undefined
    : (metadataRole ?? userProfile?.role);
  const shouldShowSidebarLoading =
    isSessionLoading || (!isGuest && !metadataRole && isProfileLoading);
  const shouldFallbackToGuestSidebar = !isGuest && isProfileError;

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
      isSidebarLoading: shouldShowSidebarLoading,
      shouldFallbackToGuestSidebar,
      userProfile,
    }),
    [
      avatarDisplayName,
      avatarFallback,
      avatarUrl,
      handleLogout,
      handleNavigation,
      isGuest,
      resolvedHandleLabel,
      resolvedRole,
      shouldShowSidebarLoading,
      shouldFallbackToGuestSidebar,
      userEmail,
      userProfile
    ]
  );
}

type AccountLockOverlayProps = {
  profile?: UserProfile;
};

const overlayCopy = {
  deactivated: {
    title: 'Account deactivated',
    description:
      'Your account is currently deactivated. Reactivate to resume your UpSpace access.',
    actionLabel: 'Reactivate account',
  },
  pending_deletion: {
    title: 'Deletion pending',
    description:
      'Your account is scheduled for deletion. Cancel the request to keep your access.',
    actionLabel: 'Cancel deletion',
  },
  deleted: {
    title: 'Account deleted',
    description:
      'This account has been permanently deleted. Create a new account or contact support for help.',
  },
};

function AccountLockOverlay({ profile, }: AccountLockOverlayProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const handleLogout = React.useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { error, } = await supabase.auth.signOut();

    if (error) {
      console.error('Supabase sign-out failed', error);
      return;
    }

    await router.replace('/');
  }, [router]);

  if (!profile || profile.status === 'active') {
    return null;
  }

  const isPendingDeletion = profile.status === 'pending_deletion';
  const metadata = overlayCopy[profile.status];

  if (!metadata) {
    return null;
  }

  const expiration = profile.expiresAt ? new Date(profile.expiresAt) : null;
  const deadlineLabel = expiration
    ? expiration.toLocaleString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  const action =
    profile.status === 'pending_deletion'
      ? 'cancelDeletion'
      : profile.status === 'deactivated'
        ? 'reactivate'
        : undefined;

  const handleAction = async () => {
    if (!action) {
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch('/api/v1/auth/reactivate', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ action, }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload?.message ?? 'Unable to update your account status right now.'
        );
      }
      toast.success('Account status updated. Redirecting to home...');
      await queryClient.invalidateQueries({ queryKey: ['user-profile'], });
      router.push('/marketplace');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to update your account status right now.';
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const actionLabel =
    typeof metadata === 'object' && 'actionLabel' in metadata
      ? metadata.actionLabel ?? ''
      : '';

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl" />
      <div className="relative w-full px-4 py-8 sm:px-6">
        <Card
          role="alertdialog"
          aria-live="assertive"
          aria-label={ metadata.title }
          className="mx-auto w-full max-w-xl rounded-md border border-border/70 bg-background/90 shadow-2xl"
        >
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl font-semibold text-foreground">
              { metadata.title }
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              { metadata.description }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            { deadlineLabel && isPendingDeletion && (
              <p className="text-sm text-muted-foreground">
                Scheduled deletion: { deadlineLabel }
              </p>
            ) }
            <p className="text-sm text-muted-foreground">
              All navigation is suspended until you take action.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pt-4">
            { action && (
              <Button
                className="w-full rounded-md px-4 py-2 text-sm"
                onClick={ handleAction }
                disabled={ isProcessing }
              >
                { isProcessing ? 'Working…' : actionLabel }
              </Button>
            ) }
            { profile.status === 'deleted' && (
              <Button
                variant="outline"
                className="w-full rounded-md px-4 py-2 text-sm"
                onClick={ handleLogout }
              >
                Sign out
              </Button>
            ) }
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export function MarketplaceChrome({
  children,
  dialogSlot,
  onSearchOpen,
  insetClassName,
  insetStyle,
  initialSidebarOpen,
  messageHref = '/customer/messages',
}: MarketplaceChromeProps) {
  const navData = useMarketplaceNavData();
  const cachedAvatarUrl = useCachedAvatar(navData.avatarUrl);
  const {
    onNavigate,
    role,
    isGuest,
    isSidebarLoading,
    shouldFallbackToGuestSidebar,
    userProfile,
  } = navData;
  const effectiveRole = React.useMemo<SidebarRole>(() => {
    if (isGuest || shouldFallbackToGuestSidebar) {
      return 'guest';
    }

    if (role === 'partner') {
      return 'partner';
    }

    if (role === 'admin') {
      return 'admin';
    }

    return 'customer';
  }, [isGuest, role, shouldFallbackToGuestSidebar]);

  const isCustomerRole = effectiveRole === 'customer';
  const isPartnerRole = effectiveRole === 'partner';
  const isAdminRole = effectiveRole === 'admin';
  const showTransactionHistory = isCustomerRole || isPartnerRole;
  const shouldShowAiSearch = isCustomerRole || isPartnerRole || isAdminRole;
  const shouldShowNotifications = isCustomerRole || isPartnerRole;
  const resolvedMessageHref = messageHref ?? '/customer/messages';
  const pathname = usePathname();
  const isAccountRoute = (pathname ?? '').startsWith('/customer/account');
  const isMobile = useIsMobile();
  const shouldRenderMobileBottomNav =
    isMobile && !isAccountRoute && !isPartnerRole;
  const mobileInsetPadding = React.useMemo<React.CSSProperties | undefined>(
    () =>
      isMobile
        ? {
            paddingTop: 'calc(4rem + var(--safe-area-top))',
            paddingBottom: shouldRenderMobileBottomNav
              ? 'calc(2.75rem + var(--safe-area-bottom))'
              : 'var(--safe-area-bottom)',
          }
        : undefined,
    [isMobile, shouldRenderMobileBottomNav]
  );
  const handleSearch = React.useCallback(() => {
    if (onSearchOpen) {
      onSearchOpen();
      return;
    }

    onNavigate('/marketplace?search=1');
  }, [onNavigate, onSearchOpen]);

  const mobileBottomNavActions = React.useMemo((): MobileBottomNavAction[] => {
    if (isAdminRole) {
      return [
        {
          label: 'Home',
          href: '/marketplace',
          icon: Home,
        },
        {
          label: 'Dashboard',
          href: '/marketplace/dashboard',
          icon: BarChart3,
        },
        {
          label: 'Queue',
          href: '/admin',
          icon: FileText,
        },
        {
          label: 'Deactivation requests',
          href: '/admin/deactivation-requests',
          icon: UserX,
        },
        {
          label: 'Unpublish requests',
          href: '/admin/unpublish-requests',
          icon: EyeOff,
        },
        {
          label: 'Users',
          href: '/admin/users',
          icon: Users,
        },
        {
          label: 'Spaces',
          href: '/admin/spaces',
          icon: Layers,
        }
      ];
    }

    const actions: MobileBottomNavAction[] = [];

    actions.push({
      label: 'Home',
      href: '/marketplace',
      icon: Home,
    });

    if (isPartnerRole) {
      actions.push({
        label: 'Wallet',
        href: '/customer/account/wallet',
        icon: Wallet,
      });
    }

    if (isCustomerRole) {
      const aiSearchAction: MobileBottomNavAction = {
        label: 'AI Assistant',
        href: '/marketplace/ai-assistant',
        icon: GradientSparklesIcon,
      };

      actions.push({
        label: 'Bookmarks',
        href: '/customer/bookmarks',
        icon: Bookmark,
      });
      actions.push(aiSearchAction);
    } else {
      actions.push({
        label: 'Search',
        icon: Search,
        onClick: handleSearch,
      });
    }

    if (shouldShowNotifications && !isCustomerRole) {
      actions.push({
        label: 'Notifications',
        href: '/customer/notifications',
        icon: NotificationIcon,
      });
    }

    if (shouldShowNotifications) {
      actions.push({
        label: 'Messages',
        href: resolvedMessageHref,
        icon: MessageSquare,
      });
    }

    if (isCustomerRole) {
      const aiIndex = actions.findIndex((action) => action.label === 'AI Assistant');
      if (aiIndex >= 0) {
        const [aiAction] = actions.splice(aiIndex, 1);
        const middleIndex = Math.floor((actions.length + 1) / 2);
        actions.splice(middleIndex, 0, aiAction);
      }
    }

    return actions;
  }, [
    handleSearch,
    isAdminRole,
    isCustomerRole,
    isPartnerRole,
    resolvedMessageHref,
    shouldShowNotifications
  ]);

  React.useEffect(() => {
    if (!onSearchOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const key = event.key;
      if (typeof key !== 'string' || key.toLowerCase() !== 'k') return;
      if (!event.metaKey && !event.ctrlKey) return;

      event.preventDefault();
      onSearchOpen();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSearchOpen]);

  return (
    <SidebarProvider
      className="bg-background min-h-screen"
      initialOpen={ initialSidebarOpen }
    >
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
          showSidebarToggle={ isPartnerRole }
          showThemeSwitcher={ isCustomerRole || isAdminRole }
          showNotifications={ shouldShowNotifications }
          showTransactionHistory={ showTransactionHistory }
          showAccountLinks={ !isAdminRole }
        />
      ) }
      <div className="flex min-h-screen w-full gap-5">
        <Sidebar
          collapsible="icon"
          className="hidden md:flex border-1 border-r-muted"
        >
          <SidebarHeader className="pt-4">
            <SidebarMenu>
              <SidebarToggleMenuItem />
              { isSidebarLoading ? (
                <SidebarLoadingSkeleton />
              ) : (
                <>
                  <SidebarLinkItem
                    href="/marketplace"
                    label="Home"
                    icon={ SidebarHomeIcon }
                    tooltip="Home"
                    iconProps={ { className: 'size-[18px]', } }
                  />
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Search"
                      className="justify-start gap-2 group-data-[collapsible=icon]:justify-center"
                      type="button"
                      onClick={ handleSearch }
                    >
                      <MdManageSearch className="size-4" aria-hidden="true" />
                      <span data-sidebar-label>Search</span>
                      <Kbd className="ml-auto hidden items-center gap-1 bg-muted/20 text-[10px] text-sidebar-foreground/70 md:flex group-data-[collapsible=icon]:hidden hover:!text-gray-500 dark:hover:!text-sidebar-foreground/70">
                        <Command className="size-3" aria-hidden="true" />
                        <span> + K</span>
                      </Kbd>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  { shouldShowAiSearch && (
                    <SidebarLinkItem
                      href="/marketplace/ai-assistant"
                      label="AI Assistant"
                      icon={ GradientSparklesIcon }
                      tooltip="AI Assistant"
                      labelBadge={
                        <Badge
                          variant="outline"
                          className="bg-muted/20 px-2 py-0.5 text-[10px] leading-none"
                        >
                          Beta
                        </Badge>
                      }
                    />
                  ) }
                  { isCustomerRole && (
                    <SidebarLinkItem
                      href="/customer/bookmarks"
                      label="Bookmarks"
                      icon={ Bookmark }
                      tooltip="Bookmarks"
                      iconProps={ { strokeWidth: 2, } }
                    />
                  ) }
                  { shouldShowNotifications && (
                    <SidebarLinkItem
                      href="/customer/notifications"
                      label="Notifications"
                      icon={ NotificationIcon }
                      tooltip="Notifications"
                      iconProps={ { className: 'size-[19px] -translate-y-px', } }
                    />
                  ) }
                  { isCustomerRole && (
                    <SidebarLinkItem
                      href="/customer/bookings"
                      label="Bookings"
                      icon={ Ticket }
                      tooltip="Bookings"
                      iconProps={ { strokeWidth: 1.5, } }
                    />
                  ) }
                  { shouldShowNotifications && (
                    <SidebarLinkItem
                      href={ resolvedMessageHref }
                      label="Messages"
                      icon={ SidebarMessageIcon }
                      tooltip="Messages"
                      iconProps={ { strokeWidth: 2, } }
                    />
                  ) }
                  { isPartnerRole && (
                    <SidebarLinkItem
                      href="/customer/account/wallet"
                      label="Wallet"
                      icon={ Wallet }
                      tooltip="Wallet"
                    />
                  ) }
                  { isPartnerRole && (
                    <SidebarLinkItem
                      href="/partner/spaces"
                      label="Spaces"
                      icon={ Briefcase }
                      tooltip="Spaces"
                    />
                  ) }
                  { isPartnerRole && (
                    <SidebarLinkItem
                      href="/partner/spaces/pricing-rules"
                      label="Price Rules"
                      icon={ DollarSign }
                      tooltip="Price rules"
                    />
                  ) }
                  { isPartnerRole && (
                    <SidebarLinkItem
                      href="/partner/spaces/dashboard"
                      label="Dashboard"
                      icon={ LayoutDashboard }
                      tooltip="Dashboard"
                    />
                  ) }
                  { isPartnerRole && (
                    <SidebarLinkItem
                      href="/partner/spaces/bookings"
                      label="Bookings"
                      icon={ Ticket }
                      tooltip="Bookings"
                    />
                  ) }
                  { isAdminRole && (
                    <SidebarLinkItem
                      href="/marketplace/dashboard"
                      label="Dashboard"
                      icon={ BarChart3 }
                      tooltip="Dashboard"
                      iconProps={ { strokeWidth: 2, } }
                    />
                  ) }
                  { isAdminRole && (
                    <SidebarLinkItem
                      href="/admin"
                      label="Verification Queue"
                      icon={ FileText }
                      tooltip="Verification queue"
                      iconProps={ { strokeWidth: 2, } }
                    />
                  ) }
                  { isAdminRole && (
                    <SidebarLinkItem
                      href="/admin/deactivation-requests"
                      label="Deactivation requests"
                      icon={ UserX }
                      tooltip="Deactivation requests"
                      iconProps={ { strokeWidth: 2, } }
                    />
                  ) }
                  { isAdminRole && (
                    <SidebarLinkItem
                      href="/admin/unpublish-requests"
                      label="Unpublish requests"
                      icon={ EyeOff }
                      tooltip="Unpublish requests"
                      iconProps={ { strokeWidth: 2, } }
                    />
                  ) }
                  { isAdminRole && (
                    <SidebarLinkItem
                      href="/admin/users"
                      label="Users"
                      icon={ Users }
                      tooltip="Manage users"
                      iconProps={ { strokeWidth: 2, } }
                    />
                  ) }
                  { isAdminRole && (
                    <SidebarLinkItem
                      href="/admin/spaces"
                      label="Spaces"
                      icon={ Layers }
                      tooltip="Manage spaces"
                      iconProps={ { strokeWidth: 2, } }
                    />
                  ) }
                </>
              ) }
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
              isSidebarLoading={ navData.isSidebarLoading }
              showNotifications={ shouldShowNotifications }
              showAccount={ !isAdminRole }
              showWallet={ isPartnerRole }
              showTransactionHistory={ showTransactionHistory }
              showSettings={ !isAdminRole }
            />
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset
          className={ cn(
            'relative flex-1 bg-background w-full pb-0 pt-0 md:pt-0 px-4 md:px-6',
            insetClassName
          ) }
          style={
            mobileInsetPadding || insetStyle
              ? {
                  ...mobileInsetPadding,
                  ...insetStyle,
                }
              : undefined
          }
        >
          { children }
          <AccountLockOverlay profile={ userProfile } />
        </SidebarInset>
      </div>
      { shouldRenderMobileBottomNav && (
        <MobileBottomNav actions={ mobileBottomNavActions } />
      ) }
    </SidebarProvider>
  );
}
