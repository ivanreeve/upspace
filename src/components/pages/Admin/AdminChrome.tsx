'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
CheckCircle,
DollarSign,
Layers,
Users,
X
} from 'lucide-react';
import { FiAlertCircle, FiFlag, FiTrendingUp } from 'react-icons/fi';

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

const marketplaceSearchDialogClassName =
  '[&_[data-slot=command-item][data-selected=true]]:bg-transparent [&_[data-slot=command-item][data-selected=true]:hover]:bg-accent';

const marketplaceSearchActionItemClassName =
  'text-muted-foreground hover:!bg-[oklch(0.955_0.02_204.6929)] dark:hover:!bg-[oklch(0.24_0.02_204.6929)] hover:!text-primary hover:[&_svg]:!text-primary data-[selected=true]:!bg-[oklch(0.955_0.02_204.6929)] dark:data-[selected=true]:!bg-[oklch(0.24_0.02_204.6929)] data-[selected=true]:!text-foreground';

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
            className={ marketplaceSearchDialogClassName }
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
                  onSelect={ () => handleNavigate('/admin/verification-queue') }
                  className={ marketplaceSearchActionItemClassName }
                >
                  <CheckCircle className="size-4" aria-hidden="true" />
                  <span>Pending Verifications</span>
                  <Kbd className="ml-auto flex items-center gap-1 text-[10px] bg-primary border-primary text-primary-foreground dark:bg-muted/70 dark:border-border dark:text-muted-foreground">
                    Enter
                  </Kbd>
                </CommandItem>
                <CommandItem
                  value="reports"
                  onSelect={ () => handleNavigate('/admin/reports') }
                  className={ marketplaceSearchActionItemClassName }
                >
                  <FiTrendingUp className="size-4" aria-hidden="true" />
                  <span>Reports</span>
                </CommandItem>
                <CommandItem
                  value="payout requests"
                  onSelect={ () => handleNavigate('/admin/payout-requests') }
                  className={ marketplaceSearchActionItemClassName }
                >
                  <DollarSign className="size-4" aria-hidden="true" />
                  <span>Payout requests</span>
                </CommandItem>
                <CommandItem
                  value="users"
                  onSelect={ () => handleNavigate('/admin/users') }
                  className={ marketplaceSearchActionItemClassName }
                >
                  <Users className="size-4" aria-hidden="true" />
                  <span>Users</span>
                </CommandItem>
                <CommandItem
                  value="spaces"
                  onSelect={ () => handleNavigate('/admin/spaces') }
                  className={ marketplaceSearchActionItemClassName }
                >
                  <Layers className="size-4" aria-hidden="true" />
                  <span>Spaces</span>
                </CommandItem>
                <CommandItem
                  value="chat reports"
                  onSelect={ () => handleNavigate('/admin/chat-reports') }
                  className={ marketplaceSearchActionItemClassName }
                >
                  <FiFlag className="size-4" aria-hidden="true" />
                  <span>Chat reports</span>
                </CommandItem>
                <CommandItem
                  value="complaints"
                  onSelect={ () => handleNavigate('/admin/complaints') }
                  className={ marketplaceSearchActionItemClassName }
                >
                  <FiAlertCircle className="size-4" aria-hidden="true" />
                  <span>Complaints</span>
                </CommandItem>
                { searchValue.trim() && (
                  <CommandItem
                    value="clear search"
                    onSelect={ () => setSearchValue('') }
                    className={ marketplaceSearchActionItemClassName }
                  >
                    <X className="size-4" aria-hidden="true" />
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
