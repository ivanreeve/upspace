'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

// By using React.ComponentProps, we can safely and accurately infer the props type
// from the NextThemesProvider component itself, without relying on internal module paths.
type NextThemesProviderProps = React.ComponentProps<typeof NextThemesProvider>;

/**
 * A client-side component that wraps the application with the NextThemesProvider.
 * This is necessary for the useTheme hook to function correctly throughout the app.
 */
export function ThemeProvider({
 children, ...props 
}: NextThemesProviderProps) {
  return <NextThemesProvider { ...props }>{ children }</NextThemesProvider>;
}
