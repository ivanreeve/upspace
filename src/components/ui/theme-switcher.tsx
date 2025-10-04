'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { Switch } from '@/components/ui/switch'
import { RiSunLine, RiMoonLine } from 'react-icons/ri'

export function ModeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const isDark = (theme === 'dark') || (resolvedTheme === 'dark')

  const handleToggle = (value: boolean) => {
    setTheme(value ? 'dark' : 'light')
  }

  return (
    <div className="flex items-center space-x-2">
      <RiSunLine className="size-5 text-yellow-500" />
      <Switch checked={isDark} onCheckedChange={handleToggle} />
      <RiMoonLine className="size-5 text-blue-500" />
    </div>
  )
}
