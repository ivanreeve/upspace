'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  FiBell,
  FiCommand,
  FiCornerDownLeft,
  FiHome,
  FiSearch,
  FiX
} from 'react-icons/fi';

import { CardsGrid, SkeletonGrid } from './Marketplace.Cards';
import { MarketplaceErrorState } from './Marketplace.ErrorState';

import { listSpaces } from '@/lib/api/spaces';
import { useSession } from '@/components/auth/SessionProvider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import BackToTopButton from '@/components/ui/back-to-top';
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import { LogoSymbolic } from '@/components/ui/logo-symbolic';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider
} from '@/components/ui/sidebar';
import { useUserProfile } from '@/hooks/use-user-profile';

type FiltersState = {
  q: string;
};

const DEFAULT_FILTERS: FiltersState = { q: '', };

const buildQueryParams = (filters: FiltersState) => ({
  limit: 24,
  q: filters.q.trim() || undefined,
  include_pending: true,
});

export default function Marketplace() {
  const [filters, setFilters] = React.useState<FiltersState>(DEFAULT_FILTERS);
  const [searchValue, setSearchValue] = React.useState('');
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const isMobile = useIsMobile();
  const { session, } = useSession();
  const { data: userProfile, } = useUserProfile();

  React.useEffect(() => {
    setSearchValue(filters.q ?? '');
  }, [filters.q]);

  const openSearchModal = React.useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const handleSearchOpenChange = React.useCallback((open: boolean) => {
    setIsSearchOpen(open);
    if (!open) {
      setSearchValue(filters.q ?? '');
    }
  }, [filters.q]);

  const applySearch = React.useCallback((value: string) => {
    setFilters((prev) => ({
      ...prev,
      q: value.trim(),
    }));
  }, []);

  const handleSearchSubmit = React.useCallback(
    (value?: string) => {
      const nextValue = typeof value === 'string' ? value : searchValue;
      const normalized = nextValue.trim();
      setSearchValue(normalized);
      applySearch(normalized);
      setIsSearchOpen(false);
    },
    [applySearch, searchValue]
  );

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        openSearchModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openSearchModal]);

  const {
    data,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ['marketplace-spaces', filters],
    queryFn: async () => listSpaces(buildQueryParams(filters)),
    keepPreviousData: true,
  });

  const spaces = React.useMemo(() => data?.data ?? [], [data]);
  const hasError = Boolean(error);
  const hasActiveSearch = Boolean(filters.q.trim());

  const avatarUrl = session?.user?.user_metadata?.avatar_url
    ?? session?.user?.user_metadata?.picture
    ?? null;
  const profileHandleLabel = userProfile?.handle ? `@${userProfile.handle}` : undefined;
  const preferredUsername = session?.user?.user_metadata?.preferred_username;
  const preferredUsernameLabel =
    preferredUsername && preferredUsername.includes('@') ? undefined : preferredUsername;
  const resolvedHandleLabel = profileHandleLabel ?? preferredUsernameLabel;
  const resolvedHandleValue = userProfile?.handle ?? preferredUsernameLabel ?? null;
  const avatarFallback =
    resolvedHandleValue?.slice(0, 2)?.toUpperCase()
    ?? 'US';
  const avatarDisplayName =
    resolvedHandleLabel
    ?? 'UpSpace User';

  const content = (
    <section className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
      <div className="space-y-6">
        { hasError ? (
          <div className="flex min-h-[70vh] w-full items-center justify-center px-4">
            <MarketplaceErrorState />
          </div>
        ) : (
          <div className="space-y-3">
            { hasActiveSearch && (
              <p className="text-sm text-muted-foreground">
                Showing results for &quot;{ filters.q }&quot;
              </p>
            ) }
            { isLoading ? (
              <SkeletonGrid />
            ) : (
              <CardsGrid items={ spaces } />
            ) }
            { isFetching && !isLoading && (
              <p className="text-xs text-muted-foreground">Refreshing latest availability…</p>
            ) }
          </div>
        ) }
      </div>

      <BackToTopButton />
    </section>
  );

  return (
    <SidebarProvider className="bg-background min-h-screen">
      <MarketplaceSearchDialog
        open={ isSearchOpen }
        onOpenChange={ handleSearchOpenChange }
        searchValue={ searchValue }
        onSearchChange={ setSearchValue }
        onSearchSubmit={ handleSearchSubmit }
        hasActiveSearch={ hasActiveSearch }
      />
      { isMobile && (
        <MobileTopNav
          avatarUrl={ avatarUrl }
          avatarFallback={ avatarFallback }
          onSearchOpen={ openSearchModal }
        />
      ) }
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="none" className="hidden md:flex border-1 border-r-muted">
          <SidebarHeader className="pt-4">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Home">
                  <Link href="/">
                    <FiHome className="size-4" />
                    <span>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Search"
                  className="justify-between"
                  type="button"
                  onClick={ openSearchModal }
                >
                  <span className="flex items-center gap-2">
                    <FiSearch className="size-4" />
                    <span>Search</span>
                  </span>
                  <Kbd className="ml-2 hidden items-center gap-1 bg-sidebar-accent/10 text-[10px] text-sidebar-foreground/70 md:flex">
                    <FiCommand className="size-3" aria-hidden="true" />
                    <span> + K</span>
                  </Kbd>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Notifications">
                  <Link href="/notifications">
                    <FiBell className="size-4" />
                    <span>Notifications</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Profile</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Account">
                      <Link href="/onboarding">
                        <Avatar className="size-8">
                          { avatarUrl ? (
                            <AvatarImage src={ avatarUrl } alt="User avatar" />
                          ) : (
                            <AvatarFallback>{ avatarFallback }</AvatarFallback>
                          ) }
                        </Avatar>
                        <span className="truncate">{ avatarDisplayName }</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="flex-1 bg-background w-full pb-28 pt-16 md:pb-10 md:pt-0">
          { content }
        </SidebarInset>
      </div>

      { isMobile && (
        <MobileBottomBar
          avatarUrl={ avatarUrl }
          avatarFallback={ avatarFallback }
          onSearchOpen={ openSearchModal }
        />
      ) }
    </SidebarProvider>
  );
}

type MarketplaceSearchDialogProps = {
  open: boolean
  searchValue: string
  hasActiveSearch: boolean
  onOpenChange: (open: boolean) => void
  onSearchChange: (value: string) => void
  onSearchSubmit: (value?: string) => void
};

function MarketplaceSearchDialog({
  open,
  onOpenChange,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  hasActiveSearch,
}: MarketplaceSearchDialogProps) {
  const trimmedValue = searchValue.trim();

  return (
    <CommandDialog
      open={ open }
      onOpenChange={ onOpenChange }
      title="Search spaces"
      description="Search the UpSpace marketplace"
    >
      <CommandInput
        value={ searchValue }
        onValueChange={ onSearchChange }
        placeholder="Search Spaces..."
        aria-label="Search spaces"
        onKeyDown={ (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onSearchSubmit();
          }
        } }
      />
      <CommandList>
        <CommandGroup heading="Actions">
          <CommandItem
            value={ trimmedValue ? `search ${trimmedValue}` : 'search marketplace' }
            onSelect={ () => onSearchSubmit() }
          >
            <FiSearch className="size-4" aria-hidden="true" />
            <span>Search marketplace</span>
            { trimmedValue && (
              <span className="truncate text-muted-foreground">
                &quot;{ trimmedValue }&quot;
              </span>
            ) }
            <CommandShortcut className="flex items-center gap-1">
              <Kbd>Return</Kbd>
              <FiCornerDownLeft className="size-4" aria-hidden="true" />
            </CommandShortcut>
          </CommandItem>
          { hasActiveSearch && (
            <CommandItem
              value="clear search"
              onSelect={ () => onSearchSubmit('') }
            >
              <FiX className="size-4" aria-hidden="true" />
              <span>Clear search</span>
            </CommandItem>
          ) }
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function MobileBottomBar({
  avatarUrl,
  avatarFallback,
  onSearchOpen,
}: {
  avatarUrl: string | null
  avatarFallback: string
  onSearchOpen: () => void
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 backdrop-blur-md shadow-lg md:hidden">
      <div className="mx-auto flex max-w-[480px] items-center justify-around px-6 py-3">
        <Link
          href="/"
          className="flex flex-col items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-label="Home"
        >
          <FiHome className="size-5" aria-hidden="true" />
          <span>Home</span>
        </Link>
        <button
          type="button"
          onClick={ onSearchOpen }
          className="flex flex-col items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-label="Open search"
        >
          <FiSearch className="size-5" aria-hidden="true" />
          <span>Search</span>
        </button>
        <Link
          href="/notifications"
          className="flex flex-col items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <FiBell className="size-5" aria-hidden="true" />
          <span>Alerts</span>
        </Link>
        <Link
          href="/onboarding"
          className="flex flex-col items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-label="Account"
        >
          <Avatar className="size-8">
            { avatarUrl ? (
              <AvatarImage src={ avatarUrl } alt="User avatar" />
            ) : (
              <AvatarFallback>{ avatarFallback }</AvatarFallback>
            ) }
          </Avatar>
          <span>Account</span>
        </Link>
      </div>
    </nav>
  );
}

function MobileTopNav({
  avatarUrl,
  avatarFallback,
  onSearchOpen,
}: {
  avatarUrl: string | null
  avatarFallback: string
  onSearchOpen: () => void
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b bg-background/90 px-4 py-3 backdrop-blur-md md:hidden">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <LogoSymbolic className="text-primary dark:text-secondary" />
          <span className="text-base font-semibold text-foreground">UpSpace</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="rounded-full p-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <FiBell className="size-5" aria-hidden="true" />
          </Link>
          <button
            type="button"
            aria-label="Search"
            onClick={ onSearchOpen }
            className="rounded-full p-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <FiSearch className="size-5" aria-hidden="true" />
          </button>
          <Link
            href="/onboarding"
            aria-label="Account"
            className="rounded-full p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Avatar className="size-8">
              { avatarUrl ? (
                <AvatarImage src={ avatarUrl } alt="User avatar" />
              ) : (
                <AvatarFallback>{ avatarFallback }</AvatarFallback>
              ) }
            </Avatar>
          </Link>
        </div>
      </div>
    </header>
  );
}
