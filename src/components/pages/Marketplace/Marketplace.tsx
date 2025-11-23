'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  FiBell,
  FiCommand,
  FiHome,
  FiLoader,
  FiSearch,
  FiX
} from 'react-icons/fi';
import { GoSidebarExpand, GoSidebarCollapse } from 'react-icons/go';

import { CardsGrid, SkeletonGrid } from './Marketplace.Cards';
import { MarketplaceErrorState } from './Marketplace.ErrorState';

import { listSpaces, suggestSpaces, type SpaceSuggestion } from '@/lib/api/spaces';
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
import { cn } from '@/lib/utils';
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

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debounced;
}

function SidebarToggleMenuItem() {
  const {
    state,
    toggleSidebar,
  } = useSidebar();
  const isExpanded = state === 'expanded';
  const Icon = isExpanded
    ? GoSidebarCollapse
    : GoSidebarExpand;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={ isExpanded ? 'Collapse sidebar' : 'Expand sidebar' }
        type="button"
        onClick={ toggleSidebar }
        className="justify-center"
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
}: {
  avatarUrl: string | null
  avatarFallback: string
  avatarDisplayName: string
  resolvedHandleLabel: string | undefined
}) {
  const { state, } = useSidebar();
  const isCollapsed = state === 'collapsed';

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
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            tooltip={ isCollapsed ? undefined : 'Account' }
            className={ cn('w-full ml-[-5px]', isCollapsed && 'justify-center') }
          >
            <Link href="/onboarding" className={ `flex items-center gap-3 py-8 ${isCollapsed ? 'ml-[-10px]' : ''}` }>
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
                  { resolvedHandleLabel && (
                    <span className="text-xs text-muted-foreground truncate">
                      { resolvedHandleLabel }
                    </span>
                  ) }
                </div>
              ) }
              <span className="sr-only">
                { `Open account for ${avatarDisplayName}${resolvedHandleLabel ? ` (${resolvedHandleLabel})` : ''}` }
              </span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </div>
  );
}

export default function Marketplace() {
  const [filters, setFilters] = React.useState<FiltersState>(DEFAULT_FILTERS);
  const [searchValue, setSearchValue] = React.useState('');
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const isMobile = useIsMobile();
  const { session, } = useSession();
  const { data: userProfile, } = useUserProfile();
  const mobileInsetPadding = React.useMemo<React.CSSProperties | undefined>(
    () => (isMobile
      ? {
          paddingTop: 'calc(4rem + var(--safe-area-top))',
          paddingBottom: 'calc(2.75rem + var(--safe-area-bottom))',
        }
      : undefined),
    [isMobile]
  );

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
  React.useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocOverflow = document.documentElement.style.overflow;

    if (hasError) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocOverflow;
    };
  }, [hasError]);

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
    <section className="relative mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
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
      <MarketplaceGradientOverlay />
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
        <Sidebar collapsible="icon" className="hidden md:flex border-1 border-r-muted">
          <SidebarHeader className="pt-4">
            <SidebarMenu>
              <SidebarToggleMenuItem />
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Home">
                  <Link href="/">
                    <FiHome className="size-4" strokeWidth={ 1.4 } />
                    <span data-sidebar-label>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Search"
                  className="justify-between group-data-[collapsible=icon]:justify-center"
                  type="button"
                  onClick={ openSearchModal }
                >
                  <FiSearch className="size-4" strokeWidth={ 1.4 }/>
                  <span data-sidebar-label>Search</span>
                  <Kbd className="ml-auto hidden items-center gap-1 bg-sidebar-accent/10 text-[10px] text-sidebar-foreground/70 md:flex group-data-[collapsible=icon]:hidden">
                    <FiCommand className="size-3" aria-hidden="true" />
                    <span> + K</span>
                  </Kbd>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Notifications">
                  <Link href="/notifications">
                    <FiBell className="size-4" strokeWidth={ 1.4 } />
                    <span data-sidebar-label>Notifications</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent className="flex-1" />
          <SidebarFooter className="mt-auto border-t border-sidebar-border/60">
            <SidebarFooterContent
              avatarUrl={ avatarUrl }
              avatarFallback={ avatarFallback }
              avatarDisplayName={ avatarDisplayName }
              resolvedHandleLabel={ resolvedHandleLabel }
            />
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset
          className="flex-1 bg-background w-full pb-10 pt-16 md:pt-0"
          style={ mobileInsetPadding }
        >
          { content }
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function MarketplaceGradientOverlay() {
  const {
 state, isMobile, 
} = useSidebar();

  const overlayStyles = React.useMemo<React.CSSProperties>(() => {
    if (isMobile) {
      return {
 left: 0,
right: 0, 
};
    }

    const sidebarOffset = state === 'collapsed'
      ? 'var(--sidebar-width-icon)'
      : 'var(--sidebar-width)';

    return {
      left: sidebarOffset,
      right: 0,
    };
  }, [isMobile, state]);

  return (
    <div
      aria-hidden="true"
      style={ overlayStyles }
      className="pointer-events-none fixed bottom-0 z-30 h-[20vh] bg-gradient-to-t from-background via-background/50 to-background/0 transition-all duration-300"
    />
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
  const debouncedQuery = useDebouncedValue(trimmedValue, 200);
  const isMobile = useIsMobile();
  const shouldFetchSuggestions = debouncedQuery.length >= 2;

  const {
    data: suggestionData,
    isFetching: isFetchingSuggestions,
    isError: isSuggestionError,
  } = useQuery({
    queryKey: ['space-suggestions', debouncedQuery],
    queryFn: ({ signal, }) => suggestSpaces({
      q: debouncedQuery,
      limit: 8,
      include_pending: true,
      signal,
    }),
    enabled: shouldFetchSuggestions,
    staleTime: 30_000,
  });

  const suggestions: SpaceSuggestion[] = suggestionData?.suggestions ?? [];
  const suggestionStatusMessage = shouldFetchSuggestions
    ? `Showing ${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'}.`
    : 'Type at least two characters to see suggestions.';

  return (
    <CommandDialog
      open={ open }
      onOpenChange={ onOpenChange }
      title="Search spaces"
      description="Search the UpSpace marketplace"
      position="top"
      mobileFullScreen={ isMobile }
      fullWidth
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
      <CommandList className={ isMobile ? 'flex-1 max-h-full' : undefined }>
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
              <Kbd>Enter</Kbd>
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

        <CommandGroup heading="Suggestions">
          <p className="sr-only" aria-live="polite">{ suggestionStatusMessage }</p>

          { !shouldFetchSuggestions && (
            <CommandItem disabled>
              <FiSearch className="size-4" aria-hidden="true" />
              <span>Type at least 2 characters to see suggestions</span>
            </CommandItem>
          ) }

          { shouldFetchSuggestions && isSuggestionError && (
            <CommandItem disabled>
              <FiX className="size-4" aria-hidden="true" />
              <div className="flex flex-col text-left">
                <span>Suggestions unavailable</span>
                <span className="text-xs text-muted-foreground">Try again in a moment.</span>
              </div>
            </CommandItem>
          ) }

          { shouldFetchSuggestions && isFetchingSuggestions && (
            <CommandItem disabled>
              <FiLoader className="size-4 animate-spin" aria-hidden="true" />
              <span>Fetching suggestions…</span>
            </CommandItem>
          ) }

          { shouldFetchSuggestions && suggestions.map((suggestion) => (
            <CommandItem
              key={ suggestion.space_id }
              value={ `suggest ${suggestion.name}` }
              onSelect={ () => {
                onSearchChange(suggestion.name);
                onSearchSubmit(suggestion.name);
              } }
            >
              <Avatar
                className="size-9 border border-border shadow-sm"
                style={ { borderRadius: 4, } }
              >
                { suggestion.image_url ? (
                  <AvatarImage
                    src={ suggestion.image_url }
                    alt="Space preview"
                    style={ { borderRadius: 4, } }
                  />
                ) : (
                  <AvatarFallback style={ { borderRadius: 4, } }>
                    { suggestion.name.slice(0, 2).toUpperCase() }
                  </AvatarFallback>
                ) }
              </Avatar>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="line-clamp-1 font-medium">{ suggestion.name }</span>
                { suggestion.location && (
                  <span className="text-xs text-muted-foreground line-clamp-1">
                    { suggestion.location }
                  </span>
                ) }
              </div>
            </CommandItem>
          )) }

          { shouldFetchSuggestions && !isFetchingSuggestions && suggestions.length === 0 && !isSuggestionError && (
            <CommandItem disabled>
              <FiX className="size-4" aria-hidden="true" />
              <span>No matching spaces yet.</span>
            </CommandItem>
          ) }
        </CommandGroup>
      </CommandList>
    </CommandDialog>
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
