interface LogoProps { size?: 'sm' | 'md' | 'lg'; collapsed?: boolean }

export default function Logo({ size = 'md', collapsed = false }: LogoProps) {
  const sz = size === 'sm' ? 24 : size === 'md' ? 28 : 36
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexShrink: 0, textDecoration: 'none' }}>
      <svg width={sz} height={sz} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="var(--brand-700)" />
        <path d="M9 9h8a5 5 0 010 10H9V9z" fill="white" fillOpacity=".9" />
        <rect x="9" y="20" width="5" height="4" rx="1" fill="white" fillOpacity=".6" />
        <circle cx="22" cy="21" r="3.5" fill="white" fillOpacity=".25" stroke="white" strokeWidth="1.5" />
        <path d="M20.8 21l.8.8 1.8-1.8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!collapsed && (
        <span style={{
          fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: size === 'sm' ? 13 : size === 'md' ? 15 : 18,
          color: 'var(--ink-900)', letterSpacing: '-0.01em', lineHeight: 1, whiteSpace: 'nowrap',
        }}>
          PDPL<span style={{ color: 'var(--brand-700)', marginLeft: 2 }}>Reviewer</span>
        </span>
      )}
    </span>
  )
}
