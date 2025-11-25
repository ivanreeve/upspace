'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiSearch, FiX } from 'react-icons/fi';

import { MarketplaceChrome } from '../MarketplaceChrome';

import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';

type SpaceDetailShellProps = {
  children: React.ReactNode
  initialSidebarOpen?: boolean
};

export function SpaceDetailShell({
  children,
  initialSidebarOpen,
}: SpaceDetailShellProps) {
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

  return (
    <MarketplaceChrome
      initialSidebarOpen={ initialSidebarOpen }
      onSearchOpen={ handleSearchOpen }
      dialogSlot={ (
        <CommandDialog
          open={ isSearchOpen }
          onOpenChange={ handleDialogOpenChange }
          title="Search spaces"
          description="Search the UpSpace marketplace"
          position="top"
          mobileFullScreen
          fullWidth
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
            <CommandGroup heading="Actions">
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
