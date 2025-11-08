'use client';

import {
  LuChartBar,
  LuClipboardList,
  LuLayers,
  LuLifeBuoy,
  LuSparkles
} from 'react-icons/lu';

import NavBar, { type NavItem } from '@/components/ui/navbar';

const menuItems: NavItem[] = [
  {
    href: '/spaces#overview',
    label: 'Overview',
    icon: LuSparkles,
  },
  {
    href: '/spaces#actions',
    label: 'Actions',
    icon: LuClipboardList,
  },
  {
    href: '/spaces#portfolio',
    label: 'Portfolio',
    icon: LuLayers,
  },
  {
    href: '/spaces#tasks',
    label: 'Tasks',
    icon: LuChartBar,
  },
  {
    href: '/spaces#support',
    label: 'Support',
    icon: LuLifeBuoy,
  }
];

export function SpacesNavBar() {
  return <NavBar menuItems={menuItems} />;
}
