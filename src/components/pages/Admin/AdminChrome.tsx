'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiCheckCircle, FiX } from 'react-icons/fi';

import { MarketplaceChrome } from '../Marketplace/MarketplaceChrome';

import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';

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

  const verificationSidebarItem = (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip="Verification queue">
        <Link href="/admin">
          <FiCheckCircle className="size-4" strokeWidth={ 1.4 } />
          <span data-sidebar-label>Verification Queue</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <MarketplaceChrome
      initialSidebarOpen={ initialSidebarOpen }
      onSearchOpen={ handleSearchOpen }
      dialogSlot={ (
        <CommandDialog
          open={ isSearchOpen }
          onOpenChange={ handleDialogOpenChange }
          title="Admin actions"
          description="Navigate admin features"
          position="top"
          mobileFullScreen
          fullWidth
        >
          <CommandInput
            value={ searchValue }
            onValueChange={ setSearchValue }
            placeholder="Search admin..."
            aria-label="Search admin"
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
      sidebarHeaderExtras={ verificationSidebarItem }
    >
      { children }
    </MarketplaceChrome>
  );
}
