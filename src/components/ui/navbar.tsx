"use client";

import Link from "next/link";
import * as React from "react";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

export type NavBarProps = React.HTMLAttributes<HTMLElement>;

export default function NavBar({ className = "", ...props }: NavBarProps) {
  return (
    <nav
      aria-label="Main"
      className={[
        "sticky top-0 z-50 w-full",
        "bg-background text-foreground border-b border-border",
        "backdrop-blur",
        className,
      ].join(" ")}
      {...props}
    >
      <div className="mx-auto w-full max-w-screen-2xl px-4">
        <div className="flex h-14 items-center">
          <NavigationMenu className="ml-auto">
            <NavigationMenuList className="justify-end gap-1">
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <Link href="/" className={navigationMenuTriggerStyle()}>
                    Home
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <Link
                    href="/#features"
                    className={navigationMenuTriggerStyle()}
                  >
                    Features
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <Link href="/#faqs" className={navigationMenuTriggerStyle()}>
                    FAQs
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
      </div>
    </nav>
  );
}
