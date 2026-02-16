'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiSearch, FiX } from 'react-icons/fi';

import {
  ResponsiveCommandDialog as CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import { VoiceSearchButton } from '@/components/ui/voice-search-button';
import { VoiceSearchDialog } from '@/components/ui/voice-search-dialog';
import { useMarketplaceChromeSlot } from '@/components/pages/Marketplace/MarketplaceChromeProvider';

type SpaceDetailShellProps = {
  children: React.ReactNode
};

export function SpaceDetailShell({ children, }: SpaceDetailShellProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const router = useRouter();
  const [isVoiceSearchOpen, setIsVoiceSearchOpen] = useState(false);

  const handleSearchOpen = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setIsSearchOpen(open);
    if (!open) {
      setSearchValue('');
    }
  }, []);

  const handleSearchSubmit = useCallback((value?: string) => {
    const normalized = (value ?? searchValue).trim();
    const target = normalized ? `/marketplace?q=${encodeURIComponent(normalized)}` : '/marketplace';
    router.push(target);
    setIsSearchOpen(false);
  }, [router, searchValue]);

  const handleVoiceSearchSubmit = useCallback((value: string) => {
    setSearchValue(value);
    handleSearchSubmit(value);
    setIsVoiceSearchOpen(false);
  }, [handleSearchSubmit]);

  const handleVoiceButtonClick = useCallback(() => {
    handleDialogOpenChange(false);
    setIsVoiceSearchOpen(true);
  }, [handleDialogOpenChange]);

  const dialogSlot = useMemo(
    () => (
      <>
        <CommandDialog
          open={ isSearchOpen }
          onOpenChange={ handleDialogOpenChange }
          title="Search spaces"
          description="Search the UpSpace marketplace"
          position="top"
          fullWidth
          className="[&_[data-slot=command-item][data-selected=true]]:bg-transparent [&_[data-slot=command-item][data-selected=true]:hover]:bg-accent"
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
            endAdornment={ (
              <VoiceSearchButton onClick={ handleVoiceButtonClick } />
            ) }
          />
          <CommandList>
            <CommandGroup heading="Actions">
              <CommandItem
                value="search marketplace"
                onSelect={ () => handleSearchSubmit() }
                className="group hover:text-white data-[selected=true]:text-white"
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
        <VoiceSearchDialog
          open={ isVoiceSearchOpen }
          onOpenChange={ setIsVoiceSearchOpen }
          onSubmit={ handleVoiceSearchSubmit }
        />
      </>
    ),
    [
      handleDialogOpenChange,
      handleSearchSubmit,
      handleVoiceButtonClick,
      handleVoiceSearchSubmit,
      isSearchOpen,
      isVoiceSearchOpen,
      searchValue
    ]
  );

  useMarketplaceChromeSlot({
    dialogSlot,
    onSearchOpen: handleSearchOpen,
  });

  return <>{ children }</>;
}
