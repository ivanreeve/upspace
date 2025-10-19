'use client'

import { useEffect } from 'react'
import { ApiReferenceReact, type AnyApiReferenceConfiguration } from '@scalar/api-reference-react'
import '@scalar/api-reference-react/style.css'

type ScalarApiReferenceProps = { spec: Record<string, unknown> }

export default function ScalarApiReference({ spec }: ScalarApiReferenceProps) {
  useEffect(() => {
    document.body.classList.add('scrollbar-hidden')
    document.documentElement.classList.add('scrollbar-hidden')
    return () => {
      document.body.classList.remove('scrollbar-hidden')
      document.documentElement.classList.remove('scrollbar-hidden')
    }
  }, [])

  const configuration = { content: spec } satisfies AnyApiReferenceConfiguration
  return <ApiReferenceReact configuration={configuration} />
}
