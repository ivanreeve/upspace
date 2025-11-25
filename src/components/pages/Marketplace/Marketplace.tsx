'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FiBell,
  FiCommand,
  FiHome,
  FiLoader,
  FiList,
  FiLogOut,
  FiSearch,
  FiSettings,
  FiUser,
  FiX
} from 'react-icons/fi';
import { TbLayoutSidebarFilled } from 'react-icons/tb';
import { CgOptions } from 'react-icons/cg';

import { CardsGrid, SkeletonGrid } from './Marketplace.Cards';
import { MarketplaceErrorState } from './Marketplace.ErrorState';

import { listSpaces, suggestSpaces, type SpaceSuggestion } from '@/lib/api/spaces';
import { useSession } from '@/components/auth/SessionProvider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import BackToTopButton from '@/components/ui/back-to-top';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { Label } from '@/components/ui/label';
import { LogoSymbolic } from '@/components/ui/logo-symbolic';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  fetchPhilippineBarangaysByCity,
  fetchPhilippineCitiesByRegion,
  fetchPhilippineRegions,
  type PhilippineBarangayOption,
  type PhilippineCityOption,
  type PhilippineRegionOption
} from '@/lib/philippines-addresses/client';
import { dedupeAddressOptions } from '@/lib/addresses';
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
import { AMENITY_CATEGORY_DISPLAY_MAP } from '@/lib/amenity/amenity_category_display_map';
import { AMENITY_ICON_MAPPINGS } from '@/lib/amenity/amenity_icon_mappings';
import { cn } from '@/lib/utils';
import { useUserProfile } from '@/hooks/use-user-profile';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type FiltersState = {
  q: string;
  region: string;
  city: string;
  barangay: string;
  amenities: string[];
  amenitiesMode: 'all' | 'any';
  amenitiesNegate: boolean;
};

const DEFAULT_FILTERS: FiltersState = {
  q: '',
  region: '',
  city: '',
  barangay: '',
  amenities: [],
  amenitiesMode: 'any',
  amenitiesNegate: false,
};

const normalizeFilterValue = (value?: string) => (value ?? '').trim();
const normalizeAmenityValues = (amenities?: string[]) =>
  Array.from(
    new Set(
      (amenities ?? [])
        .map((value) => normalizeFilterValue(value))
        .filter(Boolean)
    )
  );
const areFiltersEqual = (a: FiltersState, b: FiltersState) => {
  if (
    a.q !== b.q
    || a.region !== b.region
    || a.city !== b.city
    || a.barangay !== b.barangay
    || a.amenitiesMode !== b.amenitiesMode
    || a.amenitiesNegate !== b.amenitiesNegate
  ) {
    return false;
  }

  if (a.amenities.length !== b.amenities.length) return false;

  for (let index = 0; index < a.amenities.length; index += 1) {
    if (a.amenities[index] !== b.amenities[index]) {
      return false;
    }
  }

  return true;
};
const ORDERED_AMENITY_CATEGORIES = Object.keys(AMENITY_CATEGORY_DISPLAY_MAP);

const buildQueryParams = (filters: FiltersState) => {
  const amenities = normalizeAmenityValues(filters.amenities);
  const hasAmenities = amenities.length > 0;

  return {
    limit: 24,
    q: normalizeFilterValue(filters.q) || undefined,
    region: normalizeFilterValue(filters.region) || undefined,
    city: normalizeFilterValue(filters.city) || undefined,
    barangay: normalizeFilterValue(filters.barangay) || undefined,
    amenities: hasAmenities ? amenities : undefined,
    amenities_mode: hasAmenities ? filters.amenitiesMode : undefined,
    amenities_negate: hasAmenities ? filters.amenitiesNegate : undefined,
    include_pending: true,
  };
};

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
}: {
  avatarUrl: string | null
  avatarFallback: string
  avatarDisplayName: string
  resolvedHandleLabel: string | undefined
  userEmail: string | null
  onNavigate: (href: string) => void
  onLogout: () => Promise<void> | void
}) {
  const { state, } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const secondaryLabel = resolvedHandleLabel ?? userEmail ?? 'Account';
  const emailLabel = userEmail ?? 'Email unavailable';

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                type="button"
                tooltip={ isCollapsed ? 'Open account menu' : undefined }
                className={ cn('w-full ml-[-5px]', isCollapsed ? 'justify-center' : 'justify-start') }
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
              sideOffset={ 8 }
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
    </div>
  );
}

export default function Marketplace() {
  const [filters, setFilters] = React.useState<FiltersState>(DEFAULT_FILTERS);
  const [pendingFilters, setPendingFilters] = React.useState<FiltersState>(DEFAULT_FILTERS);
  const [searchValue, setSearchValue] = React.useState('');
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const applyFilters = React.useCallback((updates: Partial<FiltersState>) => {
    setPendingFilters((prev) => {
      const next: FiltersState = {
        ...prev,
        ...updates,
        q: normalizeFilterValue(updates.q ?? prev.q),
        region: normalizeFilterValue(updates.region ?? prev.region),
        city: normalizeFilterValue(updates.city ?? prev.city),
        barangay: normalizeFilterValue(updates.barangay ?? prev.barangay),
        amenities: normalizeAmenityValues(updates.amenities ?? prev.amenities),
        amenitiesMode: updates.amenitiesMode ?? prev.amenitiesMode,
        amenitiesNegate: updates.amenitiesNegate ?? prev.amenitiesNegate,
      };

      if (areFiltersEqual(prev, next)) {
        return prev;
      }

      return next;
    });
  }, []);
  const isMobile = useIsMobile();
  const { session, } = useSession();
  const router = useRouter();
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

  const handleSearchSubmit = React.useCallback(
    (value?: string) => {
      const nextValue = typeof value === 'string' ? value : searchValue;
      const normalized = normalizeFilterValue(nextValue);
      const nextFilters = {
        ...pendingFilters,
        q: normalized,
      };

      setSearchValue(normalized);
      setPendingFilters((prev) => (areFiltersEqual(prev, nextFilters) ? prev : nextFilters));
      setFilters((prev) => (areFiltersEqual(prev, nextFilters) ? prev : nextFilters));
      setIsSearchOpen(false);
    },
    [pendingFilters, searchValue]
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
  const hasLocationFilters = Boolean(filters.region || filters.city || filters.barangay);
  const hasAmenityFilters = filters.amenities.length > 0;
  const hasAnyFilters = hasLocationFilters || hasAmenityFilters;
  const pendingHasLocationFilters = Boolean(pendingFilters.region || pendingFilters.city || pendingFilters.barangay);
  const pendingHasAmenityFilters = pendingFilters.amenities.length > 0;
  const pendingHasAnyFilters = pendingHasLocationFilters || pendingHasAmenityFilters;
  const shouldShowResultsHeader = hasActiveSearch || hasAnyFilters;
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
  const profileHandleLabel = userProfile?.handle ?? undefined;
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

  const content = (
    <section className="relative mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
      <div className="space-y-6">
        { shouldShowResultsHeader && (
          <h2 className="text-2xl font-semibold text-foreground">Search Results</h2>
        ) }
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
        hasAnyFilters={ pendingHasAnyFilters }
        filters={ pendingFilters }
        onFiltersApply={ applyFilters }
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
              userEmail={ userEmail }
              onNavigate={ handleNavigation }
              onLogout={ handleLogout }
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
  hasAnyFilters: boolean
  filters: FiltersState
  onOpenChange: (open: boolean) => void
  onSearchChange: (value: string) => void
  onSearchSubmit: (value?: string) => void
  onFiltersApply: (updates: Partial<FiltersState>) => void
};

function MarketplaceSearchDialog({
  open,
  onOpenChange,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  hasActiveSearch,
  hasAnyFilters,
  filters,
  onFiltersApply,
}: MarketplaceSearchDialogProps) {
  const trimmedValue = searchValue.trim();
  const debouncedQuery = useDebouncedValue(trimmedValue, 200);
  const isMobile = useIsMobile();
  const shouldFetchSuggestions = debouncedQuery.length >= 2;
  const [isFilterDialogOpen, setIsFilterDialogOpen] = React.useState(false);
  const searchDialogOpen = open && !isFilterDialogOpen;

  React.useEffect(() => {
    if (!open) {
      setIsFilterDialogOpen(false);
    }
  }, [open]);

  const handleSearchDialogOpenChange = React.useCallback((next: boolean) => {
    if (isFilterDialogOpen && !next) {
      setIsFilterDialogOpen(false);
    }

    onOpenChange(next);
  }, [isFilterDialogOpen, onOpenChange]);

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
  const handleAmenityRemove = React.useCallback((name: string) => {
    const next = filters.amenities.filter((value) => value !== name);
    onFiltersApply({
      amenities: next,
      amenitiesMode: next.length ? filters.amenitiesMode : 'any',
      amenitiesNegate: next.length ? filters.amenitiesNegate : false,
    });
  }, [filters.amenities, filters.amenitiesMode, filters.amenitiesNegate, onFiltersApply]);

  return (
    <>
      <CommandDialog
        open={ searchDialogOpen }
        onOpenChange={ handleSearchDialogOpenChange }
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
          { hasAnyFilters && (
            <CommandGroup heading="Filters">
              <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
                { filters.region && (
                  <FilterBadge
                    label={ `Region: ${filters.region}` }
                    onClear={ () => onFiltersApply({
                      region: '',
                      city: '',
                      barangay: '',
                    }) }
                  />
                ) }
                { filters.city && (
                  <FilterBadge
                    label={ `City: ${filters.city}` }
                    onClear={ () => onFiltersApply({
                      city: '',
                      barangay: '',
                    }) }
                  />
                ) }
                { filters.barangay && (
                  <FilterBadge
                    label={ `Barangay: ${filters.barangay}` }
                    onClear={ () => onFiltersApply({ barangay: '', }) }
                  />
                ) }
                { filters.amenities.map((amenity) => (
                  <FilterBadge
                    key={ `amenity-${amenity}` }
                    label={ filters.amenitiesNegate ? `Exclude: ${amenity}` : `Amenity: ${amenity}` }
                    onClear={ () => handleAmenityRemove(amenity) }
                    variant={ filters.amenitiesNegate ? 'destructive' : 'default' }
                  />
                )) }
              </div>
            </CommandGroup>
          ) }

          <CommandGroup heading="Actions">
            <CommandItem
              value="apply filters"
              onSelect={ () => setIsFilterDialogOpen(true) }
            >
              <CgOptions className="size-4" aria-hidden="true" />
              <span>Apply filters</span>
              { hasAnyFilters && (
                <Badge variant="secondary" className="ml-auto">
                  Active
                </Badge>
              ) }
            </CommandItem>
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
            { hasAnyFilters && (
              <CommandItem
                value="clear filters"
                onSelect={ () => onFiltersApply({
                  region: '',
                  city: '',
                  barangay: '',
                  amenities: [],
                  amenitiesMode: 'any',
                  amenitiesNegate: false,
                }) }
              >
                <FiX className="size-4" aria-hidden="true" />
                <span>Clear filters</span>
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
      <LocationFilterDialog
        open={ isFilterDialogOpen }
        onOpenChange={ setIsFilterDialogOpen }
        filters={ filters }
        onApply={ (nextFilters) => {
          onFiltersApply(nextFilters);
          setIsFilterDialogOpen(false);
        } }
      />
    </>
  );
}

type LocationFilterDialogProps = {
  open: boolean
  filters: FiltersState
  onApply: (filters: Partial<FiltersState>) => void
  onOpenChange: (open: boolean) => void
};

type AmenityChoice = {
  id: string;
  name: string;
  category: string | null;
  identifier: string | null;
};

function LocationFilterDialog({
  open,
  filters,
  onApply,
  onOpenChange,
}: LocationFilterDialogProps) {
  const [draftRegion, setDraftRegion] = React.useState(filters.region);
  const [draftCity, setDraftCity] = React.useState(filters.city);
  const [draftBarangay, setDraftBarangay] = React.useState(filters.barangay);
  const [draftAmenities, setDraftAmenities] = React.useState<string[]>(filters.amenities);
  const [amenitiesSearch, setAmenitiesSearch] = React.useState('');
  const [amenitiesMode, setAmenitiesMode] = React.useState<FiltersState['amenitiesMode']>(filters.amenitiesMode);
  const [amenitiesNegate, setAmenitiesNegate] = React.useState(filters.amenitiesNegate);
  const isMobile = useIsMobile();

  React.useEffect(() => {
    if (open) {
      setDraftRegion(filters.region);
      setDraftCity(filters.city);
      setDraftBarangay(filters.barangay);
      setDraftAmenities(filters.amenities);
      setAmenitiesMode(filters.amenitiesMode);
      setAmenitiesNegate(filters.amenitiesNegate);
      setAmenitiesSearch('');
    }
  }, [filters.amenities, filters.amenitiesMode, filters.amenitiesNegate, filters.barangay, filters.city, filters.region, open]);

  React.useEffect(() => {
    if (draftAmenities.length === 0 && amenitiesNegate) {
      setAmenitiesNegate(false);
    }
  }, [amenitiesNegate, draftAmenities.length]);

  const {
    data: regionOptions = [],
    isLoading: isRegionsLoading,
    isError: isRegionsError,
  } = useQuery<PhilippineRegionOption[]>({
    queryKey: ['philippines', 'regions'],
    queryFn: fetchPhilippineRegions,
    enabled: open,
    staleTime: 1000 * 60 * 30,
  });

  const selectedRegion = React.useMemo(
    () => regionOptions.find((region) => region.name === draftRegion) ?? null,
    [draftRegion, regionOptions]
  );
  const regionCodeForQuery = selectedRegion?.code;

  const {
    data: cityOptions = [],
    isLoading: isCitiesLoading,
    isError: isCitiesError,
  } = useQuery<PhilippineCityOption[]>({
    queryKey: ['philippines', 'cities', regionCodeForQuery],
    queryFn: () => {
      if (!regionCodeForQuery) {
        return Promise.resolve<PhilippineCityOption[]>([]);
      }

      return fetchPhilippineCitiesByRegion(regionCodeForQuery);
    },
    enabled: open && Boolean(regionCodeForQuery),
    staleTime: 1000 * 60 * 30,
  });

  const dedupedCityOptions = React.useMemo(() => dedupeAddressOptions(cityOptions), [cityOptions]);
  const selectedCity = React.useMemo(
    () => dedupedCityOptions.find((city) => city.name === draftCity) ?? null,
    [dedupedCityOptions, draftCity]
  );
  const cityCodeForQuery = selectedCity?.code;

  const {
    data: barangayOptions = [],
    isLoading: isBarangaysLoading,
    isError: isBarangaysError,
  } = useQuery<PhilippineBarangayOption[]>({
    queryKey: ['philippines', 'barangays', cityCodeForQuery],
    queryFn: () => {
      if (!cityCodeForQuery) {
        return Promise.resolve<PhilippineBarangayOption[]>([]);
      }

      return fetchPhilippineBarangaysByCity(cityCodeForQuery);
    },
    enabled: open && Boolean(cityCodeForQuery),
    staleTime: 1000 * 60 * 30,
  });

  const dedupedBarangayOptions = React.useMemo(
    () => dedupeAddressOptions(barangayOptions),
    [barangayOptions]
  );

  const {
    data: amenityChoices = [],
    isLoading: isAmenitiesLoading,
    isError: isAmenitiesError,
    refetch: refetchAmenities,
  } = useQuery<AmenityChoice[]>({
    queryKey: ['amenity-choices'],
    queryFn: async () => {
      const response = await fetch('/api/v1/amenities/choices');
      if (!response.ok) {
        throw new Error('Failed to fetch amenity choices');
      }

      const payload = (await response.json()) as { data: AmenityChoice[]; };
      return payload.data;
    },
    staleTime: 1000 * 60 * 10,
    enabled: open,
  });

  const groupedAmenities = React.useMemo(() => {
    if (!amenityChoices.length) return [];

    const grouped = new Map<string, AmenityChoice[]>();
    for (const amenity of amenityChoices) {
      const key = amenity.category ?? 'others';
      const group = grouped.get(key) ?? [];
      group.push(amenity);
      grouped.set(key, group);
    }

    const ordered: { key: string; label: string; amenities: AmenityChoice[]; }[] = [];
    for (const key of ORDERED_AMENITY_CATEGORIES) {
      if (!grouped.has(key)) continue;
      ordered.push({
        key,
        label: AMENITY_CATEGORY_DISPLAY_MAP[key] ?? key,
        amenities: grouped.get(key)?.slice() ?? [],
      });
      grouped.delete(key);
    }

    for (const [key, amenitiesForKey] of grouped.entries()) {
      ordered.push({
        key,
        label: AMENITY_CATEGORY_DISPLAY_MAP[key] ?? key,
        amenities: amenitiesForKey.slice(),
      });
    }

    return ordered;
  }, [amenityChoices]);

  const normalizedAmenitySearch = amenitiesSearch.trim().toLowerCase();
  const filteredAmenityGroups = React.useMemo(() => {
    if (!normalizedAmenitySearch) return groupedAmenities;

    return groupedAmenities
      .map((group) => ({
        ...group,
        amenities: group.amenities.filter((amenity) =>
          amenity.name.toLowerCase().includes(normalizedAmenitySearch)
        ),
      }))
      .filter((group) => group.amenities.length > 0);
  }, [groupedAmenities, normalizedAmenitySearch]);

  const selectedAmenities = React.useMemo(
    () => normalizeAmenityValues(draftAmenities),
    [draftAmenities]
  );

  const regionDisabled = isRegionsLoading;
  const cityDisabled = !selectedRegion || isCitiesLoading;
  const barangayDisabled =
    !selectedCity || isBarangaysLoading || dedupedBarangayOptions.length === 0;

  const handleAmenityToggle = (amenityName: string) => {
    setDraftAmenities((prev) => {
      const normalized = normalizeFilterValue(amenityName);
      if (!normalized) return prev;

      if (prev.includes(normalized)) {
        return prev.filter((value) => value !== normalized);
      }

      return [...prev, normalized];
    });
  };

  const handleAmenityRemove = (amenityName: string) => {
    setDraftAmenities((prev) => prev.filter((value) => value !== amenityName));
  };

  const handleApplyFilters = () => {
    onApply({
      region: draftRegion,
      city: draftCity,
      barangay: draftBarangay,
      amenities: selectedAmenities,
      amenitiesMode: selectedAmenities.length > 0 ? amenitiesMode : 'any',
      amenitiesNegate: selectedAmenities.length > 0 ? amenitiesNegate : false,
    });
  };

  return (
    <Dialog open={ open } onOpenChange={ onOpenChange }>
      <DialogContent
        className={ cn(
          'space-y-8 pb-0',
          !isMobile && 'sm:max-w-[720px]'
        ) }
        position={ isMobile ? 'top' : 'center' }
        mobileFullScreen={ isMobile }
        fullWidth={ isMobile }
      >
        <DialogHeader>
          <DialogTitle>Advanced Filters</DialogTitle>
          <DialogDescription>Filter spaces by location, price, ratings, and amenities.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="marketplace-filter-region">Region / State</Label>
            <Select
              value={ draftRegion }
              onValueChange={ (value) => {
                setDraftRegion(value);
                setDraftCity('');
                setDraftBarangay('');
              } }
              disabled={ regionDisabled }
            >
              <SelectTrigger
                id="marketplace-filter-region"
                aria-label="Select region or state"
                className="w-full"
              >
                <SelectValue placeholder={ isRegionsLoading ? 'Loading regions...' : 'Select region / state' } />
              </SelectTrigger>
              <SelectContent side="bottom" align="start" avoidCollisions={ false }>
                { isRegionsError && (
                  <SelectItem value="regions-error" disabled>
                    Unable to load regions
                  </SelectItem>
                ) }
                { regionOptions.map((region) => (
                  <SelectItem key={ region.code } value={ region.name }>
                    { region.name }
                  </SelectItem>
                )) }
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="marketplace-filter-city">City</Label>
            <Select
              value={ draftCity }
              onValueChange={ (value) => {
                setDraftCity(value);
                setDraftBarangay('');
              } }
              disabled={ cityDisabled }
            >
              <SelectTrigger
                id="marketplace-filter-city"
                aria-label="Select city"
                className="w-full"
              >
                <SelectValue placeholder={ isCitiesLoading ? 'Loading cities...' : 'Select city' } />
              </SelectTrigger>
              <SelectContent side="bottom" align="start" avoidCollisions={ false }>
                { isCitiesError && (
                  <SelectItem value="cities-error" disabled>
                    Unable to load cities
                  </SelectItem>
                ) }
                { dedupedCityOptions.map((city) => (
                  <SelectItem key={ `${city.code}-${city.name}` } value={ city.name }>
                    { city.name }
                  </SelectItem>
                )) }
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="marketplace-filter-barangay">Barangay</Label>
            <Select
              value={ draftBarangay }
              onValueChange={ (value) => setDraftBarangay(value) }
              disabled={ barangayDisabled }
            >
              <SelectTrigger
                id="marketplace-filter-barangay"
                aria-label="Select barangay"
                className="w-full"
              >
                <SelectValue
                  placeholder={
                    !selectedCity
                      ? 'Select a city first'
                      : isBarangaysLoading
                        ? 'Loading barangays...'
                        : dedupedBarangayOptions.length === 0
                          ? 'No barangays available'
                          : 'Select barangay'
                  }
                />
              </SelectTrigger>
              <SelectContent side="bottom" align="start" avoidCollisions={ false }>
                { isBarangaysError && (
                  <SelectItem value="barangays-error" disabled>
                    Unable to load barangays
                  </SelectItem>
                ) }
                { dedupedBarangayOptions.map((barangay) => (
                  <SelectItem key={ `${barangay.code}-${barangay.name}` } value={ barangay.name }>
                    { barangay.name }
                  </SelectItem>
                )) }
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3 mt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Label htmlFor="amenities-search-input">Amenities</Label>
              <p className="text-sm text-muted-foreground">
                Search and select amenities to refine results. Click an amenity to add or remove it.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2">
                <div className="flex flex-col">
                  <Label htmlFor="amenities-match-toggle">
                    { amenitiesMode === 'any' ? 'Any' : 'All' }
                  </Label>
                </div>
                <Switch
                  id="amenities-match-toggle"
                  checked={ amenitiesMode === 'any' }
                  onCheckedChange={ (checked) => setAmenitiesMode(checked ? 'any' : 'all') }
                  disabled={ amenitiesNegate }
                  aria-label={ `Match ${amenitiesMode === 'any' ? 'any' : 'all'} amenities` }
                />
              </div>
              <div className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2">
                <div className="flex flex-col">
                  <Label htmlFor="amenities-negate-toggle">
                    { amenitiesNegate ? 'Exclude' : 'Include' }
                  </Label>
                </div>
                <Switch
                  id="amenities-negate-toggle"
                  checked={ amenitiesNegate }
                  onCheckedChange={ setAmenitiesNegate }
                  disabled={ selectedAmenities.length === 0 }
                  aria-label={ amenitiesNegate ? 'Exclude selected amenities' : 'Include selected amenities' }
                />
              </div>
            </div>
          </div>

          <div className="relative">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="amenities-search-input"
              placeholder="Search amenities (click results to add)"
              value={ amenitiesSearch }
              onChange={ (event) => setAmenitiesSearch(event.target.value) }
              aria-label="Search amenities to filter"
              className="pl-9"
            />
          </div>

          { selectedAmenities.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/30 px-3 py-2">
              { selectedAmenities.map((amenity) => (
                <FilterBadge
                  key={ `selected-${amenity}` }
                  label={ amenitiesNegate ? `Exclude: ${amenity}` : amenity }
                  onClear={ () => handleAmenityRemove(amenity) }
                  variant={ amenitiesNegate ? 'destructive' : 'default' }
                />
              )) }
            </div>
          ) }

          <div className="rounded-lg border border-border/60 bg-muted/20">
            <ScrollArea className="h-[320px] w-full px-1">
              <div className="space-y-5 p-3">
                { isAmenitiesLoading ? (
                  <div className="space-y-4" role="status" aria-label="Loading amenities">
                    <span className="sr-only">Loading amenities</span>
                    { Array.from({ length: 2, }).map((_, index) => (
                      <div key={ index } className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          { Array.from({ length: 4, }).map((_, cardIndex) => (
                            <div
                              key={ `${index}-${cardIndex}` }
                              className="rounded-md border border-border/60 bg-background/60 p-3"
                            >
                              <div className="flex items-center gap-3">
                                <Skeleton className="size-8 rounded-md" />
                                <div className="space-y-2">
                                  <Skeleton className="h-4 w-28" />
                                  <Skeleton className="h-3 w-16" />
                                </div>
                              </div>
                            </div>
                          )) }
                        </div>
                      </div>
                    )) }
                  </div>
                ) : isAmenitiesError ? (
                  <div className="flex items-center justify-between rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <span>Unable to load amenities.</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive underline"
                      onClick={ () => refetchAmenities() }
                    >
                      Retry
                    </Button>
                  </div>
                ) : filteredAmenityGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    { normalizedAmenitySearch
                      ? 'No amenities match your search.'
                      : 'No amenities available yet.' }
                  </p>
                ) : (
                  filteredAmenityGroups.map((group) => (
                    <section key={ group.key } className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">{ group.label }</h3>
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                          { group.amenities.length } option{ group.amenities.length === 1 ? '' : 's' }
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        { group.amenities.map((amenity) => {
                          const Icon = amenity.identifier
                            ? AMENITY_ICON_MAPPINGS[amenity.identifier] ?? FiList
                            : FiList;
                          const isSelected = selectedAmenities.includes(amenity.name);

                          return (
                            <button
                              key={ amenity.id }
                              type="button"
                              onClick={ () => handleAmenityToggle(amenity.name) }
                              className={ cn(
                                'flex items-center gap-3 rounded-md border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                                isSelected
                                  ? amenitiesNegate
                                    ? 'border-destructive/60 bg-destructive/10 text-destructive shadow-sm hover:border-destructive/80'
                                    : 'border-primary bg-primary/5 text-foreground shadow-sm hover:border-primary/70'
                                  : 'border-border/60 bg-background/60 hover:border-primary/60'
                              ) }
                              aria-pressed={ isSelected }
                              aria-label={ `${isSelected ? 'Remove' : 'Add'} amenity ${amenity.name}` }
                            >
                              <Icon className="size-4 text-foreground" aria-hidden="true" />
                              <span className="flex-1 text-sm font-medium text-foreground">
                                { amenity.name }
                              </span>
                              { isSelected && (
                                <Badge
                                  variant={ amenitiesNegate ? 'destructive' : 'secondary' }
                                  className="shrink-0"
                                >
                                  Selected
                                </Badge>
                              ) }
                            </button>
                          );
                        }) }
                      </div>
                    </section>
                  ))
                ) }
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={ () => onOpenChange(false) }
          >
            Cancel
          </Button>
          <Button type="button" variant="default" onClick={ handleApplyFilters }>
            Apply filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterBadge({
  label,
  onClear,
  variant = 'default',
}: {
  label: string
  onClear: () => void
  variant?: 'default' | 'destructive'
}) {
  return (
    <button
      type="button"
      onClick={ (event) => {
        event.preventDefault();
        event.stopPropagation();
        onClear();
      } }
      className={ cn(
        'flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        variant === 'destructive'
          ? 'border border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20'
          : 'bg-secondary text-foreground hover:bg-secondary/80'
      ) }
      aria-label={ `Clear ${label}` }
    >
      <span className="truncate">{ label }</span>
      <FiX className="size-3" aria-hidden="true" />
    </button>
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
