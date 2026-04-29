import { type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Shell from './Shell'
import { ToastStack } from './overlays'

const SHELL_LESS = ['/sign-in', '/forgot-password', '/auth/', '/external/']

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const noShell = SHELL_LESS.some((p) => pathname.startsWith(p))

  return (
    <>
      {/* Skip-to-content for keyboard / screen reader users */}
      <a
        href="#main-content"
        style={{
          position: 'absolute', top: -40, left: 8, zIndex: 9999,
          padding: '8px 14px', borderRadius: 'var(--r-md)',
          background: 'var(--brand-700)', color: '#fff',
          fontSize: 13, fontWeight: 600, textDecoration: 'none',
          transition: 'top 0.1s',
        }}
        onFocus={(e) => { e.currentTarget.style.top = '8px' }}
        onBlur={(e) => { e.currentTarget.style.top = '-40px' }}
      >
        Skip to main content
      </a>
      {noShell ? <>{children}</> : <Shell>{children}</Shell>}
      <ToastStack />
    </>
  )
}
