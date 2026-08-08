import type { ReactNode } from 'react';

/**
 * The cream tab bar from the design reference.
 *
 * Chat and Cart are live. Orders arrives in F4 — shown disabled rather than hidden so
 * the chrome does not shift once it works.
 */
export type Tab = 'chat' | 'cart' | 'orders' | 'settings';

// React 19 dropped the global JSX namespace; ReactNode covers what we store here.
const TABS: { id: Tab; label: string; icon: ReactNode; ready: boolean }[] = [
  {
    id: 'chat',
    label: 'Chat',
    ready: true,
    icon: <path d="M4 5h16v10H9l-5 4V5z" fill="currentColor" />,
  },
  {
    id: 'cart',
    label: 'Cart',
    ready: true,
    icon: (
      <path
        d="M4 6h16l-1.5 9h-13L4 6zm3 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"
        fill="currentColor"
      />
    ),
  },
  {
    id: 'orders',
    label: 'Orders',
    ready: false,
    icon: (
      <path
        d="M5 4h14v16H5V4zm3 4h8v1.6H8V8zm0 4h8v1.6H8V12zm0 4h5v1.6H8V16z"
        fill="currentColor"
      />
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    ready: false,
    icon: (
      <path
        d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5zm8-.5-1.6-2.8-2.2.6-1.9-1.1L14 2h-4l-.3 2.7-1.9 1.1-2.2-.6L4 8l1.7 1.8v2.4L4 14l1.6 2.8 2.2-.6 1.9 1.1L10 20h4l.3-2.7 1.9-1.1 2.2.6L20 14l-1.7-1.8V9.8L20 8z"
        fill="currentColor"
      />
    ),
  },
];

export function BottomNav({
  active,
  cartCount = 0,
  onSelect,
}: {
  active: Tab;
  cartCount?: number;
  onSelect?: (tab: Tab) => void;
}) {
  return (
    <nav
      className="flex items-center justify-around bg-[var(--color-cream)] px-2 pt-2"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            disabled={!tab.ready}
            onClick={() => tab.ready && onSelect?.(tab.id)}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'relative grid h-11 w-11 place-items-center rounded-full transition',
              isActive
                ? 'bg-[var(--color-orange)] text-white shadow-md'
                : 'text-[var(--color-ink)]/35',
              !tab.ready && 'opacity-40',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
              {tab.icon}
            </svg>

            {/* Cart count, so the basket is visible even with a sheet closed. */}
            {tab.id === 'cart' && cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--color-brand)] px-1 text-[9px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
