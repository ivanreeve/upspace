'use client';

import React from 'react';

import { MarketplaceChrome } from './MarketplaceChrome';

type MarketplaceChromeContextValue = {
  setDialogSlot: (slot: React.ReactNode | null) => void;
  setOnSearchOpen: (handler?: () => void) => void;
};

const MarketplaceChromeContext = React.createContext<MarketplaceChromeContextValue | null>(null);

type MarketplaceChromeProviderProps = {
  children: React.ReactNode;
  initialSidebarOpen?: boolean;
};

export function MarketplaceChromeProvider({
  children,
  initialSidebarOpen,
}: MarketplaceChromeProviderProps) {
  const [dialogSlot, setDialogSlotState] = React.useState<React.ReactNode | null>(null);
  const [onSearchOpen, setOnSearchOpenState] = React.useState<(() => void) | undefined>(undefined);

  const setDialogSlot = React.useCallback((slot: React.ReactNode | null) => {
    setDialogSlotState(() => slot);
  }, []);

  const setOnSearchOpen = React.useCallback((handler?: () => void) => {
    if (!handler) {
      setOnSearchOpenState(undefined);
      return;
    }

    setOnSearchOpenState(() => handler);
  }, []);

  const contextValue = React.useMemo(
    () => ({ setDialogSlot, setOnSearchOpen }),
    [setDialogSlot, setOnSearchOpen]
  );

  return (
    <MarketplaceChrome
      initialSidebarOpen={ initialSidebarOpen }
      dialogSlot={ dialogSlot ?? undefined }
      onSearchOpen={ onSearchOpen }
    >
      <MarketplaceChromeContext.Provider value={ contextValue }>
        { children }
      </MarketplaceChromeContext.Provider>
    </MarketplaceChrome>
  );
}

type MarketplaceChromeSlotOptions = {
  dialogSlot: React.ReactNode | null;
  onSearchOpen: () => void;
};

export function useMarketplaceChromeSlot({
  dialogSlot,
  onSearchOpen,
}: MarketplaceChromeSlotOptions) {
  const context = React.useContext(MarketplaceChromeContext);

  React.useEffect(() => {
    if (!context) return;

    context.setDialogSlot(dialogSlot);
    context.setOnSearchOpen(onSearchOpen);

    return () => {
      context.setDialogSlot(null);
      context.setOnSearchOpen(undefined);
    };
  }, [context, dialogSlot, onSearchOpen]);
}
