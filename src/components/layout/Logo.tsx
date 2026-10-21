import { cn } from '@/lib/utils'

/** Same artwork as public/logo.svg (the PWA icon), so the brand mark matches the installed app. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5 font-semibold tracking-tight', className)}>
      <svg viewBox="0 0 512 512" className="size-8 shrink-0" aria-hidden>
        <rect width="512" height="512" rx="112" fill="#6250d6" />
        <g fill="none" stroke="#fff" strokeLinecap="round">
          <rect x="104" y="120" width="304" height="256" rx="44" strokeWidth="32" />
          <circle cx="256" cy="248" r="62" strokeWidth="28" />
          <path d="M160 376v28M352 376v28" strokeWidth="32" />
        </g>
        <circle cx="256" cy="248" r="16" fill="#fff" />
      </svg>
      Finance Vault
    </span>
  )
}
