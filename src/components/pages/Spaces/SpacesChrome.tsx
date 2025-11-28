'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiMessageSquare, FiSearch, FiX } from 'react-icons/fi';

import { MarketplaceChrome } from '../Marketplace/MarketplaceChrome';

import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import {
  ResponsiveCommandDialog as CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';

type SpacesChromeProps = {
  children: React.ReactNode
  initialSidebarOpen?: boolean
};

export function SpacesChrome({
  children,
  initialSidebarOpen,
}: SpacesChromeProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const router = useRouter();

  const handleSearchOpen = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setIsSearchOpen(open);
    if (!open) {
      setSearchValue('');
    }
  }, []);

  const handleSearchSubmit = useCallback(() => {
    const normalized = searchValue.trim();
    const target = normalized ? `/marketplace?q=${encodeURIComponent(normalized)}` : '/marketplace';
    router.push(target);
    setIsSearchOpen(false);
  }, [router, searchValue]);

  const messageSidebarItem = useMemo(() => (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip="Messages">
        <Link href="/spaces/messages">
          <FiMessageSquare className="size-4" aria-hidden="true" />
          <span data-sidebar-label>Messages</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  ), []);

  return (
    <MarketplaceChrome
      initialSidebarOpen={ initialSidebarOpen }
      onSearchOpen={ handleSearchOpen }
      sidebarExtras={ messageSidebarItem }
      dialogSlot={ (
        <CommandDialog
          open={ isSearchOpen }
          onOpenChange={ handleDialogOpenChange }
          title="Search spaces"
          description="Search the UpSpace marketplace"
          position="top"
        >
          <CommandInput
            value={ searchValue }
            onValueChange={ setSearchValue }
            placeholder="Search Spaces..."
            aria-label="Search spaces"
            onKeyDown={ (event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSearchSubmit();
              }
            } }
          />
          <CommandList>
            <CommandGroup heading="Actions" forceMount>
              <CommandItem
                value="search marketplace"
                onSelect={ () => handleSearchSubmit() }
              >
                <FiSearch className="size-4" aria-hidden="true" />
                <span>Search marketplace</span>
                { searchValue.trim() ? (
                  <span className="truncate text-muted-foreground">
                    &quot;{ searchValue.trim() }&quot;
                  </span>
                ) : null }
                <Kbd className="ml-auto flex items-center gap-1 text-[10px]">
                  Enter
                </Kbd>
              </CommandItem>
              { searchValue.trim() && (
                <CommandItem
                  value="clear search"
                  onSelect={ () => setSearchValue('') }
                >
                  <FiX className="size-4" aria-hidden="true" />
                  <span>Clear search</span>
                </CommandItem>
              ) }
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      ) }
    >
      { children }
    </MarketplaceChrome>
  );
}
