'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
FiCheckCircle,
FiLayers,
FiUsers,
FiX
} from 'react-icons/fi';

import { MarketplaceChrome } from '../Marketplace/MarketplaceChrome';

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

type AdminChromeProps = {
  children: React.ReactNode
  initialSidebarOpen?: boolean
};

export function AdminChrome({
  children,
  initialSidebarOpen,
}: AdminChromeProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isVoiceSearchOpen, setIsVoiceSearchOpen] = useState(false);
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

  const handleNavigate = useCallback((path: string) => {
    router.push(path);
    setIsSearchOpen(false);
  }, [router]);

  const handleVoiceSearchSubmit = useCallback((value: string) => {
    setSearchValue(value);
    setIsVoiceSearchOpen(false);
  }, []);

  const handleVoiceButtonClick = useCallback(() => {
    handleDialogOpenChange(false);
    setIsVoiceSearchOpen(true);
  }, [handleDialogOpenChange]);

  return (
    <MarketplaceChrome
      initialSidebarOpen={ initialSidebarOpen }
      onSearchOpen={ handleSearchOpen }
      dialogSlot={ (
        <>
          <CommandDialog
            open={ isSearchOpen }
            onOpenChange={ handleDialogOpenChange }
            title="Admin actions"
            description="Navigate admin features"
            position="top"
            fullWidth
        >
          <CommandInput
            value={ searchValue }
            onValueChange={ setSearchValue }
            placeholder="Search admin..."
            aria-label="Search admin"
            endAdornment={ (
              <VoiceSearchButton onClick={ handleVoiceButtonClick } />
            ) }
          />
          <CommandList>
          <CommandGroup heading="Quick Actions" forceMount>
            <CommandItem
              value="pending verifications"
              onSelect={ () => handleNavigate('/admin') }
            >
              <FiCheckCircle className="size-4" aria-hidden="true" />
              <span>Pending Verifications</span>
              <Kbd className="ml-auto flex items-center gap-1 text-[10px]">
                Enter
              </Kbd>
            </CommandItem>
            <CommandItem value="users" onSelect={ () => handleNavigate('/admin/users') }>
              <FiUsers className="size-4" aria-hidden="true" />
              <span>Users</span>
            </CommandItem>
            <CommandItem value="spaces" onSelect={ () => handleNavigate('/admin/spaces') }>
              <FiLayers className="size-4" aria-hidden="true" />
              <span>Spaces</span>
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
      ) }
    >
      { children }
    </MarketplaceChrome>
  );
}
