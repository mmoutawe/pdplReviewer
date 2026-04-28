import { type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Shell from './Shell'
import { ToastStack } from './overlays'

const SHELL_LESS = ['/sign-in', '/external/']

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const noShell = SHELL_LESS.some((p) => pathname.startsWith(p))

  return (
    <>
      {noShell ? <>{children}</> : <Shell>{children}</Shell>}
      <ToastStack />
    </>
  )
}
